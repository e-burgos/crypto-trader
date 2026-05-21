import { TradeSimulationTool } from './trade-simulation.tool';

describe('TradeSimulationTool', () => {
  const tool = new TradeSimulationTool();

  it('calculates slippage for BTC at 0.05%', async () => {
    const result = await tool.execute({
      userId: 'user-1',
      pair: 'BTCUSDT',
      price: 100_000,
      quantity: 0.1,
      side: 'BUY',
    } as any);

    // notional = 100000 * 0.1 = 10000
    // slippage = 10000 * 0.0005 = 5
    expect(result.data.slippagePct).toBe(0.0005);
    expect(result.data.slippageUsd).toBe(5);
  });

  it('calculates slippage for altcoin at 0.15%', async () => {
    const result = await tool.execute({
      userId: 'user-1',
      pair: 'SOLUSDT',
      price: 150,
      quantity: 10,
      side: 'BUY',
    } as any);

    // notional = 150 * 10 = 1500
    // slippage = 1500 * 0.0015 = 2.25
    expect(result.data.slippagePct).toBe(0.0015);
    expect(result.data.slippageUsd).toBe(2.25);
  });

  it('calculates ETH slippage at 0.1%', async () => {
    const result = await tool.execute({
      userId: 'user-1',
      pair: 'ETHUSDT',
      price: 3000,
      quantity: 1,
      side: 'BUY',
    } as any);

    // notional = 3000 * 1 = 3000
    // slippage = 3000 * 0.001 = 3
    expect(result.data.slippagePct).toBe(0.001);
    expect(result.data.slippageUsd).toBe(3);
  });

  it('calculates EV with fees and slippage', async () => {
    const result = await tool.execute({
      userId: 'user-1',
      pair: 'BTCUSDT',
      price: 50_000,
      quantity: 0.1,
      side: 'BUY',
      feePct: 0.001,
      takeProfitPct: 0.05,
      stopLossPct: 0.02,
    } as any);

    const notional = 50_000 * 0.1; // 5000
    const fees = notional * 0.001; // 5
    const slippage = notional * 0.0005; // 2.5
    const grossPnl = notional * 0.05; // 250
    const expectedPnl = grossPnl - fees - slippage; // 242.5
    const downside = notional * 0.02 + fees + slippage; // 107.5

    expect(result.data.notional).toBe(notional);
    expect(result.data.feesUsd).toBe(fees);
    expect(result.data.slippageUsd).toBe(slippage);
    expect(result.data.expectedPnlUsd).toBe(expectedPnl);
    expect(result.data.downsideUsd).toBe(downside);
  });

  it('handles zero quantity gracefully', async () => {
    const result = await tool.execute({
      userId: 'user-1',
      price: 100,
      quantity: 0,
    } as any);

    expect(result.data.notional).toBe(0);
    expect(result.data.feesUsd).toBe(0);
    expect(result.data.slippageUsd).toBe(0);
  });
});
