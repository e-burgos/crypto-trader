import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';
import { AgentOutcomeStatus } from '../../../generated/prisma/enums';
import { EVALUATION_QUEUE, EvaluationService } from './evaluation.service';

interface EvaluateJobData {
  decisionId: string;
  horizonMinutes: number;
}

const WIN_THRESHOLD = 0.005;
const LOSS_THRESHOLD = -0.005;
const HOLD_SIGNIFICANT_PCT = 0.02;
const HIGH_VOL_PCT = 0.03;

@Processor(EVALUATION_QUEUE)
export class EvaluationProcessor {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
    private readonly evaluationService: EvaluationService,
  ) {}

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

    const existing = await this.prisma.agentDecisionEvaluation.findUnique({
      where: {
        decisionId_horizonMinutes: { decisionId, horizonMinutes },
      },
    });
    if (existing) {
      this.logger.log(
        `Evaluation already exists for decision=${decisionId} horizon=${horizonMinutes}m — skipping`,
      );
      return;
    }

    const indicators = decision.indicators as Record<string, unknown>;
    const priceAtDecision =
      (indicators?.currentPrice as number) ??
      (indicators?.price as number) ??
      (indicators?.close as number) ??
      0;

    if (!(priceAtDecision > 0)) {
      await this.createNotEvaluable(decisionId, decision.userId, horizonMinutes, 0);
      return;
    }

    const symbol = `${decision.asset}${decision.pair}`;
    const evaluatedAtTarget = new Date(
      decision.createdAt.getTime() + horizonMinutes * 60_000,
    );
    const priceAtEvaluation = await this.marketService.getPriceAt(
      symbol,
      evaluatedAtTarget,
    );

    if (priceAtEvaluation === null) {
      await this.createNotEvaluable(
        decisionId,
        decision.userId,
        horizonMinutes,
        priceAtDecision,
      );
      return;
    }

    const priceChange = (priceAtEvaluation - priceAtDecision) / priceAtDecision;

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

  private async createNotEvaluable(
    decisionId: string,
    userId: string,
    horizonMinutes: number,
    priceAtDecision: number,
  ) {
    await this.prisma.agentDecisionEvaluation.create({
      data: {
        decisionId,
        userId,
        horizonMinutes,
        status: 'NOT_EVALUABLE' as AgentOutcomeStatus,
        priceAtDecision,
        priceAtEvaluation: null,
        evaluatedAt: new Date(),
      },
    });
    this.logger.warn(
      `Evaluation NOT_EVALUABLE: decision=${decisionId} horizon=${horizonMinutes}m`,
    );
  }

  @Process('cleanup')
  async runCleanup() {
    await this.evaluationService.cleanup();
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

    const existingEvals = await this.prisma.agentDecisionEvaluation.findMany({
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
            horizon * 60 * 1000 - (Date.now() - decision.createdAt.getTime());
          if (delayMs > 0) {
            await job.queue.add(
              'evaluate',
              { decisionId: decision.id, horizonMinutes: horizon },
              {
                delay: delayMs,
                jobId: `eval:${decision.id}:${horizon}`,
                removeOnComplete: true,
              },
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
