import { simulateTrade, SLIPPAGE_PCT_BY_ASSET } from './trade-simulation';

describe('simulateTrade', () => {
  it('calculates slippage for BTC at 0.05%', () => {
    const result = simulateTrade({
      asset: 'BTC',
      side: 'BUY',
      price: 100_000,
      quantity: 0.1,
    });

    // notional = 100000 * 0.1 = 10000
    // slippage = 10000 * 0.0005 = 5
    expect(result.slippagePct).toBe(0.0005);
    expect(result.slippageUsd).toBe(5);
  });

  it('calculates slippage for an unlisted asset at the default rate', () => {
    const result = simulateTrade({
      asset: 'SOL',
      side: 'BUY',
      price: 150,
      quantity: 10,
    });

    // notional = 150 * 10 = 1500
    // slippage = 1500 * 0.0015 = 2.25
    expect(result.slippagePct).toBe(0.0015);
    expect(result.slippageUsd).toBe(2.25);
  });

  it('calculates ETH slippage at 0.1%', () => {
    const result = simulateTrade({
      asset: 'ETH',
      side: 'BUY',
      price: 3000,
      quantity: 1,
    });

    // notional = 3000 * 1 = 3000
    // slippage = 3000 * 0.001 = 3
    expect(result.slippagePct).toBe(0.001);
    expect(result.slippageUsd).toBe(3);
  });

  it('calculates EV with fees and slippage', () => {
    const result = simulateTrade({
      asset: 'BTC',
      side: 'BUY',
      price: 50_000,
      quantity: 0.1,
      feePct: 0.001,
      takeProfitPct: 0.05,
      stopLossPct: 0.02,
    });

    const notional = 50_000 * 0.1; // 5000
    const fees = notional * 0.001; // 5
    const slippage = notional * 0.0005; // 2.5
    const grossPnl = notional * 0.05; // 250
    const expectedPnl = grossPnl - fees - slippage; // 242.5
    const downside = notional * 0.02 + fees + slippage; // 107.5

    expect(result.notionalUsd).toBe(notional);
    expect(result.feesUsd).toBe(fees);
    expect(result.slippageUsd).toBe(slippage);
    expect(result.expectedPnlUsd).toBe(expectedPnl);
    expect(result.downsideUsd).toBe(downside);
    expect(result.riskRewardRatio).toBeCloseTo(expectedPnl / downside, 4);
  });

  it('handles zero quantity gracefully', () => {
    const result = simulateTrade({
      asset: 'BTC',
      side: 'BUY',
      price: 100,
      quantity: 0,
    });

    expect(result.notionalUsd).toBe(0);
    expect(result.feesUsd).toBe(0);
    expect(result.slippageUsd).toBe(0);
    expect(result.riskRewardRatio).toBe(0);
  });

  it('inverts expected gross P&L for SELL side', () => {
    const result = simulateTrade({
      asset: 'BTC',
      side: 'SELL',
      price: 50_000,
      quantity: 0.1,
      takeProfitPct: 0.05,
    });

    const notional = 5000;
    const grossPnl = -(notional * 0.05);
    expect(result.expectedPnlUsd).toBeLessThan(0);
    expect(result.expectedPnlUsd).toBeCloseTo(
      grossPnl - result.feesUsd - result.slippageUsd,
      2,
    );
  });

  it('riskRewardRatio is 0 when downside is 0', () => {
    const result = simulateTrade({
      asset: 'BTC',
      side: 'BUY',
      price: 100,
      quantity: 0,
      feePct: 0,
    });

    expect(result.downsideUsd).toBe(0);
    expect(result.riskRewardRatio).toBe(0);
  });

  it('exposes SLIPPAGE_PCT_BY_ASSET for callers that need the raw table', () => {
    expect(SLIPPAGE_PCT_BY_ASSET.BTC).toBe(0.0005);
    expect(SLIPPAGE_PCT_BY_ASSET.ETH).toBe(0.001);
    expect(SLIPPAGE_PCT_BY_ASSET.default).toBe(0.0015);
  });
});
