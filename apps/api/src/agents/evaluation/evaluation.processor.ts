import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentOutcomeStatus } from '../../../generated/prisma/enums';
import { EVALUATION_QUEUE } from './evaluation.service';

interface EvaluateJobData {
  decisionId: string;
  horizonMinutes: number;
}

/** Heuristic thresholds */
const WIN_THRESHOLD = 0.005; // 0.5%
const LOSS_THRESHOLD = -0.005; // -0.5%
const HOLD_SIGNIFICANT_PCT = 0.02; // 2%
const HIGH_VOL_PCT = 0.03; // 3%

@Processor(EVALUATION_QUEUE)
export class EvaluationProcessor {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('evaluate')
  async evaluate(job: Job<EvaluateJobData>) {
    const { decisionId, horizonMinutes } = job.data;
    this.logger.log(
      `Evaluating decision=${decisionId} horizon=${horizonMinutes}m`,
    );

    const decision = await this.prisma.agentDecision.findUnique({
      where: { id: decisionId },
    });
    if (!decision) {
      this.logger.warn(`Decision ${decisionId} not found — skipping`);
      return;
    }

    // Use the last known price from indicators as priceAtDecision
    const indicators = decision.indicators as Record<string, unknown>;
    const priceAtDecision =
      (indicators?.currentPrice as number) ??
      (indicators?.close as number) ??
      0;

    // Simulate "current price" by looking at any trade that happened,
    // or fall back to the decision price (evaluations will be NEUTRAL).
    // In production this would call Binance/market API; here we query recent trades.
    const trade = await this.prisma.trade.findFirst({
      where: { userId: decision.userId },
      orderBy: { executedAt: 'desc' },
    });
    const priceAtEvaluation = trade?.price ?? priceAtDecision;

    const priceChange =
      priceAtDecision > 0
        ? (priceAtEvaluation - priceAtDecision) / priceAtDecision
        : 0;

    const { status, realizedPnlUsd, hypotheticalPnlUsd, missedOpportunityUsd } =
      this.calculateOutcome(decision.decision, priceChange, priceAtDecision);

    const marketRegime = this.calculateMarketRegime(priceChange);

    await this.prisma.agentDecisionEvaluation.create({
      data: {
        decisionId,
        userId: decision.userId,
        horizonMinutes,
        status: status as AgentOutcomeStatus,
        priceAtDecision,
        priceAtEvaluation,
        realizedPnlUsd,
        hypotheticalPnlUsd,
        missedOpportunityUsd,
        maxAdverseMovePct: priceChange < 0 ? Math.abs(priceChange) * 100 : 0,
        maxFavorableMovePct: priceChange > 0 ? priceChange * 100 : 0,
        marketRegime,
        evaluatedAt: new Date(),
      },
    });

    this.logger.log(
      `Evaluation created: decision=${decisionId} status=${status} regime=${marketRegime}`,
    );
  }

  @Process('schedule-evaluations')
  async scheduleEvaluations(job: Job) {
    this.logger.log('Scheduling evaluations for recent decisions');

    const recentDecisions = await this.prisma.agentDecision.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 25 * 60 * 60 * 1000) }, // last 25h
      },
      select: { id: true, createdAt: true },
    });

    const existingEvals =
      await this.prisma.agentDecisionEvaluation.findMany({
        where: {
          decisionId: { in: recentDecisions.map((d) => d.id) },
        },
        select: { decisionId: true, horizonMinutes: true },
      });

    const evalSet = new Set(
      existingEvals.map((e) => `${e.decisionId}:${e.horizonMinutes}`),
    );

    const horizons = [15, 60, 240, 1440]; // 15m, 1h, 4h, 24h
    let scheduled = 0;

    for (const decision of recentDecisions) {
      for (const horizon of horizons) {
        const key = `${decision.id}:${horizon}`;
        if (!evalSet.has(key)) {
          const delayMs =
            horizon * 60 * 1000 -
            (Date.now() - decision.createdAt.getTime());
          if (delayMs > 0) {
            await job.queue.add(
              'evaluate',
              { decisionId: decision.id, horizonMinutes: horizon },
              { delay: delayMs, removeOnComplete: true },
            );
            scheduled++;
          }
        }
      }
    }

    this.logger.log(`Scheduled ${scheduled} evaluation jobs`);
  }

  calculateOutcome(
    decision: string,
    priceChange: number,
    priceAtDecision: number,
  ) {
    let status: string;
    let realizedPnlUsd: number | null = null;
    let hypotheticalPnlUsd: number | null = null;
    let missedOpportunityUsd: number | null = null;

    if (decision === 'BUY') {
      realizedPnlUsd = priceChange * priceAtDecision;
      if (priceChange > WIN_THRESHOLD) {
        status = 'WIN';
      } else if (priceChange < LOSS_THRESHOLD) {
        status = 'LOSS';
      } else {
        status = 'NEUTRAL';
      }
    } else if (decision === 'SELL') {
      // Selling: profit if price went down after selling
      realizedPnlUsd = -priceChange * priceAtDecision;
      if (priceChange < LOSS_THRESHOLD) {
        status = 'WIN'; // sold before drop
      } else if (priceChange > WIN_THRESHOLD) {
        status = 'LOSS'; // sold before pump
      } else {
        status = 'NEUTRAL';
      }
    } else {
      // HOLD
      hypotheticalPnlUsd = priceChange * priceAtDecision;
      if (priceChange > HOLD_SIGNIFICANT_PCT) {
        status = 'MISSED_OPPORTUNITY';
        missedOpportunityUsd = priceChange * priceAtDecision;
      } else if (priceChange < -HOLD_SIGNIFICANT_PCT) {
        status = 'AVOIDED_LOSS';
      } else {
        status = 'NEUTRAL';
      }
    }

    return { status, realizedPnlUsd, hypotheticalPnlUsd, missedOpportunityUsd };
  }

  calculateMarketRegime(priceChange: number): string {
    const absPct = Math.abs(priceChange);
    if (absPct > HIGH_VOL_PCT) return 'HIGH_VOLATILITY';
    if (priceChange > HOLD_SIGNIFICANT_PCT) return 'TRENDING_UP';
    if (priceChange < -HOLD_SIGNIFICANT_PCT) return 'TRENDING_DOWN';
    return 'RANGING';
  }
}
