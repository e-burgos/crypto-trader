import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateTradingConfigDto,
  UpdateTradingConfigDto,
  StartAgentDto,
} from './dto/trading-config.dto';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import {
  SandboxOrderExecutor,
  LiveOrderExecutor,
  PositionManager,
} from '@crypto-trader/trading-engine';
import {
  TradingMode,
  TradeType,
  NotificationType,
} from '@crypto-trader/shared';
import {
  SUPPORTED_PAIRS,
  TRADE_FEE_PCT,
  MAX_ACTIVE_AGENTS_PER_USER,
} from '@crypto-trader/shared';
import { decrypt } from '../users/utils/encryption.util';

const DEFAULTS = {
  buyThreshold: 70,
  sellThreshold: 70,
  stopLossPct: 0.03,
  takeProfitPct: 0.05,
  minProfitPct: 0.003,
  maxTradePct: 0.05,
  maxConcurrentPositions: 2,
  minIntervalMinutes: 5,
};

export const TRADING_QUEUE = 'trading-agent';

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);
  private readonly positionManager = new PositionManager();

  // Cache for Binance balance to avoid hammering testnet.binance.vision
  // Keyed by `${userId}:${isTestnet}`, TTL = 5 minutes
  private readonly balanceCache = new Map<
    string,
    { data: { currency: string; balance: number }[]; expiresAt: number }
  >();
  private static readonly BALANCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TRADING_QUEUE) private readonly tradingQueue: Queue,
    private readonly gateway: AppGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * On startup: re-queue any configs that were running before the restart.
   * The DB is the source of truth for isRunning; BullMQ jobs are ephemeral.
   * We scan waiting+delayed jobs by configId to avoid duplicates, since
   * re-queued jobs use Bull-generated IDs (no static jobId).
   */
  async onModuleInit() {
    const runningConfigs = await this.prisma.tradingConfig.findMany({
      where: { isRunning: true },
    });

    if (runningConfigs.length === 0) return;

    const [waitingJobs, delayedJobs, activeJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
      this.tradingQueue.getActive(),
    ]);
    const scheduledConfigIds = new Set(
      [...waitingJobs, ...delayedJobs, ...activeJobs].map(
        (j) => j.data?.configId,
      ),
    );

    for (const config of runningConfigs) {
      if (!scheduledConfigIds.has(config.id)) {
        const jobId = `agent-${config.userId}-${config.id}`;
        await this.tradingQueue.add(
          'run-cycle',
          { userId: config.userId, configId: config.id },
          { jobId, removeOnComplete: true },
        );
        this.logger.log(
          `Re-queued agent on startup: user=${config.userId} config=${config.id}`,
        );
      }
    }

    this.logger.log(
      `Startup recovery: checked ${runningConfigs.length} running agent(s)`,
    );
  }

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfigs(userId: string) {
    return this.prisma.tradingConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConfig(userId: string, dto: CreateTradingConfigDto) {
    // Build a comparable snapshot of the incoming config values
    const incoming = {
      asset: dto.asset,
      pair: dto.pair,
      mode: dto.mode,
      buyThreshold: dto.buyThreshold ?? DEFAULTS.buyThreshold,
      sellThreshold: dto.sellThreshold ?? DEFAULTS.sellThreshold,
      stopLossPct: dto.stopLossPct ?? DEFAULTS.stopLossPct,
      takeProfitPct: dto.takeProfitPct ?? DEFAULTS.takeProfitPct,
      maxTradePct: dto.maxTradePct ?? DEFAULTS.maxTradePct,
      maxConcurrentPositions:
        dto.maxConcurrentPositions ?? DEFAULTS.maxConcurrentPositions,
      minIntervalMinutes: dto.minIntervalMinutes ?? DEFAULTS.minIntervalMinutes,
      intervalMode: dto.intervalMode ?? 'AGENT',
      orderPriceOffsetPct: dto.orderPriceOffsetPct ?? 0,
    };

    // Detect configs for the same pair that share identical parameters
    const existing = await this.prisma.tradingConfig.findMany({
      where: { userId, asset: dto.asset as any, pair: dto.pair as any },
    });

    for (const cfg of existing) {
      const isSame =
        cfg.mode === incoming.mode &&
        cfg.buyThreshold === incoming.buyThreshold &&
        cfg.sellThreshold === incoming.sellThreshold &&
        Math.abs(cfg.stopLossPct - incoming.stopLossPct) < 0.0001 &&
        Math.abs(cfg.takeProfitPct - incoming.takeProfitPct) < 0.0001 &&
        Math.abs(cfg.maxTradePct - incoming.maxTradePct) < 0.0001 &&
        cfg.maxConcurrentPositions === incoming.maxConcurrentPositions &&
        cfg.minIntervalMinutes === incoming.minIntervalMinutes &&
        cfg.intervalMode === incoming.intervalMode &&
        Math.abs(cfg.orderPriceOffsetPct - incoming.orderPriceOffsetPct) <
          0.0001;

      if (isSame) {
        throw new BadRequestException(
          `Ya existe una configuración idéntica para ${dto.asset}/${dto.pair}. Cambia al menos un parámetro o asigna un nombre diferente.`,
        );
      }
    }

    return this.prisma.tradingConfig.create({
      data: {
        userId,
        name: dto.name ?? '',
        asset: dto.asset as any,
        pair: dto.pair as any,
        mode: dto.mode as any,
        buyThreshold: incoming.buyThreshold,
        sellThreshold: incoming.sellThreshold,
        stopLossPct: incoming.stopLossPct,
        takeProfitPct: incoming.takeProfitPct,
        minProfitPct: dto.minProfitPct ?? DEFAULTS.minProfitPct,
        maxTradePct: incoming.maxTradePct,
        maxConcurrentPositions: incoming.maxConcurrentPositions,
        minIntervalMinutes: incoming.minIntervalMinutes,
        intervalMode: incoming.intervalMode as any,
        orderPriceOffsetPct: incoming.orderPriceOffsetPct,
      },
    });
  }

  async updateConfig(
    userId: string,
    configId: string,
    dto: UpdateTradingConfigDto,
  ) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { id: configId, userId },
    });
    if (!config) throw new NotFoundException('Trading config not found');

    return this.prisma.tradingConfig.update({
      where: { id: configId },
      data: { ...dto } as any,
    });
  }

  async deleteConfig(userId: string, configId: string) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { id: configId, userId },
    });
    if (!config) throw new NotFoundException('Trading config not found');

    // Stop agent if running before deleting
    if (config.isRunning) {
      await this.stopAgentById(userId, configId);
    }

    await this.prisma.tradingConfig.delete({ where: { id: configId } });
    return { deleted: true, configId };
  }

  // ── Agent lifecycle ───────────────────────────────────────────────────────

  async startAgent(userId: string, dto: StartAgentDto) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { id: dto.configId, userId },
    });
    if (!config) {
      throw new NotFoundException(
        `No trading config found with id ${dto.configId}.`,
      );
    }
    if (config.isRunning) {
      throw new BadRequestException(
        `Agent for config ${dto.configId} is already running`,
      );
    }

    // ── Enforce global active-agent limit per user ───────────────────────
    const activeCount = await this.prisma.tradingConfig.count({
      where: { userId, isRunning: true },
    });
    if (activeCount >= MAX_ACTIVE_AGENTS_PER_USER) {
      throw new BadRequestException(
        `Maximum ${MAX_ACTIVE_AGENTS_PER_USER} active agents allowed. Stop an existing agent before starting a new one.`,
      );
    }

    await this.prisma.tradingConfig.update({
      where: { id: config.id },
      data: { isRunning: true },
    });

    const job = await this.tradingQueue.add(
      'run-cycle',
      { userId, configId: config.id },
      { jobId: `agent-${userId}-${config.id}`, removeOnComplete: true },
    );

    this.logger.log(
      `Agent started for user ${userId}, config ${config.id}, job ${job.id}`,
    );
    return {
      started: true,
      configId: config.id,
      asset: config.asset,
      pair: config.pair,
      mode: config.mode,
      jobId: job.id,
    };
  }

  async stopAgent(userId: string, configId: string) {
    return this.stopAgentById(userId, configId);
  }

  async stopAgentById(userId: string, configId: string) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { id: configId, userId },
    });
    if (!config || !config.isRunning) {
      return { stopped: false, reason: 'Agent was not running' };
    }

    await this.prisma.tradingConfig.update({
      where: { id: config.id },
      data: { isRunning: false },
    });

    // Remove both the initial static-ID job and any auto-ID delayed jobs
    const jobId = `agent-${userId}-${config.id}`;
    const staticJob = await this.tradingQueue.getJob(jobId);
    if (staticJob) await staticJob.remove();

    const [waitingJobs, delayedJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
    ]);
    await Promise.all(
      [...waitingJobs, ...delayedJobs]
        .filter((j) => j.data?.configId === config.id)
        .map((j) => j.remove()),
    );

    this.logger.log(`Agent stopped for user ${userId}, config ${config.id}`);
    return { stopped: true, configId: config.id };
  }

  async stopAgentsByModeForUser(userId: string, mode: string) {
    const runningConfigs = await this.prisma.tradingConfig.findMany({
      where: { userId, isRunning: true, mode: mode as any },
    });

    if (runningConfigs.length === 0) {
      return { stopped: 0 };
    }

    await this.prisma.tradingConfig.updateMany({
      where: { userId, isRunning: true, mode: mode as any },
      data: { isRunning: false },
    });

    const configIds = new Set(runningConfigs.map((c) => c.id));
    const [waitingJobs, delayedJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
    ]);
    await Promise.all(
      [...waitingJobs, ...delayedJobs]
        .filter((j) => configIds.has(j.data?.configId))
        .map((j) => j.remove()),
    );

    this.logger.log(
      `Stopped ${runningConfigs.length} ${mode} agent(s) for user ${userId}`,
    );

    return { stopped: runningConfigs.length };
  }

  async stopAllAgentsForUser(userId: string) {
    const runningConfigs = await this.prisma.tradingConfig.findMany({
      where: { userId, isRunning: true },
    });

    await this.prisma.tradingConfig.updateMany({
      where: { userId, isRunning: true },
      data: { isRunning: false },
    });

    const configIds = new Set(runningConfigs.map((c) => c.id));
    const [waitingJobs, delayedJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
    ]);
    await Promise.all(
      [...waitingJobs, ...delayedJobs]
        .filter((j) => configIds.has(j.data?.configId))
        .map((j) => j.remove()),
    );

    // Warn user about open positions that are now unmonitored
    const openPositions = await this.prisma.position.findMany({
      where: { userId, status: 'OPEN' },
      select: { mode: true },
    });

    const hasLivePositions = openPositions.some((p) => p.mode === 'LIVE');

    this.gateway.emitToUser(userId, 'agent:all-stopped', {
      stopped: runningConfigs.length,
      openPositions: openPositions.length,
      hasLivePositions,
    });

    return {
      stopped: runningConfigs.length,
      openPositions: openPositions.length,
      hasLivePositions,
    };
  }

  async stopAllAgents() {
    const runningConfigs = await this.prisma.tradingConfig.findMany({
      where: { isRunning: true },
      include: { user: { select: { id: true } } },
    });

    await this.prisma.tradingConfig.updateMany({
      where: { isRunning: true },
      data: { isRunning: false },
    });

    const configIds = new Set(runningConfigs.map((c) => c.id));
    const [waitingJobs, delayedJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
    ]);
    await Promise.all(
      [...waitingJobs, ...delayedJobs]
        .filter((j) => configIds.has(j.data?.configId))
        .map((j) => j.remove()),
    );

    return { stopped: runningConfigs.length };
  }

  async getAgentStatus(userId: string) {
    const configs = await this.prisma.tradingConfig.findMany({
      where: { userId },
      select: {
        id: true,
        asset: true,
        pair: true,
        mode: true,
        isRunning: true,
        minIntervalMinutes: true,
        updatedAt: true,
      },
    });

    // Scan all scheduled jobs once, then match by configId.
    // Re-queued jobs use Bull-auto-generated IDs, so we can't rely on getJob(staticId).
    const [waitingJobs, delayedJobs, activeJobs] = await Promise.all([
      this.tradingQueue.getWaiting(),
      this.tradingQueue.getDelayed(),
      this.tradingQueue.getActive(),
    ]);
    const scheduledMap = new Map<
      string,
      { jobId: string; nextRunAt: number | null }
    >();
    for (const j of [...waitingJobs, ...delayedJobs, ...activeJobs]) {
      if (j.data?.configId) {
        let nextRunAt: number | null = null;
        const jobDelay = (j.opts as Record<string, unknown>)?.delay as
          | number
          | undefined;
        const jobTs = j.timestamp;
        if (jobDelay && jobTs) {
          nextRunAt = jobTs + jobDelay;
        } else if (jobTs) {
          nextRunAt = jobTs;
        }
        scheduledMap.set(j.data.configId, {
          jobId: String(j.id),
          nextRunAt,
        });
      }
    }

    return configs.map((config) => {
      const job = scheduledMap.get(config.id);
      return {
        ...config,
        jobQueued: !!job,
        jobId: job?.jobId ?? null,
        nextRunAt: job?.nextRunAt ?? null,
      };
    });
  }

  async getAllAgentsStatus() {
    const configs = await this.prisma.tradingConfig.findMany({
      where: { isRunning: true },
      include: { user: { select: { id: true, email: true } } },
    });

    return configs.map((config) => ({
      userId: config.userId,
      email: config.user.email,
      configId: config.id,
      asset: config.asset,
      pair: config.pair,
      mode: config.mode,
      isRunning: config.isRunning,
      updatedAt: config.updatedAt,
    }));
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  async getPositions(userId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          asset: true,
          pair: true,
          mode: true,
          entryPrice: true,
          exitPrice: true,
          quantity: true,
          entryAt: true,
          exitAt: true,
          fees: true,
          status: true,
          pnl: true,
          config: {
            select: {
              stopLossPct: true,
              takeProfitPct: true,
              maxTradePct: true,
              buyThreshold: true,
              sellThreshold: true,
              minIntervalMinutes: true,
              orderPriceOffsetPct: true,
              maxConcurrentPositions: true,
            },
          },
          trades: {
            orderBy: { executedAt: 'asc' },
            select: {
              id: true,
              type: true,
              price: true,
              quantity: true,
              fee: true,
              executedAt: true,
              binanceOrderId: true,
            },
          },
        },
      }),
      this.prisma.position.count({ where }),
    ]);
    return { positions, total, page, limit };
  }

  // ── Trade history ─────────────────────────────────────────────────────────

  async getTradeHistory(
    userId: string,
    page = 1,
    limit = 20,
    asset?: string,
    mode?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { userId };
    if (asset) where.position = { asset };
    if (mode) where.mode = mode;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          price: true,
          quantity: true,
          fee: true,
          executedAt: true,
          mode: true,
          binanceOrderId: true,
          position: { select: { asset: true, pair: true, pnl: true } },
        },
      }),
      this.prisma.trade.count({ where }),
    ]);
    return { trades, total, page, limit };
  }

  // ── Agent decisions ───────────────────────────────────────────────────────

  async getDecisions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [decisions, total] = await Promise.all([
      this.prisma.agentDecision.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          asset: true,
          pair: true,
          decision: true,
          confidence: true,
          reasoning: true,
          waitMinutes: true,
          createdAt: true,
        },
      }),
      this.prisma.agentDecision.count({ where: { userId } }),
    ]);
    return { decisions, total, page, limit };
  }

  // ── Manual close ──────────────────────────────────────────────────────────

  async closePositionManually(userId: string, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, userId },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position.status !== 'OPEN')
      throw new BadRequestException('Position is already closed');

    const pair = SUPPORTED_PAIRS.find(
      (p) => p.asset === position.asset && p.quote === position.pair,
    );
    if (!pair)
      throw new BadRequestException(
        `Unsupported pair: ${position.asset}/${position.pair}`,
      );
    const symbol = pair.symbol;
    const mode = position.mode as TradingMode;

    let executor: SandboxOrderExecutor | LiveOrderExecutor;
    let exitPrice: number;

    if (mode === TradingMode.LIVE || mode === TradingMode.TESTNET) {
      const isTestnet = mode === TradingMode.TESTNET;
      const binanceCreds = await this.prisma.binanceCredential.findUnique({
        where: { userId_isTestnet: { userId, isTestnet } },
      });
      if (!binanceCreds)
        throw new BadRequestException(
          isTestnet
            ? 'No Binance Testnet credentials configured'
            : 'No Binance credentials configured',
        );
      const apiKey = decrypt(
        binanceCreds.apiKeyEncrypted,
        binanceCreds.apiKeyIv,
      );
      const apiSecret = decrypt(
        binanceCreds.secretEncrypted,
        binanceCreds.secretIv,
      );
      executor = new LiveOrderExecutor(
        new BinanceRestClient({ apiKey, apiSecret, testnet: isTestnet }),
      );
      const order = await executor.placeMarketOrder(
        symbol,
        TradeType.SELL,
        position.quantity,
      );
      exitPrice = order.price;
    } else {
      // SANDBOX: fetch live market price without placing a real order.
      // A fresh SandboxOrderExecutor has no base-asset balance so a SELL
      // would throw "Insufficient BTC balance". For paper trading we just
      // need the current price to calculate P&L.
      const publicClient = new BinanceRestClient({});
      const livePrice = await publicClient
        .getTickerPrice(symbol)
        .catch(() => null);
      if (!livePrice)
        throw new BadRequestException(
          'Could not fetch current price from Binance. Try again.',
        );
      exitPrice = livePrice;
    }

    const posData = {
      ...position,
      asset: position.asset as any,
      pair: position.pair as any,
      mode: position.mode as any,
      status: position.status as any,
      exitPrice: position.exitPrice ?? undefined,
      exitAt: position.exitAt ?? undefined,
      pnl: position.pnl ?? undefined,
    };
    const { position: closed, pnl } = this.positionManager.closePosition(
      posData,
      exitPrice,
    );

    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        exitPrice: closed.exitPrice,
        exitAt: closed.exitAt,
        status: 'CLOSED',
        pnl: closed.pnl,
        fees: closed.fees,
      },
    });

    const fee = exitPrice * position.quantity * TRADE_FEE_PCT;
    await this.prisma.trade.create({
      data: {
        userId,
        positionId,
        type: TradeType.SELL,
        price: exitPrice,
        quantity: position.quantity,
        fee,
        mode,
      },
    });

    if (mode === TradingMode.SANDBOX) {
      const proceeds = exitPrice * position.quantity;
      await this.prisma.sandboxWallet.upsert({
        where: {
          userId_currency: { userId, currency: position.pair as any },
        },
        create: {
          userId,
          currency: position.pair as any,
          balance: 10_000 + proceeds - fee,
        },
        update: { balance: { increment: proceeds - fee } },
      });
      const updatedWallet = await this.prisma.sandboxWallet.findUnique({
        where: { userId_currency: { userId, currency: position.pair as any } },
      });
      this.gateway.emitToUser(userId, 'wallet:updated', {
        currency: position.pair,
        balance: updatedWallet?.balance,
      });
    }

    await this.notificationsService.create(
      userId,
      NotificationType.TRADE_EXECUTED,
      JSON.stringify({
        key: 'manualClose',
        qty: position.quantity.toString(),
        asset: position.asset,
        price: exitPrice.toFixed(2),
        pnl: pnl.toFixed(2),
      }),
    );

    this.gateway.emitToUser(userId, 'position:closed', { positionId });
    this.gateway.emitToUser(userId, 'trade:executed', { position: closed });

    return {
      positionId,
      exitPrice,
      pnl,
      status: 'CLOSED',
    };
  }

  // ── Live Binance balance ──────────────────────────────────────────────────

  async getLiveBinanceBalance(
    userId: string,
    isTestnet: boolean,
  ): Promise<{ currency: string; balance: number }[]> {
    // Serve from cache if available — avoids hammering testnet.binance.vision
    // (shared community server that aggressively IP-bans frequent callers)
    const cacheKey = `${userId}:${isTestnet}`;
    const cached = this.balanceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const creds = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet } },
    });
    if (!creds) {
      throw new BadRequestException(
        isTestnet
          ? 'No Binance Testnet credentials configured'
          : 'No Binance credentials configured',
      );
    }
    const apiKey = decrypt(creds.apiKeyEncrypted, creds.apiKeyIv);
    const apiSecret = decrypt(creds.secretEncrypted, creds.secretIv);
    const client = new BinanceRestClient({
      apiKey,
      apiSecret,
      testnet: isTestnet,
    });
    let balances: { asset: string; free: number; locked: number }[];
    try {
      balances = await client.getBalances();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { msg?: string } } })?.response?.data
          ?.msg ?? (err instanceof Error ? err.message : 'Binance API error');
      throw new BadRequestException(
        `Could not fetch balance from Binance${isTestnet ? ' Testnet' : ''}: ${msg}`,
      );
    }
    const QUOTE_CURRENCIES = ['USDT', 'USDC'];
    const result = balances
      .filter((b: { asset: string; free: number; locked: number }) =>
        QUOTE_CURRENCIES.includes(b.asset),
      )
      .map((b: { asset: string; free: number; locked: number }) => ({
        currency: b.asset,
        balance: b.free + b.locked,
      }));

    this.balanceCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + TradingService.BALANCE_CACHE_TTL_MS,
    });
    return result;
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async getSandboxWallet(userId: string) {
    const wallets = await this.prisma.sandboxWallet.findMany({
      where: { userId },
      select: { currency: true, balance: true, updatedAt: true },
    });

    // Return all known quote currencies, defaulting to 10,000 if never used
    const currencies = ['USDT', 'USDC'] as const;
    return currencies.map((currency) => {
      const found = wallets.find((w) => w.currency === currency);
      return {
        currency,
        balance: found?.balance ?? 10_000,
        updatedAt: found?.updatedAt ?? null,
      };
    });
  }
}
