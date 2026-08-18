import { buildGateHoldReasoning } from './gate-reasoning';
import { DeterministicGateSnapshot } from './deterministic-gate';
import { DEFAULT_GATE_THRESHOLDS } from './gate-thresholds';

const previous: DeterministicGateSnapshot = {
  close: 60_000,
  rsi: 50,
  ema9: 100,
  ema21: 90,
  emaTrend: 'NEUTRAL',
  macdCrossover: 'NONE',
  newsFingerprint: 'news-1',
  macroFingerprint: 'macro-1',
  positionsFingerprint: 'positions-1',
  takenAt: 1_700_000_000_000,
};

const current: DeterministicGateSnapshot = {
  ...previous,
  close: 60_072,
  rsi: 52.1,
  takenAt: previous.takenAt + 60_000,
};

describe('buildGateHoldReasoning', () => {
  it('mentions the deterministic HOLD, the RSI value and band, and no LLM call', () => {
    const reasoning = buildGateHoldReasoning(current, previous, DEFAULT_GATE_THRESHOLDS);

    expect(reasoning).toContain('HOLD determinista');
    expect(reasoning).toContain('RSI 52.1 en banda 40-60');
    expect(reasoning).toContain('Sin llamada a LLM.');
  });

  it('shows a signed positive percentage when price rose', () => {
    const reasoning = buildGateHoldReasoning(current, previous, DEFAULT_GATE_THRESHOLDS);

    expect(reasoning).toContain('+0.12%');
  });

  it('shows a signed negative percentage when price fell', () => {
    const fallen: DeterministicGateSnapshot = { ...current, close: 59_800 };
    const reasoning = buildGateHoldReasoning(fallen, previous, DEFAULT_GATE_THRESHOLDS);

    expect(reasoning).toContain('-0.33%');
  });
});
