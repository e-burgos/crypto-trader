import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TRADING_QUEUE } from './trading.service';
import { MarketService } from '../market/market.service';

import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import { calculateIndicatorSnapshot } from '@crypto-trader/analysis';
import { LLMAnalyzer, createLLMProvider } from '@crypto-trader/analysis';
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
  NewsItem,
} from '@crypto-trader/shared';
import { SUPPORTED_PAIRS } from '@crypto-trader/shared';
import { decrypt } from '../users/utils/encryption.util';

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
      const binanceCreds = await this.prisma.binanceCredential.findUnique({
        where: { userId },
      });

      let binanceApiKey: string | undefined;
      let binanceSecret: string | undefined;
      if (binanceCreds && config.mode === TradingMode.LIVE) {
        binanceApiKey = decrypt(
          binanceCreds.apiKeyEncrypted,
          binanceCreds.apiKeyIv,
        );
        binanceSecret = decrypt(
          binanceCreds.secretEncrypted,
          binanceCreds.secretIv,
        );
      }

      // 3. Decrypt LLM credentials
      const llmCred = await this.prisma.lLMCredential.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!llmCred) {
        this.logger.warn(
          `No LLM credentials for user ${userId} — pausing agent`,
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
      const llmApiKey = decrypt(llmCred.apiKeyEncrypted, llmCred.apiKeyIv);

      // 4. Fetch candles
      const binanceClient = new BinanceRestClient({
        apiKey: binanceApiKey,
        apiSecret: binanceSecret,
      });
      const candles = await binanceClient.getKlines(pair.symbol, '1h', 200);

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

      // 8. Call LLM
      const llmProvider = createLLMProvider(
        llmCred.provider as any,
        llmApiKey,
        llmCred.selectedModel,
      );
      const analyzer = new LLMAnalyzer(llmProvider);
      const decision = await analyzer.analyze({
        asset: config.asset as any,
        pair: config.pair as any,
        indicatorSnapshot,
        recentCandles: candles.slice(-20),
        newsItems: newsItems as unknown as NewsItem[],
        recentTrades,
        userConfig: {
          id: config.id,
          userId: config.userId,
          asset: config.asset as any,
          pair: config.pair as any,
          buyThreshold: config.buyThreshold,
          sellThreshold: config.sellThreshold,
          stopLossPct: config.stopLossPct,
          takeProfitPct: config.takeProfitPct,
          maxTradePct: config.maxTradePct,
          maxConcurrentPositions: config.maxConcurrentPositions,
          minIntervalMinutes: config.minIntervalMinutes,
          mode: config.mode as TradingMode,
          isRunning: config.isRunning,
        },
      });

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
          waitMinutes: decision.suggestedWaitMinutes,
        },
      });

      // Emit decision to WebSocket
      this.gateway.emitToUser(userId, 'agent:decision', savedDecision);

      // 10. Execute BUY if conditions met
      const confidencePct = decision.confidence * 100;
      if (
        decision.decision === Decision.BUY &&
        confidencePct >= config.buyThreshold
      ) {
        await this.executeBuy(
          userId,
          config,
          pair.symbol,
          config.mode as TradingMode,
          binanceApiKey,
          binanceSecret,
        );
      }

      // 11. Check stop-loss / take-profit on open positions
      await this.checkOpenPositions(
        userId,
        config,
        pair.symbol,
        config.mode as TradingMode,
        binanceApiKey,
        binanceSecret,
      );

      // 12. Schedule next cycle
      const waitMinutes = Math.max(
        decision.suggestedWaitMinutes,
        config.minIntervalMinutes,
      );
      const delay = waitMinutes * 60 * 1000;

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
          `Next cycle for config ${configId} in ${waitMinutes}min`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
      const publicClient = new BinanceRestClient({});
      const marketPrice = await publicClient.getTickerPrice(symbol);
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
      const fee = cost * 0.001;
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

    // ── LIVE ─────────────────────────────────────────────────────────────────
    const executor = new LiveOrderExecutor(
      new BinanceRestClient({ apiKey, apiSecret }),
    );
    const currentPrice = await executor.getPrice(symbol);
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
        fee: order.price * order.quantity * 0.001,
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

  private async checkOpenPositions(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    apiKey?: string,
    apiSecret?: string,
  ) {
    const openPositions = await this.prisma.position.findMany({
      where: { userId, asset: config.asset, status: 'OPEN', mode },
    });
    if (!openPositions.length) return;

    const executor =
      mode === TradingMode.SANDBOX
        ? new SandboxOrderExecutor()
        : new LiveOrderExecutor(new BinanceRestClient({ apiKey, apiSecret }));

    // For SANDBOX: inject real market price from Binance public API (no auth needed)
    if (mode === TradingMode.SANDBOX) {
      const publicClient = new BinanceRestClient({});
      const livePrice = await publicClient
        .getTickerPrice(symbol)
        .catch(() => null);
      if (livePrice)
        (executor as SandboxOrderExecutor).setPrice(symbol, livePrice);
    }

    const currentPrice = await executor.getPrice(symbol).catch(() => null);
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
            fee: order.price * order.quantity * 0.001,
            mode,
            binanceOrderId: order.orderId,
          },
        });

        // ── For SANDBOX: credit proceeds back to wallet ─────────────────────
        if (mode === TradingMode.SANDBOX) {
          const proceeds = order.price * order.quantity;
          const fee = proceeds * 0.001;
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

        const reason = shouldStopLoss ? 'Stop-loss' : 'Take-profit';
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

  private buildNewsAggregator_unused() {
    // Kept for reference — bot now reads from DB via MarketService
    return null;
  }
}
