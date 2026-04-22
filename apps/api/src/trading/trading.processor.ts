import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TRADING_QUEUE } from './trading.service';
import { MarketService } from '../market/market.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { calculateIndicatorSnapshot } from '@crypto-trader/analysis';
import {
  SandboxOrderExecutor,
  LiveOrderExecutor,
  PositionManager,
  calculateTradeQuantity,
} from '@crypto-trader/trading-engine';

import {
  Decision,
  TradingMode,
  TradeType,
  NotificationType,
} from '@crypto-trader/shared';
import { SUPPORTED_PAIRS, TRADE_FEE_PCT } from '@crypto-trader/shared';
import { decrypt } from '../users/utils/encryption.util';
import type { AgentHealthReport } from '../agents/agent-config-resolver.service';

interface AgentJobData {
  userId: string;
  configId: string;
}

@Processor(TRADING_QUEUE)
export class TradingProcessor {
  private readonly logger = new Logger(TradingProcessor.name);
  private readonly positionManager = new PositionManager();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly marketService: MarketService,
    private readonly orchestratorService: OrchestratorService,
    private readonly agentConfigResolver: AgentConfigResolverService,
  ) {}

  @Process('run-cycle')
  async runCycle(job: Job<AgentJobData>) {
    const { userId, configId } = job.data;
    this.logger.log(
      `Running agent cycle for user=${userId} config=${configId}`,
    );

    try {
      // 1. Load config
      const config = await this.prisma.tradingConfig.findFirst({
        where: { id: configId, userId, isRunning: true },
      });
      if (!config) {
        this.logger.warn(`Config ${configId} not running — skipping cycle`);
        return;
      }

      const pair = SUPPORTED_PAIRS.find(
        (p) => p.asset === config.asset && p.quote === config.pair,
      );
      if (!pair)
        throw new Error(`Unsupported pair: ${config.asset}/${config.pair}`);

      // 2. Decrypt Binance credentials
      const isTestnetMode = config.mode === TradingMode.TESTNET;
      const isLiveMode = config.mode === TradingMode.LIVE;

      // Guard: TESTNET mode requires testnet credentials
      if (isTestnetMode) {
        const testnetCreds = await this.prisma.binanceCredential.findUnique({
          where: { userId_isTestnet: { userId, isTestnet: true } },
        });
        if (!testnetCreds) {
          this.logger.warn(
            `No testnet credentials for user ${userId} — pausing agent`,
          );
          await this.prisma.tradingConfig.update({
            where: { id: configId },
            data: { isRunning: false },
          });
          await this.notificationsService.create(
            userId,
            NotificationType.AGENT_ERROR,
            JSON.stringify({ key: 'agentNoTestnetKeys' }),
          );
          return;
        }
      }

      const binanceCreds =
        isLiveMode || isTestnetMode
          ? await this.prisma.binanceCredential.findUnique({
              where: { userId_isTestnet: { userId, isTestnet: isTestnetMode } },
            })
          : null;

      let binanceApiKey: string | undefined;
      let binanceSecret: string | undefined;
      if (binanceCreds && (isLiveMode || isTestnetMode)) {
        binanceApiKey = decrypt(
          binanceCreds.apiKeyEncrypted,
          binanceCreds.apiKeyIv,
        );
        binanceSecret = decrypt(
          binanceCreds.secretEncrypted,
          binanceCreds.secretIv,
        );
      }

      // 3. Verify LLM health — agent-aware check (Spec 38, Fix P2)
      const healthReport: AgentHealthReport =
        await this.agentConfigResolver.checkHealth(userId);
      if (!healthReport.healthy) {
        const unhealthy = healthReport.agents
          .filter((a) => !a.healthy)
          .map((a) => a.agentId)
          .join(', ');
        this.logger.warn(
          `Agent config health check failed for user ${userId} — unhealthy agents: ${unhealthy} — pausing`,
        );
        await this.prisma.tradingConfig.update({
          where: { id: configId },
          data: { isRunning: false },
        });
        await this.notificationsService.create(
          userId,
          NotificationType.AGENT_ERROR,
          JSON.stringify({ key: 'agentNoLLM' }),
        );
        return;
      }

      // 4. Fetch candles
      // Klines is a PUBLIC endpoint — no auth or testnet URL needed.
      // Using api.binance.com (production) regardless of agent mode avoids
      // rate-limit issues on testnet.binance.vision (shared, unreliable server).
      // Testnet only differs for authenticated calls (orders, account balance).
      const publicKlineClient = new BinanceRestClient({ testnet: false });
      const candles = await publicKlineClient.getKlines(pair.symbol, '1h', 200);

      // For SANDBOX & TESTNET: derive market price from the last candle's close.
      // Klines come from api.binance.com (production) regardless of mode, so the
      // close price is accurate. This eliminates getTickerPrice() REST calls:
      //   - SANDBOX: avoids unauthenticated public API call
      //   - TESTNET: avoids calling testnet.binance.vision (unreliable, aggressive rate limits)
      // LIVE keeps using real-time ticker for maximum price accuracy.
      const cachedMarketPrice: number | undefined =
        (config.mode === TradingMode.SANDBOX ||
          config.mode === TradingMode.TESTNET) &&
        candles.length > 0
          ? candles[candles.length - 1].close
          : undefined;

      // 5. Build indicator snapshot
      const indicatorSnapshot = calculateIndicatorSnapshot(candles);

      // 6. Load news analysis from DB (AI if within 12h, else keyword-based)
      //    Respects botEnabled: if disabled, bot runs without news context
      const AI_VALID_MS = 12 * 60 * 60 * 1000;
      const newsConfig = await this.marketService.getNewsConfig(userId);
      const dbAnalysis = newsConfig.botEnabled
        ? await this.marketService.getLatestAnalysis(userId)
        : null;

      let newsItems: Array<{
        id: string;
        source: string;
        headline: string;
        sentiment: string;
        summary?: string | null;
        author?: string | null;
        publishedAt: Date | string;
      }> = [];

      if (dbAnalysis) {
        const hasRecentAI =
          dbAnalysis.aiAnalyzedAt &&
          Date.now() - new Date(dbAnalysis.aiAnalyzedAt).getTime() <
            AI_VALID_MS;

        if (hasRecentAI && dbAnalysis.aiHeadlines) {
          // Merge AI overrides into headlines
          const aiMap = new Map(
            (
              dbAnalysis.aiHeadlines as Array<{
                id: string;
                sentiment: string;
                reasoning: string;
              }>
            ).map((a) => [a.id, a]),
          );
          newsItems = (
            dbAnalysis.headlines as Array<{
              id: string;
              source: string;
              headline: string;
              sentiment: string;
              summary?: string | null;
              author?: string | null;
              publishedAt: string;
            }>
          ).map((h) => ({
            ...h,
            sentiment: aiMap.get(h.id)?.sentiment ?? h.sentiment,
          }));
        } else {
          // Use keyword-based headlines from DB
          newsItems = dbAnalysis.headlines as typeof newsItems;
        }
      } else if (newsConfig.botEnabled) {
        // No DB analysis yet but bot is enabled — run one now
        const freshAnalysis =
          await this.marketService.runKeywordAnalysis(userId);
        newsItems = freshAnalysis.headlines as typeof newsItems;
      }
      // else: botEnabled = false → newsItems stays empty []

      // 7. Load recent trades
      const recentDbTrades = await this.prisma.trade.findMany({
        where: { userId },
        orderBy: { executedAt: 'desc' },
        take: 10,
        include: { position: { select: { asset: true, pair: true } } },
      });
      const recentTrades = recentDbTrades.map((t) => ({
        id: t.id,
        userId: t.userId,
        positionId: t.positionId,
        type: t.type as TradeType,
        price: t.price,
        quantity: t.quantity,
        fee: t.fee,
        executedAt: t.executedAt,
        mode: t.mode as TradingMode,
        binanceOrderId: t.binanceOrderId ?? undefined,
      }));

      // 7b. Load recent agent decisions for this config
      const recentDbDecisions = await this.prisma.agentDecision.findMany({
        where: { userId, configId: config.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          decision: true,
          confidence: true,
          reasoning: true,
          createdAt: true,
        },
      });
      const recentDecisions = recentDbDecisions.map((d) => ({
        decision: d.decision as string,
        confidence: d.confidence,
        reasoning: d.reasoning,
        createdAt: d.createdAt.toISOString(),
      }));

      // 8. Call OrchestratorService (uses AgentConfigResolver for model selection)
      const orchestratedDecision =
        await this.orchestratorService.orchestrateDecision(
          userId,
          configId,
          indicatorSnapshot,
          newsItems.map((n) => ({
            headline: n.headline,
            sentiment: n.sentiment,
            summary: n.summary ?? null,
          })),
          undefined,
        );
      // Adapt DecisionPayload to the shape expected by the rest of the processor
      const decision = {
        decision: orchestratedDecision.decision as Decision,
        confidence: orchestratedDecision.confidence,
        reasoning: orchestratedDecision.reasoning,
        suggestedWaitMinutes: orchestratedDecision.waitMinutes,
        orchestrated: orchestratedDecision.orchestrated,
        subAgentResults: orchestratedDecision.subAgentResults,
      };

      // Compute effective wait: AGENT mode respects LLM suggestion, CUSTOM mode uses user config.
      const effectiveWaitMinutes =
        config.intervalMode === 'CUSTOM'
          ? config.minIntervalMinutes
          : decision.suggestedWaitMinutes;

      // 9. Save decision
      const savedDecision = await this.prisma.agentDecision.create({
        data: {
          userId,
          asset: config.asset,
          pair: config.pair,
          decision: decision.decision as any,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          indicators: indicatorSnapshot as any,
          newsHeadlines: newsItems.slice(0, 5).map((n) => ({
            headline: n.headline,
            sentiment: n.sentiment,
            summary: n.summary ?? null,
            author: n.author ?? null,
            source: n.source,
          })) as any,
          waitMinutes: effectiveWaitMinutes,
          configId: config.id,
          configName: config.name || undefined,
          mode: config.mode as any,
          metadata: {
            orchestrated: decision.orchestrated,
            subAgentResults: decision.subAgentResults,
          } as any,
        },
      });

      // Emit decision to WebSocket
      this.gateway.emitToUser(userId, 'agent:decision', savedDecision);

      // 10. Execute based on LLM decision
      const confidencePct = decision.confidence * 100;

      if (
        decision.decision === Decision.BUY &&
        confidencePct >= config.buyThreshold
      ) {
        try {
          await this.executeBuy(
            userId,
            config,
            pair.symbol,
            config.mode as TradingMode,
            binanceApiKey,
            binanceSecret,
            cachedMarketPrice,
          );
        } catch (orderErr) {
          const axiosData = (orderErr as any)?.response?.data;
          const binanceDetail = axiosData
            ? ` [Binance ${axiosData.code}: ${axiosData.msg}]`
            : '';
          const orderMsg =
            (orderErr instanceof Error ? orderErr.message : String(orderErr)) +
            binanceDetail;
          this.logger.warn(
            `BUY order failed for config ${configId} — skipping cycle: ${orderMsg}`,
          );
          await this.notificationsService
            .create(
              userId,
              NotificationType.AGENT_ERROR,
              JSON.stringify({
                key: 'orderError',
                message: `BUY failed: ${orderMsg.slice(0, 180)}`,
              }),
            )
            .catch(() => null);
        }
      }

      if (
        decision.decision === Decision.SELL &&
        confidencePct >= config.sellThreshold
      ) {
        try {
          await this.executeLLMSell(
            userId,
            config,
            pair.symbol,
            config.mode as TradingMode,
            binanceApiKey,
            binanceSecret,
            cachedMarketPrice,
          );
        } catch (orderErr) {
          const axiosData = (orderErr as any)?.response?.data;
          const binanceDetail = axiosData
            ? ` [Binance ${axiosData.code}: ${axiosData.msg}]`
            : '';
          const orderMsg =
            (orderErr instanceof Error ? orderErr.message : String(orderErr)) +
            binanceDetail;
          this.logger.warn(
            `SELL order failed for config ${configId} — skipping cycle: ${orderMsg}`,
          );
          await this.notificationsService
            .create(
              userId,
              NotificationType.AGENT_ERROR,
              JSON.stringify({
                key: 'orderError',
                message: `SELL failed: ${orderMsg.slice(0, 180)}`,
              }),
            )
            .catch(() => null);
        }
      }

      // 11. Check stop-loss / take-profit on remaining open positions
      await this.checkOpenPositions(
        userId,
        config,
        pair.symbol,
        config.mode as TradingMode,
        binanceApiKey,
        binanceSecret,
        cachedMarketPrice,
      );

      // 12. Schedule next cycle — uses the same effectiveWaitMinutes computed above.
      const delay = effectiveWaitMinutes * 60 * 1000;

      // Re-queue only if still running.
      // NOTE: We intentionally omit jobId here. Using the same static jobId while
      // the current job is still active causes Bull to return the existing active job
      // instead of creating a new delayed one, silently stopping the agent.
      const currentConfig = await this.prisma.tradingConfig.findUnique({
        where: { id: configId },
        select: { isRunning: true },
      });
      if (currentConfig?.isRunning) {
        await job.queue.add(
          'run-cycle',
          { userId, configId },
          { delay, removeOnComplete: true },
        );
        this.logger.log(
          `Next cycle for config ${configId} in ${effectiveWaitMinutes}min`,
        );
      }
    } catch (err) {
      // Extract Binance-specific error detail from Axios response body
      const httpStatus = (err as any)?.response?.status as number | undefined;
      const axiosData = (err as any)?.response?.data;
      const binanceDetail =
        axiosData?.code && axiosData?.msg
          ? ` [Binance ${axiosData.code}: ${axiosData.msg}]`
          : '';
      const message =
        (err instanceof Error ? err.message : String(err)) + binanceDetail;

      // 429 = Binance rate-limit: transient error — do NOT stop the agent.
      // Use the Retry-After header if present.
      // Fallback: 70s (just past the 60s window reset) for testnet; 10 min for live.
      if (httpStatus === 429) {
        const retryAfterHeader = (err as any)?.response?.headers?.[
          'retry-after'
        ];
        const configMode = await this.prisma.tradingConfig
          .findUnique({ where: { id: configId }, select: { mode: true } })
          .then((c) => c?.mode ?? null)
          .catch(() => null);
        const isTestnet = configMode === 'TESTNET';
        const fallbackSeconds = isTestnet ? 70 : 600;
        const retryAfterSeconds = retryAfterHeader
          ? Math.max(parseInt(String(retryAfterHeader), 10), 60)
          : fallbackSeconds;
        const retryDelay = retryAfterSeconds * 1000;
        const retryMinutes = Math.ceil(retryAfterSeconds / 60);
        this.logger.warn(
          `Rate-limited by Binance for user=${userId}. Retrying in ${retryMinutes} min (Retry-After: ${retryAfterHeader ?? 'not provided'}).`,
        );
        const stillRunning = await this.prisma.tradingConfig
          .findUnique({ where: { id: configId }, select: { isRunning: true } })
          .catch(() => null);
        if (stillRunning?.isRunning) {
          await job.queue
            .add(
              'run-cycle',
              { userId, configId },
              { delay: retryDelay, removeOnComplete: true },
            )
            .catch(() => null);
        }
        await this.notificationsService
          .create(
            userId,
            NotificationType.AGENT_ERROR,
            JSON.stringify({
              key: 'agentRateLimit',
              retryMinutes: String(retryMinutes),
            }),
          )
          .catch(() => null);
        return;
      }

      // Network errors: transient — do NOT stop the agent, retry in 5 min.
      const networkErrorCodes = [
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
      ];
      const errCode = (err as NodeJS.ErrnoException)?.code ?? '';
      if (networkErrorCodes.includes(errCode)) {
        const retryMinutes = 5;
        const retryDelay = retryMinutes * 60 * 1000;
        this.logger.warn(
          `Network error for user=${userId} (${errCode}). Retrying in ${retryMinutes} min.`,
        );
        const stillRunning = await this.prisma.tradingConfig
          .findUnique({ where: { id: configId }, select: { isRunning: true } })
          .catch(() => null);
        if (stillRunning?.isRunning) {
          await job.queue
            .add(
              'run-cycle',
              { userId, configId },
              { delay: retryDelay, removeOnComplete: true },
            )
            .catch(() => null);
        }
        await this.notificationsService
          .create(
            userId,
            NotificationType.AGENT_ERROR,
            JSON.stringify({
              key: 'agentNetworkError',
              retryMinutes: String(retryMinutes),
            }),
          )
          .catch(() => null);
        return;
      }

      // LLM provider errors (rate-limit, server errors, timeouts)
      // These are transient — retry instead of stopping the agent.
      const isLlmError =
        message.includes('Request failed with status code 429') ||
        message.includes('Request failed with status code 451') ||
        message.includes('Request failed with status code 500') ||
        message.includes('Request failed with status code 502') ||
        message.includes('Request failed with status code 503') ||
        message.includes('Request failed with status code 529') ||
        message.includes('rate limit') ||
        message.includes('Rate limit') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('timeout') ||
        message.includes('ETIMEDOUT');

      if (isLlmError) {
        const retryMinutes = 10;
        const retryDelay = retryMinutes * 60 * 1000;
        this.logger.warn(
          `LLM error for user=${userId} config=${configId}. Retrying in ${retryMinutes} min: ${message.slice(0, 150)}`,
        );
        const stillRunning = await this.prisma.tradingConfig
          .findUnique({
            where: { id: configId },
            select: { isRunning: true },
          })
          .catch(() => null);
        if (stillRunning?.isRunning) {
          await job.queue
            .add(
              'run-cycle',
              { userId, configId },
              { delay: retryDelay, removeOnComplete: true },
            )
            .catch(() => null);
        }
        await this.notificationsService
          .create(
            userId,
            NotificationType.AGENT_ERROR,
            JSON.stringify({
              key: 'agentLlmError',
              retryMinutes: String(retryMinutes),
            }),
          )
          .catch(() => null);
        return;
      }

      this.logger.error(`Agent cycle error for user=${userId}: ${message}`);
      await this.prisma.tradingConfig
        .update({
          where: { id: configId },
          data: { isRunning: false },
        })
        .catch(() => null);
      await this.notificationsService
        .create(
          userId,
          NotificationType.AGENT_ERROR,
          JSON.stringify({ key: 'agentError', message: message.slice(0, 200) }),
        )
        .catch(() => null);
    }
  }

  private async executeBuy(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    apiKey?: string,
    apiSecret?: string,
    cachedPrice?: number,
  ) {
    const openCount = await this.prisma.position.count({
      where: { userId, status: 'OPEN', asset: config.asset, mode: config.mode },
    });
    if (openCount >= config.maxConcurrentPositions) {
      this.logger.log(`Max positions reached for user ${userId}`);
      return;
    }

    // ── SANDBOX: use persisted DB balance ────────────────────────────────────
    if (mode === TradingMode.SANDBOX) {
      const marketPrice =
        cachedPrice ?? (await new BinanceRestClient({}).getTickerPrice(symbol));
      // Apply order price offset (e.g., -0.01 = simulate buying 1% below market)
      const offsetPct: number = config.orderPriceOffsetPct ?? 0;
      const livePrice = marketPrice * (1 + offsetPct);

      // Upsert wallet row (first-time init at 10,000)
      const wallet = await this.prisma.sandboxWallet.upsert({
        where: { userId_currency: { userId, currency: config.pair as any } },
        create: { userId, currency: config.pair as any, balance: 10_000 },
        update: {},
      });

      const quantity = calculateTradeQuantity(
        wallet.balance,
        livePrice,
        config.maxTradePct,
      );
      if (quantity <= 0) return;

      const cost = livePrice * quantity;
      const fee = cost * TRADE_FEE_PCT;
      const total = cost + fee;
      if (wallet.balance < total) return;

      // Deduct from wallet
      await this.prisma.sandboxWallet.update({
        where: { userId_currency: { userId, currency: config.pair as any } },
        data: { balance: wallet.balance - total },
      });

      const positionData = this.positionManager.openPosition({
        userId,
        configId: config.id,
        asset: config.asset,
        pair: config.pair,
        mode,
        entryPrice: livePrice,
        quantity,
      });

      const savedPosition = await this.prisma.position.create({
        data: positionData as any,
      });

      await this.prisma.trade.create({
        data: {
          userId,
          positionId: savedPosition.id,
          type: TradeType.BUY,
          price: livePrice,
          quantity,
          fee,
          mode,
          binanceOrderId: `sandbox-${Date.now()}`,
        },
      });

      await this.notificationsService.create(
        userId,
        NotificationType.TRADE_EXECUTED,
        JSON.stringify({
          key: 'tradeBuy',
          qty: quantity.toString(),
          asset: config.asset,
          price: livePrice.toFixed(2),
          mode,
        }),
      );
      this.gateway.emitToUser(userId, 'trade:executed', {
        position: savedPosition,
      });
      this.gateway.emitToUser(userId, 'wallet:updated', {
        currency: config.pair,
        balance: wallet.balance - total,
      });
      return;
    }

    // ── LIVE or TESTNET: use real Binance (prod or testnet) ──────────────────
    const executor = new LiveOrderExecutor(
      new BinanceRestClient({
        apiKey,
        apiSecret,
        testnet: mode === TradingMode.TESTNET,
      }),
    );
    // TESTNET: use cached kline-close price to avoid calling testnet.binance.vision
    // (unreliable, aggressive rate limits). LIVE: always fetch real-time price.
    const currentPrice = cachedPrice ?? (await executor.getPrice(symbol));
    // Apply offset to the reference price used for quantity calculation
    const liveOffsetPct: number = config.orderPriceOffsetPct ?? 0;
    const referencePrice = currentPrice * (1 + liveOffsetPct);
    const quoteBalance = await executor.getBalance(config.pair);
    const quantity = calculateTradeQuantity(
      quoteBalance.free,
      referencePrice,
      config.maxTradePct,
    );
    if (quantity <= 0) return;

    const order = await executor.placeMarketOrder(
      symbol,
      TradeType.BUY,
      quantity,
    );

    const positionData = this.positionManager.openPosition({
      userId,
      configId: config.id,
      asset: config.asset,
      pair: config.pair,
      mode,
      entryPrice: order.price,
      quantity: order.quantity,
    });

    const savedPosition = await this.prisma.position.create({
      data: positionData as any,
    });

    await this.prisma.trade.create({
      data: {
        userId,
        positionId: savedPosition.id,
        type: TradeType.BUY,
        price: order.price,
        quantity: order.quantity,
        fee: order.price * order.quantity * TRADE_FEE_PCT,
        mode,
        binanceOrderId: order.orderId,
      },
    });

    await this.notificationsService.create(
      userId,
      NotificationType.TRADE_EXECUTED,
      JSON.stringify({
        key: 'tradeBuy',
        qty: order.quantity.toString(),
        asset: config.asset,
        price: order.price.toFixed(2),
        mode,
      }),
    );
    this.gateway.emitToUser(userId, 'trade:executed', {
      position: savedPosition,
    });
  }

  private async executeLLMSell(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    apiKey?: string,
    apiSecret?: string,
    cachedPrice?: number,
  ) {
    const openPositions = await this.prisma.position.findMany({
      where: { userId, asset: config.asset, status: 'OPEN', mode },
    });
    if (!openPositions.length) return;

    const executor =
      mode === TradingMode.SANDBOX
        ? new SandboxOrderExecutor()
        : new LiveOrderExecutor(
            new BinanceRestClient({
              apiKey,
              apiSecret,
              testnet: mode === TradingMode.TESTNET,
            }),
          );

    if (mode === TradingMode.SANDBOX) {
      const livePrice =
        cachedPrice ??
        (await new BinanceRestClient({})
          .getTickerPrice(symbol)
          .catch(() => null));
      if (livePrice)
        (executor as SandboxOrderExecutor).setPrice(symbol, livePrice);
      // Seed base-asset balances so the executor won't reject SELL orders.
      // The real balance lives in the DB — the executor is only used for
      // order simulation / price calculation.
      for (const pos of openPositions) {
        const { base } = this.parseSymbolForSandbox(symbol);
        const current = (await executor.getBalance(base)).free;
        (executor as SandboxOrderExecutor).setBalance(
          base,
          current + pos.quantity,
        );
      }
    }

    // TESTNET: prefer cached kline-close price to avoid testnet.binance.vision.
    // LIVE: always fetch real-time price from api.binance.com.
    const currentPrice =
      cachedPrice ?? (await executor.getPrice(symbol).catch(() => null));
    if (!currentPrice) return;

    const minProfitPct: number = config.minProfitPct ?? 0.003;

    for (const pos of openPositions) {
      // Only sell if the position is currently profitable above the minimum threshold
      const profitPct = (currentPrice - pos.entryPrice) / pos.entryPrice;
      if (profitPct < minProfitPct) {
        this.logger.log(
          `LLM SELL skipped for position ${pos.id}: profit ${(profitPct * 100).toFixed(2)}% below minimum ${(minProfitPct * 100).toFixed(2)}%`,
        );
        continue;
      }

      const order = await executor.placeMarketOrder(
        symbol,
        TradeType.SELL,
        pos.quantity,
      );
      const posData = {
        ...pos,
        asset: pos.asset as any,
        pair: pos.pair as any,
        mode: pos.mode as any,
        status: pos.status as any,
        exitPrice: pos.exitPrice ?? undefined,
        exitAt: pos.exitAt ?? undefined,
        pnl: pos.pnl ?? undefined,
      };
      const { position: closedPosition, pnl } =
        this.positionManager.closePosition(posData, order.price);

      await this.prisma.position.update({
        where: { id: pos.id },
        data: {
          exitPrice: closedPosition.exitPrice,
          exitAt: closedPosition.exitAt,
          status: 'CLOSED',
          pnl: closedPosition.pnl,
          fees: closedPosition.fees,
        },
      });

      await this.prisma.trade.create({
        data: {
          userId,
          positionId: pos.id,
          type: TradeType.SELL,
          price: order.price,
          quantity: order.quantity,
          fee: order.price * order.quantity * TRADE_FEE_PCT,
          mode,
          binanceOrderId: order.orderId,
        },
      });

      if (mode === TradingMode.SANDBOX) {
        const proceeds = order.price * order.quantity;
        const fee = proceeds * TRADE_FEE_PCT;
        await this.prisma.sandboxWallet.upsert({
          where: { userId_currency: { userId, currency: pos.pair as any } },
          create: {
            userId,
            currency: pos.pair as any,
            balance: 10_000 + proceeds - fee,
          },
          update: { balance: { increment: proceeds - fee } },
        });
        const updatedWallet = await this.prisma.sandboxWallet.findUnique({
          where: { userId_currency: { userId, currency: pos.pair as any } },
        });
        this.gateway.emitToUser(userId, 'wallet:updated', {
          currency: pos.pair,
          balance: updatedWallet?.balance,
        });
      }

      await this.notificationsService.create(
        userId,
        NotificationType.TRADE_EXECUTED,
        JSON.stringify({
          key: 'tradeSell',
          qty: pos.quantity.toString(),
          asset: config.asset,
          price: order.price.toFixed(2),
          pnl: pnl.toFixed(2),
          mode,
        }),
      );
      this.gateway.emitToUser(userId, 'trade:executed', {
        position: closedPosition,
      });
      this.gateway.emitToUser(userId, 'position:updated', {
        position: closedPosition,
      });
    }
  }

  private async checkOpenPositions(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    apiKey?: string,
    apiSecret?: string,
    cachedPrice?: number,
  ) {
    const openPositions = await this.prisma.position.findMany({
      where: { userId, asset: config.asset, status: 'OPEN', mode },
    });
    if (!openPositions.length) return;

    const executor =
      mode === TradingMode.SANDBOX
        ? new SandboxOrderExecutor()
        : new LiveOrderExecutor(
            new BinanceRestClient({
              apiKey,
              apiSecret,
              testnet: mode === TradingMode.TESTNET,
            }),
          );

    // For SANDBOX: inject real market price from Binance public API (no auth needed)
    if (mode === TradingMode.SANDBOX) {
      const livePrice =
        cachedPrice ??
        (await new BinanceRestClient({})
          .getTickerPrice(symbol)
          .catch(() => null));
      if (livePrice)
        (executor as SandboxOrderExecutor).setPrice(symbol, livePrice);
      // Seed base-asset balances so stop-loss / take-profit SELL orders succeed.
      for (const pos of openPositions) {
        const { base } = this.parseSymbolForSandbox(symbol);
        const current = (await executor.getBalance(base)).free;
        (executor as SandboxOrderExecutor).setBalance(
          base,
          current + pos.quantity,
        );
      }
    }

    // TESTNET: prefer cached kline-close price to avoid testnet.binance.vision.
    // LIVE: always fetch real-time price from api.binance.com.
    const currentPrice =
      cachedPrice ?? (await executor.getPrice(symbol).catch(() => null));
    if (!currentPrice) return;

    for (const pos of openPositions) {
      const posData = {
        ...pos,
        asset: pos.asset as any,
        pair: pos.pair as any,
        mode: pos.mode as any,
        status: pos.status as any,
        exitPrice: pos.exitPrice ?? undefined,
        exitAt: pos.exitAt ?? undefined,
        pnl: pos.pnl ?? undefined,
      };
      const shouldStopLoss = this.positionManager.shouldStopLoss(
        posData,
        currentPrice,
        config.stopLossPct,
      );
      const shouldTakeProfit = this.positionManager.shouldTakeProfit(
        posData,
        currentPrice,
        config.takeProfitPct,
      );

      if (shouldStopLoss || shouldTakeProfit) {
        const order = await executor.placeMarketOrder(
          symbol,
          TradeType.SELL,
          pos.quantity,
        );
        const { position: closedPosition, pnl } =
          this.positionManager.closePosition(posData, order.price);

        await this.prisma.position.update({
          where: { id: pos.id },
          data: {
            exitPrice: closedPosition.exitPrice,
            exitAt: closedPosition.exitAt,
            status: 'CLOSED',
            pnl: closedPosition.pnl,
            fees: closedPosition.fees,
          },
        });

        await this.prisma.trade.create({
          data: {
            userId,
            positionId: pos.id,
            type: TradeType.SELL,
            price: order.price,
            quantity: order.quantity,
            fee: order.price * order.quantity * TRADE_FEE_PCT,
            mode,
            binanceOrderId: order.orderId,
          },
        });

        // ── For SANDBOX: credit proceeds back to wallet ─────────────────────
        if (mode === TradingMode.SANDBOX) {
          const proceeds = order.price * order.quantity;
          const fee = proceeds * TRADE_FEE_PCT;
          await this.prisma.sandboxWallet.upsert({
            where: { userId_currency: { userId, currency: pos.pair as any } },
            create: {
              userId,
              currency: pos.pair as any,
              balance: 10_000 + proceeds - fee,
            },
            update: { balance: { increment: proceeds - fee } },
          });
          const updatedWallet = await this.prisma.sandboxWallet.findUnique({
            where: { userId_currency: { userId, currency: pos.pair as any } },
          });
          this.gateway.emitToUser(userId, 'wallet:updated', {
            currency: pos.pair,
            balance: updatedWallet?.balance,
          });
        }

        const notifType = shouldStopLoss
          ? NotificationType.STOP_LOSS_TRIGGERED
          : NotificationType.TAKE_PROFIT_HIT;

        await this.notificationsService.create(
          userId,
          notifType,
          JSON.stringify({
            key: shouldStopLoss ? 'stopLoss' : 'takeProfit',
            qty: pos.quantity.toString(),
            asset: config.asset,
            price: order.price.toFixed(2),
            pnl: pnl.toFixed(2),
          }),
        );
        this.gateway.emitToUser(userId, 'trade:executed', {
          position: closedPosition,
        });
        this.gateway.emitToUser(userId, 'position:updated', {
          position: closedPosition,
        });
      }
    }
  }

  /** Extract base and quote from a pair symbol (e.g. BTCUSDT → BTC, USDT). */
  private parseSymbolForSandbox(symbol: string): {
    base: string;
    quote: string;
  } {
    for (const quote of ['USDT', 'USDC']) {
      if (symbol.endsWith(quote)) {
        return { base: symbol.slice(0, -quote.length), quote };
      }
    }
    throw new Error(`Cannot parse symbol: ${symbol}`);
  }

  private buildNewsAggregator_unused() {
    // Kept for reference — bot now reads from DB via MarketService
    return null;
  }
}
