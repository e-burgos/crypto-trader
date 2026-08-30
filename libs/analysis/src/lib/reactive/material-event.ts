import { MaterialEventThresholds } from './reactive-thresholds';

export type MaterialEventType = 'PRICE_MOVED' | 'LEVEL_BREAK' | 'VOLUME_SPIKE';

export interface MaterialEventState {
  confirmedSideByLevel: Record<string, -1 | 1>;
  lastVolumeEventCandleOpenTime: number | null;
  lastEvaluatedAtMs: number | null;
}

export interface MaterialEventReference {
  close: number;
  takenAt: number;
  supportResistance: { support: number[]; resistance: number[] };
  volumeAverage: number;
}

export interface DetectMaterialEventInput {
  now: number;
  tick: { price: number; timestamp: number };
  candle: { volume: number; openTime: number; closeTime: number } | null;
  reference: MaterialEventReference | null;
  state: MaterialEventState;
  thresholds: MaterialEventThresholds;
  referenceMaxAgeMs: number;
}

export interface DetectMaterialEventResult {
  event: MaterialEventType | null;
  detail: string;
  state: MaterialEventState;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function serializeLevel(level: number): string {
  return level.toFixed(8);
}

function evaluateLevelBreaks(
  price: number,
  levels: number[],
  confirmedSideByLevel: Record<string, -1 | 1>,
  levelConfirmDistancePct: number,
): { flipped: boolean; nextConfirmedSideByLevel: Record<string, -1 | 1>; flippedLevel: number | null } {
  let flipped = false;
  let flippedLevel: number | null = null;
  const nextConfirmedSideByLevel = { ...confirmedSideByLevel };

  for (const level of levels) {
    if (!Number.isFinite(level) || level <= 0) continue;

    const distanceRatio = Math.abs(price - level) / level;
    if (distanceRatio < levelConfirmDistancePct) continue;

    const side: -1 | 1 = price > level ? 1 : -1;
    const key = serializeLevel(level);
    const previousSide = nextConfirmedSideByLevel[key];

    if (previousSide !== undefined && previousSide !== side) {
      flipped = true;
      flippedLevel = level;
    }
    nextConfirmedSideByLevel[key] = side;
  }

  return { flipped, nextConfirmedSideByLevel, flippedLevel };
}

export function detectMaterialEvent(
  input: DetectMaterialEventInput,
): DetectMaterialEventResult {
  const { now, tick, candle, reference, state, thresholds, referenceMaxAgeMs } = input;

  if (!reference) {
    return { event: null, detail: 'NO_REFERENCE', state };
  }
  if (now - reference.takenAt > referenceMaxAgeMs) {
    return { event: null, detail: 'REFERENCE_STALE', state };
  }
  if (
    state.lastEvaluatedAtMs !== null &&
    now - state.lastEvaluatedAtMs < thresholds.minEvaluationIntervalMs
  ) {
    return { event: null, detail: 'THROTTLED', state };
  }
  if (!Number.isFinite(reference.close) || reference.close <= 0) {
    return { event: null, detail: 'INVALID_REFERENCE_CLOSE', state };
  }

  const evaluatedState: MaterialEventState = { ...state, lastEvaluatedAtMs: now };

  const priceChangeRatio = Math.abs(tick.price - reference.close) / reference.close;
  if (priceChangeRatio > thresholds.priceChangePct) {
    return {
      event: 'PRICE_MOVED',
      detail: `price moved ${(priceChangeRatio * 100).toFixed(4)}% against reference close ${reference.close}`,
      state: evaluatedState,
    };
  }

  const levels = [
    ...reference.supportResistance.support,
    ...reference.supportResistance.resistance,
  ];
  const { flipped, nextConfirmedSideByLevel, flippedLevel } = evaluateLevelBreaks(
    tick.price,
    levels,
    state.confirmedSideByLevel,
    thresholds.levelConfirmDistancePct,
  );
  const stateAfterLevels: MaterialEventState = {
    ...evaluatedState,
    confirmedSideByLevel: nextConfirmedSideByLevel,
  };
  if (flipped) {
    return {
      event: 'LEVEL_BREAK',
      detail: `price crossed confirmed level ${flippedLevel}`,
      state: stateAfterLevels,
    };
  }

  if (candle && candle.closeTime > candle.openTime) {
    const rawElapsed = (now - candle.openTime) / (candle.closeTime - candle.openTime);
    const elapsed = clamp(rawElapsed, thresholds.volumeMinElapsedFraction, 1);
    const expected = reference.volumeAverage * elapsed;
    const isNewCandle = candle.openTime !== state.lastVolumeEventCandleOpenTime;

    if (expected > 0 && candle.volume / expected >= thresholds.volumeSpikeRatio && isNewCandle) {
      return {
        event: 'VOLUME_SPIKE',
        detail: `volume ${candle.volume} reached ${(candle.volume / expected).toFixed(2)}x the expected ${expected.toFixed(4)} at elapsed fraction ${elapsed.toFixed(4)}`,
        state: { ...stateAfterLevels, lastVolumeEventCandleOpenTime: candle.openTime },
      };
    }
  }

  return { event: null, detail: 'NO_MATERIAL_CHANGE', state: stateAfterLevels };
}
