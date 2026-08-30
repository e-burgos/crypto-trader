import type { DeterministicGateSnapshot } from '@crypto-trader/analysis';
import { fingerprint, type IndicatorSnapshot } from '@crypto-trader/shared';

export const HARNESS_ASSET = 'BTC';
export const HARNESS_PAIR = 'USDT';
export const HARNESS_TIMEFRAME = '1h';

export interface PositionFixture {
  id: string;
  quantity: number;
  status: string;
  protectionStatus: string;
  stopPrice: number | null;
  trailingActive: boolean;
  partialExitCount: number;
}

export interface NewsFixture {
  headline: string;
  sentiment: string;
}

export interface CostScenario {
  id: string;
  /** true ⇒ this scenario must NEVER resolve HOLD by the gate (CA-062) */
  withSignal: boolean;
  now: number;
  snapshotTakenAt: number;
  reconciliationConfirmed: boolean;
  previous: DeterministicGateSnapshot;
  close: number;
  indicators: IndicatorSnapshot;
  openPositions: PositionFixture[];
  news: NewsFixture[];
  macro: Record<string, unknown>;
}

export function computePositionsFingerprint(
  positions: PositionFixture[],
): string {
  return fingerprint(
    positions.map((p) => ({
      id: p.id,
      quantity: p.quantity,
      status: p.status,
      protectionStatus: p.protectionStatus,
      stopPrice: p.stopPrice,
      trailingActive: p.trailingActive,
      partialExitCount: p.partialExitCount,
    })),
  );
}

export function computeNewsFingerprint(news: NewsFixture[]): string {
  return fingerprint(
    news.slice(0, 10).map((n) => ({ headline: n.headline, sentiment: n.sentiment })),
  );
}

export function computeMacroFingerprint(macro: Record<string, unknown>): string {
  return fingerprint({
    globalMarket: macro.globalMarket ?? null,
    defiHealth: macro.defiHealth ?? null,
    tokenUnlocks: macro.tokenUnlocks ?? null,
    fearGreed: macro.fearGreed ?? null,
  });
}

export interface ScenarioTick {
  price: number;
  volume: number;
  timestamp: number;
}

export function buildScenarioTicks(
  scenario: CostScenario,
  tickCount: number,
): ScenarioTick[] {
  if (tickCount < 2) {
    throw new Error('buildScenarioTicks requires tickCount >= 2 to interpolate a path');
  }

  const startPrice = scenario.previous.close;
  const endPrice = scenario.close;
  const startTime = scenario.previous.takenAt;
  const endTime = scenario.snapshotTakenAt;
  const volume = scenario.indicators.volume.current;
  const lastIndex = tickCount - 1;

  return Array.from({ length: tickCount }, (_, index) => {
    const fraction = index / lastIndex;
    return {
      price: startPrice + (endPrice - startPrice) * fraction,
      volume,
      timestamp: startTime + (endTime - startTime) * fraction,
    };
  });
}

const NOW = 1_800_000_000_000;
const PREVIOUS_TAKEN_AT = NOW - 15 * 60_000;

const NO_POSITIONS: PositionFixture[] = [];
const ONE_PROTECTED_POSITION: PositionFixture[] = [
  {
    id: 'pos-1',
    quantity: 0.42,
    status: 'OPEN',
    protectionStatus: 'PROTECTED',
    stopPrice: 58_500,
    trailingActive: true,
    partialExitCount: 0,
  },
];

const STABLE_NEWS: NewsFixture[] = [
  { headline: 'BTC holds above key support amid range-bound trading', sentiment: 'NEUTRAL' },
  { headline: 'Exchange inflows stay flat week over week', sentiment: 'NEUTRAL' },
];
const NEWS_WITH_NEW_HEADLINE: NewsFixture[] = [
  ...STABLE_NEWS,
  { headline: 'Regulator signals surprise crackdown on stablecoin issuers', sentiment: 'NEGATIVE' },
];

const NO_MACRO: Record<string, unknown> = {};
const STABLE_MACRO: Record<string, unknown> = {
  globalMarket: { totalMarketCapUsd: 2_300_000_000_000, btcDominancePct: 51.2 },
  defiHealth: { tvlUsd: 82_000_000_000 },
  tokenUnlocks: [],
  fearGreed: { value: 54, classification: 'NEUTRAL' },
};

