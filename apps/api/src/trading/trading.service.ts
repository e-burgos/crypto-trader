import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTradingConfigDto,
  UpdateTradingConfigDto,
  StartAgentDto,
} from './dto/trading-config.dto';

const DEFAULTS = {
  buyThreshold: 70,
  sellThreshold: 70,
  stopLossPct: 0.03,
  takeProfitPct: 0.05,
  maxTradePct: 0.05,
  maxConcurrentPositions: 2,
  minIntervalMinutes: 5,
};

export const TRADING_QUEUE = 'trading-agent';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TRADING_QUEUE) private readonly tradingQueue: Queue,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfigs(userId: string) {
    return this.prisma.tradingConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertConfig(userId: string, dto: CreateTradingConfigDto) {
    return this.prisma.tradingConfig.upsert({
      where: { userId_asset_pair: { userId, asset: dto.asset as any, pair: dto.pair as any } },
      create: {
        userId,
        asset: dto.asset as any,
        pair: dto.pair as any,
        mode: dto.mode as any,
        buyThreshold: dto.buyThreshold ?? DEFAULTS.buyThreshold,
        sellThreshold: dto.sellThreshold ?? DEFAULTS.sellThreshold,
        stopLossPct: dto.stopLossPct ?? DEFAULTS.stopLossPct,
        takeProfitPct: dto.takeProfitPct ?? DEFAULTS.takeProfitPct,
        maxTradePct: dto.maxTradePct ?? DEFAULTS.maxTradePct,
        maxConcurrentPositions: dto.maxConcurrentPositions ?? DEFAULTS.maxConcurrentPositions,
        minIntervalMinutes: dto.minIntervalMinutes ?? DEFAULTS.minIntervalMinutes,
      },
      update: {
        mode: dto.mode as any,
        buyThreshold: dto.buyThreshold,
        sellThreshold: dto.sellThreshold,
        stopLossPct: dto.stopLossPct,
        takeProfitPct: dto.takeProfitPct,
        maxTradePct: dto.maxTradePct,
        maxConcurrentPositions: dto.maxConcurrentPositions,
        minIntervalMinutes: dto.minIntervalMinutes,
      },
    });
  }

  async updateConfig(userId: string, configId: string, dto: UpdateTradingConfigDto) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { id: configId, userId },
    });
    if (!config) throw new NotFoundException('Trading config not found');

    return this.prisma.tradingConfig.update({
      where: { id: configId },
      data: { ...dto } as any,
    });
  }

  // ── Agent lifecycle ───────────────────────────────────────────────────────

  async startAgent(userId: string, dto: StartAgentDto) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { userId, asset: dto.asset as any, pair: dto.pair as any },
    });
    if (!config) {
      throw new NotFoundException(
        `No trading config found for ${dto.asset}/${dto.pair}. Create one first.`,
      );
    }
    if (config.isRunning) {
      throw new BadRequestException(
        `Agent for ${dto.asset}/${dto.pair} is already running`,
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

    this.logger.log(`Agent started for user ${userId}, config ${config.id}, job ${job.id}`);
    return {
      started: true,
      configId: config.id,
      asset: config.asset,
      pair: config.pair,
      mode: config.mode,
      jobId: job.id,
    };
  }

  async stopAgent(userId: string, asset: string, pair: string) {
    const config = await this.prisma.tradingConfig.findFirst({
      where: { userId, asset: asset as any, pair: pair as any },
    });
    if (!config) throw new NotFoundException('Trading config not found');

    if (!config.isRunning) {
      return { stopped: false, reason: 'Agent was not running' };
    }

    await this.prisma.tradingConfig.update({
      where: { id: config.id },
      data: { isRunning: false },
    });

    const jobId = `agent-${userId}-${config.id}`;
    const job = await this.tradingQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }

    this.logger.log(`Agent stopped for user ${userId}, config ${config.id}`);
    return { stopped: true, configId: config.id };
  }

  async stopAllAgentsForUser(userId: string) {
    const runningConfigs = await this.prisma.tradingConfig.findMany({
      where: { userId, isRunning: true },
    });

    await this.prisma.tradingConfig.updateMany({
      where: { userId, isRunning: true },
      data: { isRunning: false },
    });

    for (const config of runningConfigs) {
      const job = await this.tradingQueue.getJob(`agent-${userId}-${config.id}`);
      if (job) await job.remove();
    }

    return { stopped: runningConfigs.length };
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

    for (const config of runningConfigs) {
      const jobId = `agent-${config.userId}-${config.id}`;
      const job = await this.tradingQueue.getJob(jobId);
      if (job) await job.remove();
    }

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

    const statuses = await Promise.all(
      configs.map(async (config) => {
        const jobId = `agent-${userId}-${config.id}`;
        const job: Job | null = await this.tradingQueue.getJob(jobId);
        return {
          ...config,
          jobQueued: !!job,
          jobId: job ? job.id : null,
        };
      }),
    );

    return statuses;
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

  async getOpenPositions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        orderBy: { entryAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          asset: true,
          pair: true,
          mode: true,
          entryPrice: true,
          quantity: true,
          entryAt: true,
          fees: true,
          status: true,
        },
      }),
      this.prisma.position.count({ where: { userId, status: 'OPEN' } }),
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
}
