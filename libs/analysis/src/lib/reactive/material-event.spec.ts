import { DEFAULT_MATERIAL_EVENT_THRESHOLDS } from './reactive-thresholds';
import {
  DetectMaterialEventInput,
  MaterialEventReference,
  MaterialEventState,
  detectMaterialEvent,
} from './material-event';

const T0 = 1_700_000_000_000;
const REFERENCE_MAX_AGE_MS = 90 * 60_000;

function baseState(overrides: Partial<MaterialEventState> = {}): MaterialEventState {
  return {
    confirmedSideByLevel: {},
    lastVolumeEventCandleOpenTime: null,
    lastEvaluatedAtMs: null,
    ...overrides,
  };
}

function baseReference(overrides: Partial<MaterialEventReference> = {}): MaterialEventReference {
  return {
    close: 60_000,
    takenAt: T0,
    supportResistance: { support: [59_000], resistance: [61_000] },
    volumeAverage: 1_000,
    ...overrides,
  };
}

function baseInput(overrides: Partial<DetectMaterialEventInput> = {}): DetectMaterialEventInput {
  return {
    now: T0,
    tick: { price: 60_000, timestamp: T0 },
    candle: null,
    reference: baseReference(),
    state: baseState(),
    thresholds: DEFAULT_MATERIAL_EVENT_THRESHOLDS,
    referenceMaxAgeMs: REFERENCE_MAX_AGE_MS,
    ...overrides,
  };
}

describe('detectMaterialEvent — fail-closed guards', () => {
  it('reports no event when there is no reference', () => {
    const result = detectMaterialEvent(baseInput({ reference: null }));

    expect(result.event).toBeNull();
    expect(result.detail).toBe('NO_REFERENCE');
  });

  it('reports no event when the reference is older than referenceMaxAgeMs', () => {
    const reference = baseReference({ takenAt: T0 - REFERENCE_MAX_AGE_MS - 1 });

    const result = detectMaterialEvent(baseInput({ reference }));

    expect(result.event).toBeNull();
    expect(result.detail).toBe('REFERENCE_STALE');
  });

  it('reports no event when the reference close is zero or negative', () => {
    const reference = baseReference({ close: 0 });

    const result = detectMaterialEvent(baseInput({ reference }));

    expect(result.event).toBeNull();
    expect(result.detail).toBe('INVALID_REFERENCE_CLOSE');
  });

  it('throttles evaluations that come in under minEvaluationIntervalMs and leaves state untouched', () => {
    const state = baseState({ lastEvaluatedAtMs: T0 - 100 });
    const input = baseInput({
      now: T0,
      state,
      tick: { price: 63_000, timestamp: T0 },
    });

    const result = detectMaterialEvent(input);

    expect(result.event).toBeNull();
    expect(result.detail).toBe('THROTTLED');
    expect(result.state).toBe(state);
  });

  it('does not throttle the first ever evaluation (lastEvaluatedAtMs null)', () => {
    const input = baseInput({
      now: T0,
      tick: { price: 60_010, timestamp: T0 },
    });

    const result = detectMaterialEvent(input);

    expect(result.detail).not.toBe('THROTTLED');
    expect(result.state.lastEvaluatedAtMs).toBe(T0);
  });
});

describe('detectMaterialEvent — PRICE_MOVED (RN-3)', () => {
  it('fires when the tick departs from the reference close by more than priceChangePct', () => {
    const tick = { price: 60_360, timestamp: T0 };

    const result = detectMaterialEvent(baseInput({ tick }));

    expect(result.event).toBe('PRICE_MOVED');
    expect(result.state.lastEvaluatedAtMs).toBe(T0);
  });

  it('does not fire exactly at the priceChangePct boundary', () => {
    const tick = { price: 60_300, timestamp: T0 };

    const result = detectMaterialEvent(baseInput({ tick }));

    expect(result.event).not.toBe('PRICE_MOVED');
  });
});