function buildIndicators(overrides: {
  rsi?: number;
  ema9?: number;
  ema21?: number;
  emaTrend?: string;
}): IndicatorSnapshot {
  return {
    rsi: { value: overrides.rsi ?? 52, signal: 'NEUTRAL' as never },
    macd: { macd: 12.4, signal: 10.1, histogram: 2.3, crossover: 'NONE' as never },
    bollingerBands: {
      upper: 61_500,
      middle: 60_000,
      lower: 58_500,
      bandwidth: 0.05,
      position: 'INSIDE' as never,
    },
    emaCross: {
      ema9: overrides.ema9 ?? 60_150,
      ema21: overrides.ema21 ?? 60_000,
      ema50: 59_500,
      ema200: 58_000,
      trend: (overrides.emaTrend ?? 'BULLISH') as never,
    },
    volume: { current: 1_200, average: 1_150, ratio: 1.04, signal: 'NORMAL' as never },
    supportResistance: { support: [58_500], resistance: [61_500] },
    timestamp: NOW,
  };
}

const STABLE_CLOSE = 60_000;
const STABLE_INDICATORS = buildIndicators({});

function buildPrevious(input: {
  close: number;
  indicators: IndicatorSnapshot;
  openPositions: PositionFixture[];
  news: NewsFixture[];
  macro: Record<string, unknown>;
}): DeterministicGateSnapshot {
  return {
    close: input.close,
    rsi: input.indicators.rsi.value,
    ema9: input.indicators.emaCross.ema9,
    ema21: input.indicators.emaCross.ema21,
    emaTrend: input.indicators.emaCross.trend,
    macdCrossover: input.indicators.macd.crossover,
    newsFingerprint: computeNewsFingerprint(input.news),
    macroFingerprint: computeMacroFingerprint(input.macro),
    positionsFingerprint: computePositionsFingerprint(input.openPositions),
    takenAt: PREVIOUS_TAKEN_AT,
  };
}

/**
 * 12 scenarios, frozen at module load (CA-059): 5 "no signal" (all 5 gate
 * conditions hold), 5 "one condition broken" (mirrors CA-039, one per
 * condition), 2 fail-closed (must always call the LLM, never the gate).
 */
export const SCENARIOS: readonly CostScenario[] = Object.freeze([
  // ── Group 1 — no signal: the gate must resolve HOLD without any LLM call ──
  {
    id: 'flat-market-no-position-no-macro',
    withSignal: false,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'flat-market-with-protected-position',
    withSignal: false,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: ONE_PROTECTED_POSITION,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: ONE_PROTECTED_POSITION,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'flat-market-with-macro-context',
    withSignal: false,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: STABLE_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: STABLE_MACRO,
    }),
  },
  {
    id: 'flat-market-with-position-and-macro',
    withSignal: false,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: ONE_PROTECTED_POSITION,
    news: STABLE_NEWS,
    macro: STABLE_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: ONE_PROTECTED_POSITION,
      news: STABLE_NEWS,
      macro: STABLE_MACRO,
    }),
  },
  {
    id: 'flat-market-tiny-price-drift-under-threshold',
    withSignal: false,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: 60_090, // +0.15%, below the 0.5% gatePriceChangePct default
    indicators: buildIndicators({ rsi: 53 }), // Δrsi = 1, within rsiMaxDelta
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },

  // ── Group 2 — one condition broken (mirrors CA-039): the gate must NOT apply ──
  {
    id: 'broken-ema-cross',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: buildIndicators({ ema9: 59_900, ema21: 60_000 }), // sign flips vs previous
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'broken-rsi-overbought',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: buildIndicators({ rsi: 72 }), // out of the 40-60 band
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'broken-price-spike',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: 60_720, // +1.2%, above the 0.5% threshold
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'broken-position-closed',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS, // previous had one open position, now closed
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: ONE_PROTECTED_POSITION,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'broken-breaking-news',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: NEWS_WITH_NEW_HEADLINE, // previous did not see this headline
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },

  // ── Group 3 — fail-closed: would otherwise be "no signal", but must still call the LLM ──
  {
    id: 'fail-closed-reconciliation-unconfirmed',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW,
    reconciliationConfirmed: false, // CE-01
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
  {
    id: 'fail-closed-stale-indicators',
    withSignal: true,
    now: NOW,
    snapshotTakenAt: NOW - 6 * 60_000, // 6 min old, beyond the 5 min snapshotMaxAgeMs
    reconciliationConfirmed: true,
    close: STABLE_CLOSE,
    indicators: STABLE_INDICATORS,
    openPositions: NO_POSITIONS,
    news: STABLE_NEWS,
    macro: NO_MACRO,
    previous: buildPrevious({
      close: STABLE_CLOSE,
      indicators: STABLE_INDICATORS,
      openPositions: NO_POSITIONS,
      news: STABLE_NEWS,
      macro: NO_MACRO,
    }),
  },
]);
