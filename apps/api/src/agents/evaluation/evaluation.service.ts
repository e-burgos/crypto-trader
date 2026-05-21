import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

export const EVALUATION_QUEUE = 'agent-evaluation';

export interface ScorecardFilters {
  agentId?: string;
  model?: string;
  provider?: string;
  symbol?: string;
  mode?: string;
  riskProfile?: string;
  marketRegime?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EVALUATION_QUEUE) private readonly evaluationQueue: Queue,
  ) {}

  async scheduleEvaluation(decisionId: string) {
    const horizons = [15, 60, 240, 1440];
    for (const horizonMinutes of horizons) {
      await this.evaluationQueue.add(
        'evaluate',
        { decisionId, horizonMinutes },
        { delay: horizonMinutes * 60 * 1000, removeOnComplete: true },
      );
    }
    this.logger.log(`Scheduled 4 evaluations for decision=${decisionId}`);
  }

  async getScorecard(filters: ScorecardFilters) {
    const where = this.buildEvalWhere(filters);

    const evaluations = await this.prisma.agentDecisionEvaluation.findMany({
      where,
      select: {
        status: true,
        realizedPnlUsd: true,
        hypotheticalPnlUsd: true,
        marketRegime: true,
        decisionId: true,
      },
    });

    const totalDecisions = evaluations.length;
    const wins = evaluations.filter((e) => e.status === 'WIN').length;
    const winRate = totalDecisions > 0 ? wins / totalDecisions : 0;
    const avgPnlUsd =
      totalDecisions > 0
        ? evaluations.reduce(
            (sum, e) => sum + (e.realizedPnlUsd ?? e.hypotheticalPnlUsd ?? 0),
            0,
          ) / totalDecisions
        : 0;

    // Fetch cost data from related decisions
    const decisionIds = [...new Set(evaluations.map((e) => e.decisionId))];
    const decisions =
      decisionIds.length > 0
        ? await this.prisma.agentDecision.findMany({
            where: { id: { in: decisionIds } },
            select: { id: true, llmCostUsd: true, dataCostUsd: true },
          })
        : [];

    const totalCost = decisions.reduce(
      (sum, d) => sum + (d.llmCostUsd ?? 0) + (d.dataCostUsd ?? 0),
      0,
    );
    const avgCostUsd =
      decisionIds.length > 0 ? totalCost / decisionIds.length : 0;

    const totalPnl = evaluations.reduce(
      (sum, e) => sum + (e.realizedPnlUsd ?? e.hypotheticalPnlUsd ?? 0),
      0,
    );
    const netValueUsd = totalPnl - totalCost;

    // Group by marketRegime
    const byRegime: Record<string, { count: number; wins: number }> = {};
    for (const e of evaluations) {
      const regime = e.marketRegime ?? 'UNKNOWN';
      if (!byRegime[regime]) byRegime[regime] = { count: 0, wins: 0 };
      byRegime[regime].count++;
      if (e.status === 'WIN') byRegime[regime].wins++;
    }

    return {
      totalDecisions,
      winRate,
      avgPnlUsd,
      avgCostUsd,
      netValueUsd,
      byMarketRegime: Object.entries(byRegime).map(([regime, data]) => ({
        regime,
        count: data.count,
        winRate: data.count > 0 ? data.wins / data.count : 0,
      })),
    };
  }

  async getSummary(filters: ScorecardFilters) {
    const where = this.buildEvalWhere(filters);

    const evaluations = await this.prisma.agentDecisionEvaluation.findMany({
      where,
      select: {
        status: true,
        realizedPnlUsd: true,
        hypotheticalPnlUsd: true,
        decisionId: true,
      },
    });

    const totalEvaluated = evaluations.length;
    const wins = evaluations.filter((e) => e.status === 'WIN').length;
    const losses = evaluations.filter((e) => e.status === 'LOSS').length;
    const winRate = totalEvaluated > 0 ? wins / totalEvaluated : 0;
    const lossRate = totalEvaluated > 0 ? losses / totalEvaluated : 0;

    const totalPnl = evaluations.reduce(
      (sum, e) => sum + (e.realizedPnlUsd ?? e.hypotheticalPnlUsd ?? 0),
      0,
    );
    const avgPnlPerDecision =
      totalEvaluated > 0 ? totalPnl / totalEvaluated : 0;

    const decisionIds = [...new Set(evaluations.map((e) => e.decisionId))];
    const decisions =
      decisionIds.length > 0
        ? await this.prisma.agentDecision.findMany({
            where: { id: { in: decisionIds } },
            select: { llmCostUsd: true, dataCostUsd: true },
          })
        : [];

    const totalCostUsd = decisions.reduce(
      (sum, d) => sum + (d.llmCostUsd ?? 0) + (d.dataCostUsd ?? 0),
      0,
    );

    const roi = totalCostUsd > 0 ? totalPnl / totalCostUsd : 0;

    return {
      totalEvaluated,
      winRate,
      lossRate,
      avgPnlPerDecision,
      totalCostUsd,
      roi,
    };
  }

  async cleanup() {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // PENDING evaluations older than 48h → set to NEUTRAL
    const pendingUpdated = await this.prisma.agentDecisionEvaluation.updateMany(
      {
        where: {
          status: 'PENDING',
          createdAt: { lt: fortyEightHoursAgo },
        },
        data: {
          status: 'NEUTRAL',
          evaluatedAt: now,
        },
      },
    );

    // NEUTRAL evaluations with horizonMinutes < 60 older than 7 days → delete
    const neutralDeleted = await this.prisma.agentDecisionEvaluation.deleteMany(
      {
        where: {
          status: 'NEUTRAL',
          horizonMinutes: { lt: 60 },
          createdAt: { lt: sevenDaysAgo },
        },
      },
    );

    this.logger.log(
      `Cleanup: ${pendingUpdated.count} PENDING→NEUTRAL, ${neutralDeleted.count} old NEUTRAL deleted`,
    );

    return {
      pendingToNeutral: pendingUpdated.count,
      neutralDeleted: neutralDeleted.count,
    };
  }

  private buildEvalWhere(filters: ScorecardFilters) {
    const where: Record<string, unknown> = {};

    if (filters.marketRegime) where.marketRegime = filters.marketRegime;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from)
        (where.createdAt as Record<string, unknown>).gte = new Date(
          filters.from,
        );
      if (filters.to)
        (where.createdAt as Record<string, unknown>).lte = new Date(filters.to);
    }
    // Filter by status != PENDING to only include evaluated ones
    where.status = { not: 'PENDING' };

    return where;
  }
}
