import {
  evaluateDeterministicGate,
  buildGateSnapshot,
  DeterministicGateSnapshot,
  DeterministicGateInput,
} from './deterministic-gate';
import { DEFAULT_GATE_THRESHOLDS } from './gate-thresholds';
import { IndicatorSnapshot } from '@crypto-trader/shared';

const T0 = 1_700_000_000_000;

const previousSnapshot: DeterministicGateSnapshot = {
  close: 60_000,
  rsi: 50,
  ema9: 100,
  ema21: 90,
  emaTrend: 'NEUTRAL',
  macdCrossover: 'NONE',
  newsFingerprint: 'news-1',
  macroFingerprint: 'macro-1',
  positionsFingerprint: 'positions-1',
  takenAt: T0,
};

const currentSnapshot: DeterministicGateSnapshot = {
  close: 60_100, // +0.167%, below the 0.5% threshold
  rsi: 52, // within 40-60, |52-50|=2 <= 5
  ema9: 101,
  ema21: 90, // sign(101-90) === sign(100-90)
  emaTrend: 'NEUTRAL',
  macdCrossover: 'NONE',
  newsFingerprint: 'news-1',
  macroFingerprint: 'macro-1',
  positionsFingerprint: 'positions-1',
  takenAt: T0 + 60_000,
};

function baseInput(
  overrides: Partial<DeterministicGateInput> = {},
): DeterministicGateInput {
  return {
    enabled: true,
    now: currentSnapshot.takenAt,
    reconciliationConfirmed: true,
    current: currentSnapshot,
    previous: previousSnapshot,
    thresholds: DEFAULT_GATE_THRESHOLDS,
    ...overrides,
  };
}

describe('evaluateDeterministicGate', () => {
  it('CA-038: resolves "sin señal" when the five conditions hold simultaneously', () => {
    const result = evaluateDeterministicGate(baseInput());

    expect(result.holds).toBe(true);
    if (result.holds) {
      expect(result.conditions).toEqual({
        emaStable: true,
        rsiNeutral: true,
        priceStable: true,
        positionsStable: true,
        newsAndMacroStable: true,
      });
      expect(result.snapshot).toBe(currentSnapshot);
    }
  });

  describe('CA-039: each condition breaks the gate individually', () => {
    const cases: Array<{
      name: string;
      current: DeterministicGateSnapshot;
      reason: string;
    }> = [
      {
        name: 'EMA cross (sign flips relative to previous)',
        current: { ...currentSnapshot, ema9: 80 },
        reason: 'EMA_CROSS',
      },
      {
        name: 'EMA trend changed',
        current: { ...currentSnapshot, emaTrend: 'BULLISH' },
        reason: 'EMA_CROSS',
      },
      {
        name: 'MACD crossover present',
        current: { ...currentSnapshot, macdCrossover: 'BULLISH' },
        reason: 'EMA_CROSS',
      },
      {
        name: 'RSI outside the neutral band',
        current: { ...currentSnapshot, rsi: 65 },
        reason: 'RSI_OUT_OF_BAND',
      },
      {
        name: 'RSI delta beyond tolerance',
        current: { ...currentSnapshot, rsi: 56 },
        reason: 'RSI_OUT_OF_BAND',
      },
      {
        name: 'price moved beyond the configured threshold',
        current: { ...currentSnapshot, close: 60_400 },
        reason: 'PRICE_MOVED',
      },
      {
        name: 'open positions changed',
        current: { ...currentSnapshot, positionsFingerprint: 'positions-2' },
        reason: 'POSITIONS_CHANGED',
      },
      {
        name: 'news changed',
        current: { ...currentSnapshot, newsFingerprint: 'news-2' },
        reason: 'NEWS_OR_MACRO_CHANGED',
      },
      {
        name: 'macro context changed',
        current: { ...currentSnapshot, macroFingerprint: 'macro-2' },
        reason: 'NEWS_OR_MACRO_CHANGED',
      },
    ];

    it.each(cases)('$name → does not apply ($reason)', ({ current, reason }) => {
      const result = evaluateDeterministicGate(baseInput({ current }));

      expect(result.holds).toBe(false);
      if (!result.holds) {
        expect(result.reason).toBe(reason);
      }
    });
  });

  it('CA-042: with no previous decision, the gate never applies', () => {
    const result = evaluateDeterministicGate(baseInput({ previous: null }));

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('NO_PREVIOUS_DECISION');
    }
  });

  it('CE-03: disabled by config → the gate never applies', () => {
    const result = evaluateDeterministicGate(baseInput({ enabled: false }));

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('DISABLED');
    }
  });

  it('CE-01: unconfirmed reconciliation → the gate never applies', () => {
    const result = evaluateDeterministicGate(
      baseInput({ reconciliationConfirmed: false }),
    );

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('RECONCILIATION_UNCONFIRMED');
    }
  });

  it('CE-02: missing indicators → the gate never applies', () => {
    const result = evaluateDeterministicGate(baseInput({ current: null }));

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('INDICATORS_INCOMPLETE');
    }
  });

  it('CE-02: stale indicators → the gate never applies', () => {
    const staleCurrent = {
      ...currentSnapshot,
      takenAt: previousSnapshot.takenAt + 6 * 60_000,
    };
    const result = evaluateDeterministicGate(
      baseInput({
        current: staleCurrent,
        now: staleCurrent.takenAt + DEFAULT_GATE_THRESHOLDS.snapshotMaxAgeMs + 1,
      }),
    );

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('INDICATORS_STALE');
    }
  });

  it('stale previous decision → the gate never applies', () => {
    const result = evaluateDeterministicGate(
      baseInput({
        now:
          previousSnapshot.takenAt +
          DEFAULT_GATE_THRESHOLDS.previousDecisionMaxAgeMs +
          1,
      }),
    );

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('PREVIOUS_DECISION_STALE');
    }
  });

  it('reconciliation is checked before indicator completeness (fail-closed order)', () => {
    const result = evaluateDeterministicGate(
      baseInput({ reconciliationConfirmed: false, current: null }),
    );

    expect(result.holds).toBe(false);
    if (!result.holds) {
      expect(result.reason).toBe('RECONCILIATION_UNCONFIRMED');
    }
  });
});

