import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { TRADING_QUEUE } from './trading.service';

import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import {
  CryptoPanicFetcher,
  NewsAggregator,
} from '@crypto-trader/data-fetcher';
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

      // 6. Fetch news
      const newsAggregator = await this.buildNewsAggregator(userId);
      const newsItems = await newsAggregator.fetchAll(10);

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
        newsItems,
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
          newsHeadlines: newsItems.slice(0, 5).map((n) => n.headline) as any,
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

      // Re-queue only if still running
      const currentConfig = await this.prisma.tradingConfig.findUnique({
        where: { id: configId },
        select: { isRunning: true },
      });
      if (currentConfig?.isRunning) {
        await job.queue.add(
          'run-cycle',
          { userId, configId },
          {
            jobId: `agent-${userId}-${configId}`,
            delay,
            removeOnComplete: true,
          },
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
      where: { userId, status: 'OPEN', asset: config.asset },
    });
    if (openCount >= config.maxConcurrentPositions) {
      this.logger.log(`Max positions reached for user ${userId}`);
      return;
    }

    const executor =
      mode === TradingMode.SANDBOX
        ? new SandboxOrderExecutor()
        : new LiveOrderExecutor(new BinanceRestClient({ apiKey, apiSecret }));

    const currentPrice = await executor.getPrice(symbol);
    const quoteBalance = await executor.getBalance(config.pair);
    const quantity = calculateTradeQuantity(
      quoteBalance.free,
      currentPrice,
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

  private async buildNewsAggregator(userId: string): Promise<NewsAggregator> {
    const sources = [];
    const newsCred = await this.prisma.newsApiCredential.findFirst({
      where: { userId, provider: 'CRYPTOPANIC', isActive: true },
    });
    if (newsCred) {
      sources.push(
        new CryptoPanicFetcher({
          authToken: decrypt(newsCred.apiKeyEncrypted, newsCred.apiKeyIv),
        }),
      );
    } else if (process.env.CRYPTOPANIC_API_KEY) {
      sources.push(
        new CryptoPanicFetcher({ authToken: process.env.CRYPTOPANIC_API_KEY }),
      );
    }
    // Always add at least the aggregator with no sources (returns empty gracefully)
    return new NewsAggregator(sources, { cacheTtlSeconds: 300 });
  }
}