describe('detectMaterialEvent — LEVEL_BREAK (RN-4, RN-6)', () => {
  it('establishes the confirmed side on first observation without firing an event', () => {
    const reference = baseReference({ close: 61_050 });
    const tick = { price: 61_200, timestamp: T0 };

    const result = detectMaterialEvent(baseInput({ reference, tick }));

    expect(result.event).toBeNull();
    expect(result.state.confirmedSideByLevel['61000.00000000']).toBe(1);
  });

  it('fires when the confirmed side flips relative to the previously registered side', () => {
    const reference = baseReference({ close: 61_050 });
    const state = baseState({ confirmedSideByLevel: { '61000.00000000': 1 } });
    const tick = { price: 60_800, timestamp: T0 };

    const result = detectMaterialEvent(baseInput({ reference, state, tick }));

    expect(result.event).toBe('LEVEL_BREAK');
    expect(result.state.confirmedSideByLevel['61000.00000000']).toBe(-1);
  });

  it('does not fire nor update state while the price oscillates inside the confirm band', () => {
    const reference = baseReference({ close: 61_050 });
    const state = baseState({ confirmedSideByLevel: { '61000.00000000': 1 } });
    const tick = { price: 61_010, timestamp: T0 };

    const result = detectMaterialEvent(baseInput({ reference, state, tick }));

    expect(result.event).toBeNull();
    expect(result.state.confirmedSideByLevel['61000.00000000']).toBe(1);
  });
});

describe('detectMaterialEvent — VOLUME_SPIKE (RN-5, §12.1 normalized over @kline_1h)', () => {
  it('fires when the current candle volume exceeds the elapsed-normalized expected volume', () => {
    const candle = { volume: 300, openTime: T0, closeTime: T0 + 3_600_000 };
    const tick = { price: 60_010, timestamp: T0 + 360_000 };

    const result = detectMaterialEvent(
      baseInput({ now: T0 + 360_000, tick, candle }),
    );

    expect(result.event).toBe('VOLUME_SPIKE');
    expect(result.state.lastVolumeEventCandleOpenTime).toBe(T0);
  });

  it('does not fire a second volume event for the same candle', () => {
    const candle = { volume: 300, openTime: T0, closeTime: T0 + 3_600_000 };
    const state = baseState({ lastVolumeEventCandleOpenTime: T0 });
    const tick = { price: 60_010, timestamp: T0 + 400_000 };

    const result = detectMaterialEvent(
      baseInput({ now: T0 + 400_000, tick, candle, state }),
    );

    expect(result.event).toBeNull();
    expect(result.detail).toBe('NO_MATERIAL_CHANGE');
  });

  it('clamps the elapsed fraction to volumeMinElapsedFraction near candle open', () => {
    const candle = { volume: 300, openTime: T0, closeTime: T0 + 3_600_000 };
    const tick = { price: 60_010, timestamp: T0 + 1_000 };

    const result = detectMaterialEvent(baseInput({ now: T0 + 1_000, tick, candle }));

    expect(result.event).toBe('VOLUME_SPIKE');
  });

  it('does not evaluate volume when the candle is absent', () => {
    const result = detectMaterialEvent(baseInput({ candle: null }));

    expect(result.event).not.toBe('VOLUME_SPIKE');
  });

  it('does not evaluate volume when the candle has a non-positive duration', () => {
    const candle = { volume: 999_999, openTime: T0, closeTime: T0 };
    const result = detectMaterialEvent(baseInput({ candle }));

    expect(result.event).not.toBe('VOLUME_SPIKE');
    expect(result.detail).toBe('NO_MATERIAL_CHANGE');
  });
});

describe('detectMaterialEvent — no material change', () => {
  it('returns null with a stable detail when nothing crosses any threshold', () => {
    const result = detectMaterialEvent(baseInput({ tick: { price: 60_010, timestamp: T0 } }));

    expect(result.event).toBeNull();
    expect(result.detail).toBe('NO_MATERIAL_CHANGE');
  });

  it('never mutates the input state object', () => {
    const state = baseState({ confirmedSideByLevel: { '61000.00000000': 1 } });
    const originalSnapshot = JSON.parse(JSON.stringify(state));

    detectMaterialEvent(baseInput({ state, tick: { price: 60_800, timestamp: T0 } }));

    expect(state).toEqual(originalSnapshot);
  });
});
