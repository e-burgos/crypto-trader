import { Injectable } from '@nestjs/common';
import { IndicatorSnapshot, fingerprint } from '@crypto-trader/shared';
import {
  DEFAULT_GATE_THRESHOLDS,
  DeterministicGateSnapshot,
  DeterministicGateThresholds,
  buildGateHoldReasoning,
  buildGateSnapshot,
  evaluateDeterministicGate,
} from '@crypto-trader/analysis';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionGateInfo, DecisionPayload } from './dto/decision-synthesis.dto';

export interface DecisionGateEvaluateParams {
  userId: string;
  configId: string;
  deterministicGateEnabled: boolean;
  gatePriceChangePct: number;
  minIntervalMinutes: number;
  close: number;
  indicators: IndicatorSnapshot;
  newsItems: Array<{ headline: string; sentiment: string }>;
  enrichedData?: {
    globalMarket?: unknown;
    defiHealth?: unknown;
    tokenUnlocks?: unknown;
    fearGreed?: unknown;
  };
  reconciliationConfirmed: boolean;
  previousDecision: { metadata: unknown } | null;
  now?: number;
}

export interface DecisionGateEvaluation {
  applied: boolean;
  gate: DecisionGateInfo;
  payload?: DecisionPayload;
}

function isValidGateSnapshot(value: unknown): value is DeterministicGateSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.close === 'number' &&
    typeof v.rsi === 'number' &&
    typeof v.ema9 === 'number' &&
    typeof v.ema21 === 'number' &&
    typeof v.emaTrend === 'string' &&
    typeof v.macdCrossover === 'string' &&
    typeof v.newsFingerprint === 'string' &&
    typeof v.macroFingerprint === 'string' &&
    typeof v.positionsFingerprint === 'string' &&
    typeof v.takenAt === 'number'
  );
}

function extractPreviousSnapshot(
  previousDecision: { metadata: unknown } | null,
): DeterministicGateSnapshot | null {
  if (!previousDecision) return null;
  const metadata = previousDecision.metadata as
    | { gate?: { snapshot?: unknown } }
    | null
    | undefined;
  const snapshot = metadata?.gate?.snapshot;
  return isValidGateSnapshot(snapshot) ? snapshot : null;
}

@Injectable()
export class DecisionGateService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    params: DecisionGateEvaluateParams,
  ): Promise<DecisionGateEvaluation> {
    const now = params.now ?? Date.now();

    const openPositions = await this.prisma.position.findMany({
      where: { userId: params.userId, configId: params.configId, status: 'OPEN' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        quantity: true,
        status: true,
        protectionStatus: true,
        stopPrice: true,
        trailingActive: true,
        partialExitCount: true,
      },
    });

    const positionsFingerprint = fingerprint(
      openPositions.map((p) => ({
        id: p.id,
        quantity: p.quantity,
        status: p.status,
        protectionStatus: p.protectionStatus,
        stopPrice: p.stopPrice,
        trailingActive: p.trailingActive,
        partialExitCount: p.partialExitCount,
      })),
    );

    const newsFingerprint = fingerprint(
      params.newsItems
        .slice(0, 10)
        .map((n) => ({ headline: n.headline, sentiment: n.sentiment })),
    );

    const macroFingerprint = fingerprint({
      globalMarket: params.enrichedData?.globalMarket ?? null,
      defiHealth: params.enrichedData?.defiHealth ?? null,
      tokenUnlocks: params.enrichedData?.tokenUnlocks ?? null,
      fearGreed: params.enrichedData?.fearGreed ?? null,
    });

    const current = buildGateSnapshot({
      close: params.close,
      indicators: params.indicators,
      newsFingerprint,
      macroFingerprint,
      positionsFingerprint,
      takenAt: now,
    });

    const previous = extractPreviousSnapshot(params.previousDecision);

    const thresholds: DeterministicGateThresholds = {
      ...DEFAULT_GATE_THRESHOLDS,
      priceChangePct: params.gatePriceChangePct,
    };

    const result = evaluateDeterministicGate({
      enabled: params.deterministicGateEnabled,
      now,
      reconciliationConfirmed: params.reconciliationConfirmed,
      current,
      previous,
      thresholds,
    });

    if (!result.holds) {
      return {
        applied: false,
        gate: { applied: false, reason: result.reason, conditions: result.conditions, snapshot: current },
      };
    }

    const reasoning = buildGateHoldReasoning(result.snapshot, previous as DeterministicGateSnapshot, thresholds);
    const gate: DecisionGateInfo = {
      applied: true,
      conditions: result.conditions,
      snapshot: result.snapshot,
    };

    return {
      applied: true,
      gate,
      payload: {
        decision: 'HOLD',
        confidence: 1.0,
        reasoning,
        waitMinutes: params.minIntervalMinutes,
        orchestrated: false,
        subAgentResults: [],
        llmCostUsd: 0,
        llmCallCount: 0,
        pricedCallCount: 0,
        unpricedCallCount: 0,
        gate,
      },
    };
  }
}
