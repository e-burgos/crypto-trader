import { Injectable } from '@nestjs/common';
import { Asset, NotificationType, TradingMode } from '@crypto-trader/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RiskBudgetService } from './risk-budget.service';
import { PortfolioContextService } from './portfolio-context.service';

export type AggregateBlockReason = 'ASSET_EXPOSURE' | 'DAILY_LOSS' | 'DRAWDOWN';

export interface AssertBuyAllowedInput {
  userId: string;
  asset: Asset;
  mode: TradingMode;
  plannedNotionalUsd: number;
}

export interface EvaluateDailyLossInput {
  userId: string;
  mode: TradingMode;
}

export interface DailyLossEvaluation {
  reached: boolean;
  realizedPnlTodayUsd: number;
  maxDailyLossUsd: number | null;
}

export interface AggregateRiskDecision {
  allowed: boolean;
  blockedBy: AggregateBlockReason | null;
  detail: string | null;
  assetExposureUsd: number;
  plannedNotionalUsd: number;
  equityUsd: number;
  realizedPnlTodayUsd: number;
  drawdownPct: number;
  agentsPaused: boolean;
}

@Injectable()
export class AggregateRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolioContext: PortfolioContextService,
    private readonly riskBudget: RiskBudgetService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async evaluateDailyLoss(
    input: EvaluateDailyLossInput,
  ): Promise<DailyLossEvaluation> {
    const policy = await this.prisma.userRiskPolicy.findUnique({
      where: { userId: input.userId },
    });
    if (!policy || !policy.enabled) {
      return { reached: false, realizedPnlTodayUsd: 0, maxDailyLossUsd: null };
    }

    const { realizedPnlUsd: realizedPnlTodayUsd } =
      await this.riskBudget.assessAggregate({
        userId: input.userId,
        since: startOfUtcDay(),
      });

    const reached =
      policy.maxDailyLossUsd != null &&
      realizedPnlTodayUsd <= -policy.maxDailyLossUsd;

    return {
      reached,
      realizedPnlTodayUsd,
      maxDailyLossUsd: policy.maxDailyLossUsd,
    };
  }

  async assertBuyAllowed(
    input: AssertBuyAllowedInput,
  ): Promise<AggregateRiskDecision> {
    const base: AggregateRiskDecision = {
      allowed: true,
      blockedBy: null,
      detail: null,
      assetExposureUsd: 0,
      plannedNotionalUsd: input.plannedNotionalUsd,
      equityUsd: 0,
      realizedPnlTodayUsd: 0,
      drawdownPct: 0,
      agentsPaused: false,
    };

    const policy = await this.prisma.userRiskPolicy.findUnique({
      where: { userId: input.userId },
    });
    if (!policy || !policy.enabled) return base;

    const snapshot = await this.portfolioContext.build({
      userId: input.userId,
      mode: input.mode,
    });
    const assetExposureUsd = round(
      snapshot.positions
        .filter((p) => p.asset === input.asset)
        .reduce((sum, p) => sum + p.notionalAtEntryUsd, 0),
    );
    const equityUsd = round(
      snapshot.wallets.reduce((sum, w) => sum + w.balance, 0) +
        snapshot.exposureAtEntryUsd,
    );

    if (
      policy.maxAssetExposureUsd != null &&
      assetExposureUsd + input.plannedNotionalUsd > policy.maxAssetExposureUsd
    ) {
      return {
        ...base,
        allowed: false,
        blockedBy: 'ASSET_EXPOSURE',
        detail: `Asset exposure ${round(assetExposureUsd + input.plannedNotionalUsd)} exceeds max ${policy.maxAssetExposureUsd}`,
        assetExposureUsd,
        equityUsd,
      };
    }
    if (
      policy.maxAssetExposurePct != null &&
      equityUsd > 0 &&
      (assetExposureUsd + input.plannedNotionalUsd) / equityUsd >
        policy.maxAssetExposurePct
    ) {
      return {
        ...base,
        allowed: false,
        blockedBy: 'ASSET_EXPOSURE',
        detail: `Asset exposure ratio exceeds max ${policy.maxAssetExposurePct}`,
        assetExposureUsd,
        equityUsd,
      };
    }

    const dailyLoss = await this.evaluateDailyLoss({
      userId: input.userId,
      mode: input.mode,
    });
    const { realizedPnlTodayUsd } = dailyLoss;

    if (dailyLoss.reached) {
      return {
        ...base,
        allowed: false,
        blockedBy: 'DAILY_LOSS',
        detail: `Daily loss ${Math.abs(realizedPnlTodayUsd).toFixed(2)} reached the max ${dailyLoss.maxDailyLossUsd}`,
        assetExposureUsd,
        equityUsd,
        realizedPnlTodayUsd,
      };
    }

    const equityAtDayStartUsd =
      equityUsd + Math.max(0, -realizedPnlTodayUsd);
    const drawdownPct =
      equityAtDayStartUsd > 0
        ? Math.max(0, -realizedPnlTodayUsd) / equityAtDayStartUsd
        : 0;

    if (
      policy.maxDrawdownPct != null &&
      drawdownPct >= policy.maxDrawdownPct
    ) {
      let agentsPaused = false;
      if (policy.pauseAgentsOnDrawdown) {
        await this.prisma.tradingConfig.updateMany({
          where: { userId: input.userId, isRunning: true },
          data: { isRunning: false },
        });
        await this.prisma.userRiskPolicy.update({
          where: { userId: input.userId },
          data: { pausedAt: new Date(), pausedReason: 'DRAWDOWN' },
        });
        await this.notificationsService
          .create(
            input.userId,
            NotificationType.AGENT_STOPPED,
            JSON.stringify({ key: 'agentsPausedDrawdown' }),
          )
          .catch(() => null);
        agentsPaused = true;
      }
      return {
        ...base,
        allowed: false,
        blockedBy: 'DRAWDOWN',
        detail: `Drawdown ${(drawdownPct * 100).toFixed(1)}% reached the max ${(policy.maxDrawdownPct * 100).toFixed(1)}%`,
        assetExposureUsd,
        equityUsd,
        realizedPnlTodayUsd,
        drawdownPct: round4(drawdownPct),
        agentsPaused,
      };
    }

    return {
      ...base,
      assetExposureUsd,
      equityUsd,
      realizedPnlTodayUsd,
      drawdownPct: round4(drawdownPct),
    };
  }
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
