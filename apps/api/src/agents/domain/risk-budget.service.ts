import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const MAX_DRAWDOWN_PCT = 0.1;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_DAILY_LOSS_LIMIT_USD = 5;

export interface RiskBudgetInput {
  userId: string;
  configId?: string;
  windowHours?: number;
}

export interface AggregateRiskBudgetInput {
  userId: string;
  since: Date;
}

export interface AggregateRiskBudgetAssessment {
  realizedPnlUsd: number;
}

export type RiskBudgetBlockReason =
  | 'MAX_POSITIONS'
  | 'DAILY_LOSS_LIMIT'
  | 'DRAWDOWN';

export interface RiskBudgetAssessment {
  canTrade: boolean;
  blockedBy: RiskBudgetBlockReason | null;
  reason: string | null;
  openPositionCount: number;
  maxConcurrentPositions: number;
  realizedPnlUsd: number;
  dailyLossLimitUsd: number;
  drawdownPct: number;
  maxDrawdownPct: number;
}

@Injectable()
export class RiskBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(input: RiskBudgetInput): Promise<RiskBudgetAssessment> {
    const windowHours = input.windowHours ?? DEFAULT_WINDOW_HOURS;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [policy, openPositionCount, maxConcurrentPositions, realizedPnlUsd] =
      await Promise.all([
        this.prisma.agentBudgetPolicy.findUnique({
          where: { userId: input.userId },
        }),
        this.countOpenPositions(input.userId, input.configId),
        this.resolveMaxConcurrentPositions(input.userId, input.configId),
        this.sumRealizedPnl(input.userId, input.configId, since),
      ]);

    const dailyLossLimitUsd =
      policy?.dailyUsdBudget ?? DEFAULT_DAILY_LOSS_LIMIT_USD;
    const drawdownPct = this.computeDrawdownPct(
      realizedPnlUsd,
      dailyLossLimitUsd,
    );

    const { blockedBy, reason } = this.evaluateBlock({
      openPositionCount,
      maxConcurrentPositions,
      drawdownPct,
      realizedPnlUsd,
      dailyLossLimitUsd,
    });

    return {
      canTrade: blockedBy === null,
      blockedBy,
      reason,
      openPositionCount,
      maxConcurrentPositions,
      realizedPnlUsd: round(realizedPnlUsd),
      dailyLossLimitUsd,
      drawdownPct: round4(drawdownPct),
      maxDrawdownPct: MAX_DRAWDOWN_PCT,
    };
  }

  async assessAggregate(
    input: AggregateRiskBudgetInput,
  ): Promise<AggregateRiskBudgetAssessment> {
    const realizedPnlUsd = await this.sumRealizedPnl(
      input.userId,
      undefined,
      input.since,
    );
    return { realizedPnlUsd: round(realizedPnlUsd) };
  }

  private async countOpenPositions(
    userId: string,
    configId?: string,
  ): Promise<number> {
    const scope = { userId, ...(configId ? { configId } : {}) };
    const [open, resting] = await Promise.all([
      this.prisma.position.count({ where: { ...scope, status: 'OPEN' } }),
      this.prisma.entryOrder.count({ where: { ...scope, status: 'RESTING' } }),
    ]);
    return open + resting;
  }

  private async resolveMaxConcurrentPositions(
    userId: string,
    configId?: string,
  ): Promise<number> {
    if (configId) {
      const config = await this.prisma.tradingConfig.findUnique({
        where: { id: configId },
      });
      return config?.maxConcurrentPositions ?? 0;
    }

    const configs = await this.prisma.tradingConfig.findMany({
      where: { userId },
      select: { maxConcurrentPositions: true },
    });
    if (configs.length === 0) return 0;
    return Math.max(...configs.map((c) => c.maxConcurrentPositions));
  }

  private async sumRealizedPnl(
    userId: string,
    configId: string | undefined,
    since: Date,
  ): Promise<number> {
    const closedPositions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'CLOSED',
        exitAt: { gte: since },
        ...(configId ? { configId } : {}),
      },
      select: { pnl: true },
    });
    return closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  }

  private computeDrawdownPct(
    realizedPnlUsd: number,
    dailyLossLimitUsd: number,
  ): number {
    if (realizedPnlUsd >= 0 || dailyLossLimitUsd <= 0) return 0;
    return Math.abs(realizedPnlUsd) / dailyLossLimitUsd;
  }

  private evaluateBlock(params: {
    openPositionCount: number;
    maxConcurrentPositions: number;
    drawdownPct: number;
    realizedPnlUsd: number;
    dailyLossLimitUsd: number;
  }): { blockedBy: RiskBudgetBlockReason | null; reason: string | null } {
    const {
      openPositionCount,
      maxConcurrentPositions,
      drawdownPct,
      realizedPnlUsd,
      dailyLossLimitUsd,
    } = params;

    if (openPositionCount >= maxConcurrentPositions) {
      return {
        blockedBy: 'MAX_POSITIONS',
        reason: `Max positions reached (${openPositionCount}/${maxConcurrentPositions})`,
      };
    }
    if (drawdownPct >= MAX_DRAWDOWN_PCT) {
      return {
        blockedBy: 'DRAWDOWN',
        reason: `Drawdown threshold exceeded (${(drawdownPct * 100).toFixed(1)}%)`,
      };
    }
    if (realizedPnlUsd <= -dailyLossLimitUsd) {
      return {
        blockedBy: 'DAILY_LOSS_LIMIT',
        reason: `Daily loss limit reached ($${Math.abs(realizedPnlUsd).toFixed(2)})`,
      };
    }
    return { blockedBy: null, reason: null };
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