describe('buildGateSnapshot', () => {
  const indicators: IndicatorSnapshot = {
    rsi: { value: 52, signal: 'NEUTRAL' as never },
    macd: { macd: 1, signal: 1, histogram: 0, crossover: 'NONE' as never },
    bollingerBands: {
      upper: 0,
      middle: 0,
      lower: 0,
      bandwidth: 0,
      position: 'INSIDE' as never,
    },
    emaCross: { ema9: 101, ema21: 90, ema50: 80, ema200: 70, trend: 'NEUTRAL' as never },
    volume: { current: 0, average: 0, ratio: 0, signal: 'NORMAL' as never },
    supportResistance: { support: [], resistance: [] },
    timestamp: T0,
  };

  it('builds a snapshot when every field is finite', () => {
    const snapshot = buildGateSnapshot({
      close: 60_100,
      indicators,
      newsFingerprint: 'news-1',
      macroFingerprint: 'macro-1',
      positionsFingerprint: 'positions-1',
      takenAt: T0,
    });

    expect(snapshot).toEqual({
      close: 60_100,
      rsi: 52,
      ema9: 101,
      ema21: 90,
      emaTrend: 'NEUTRAL',
      macdCrossover: 'NONE',
      newsFingerprint: 'news-1',
      macroFingerprint: 'macro-1',
      positionsFingerprint: 'positions-1',
      takenAt: T0,
    });
  });

  it('returns null when close is not finite', () => {
    const snapshot = buildGateSnapshot({
      close: NaN,
      indicators,
      newsFingerprint: 'news-1',
      macroFingerprint: 'macro-1',
      positionsFingerprint: 'positions-1',
      takenAt: T0,
    });

    expect(snapshot).toBeNull();
  });

  it('returns null when RSI is missing', () => {
    const snapshot = buildGateSnapshot({
      close: 60_100,
      indicators: { ...indicators, rsi: { value: NaN, signal: 'NEUTRAL' as never } },
      newsFingerprint: 'news-1',
      macroFingerprint: 'macro-1',
      positionsFingerprint: 'positions-1',
      takenAt: T0,
    });

    expect(snapshot).toBeNull();
  });
});
