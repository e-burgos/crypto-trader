const DEFAULT_FEE_PCT = 0.001;

export const SLIPPAGE_PCT_BY_ASSET: Readonly<Record<string, number>> = {
  BTC: 0.0005,
  ETH: 0.001,
  default: 0.0015,
};

export type TradeSide = 'BUY' | 'SELL';

export interface TradeSimulationInput {
  asset: string;
  side: TradeSide;
  price: number;
  quantity: number;
  feePct?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
}

export interface TradeSimulationResult {
  notionalUsd: number;
  feesUsd: number;
  slippagePct: number;
  slippageUsd: number;
  expectedPnlUsd: number;
  expectedNetValueUsd: number;
  downsideUsd: number;
  riskRewardRatio: number;
}

export function simulateTrade(
  input: TradeSimulationInput,
): TradeSimulationResult {
  const feePct = input.feePct ?? DEFAULT_FEE_PCT;
  const stopLossPct = input.stopLossPct ?? 0;
  const takeProfitPct = input.takeProfitPct ?? 0;
  const slippagePct =
    SLIPPAGE_PCT_BY_ASSET[input.asset.toUpperCase()] ??
    SLIPPAGE_PCT_BY_ASSET['default'];

  const notionalUsd = input.price * input.quantity;
  const feesUsd = notionalUsd * feePct;
  const slippageUsd = notionalUsd * slippagePct;

  const expectedGrossPnlUsd =
    takeProfitPct > 0
      ? notionalUsd * takeProfitPct * (input.side === 'BUY' ? 1 : -1)
      : 0;
  const expectedPnlUsd = expectedGrossPnlUsd - feesUsd - slippageUsd;
  const expectedNetValueUsd = notionalUsd + expectedPnlUsd;

  const downsideUsd =
    stopLossPct > 0
      ? notionalUsd * stopLossPct + feesUsd + slippageUsd
      : feesUsd + slippageUsd;

  const riskRewardRatio = downsideUsd === 0 ? 0 : expectedPnlUsd / downsideUsd;

  return {
    notionalUsd: round(notionalUsd),
    feesUsd: round(feesUsd),
    slippagePct,
    slippageUsd: round(slippageUsd),
    expectedPnlUsd: round(expectedPnlUsd),
    expectedNetValueUsd: round(expectedNetValueUsd),
    downsideUsd: round(downsideUsd),
    riskRewardRatio: round4(riskRewardRatio),
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
