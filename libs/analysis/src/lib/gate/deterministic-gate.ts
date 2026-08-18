import { IndicatorSnapshot } from '@crypto-trader/shared';
import { DeterministicGateThresholds } from './gate-thresholds';

export type GateSkipReason =
  | 'DISABLED'
  | 'NO_PREVIOUS_DECISION'
  | 'PREVIOUS_DECISION_STALE'
  | 'RECONCILIATION_UNCONFIRMED'
  | 'INDICATORS_INCOMPLETE'
  | 'INDICATORS_STALE'
  | 'EMA_CROSS'
  | 'RSI_OUT_OF_BAND'
  | 'PRICE_MOVED'
  | 'POSITIONS_CHANGED'
  | 'NEWS_OR_MACRO_CHANGED';

export interface GateConditionReport {
  emaStable: boolean;
  rsiNeutral: boolean;
  priceStable: boolean;
  positionsStable: boolean;
  newsAndMacroStable: boolean;
}

export interface DeterministicGateSnapshot {
  close: number;
  rsi: number;
  ema9: number;
  ema21: number;
  emaTrend: string;
  macdCrossover: string;
  newsFingerprint: string;
  macroFingerprint: string;
  positionsFingerprint: string;
  takenAt: number;
}

export interface DeterministicGateInput {
  enabled: boolean;
  now: number;
  reconciliationConfirmed: boolean;
  current: DeterministicGateSnapshot | null;
  previous: DeterministicGateSnapshot | null;
  thresholds: DeterministicGateThresholds;
}

export type DeterministicGateResult =
  | { holds: true; conditions: GateConditionReport; snapshot: DeterministicGateSnapshot }
  | { holds: false; reason: GateSkipReason; conditions: Partial<GateConditionReport> };

function sign(value: number): number {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function evaluateDeterministicGate(
  input: DeterministicGateInput,
): DeterministicGateResult {
  const { enabled, now, reconciliationConfirmed, current, previous, thresholds } =
    input;

  if (!enabled) {
    return { holds: false, reason: 'DISABLED', conditions: {} };
  }
  if (!previous) {
    return { holds: false, reason: 'NO_PREVIOUS_DECISION', conditions: {} };
  }
  if (now - previous.takenAt > thresholds.previousDecisionMaxAgeMs) {
    return { holds: false, reason: 'PREVIOUS_DECISION_STALE', conditions: {} };
  }
  if (!reconciliationConfirmed) {
    return { holds: false, reason: 'RECONCILIATION_UNCONFIRMED', conditions: {} };
  }
  if (!current) {
    return { holds: false, reason: 'INDICATORS_INCOMPLETE', conditions: {} };
  }
  if (now - current.takenAt > thresholds.snapshotMaxAgeMs) {
    return { holds: false, reason: 'INDICATORS_STALE', conditions: {} };
  }

  const emaStable =
    sign(current.ema9 - current.ema21) === sign(previous.ema9 - previous.ema21) &&
    current.emaTrend === previous.emaTrend &&
    current.macdCrossover === 'NONE';

  const rsiNeutral =
    current.rsi >= thresholds.rsiLowerBand &&
    current.rsi <= thresholds.rsiUpperBand &&
    Math.abs(current.rsi - previous.rsi) <= thresholds.rsiMaxDelta;

  const priceStable =
    Math.abs(current.close - previous.close) / previous.close <
    thresholds.priceChangePct;

  const positionsStable =
    current.positionsFingerprint === previous.positionsFingerprint;

  const newsAndMacroStable =
    current.newsFingerprint === previous.newsFingerprint &&
    current.macroFingerprint === previous.macroFingerprint;

  const conditions: GateConditionReport = {
    emaStable,
    rsiNeutral,
    priceStable,
    positionsStable,
    newsAndMacroStable,
  };

  if (!emaStable) return { holds: false, reason: 'EMA_CROSS', conditions };
  if (!rsiNeutral) return { holds: false, reason: 'RSI_OUT_OF_BAND', conditions };
  if (!priceStable) return { holds: false, reason: 'PRICE_MOVED', conditions };
  if (!positionsStable)
    return { holds: false, reason: 'POSITIONS_CHANGED', conditions };
  if (!newsAndMacroStable)
    return { holds: false, reason: 'NEWS_OR_MACRO_CHANGED', conditions };

  return { holds: true, conditions, snapshot: current };
}

export interface BuildGateSnapshotInput {
  close: number;
  indicators: IndicatorSnapshot;
  newsFingerprint: string;
  macroFingerprint: string;
  positionsFingerprint: string;
  takenAt: number;
}

export function buildGateSnapshot(
  input: BuildGateSnapshotInput,
): DeterministicGateSnapshot | null {
  const {
    close,
    indicators,
    newsFingerprint,
    macroFingerprint,
    positionsFingerprint,
    takenAt,
  } = input;

  const rsi = indicators.rsi?.value;
  const ema9 = indicators.emaCross?.ema9;
  const ema21 = indicators.emaCross?.ema21;
  const emaTrend = indicators.emaCross?.trend;
  const macdCrossover = indicators.macd?.crossover;

  if (
    !Number.isFinite(close) ||
    !Number.isFinite(rsi) ||
    !Number.isFinite(ema9) ||
    !Number.isFinite(ema21) ||
    !emaTrend ||
    !macdCrossover
  ) {
    return null;
  }

  return {
    close,
    rsi,
    ema9,
    ema21,
    emaTrend,
    macdCrossover,
    newsFingerprint,
    macroFingerprint,
    positionsFingerprint,
    takenAt,
  };
}
