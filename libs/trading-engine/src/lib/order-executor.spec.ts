import {
  SandboxOrderExecutor,
  LiveOrderExecutor,
  calculateTradeQuantity,
  createTradeRecord,
} from './order-executor';
import { TradingMode, TradeType } from '@crypto-trader/shared';

describe('SandboxOrderExecutor', () => {
  let executor: SandboxOrderExecutor;

  beforeEach(() => {
    executor = new SandboxOrderExecutor(10_000);
    executor.setPrice('BTCUSDT', 65_000);
  });

  describe('BUY', () => {
    it('should execute a buy order and update balances', async () => {
      const order = await executor.placeMarketOrder(
        'BTCUSDT',
        TradeType.BUY,
        0.1,
      );

      expect(order.side).toBe('BUY');
      expect(order.price).toBe(65_000);
      expect(order.quantity).toBe(0.1);
      expect(order.status).toBe('FILLED');

      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBe(0.1);

      const usdtBalance = await executor.getBalance('USDT');
      // 10000 - (65000 * 0.1) - (65000 * 0.1 * 0.001)
      expect(usdtBalance.free).toBeCloseTo(10_000 - 6500 - 6.5, 2);
    });

    it('should reject buy with insufficient balance', async () => {
      await expect(
        executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 1),
      ).rejects.toThrow('Insufficient USDT balance');
    });
  });

  describe('SELL', () => {
    it('should execute a sell order after buying', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);

      executor.setPrice('BTCUSDT', 70_000);
      const order = await executor.placeMarketOrder(
        'BTCUSDT',
        TradeType.SELL,
        0.1,
      );

      expect(order.side).toBe('SELL');
      expect(order.price).toBe(70_000);

      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBe(0);

      const usdtBalance = await executor.getBalance('USDT');
      // Started: 10000, spent 6506.5 on buy, received 7000 - 7 fee = 6993 on sell
      expect(usdtBalance.free).toBeGreaterThan(10_000);
    });

    it('should reject sell with insufficient base balance', async () => {
      await expect(
        executor.placeMarketOrder('BTCUSDT', TradeType.SELL, 1),
      ).rejects.toThrow('Insufficient BTC balance');
    });
  });

  describe('getPrice', () => {
    it('should return set price', async () => {
      const price = await executor.getPrice('BTCUSDT');
      expect(price).toBe(65_000);
    });

    it('should throw for unset symbol', async () => {
      await expect(executor.getPrice('ETHUSDT')).rejects.toThrow(
        'No sandbox price',
      );
    });
  });

  describe('getBalance', () => {
    it('should return zero for unknown asset', async () => {
      const balance = await executor.getBalance('SOL');
      expect(balance.free).toBe(0);
    });
  });

  describe('symbol parsing', () => {
    it('should handle USDC pairs', async () => {
      executor.setPrice('BTCUSDC', 65_000);

      const initialUsdc = await executor.getBalance('USDC');
      expect(initialUsdc.free).toBe(10_000);

      await executor.placeMarketOrder('BTCUSDC', TradeType.BUY, 0.01);
      const usdc = await executor.getBalance('USDC');
      expect(usdc.free).toBeLessThan(10_000);
    });
  });

  describe('placeLimitOrder', () => {
    it('fills immediately at the requested price', async () => {
      const order = await executor.placeLimitOrder(
        'BTCUSDT',
        TradeType.BUY,
        0.1,
        64_000,
      );

      expect(order.price).toBe(64_000);
      expect(order.status).toBe('FILLED');
      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBe(0.1);
    });
  });

  describe('placeStopLossLimitOrder', () => {
    it('fills immediately at the limit price', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);

      const order = await executor.placeStopLossLimitOrder(
        'BTCUSDT',
        TradeType.SELL,
        0.1,
        63_000,
        62_900,
      );

      expect(order.price).toBe(62_900);
      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBe(0);
    });
  });

  describe('protection order lifecycle', () => {
    it('placeProtectionOrder moves quantity from free to locked', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);

      const result = await executor.placeProtectionOrder({
        symbol: 'BTCUSDT',
        quantity: 0.1,
        stopPrice: 63_000,
        stopLimitPrice: 62_900,
        takeProfitPrice: 70_000,
        referencePrice: 65_000,
      });

      expect(result.kind).toBe('SIMULATED');
      expect(result.orderListId).toMatch(/^sandbox-oco-\d+$/);
      expect(result.stopOrderId).toBeNull();
      expect(result.limitOrderId).toBeNull();

      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBeCloseTo(0, 8);
      expect(btcBalance.locked).toBeCloseTo(0.1, 8);
    });

    it('getProtectionOrderStatus reports MISSING for an unknown ref', async () => {
      const status = await executor.getProtectionOrderStatus('BTCUSDT', {
        orderListId: 'does-not-exist',
      });
      expect(status.state).toBe('MISSING');
    });

    it('getProtectionOrderStatus reports ACTIVE while price sits between the legs', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);
      const placed = await executor.placeProtectionOrder({
        symbol: 'BTCUSDT',
        quantity: 0.1,
        stopPrice: 63_000,
        stopLimitPrice: 62_900,
        takeProfitPrice: 70_000,
        referencePrice: 65_000,
      });

      const status = await executor.getProtectionOrderStatus('BTCUSDT', {
        orderListId: placed.orderListId ?? undefined,
      });
      expect(status.state).toBe('ACTIVE');
    });

    it('getProtectionOrderStatus reports FILLED/STOP when price drops to the stop level', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);
      const placed = await executor.placeProtectionOrder({
        symbol: 'BTCUSDT',
        quantity: 0.1,
        stopPrice: 63_000,
        stopLimitPrice: 62_900,
        takeProfitPrice: 70_000,
        referencePrice: 65_000,
      });

      executor.setPrice('BTCUSDT', 62_000);
      const status = await executor.getProtectionOrderStatus('BTCUSDT', {
        orderListId: placed.orderListId ?? undefined,
      });

      expect(status.state).toBe('FILLED');
      expect(status.filledLeg).toBe('STOP');
      expect(status.executedPrice).toBe(62_000);
      expect(status.executedQuantity).toBe(0.1);
    });

    it('getProtectionOrderStatus reports FILLED/TAKE_PROFIT when price rises to the target', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);
      const placed = await executor.placeProtectionOrder({
        symbol: 'BTCUSDT',
        quantity: 0.1,
        stopPrice: 63_000,
        stopLimitPrice: 62_900,
        takeProfitPrice: 70_000,
        referencePrice: 65_000,
      });

      executor.setPrice('BTCUSDT', 71_000);
      const status = await executor.getProtectionOrderStatus('BTCUSDT', {
        orderListId: placed.orderListId ?? undefined,
      });

      expect(status.state).toBe('FILLED');
      expect(status.filledLeg).toBe('TAKE_PROFIT');
    });

    it('cancelProtectionOrder releases the locked quantity back to free', async () => {
      await executor.placeMarketOrder('BTCUSDT', TradeType.BUY, 0.1);
      const placed = await executor.placeProtectionOrder({
        symbol: 'BTCUSDT',
        quantity: 0.1,
        stopPrice: 63_000,
        stopLimitPrice: 62_900,
        takeProfitPrice: 70_000,
        referencePrice: 65_000,
      });

      await executor.cancelProtectionOrder('BTCUSDT', {
        orderListId: placed.orderListId ?? undefined,
      });

      const btcBalance = await executor.getBalance('BTC');
      expect(btcBalance.free).toBeCloseTo(0.1, 8);
      expect(btcBalance.locked).toBeCloseTo(0, 8);

      const status = await executor.getProtectionOrderStatus('BTCUSDT', {
        orderListId: placed.orderListId ?? undefined,
      });
      expect(status.state).toBe('MISSING');
    });

    it('cancelProtectionOrder is a no-op without an orderListId', async () => {
      await expect(
        executor.cancelProtectionOrder('BTCUSDT', {}),
      ).resolves.toBeUndefined();
    });
  });
});

describe('LiveOrderExecutor', () => {
  function createBinanceMock() {
    return {
      placeMarketOrder: vi.fn(),
      getBalances: vi.fn(),
      getTickerPrice: vi.fn(),
      placeLimitOrder: vi.fn(),
      placeStopLossLimitOrder: vi.fn(),
      placeOcoSellOrder: vi.fn(),
      getOcoStatus: vi.fn(),
      cancelOcoOrderList: vi.fn(),
    };
  }

  it('delegates placeMarketOrder to the binance client', async () => {
    const binance = createBinanceMock();
    const order = {
      orderId: '1',
      symbol: 'BTCUSDT',
      side: TradeType.BUY,
      price: 65000,
      quantity: 0.1,
      status: 'FILLED',
      executedAt: new Date(),
    };
    binance.placeMarketOrder.mockResolvedValue(order);
    const executor = new LiveOrderExecutor(binance);

    const result = await executor.placeMarketOrder(
      'BTCUSDT',
      TradeType.BUY,
      0.1,
    );

    expect(result).toBe(order);
    expect(binance.placeMarketOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      TradeType.BUY,
      0.1,
    );
  });

  it('delegates placeLimitOrder and placeStopLossLimitOrder', async () => {
    const binance = createBinanceMock();
    const executor = new LiveOrderExecutor(binance);

    await executor.placeLimitOrder('BTCUSDT', TradeType.BUY, 0.1, 64000);
    expect(binance.placeLimitOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      TradeType.BUY,
      0.1,
      64000,
    );

    await executor.placeStopLossLimitOrder(
      'BTCUSDT',
      TradeType.SELL,
      0.1,
      63000,
      62900,
    );
    expect(binance.placeStopLossLimitOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      TradeType.SELL,
      0.1,
      63000,
      62900,
    );
  });

  it('placeProtectionOrder delegates to placeOcoSellOrder and maps to kind OCO', async () => {
    const binance = createBinanceMock();
    const placedAt = new Date();
    binance.placeOcoSellOrder.mockResolvedValue({
      orderListId: 'ol-1',
      stopOrderId: 'so-1',
      limitOrderId: 'lo-1',
      placedAt,
    });
    const executor = new LiveOrderExecutor(binance);

    const result = await executor.placeProtectionOrder({
      symbol: 'BTCUSDT',
      quantity: 0.1,
      stopPrice: 63000,
      stopLimitPrice: 62900,
      takeProfitPrice: 70000,
      referencePrice: 65000,
      clientOrderId: 'prot-1-1',
    });

    expect(binance.placeOcoSellOrder).toHaveBeenCalledWith('BTCUSDT', {
      quantity: 0.1,
      takeProfitPrice: 70000,
      stopPrice: 63000,
      stopLimitPrice: 62900,
      listClientOrderId: 'prot-1-1',
      referencePrice: 65000,
    });
    expect(result).toEqual({
      kind: 'OCO',
      orderListId: 'ol-1',
      stopOrderId: 'so-1',
      limitOrderId: 'lo-1',
      placedAt,
    });
  });

  it('getProtectionOrderStatus delegates to getOcoStatus when a ref is present', async () => {
    const binance = createBinanceMock();
    const status = {
      state: 'ACTIVE' as const,
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      orderId: null,
    };
    binance.getOcoStatus.mockResolvedValue(status);
    const executor = new LiveOrderExecutor(binance);

    const result = await executor.getProtectionOrderStatus('BTCUSDT', {
      orderListId: 'ol-1',
    });

    expect(result).toBe(status);
    expect(binance.getOcoStatus).toHaveBeenCalledWith('BTCUSDT', 'ol-1');
  });

  it('getProtectionOrderStatus returns MISSING without calling the client when the ref has no orderListId', async () => {
    const binance = createBinanceMock();
    const executor = new LiveOrderExecutor(binance);

    const result = await executor.getProtectionOrderStatus('BTCUSDT', {});

    expect(result.state).toBe('MISSING');
    expect(binance.getOcoStatus).not.toHaveBeenCalled();
  });

  it('cancelProtectionOrder delegates to cancelOcoOrderList when a ref is present', async () => {
    const binance = createBinanceMock();
    const executor = new LiveOrderExecutor(binance);

    await executor.cancelProtectionOrder('BTCUSDT', { orderListId: 'ol-1' });

    expect(binance.cancelOcoOrderList).toHaveBeenCalledWith(
      'BTCUSDT',
      'ol-1',
    );
  });

  it('cancelProtectionOrder is a no-op without an orderListId', async () => {
    const binance = createBinanceMock();
    const executor = new LiveOrderExecutor(binance);

    await executor.cancelProtectionOrder('BTCUSDT', {});

    expect(binance.cancelOcoOrderList).not.toHaveBeenCalled();
  });

  it('delegates getBalance and getPrice', async () => {
    const binance = createBinanceMock();
    binance.getBalances.mockResolvedValue([
      { asset: 'BTC', free: 1, locked: 0 },
    ]);
    binance.getTickerPrice.mockResolvedValue(65000);
    const executor = new LiveOrderExecutor(binance);

    expect(await executor.getBalance('BTC')).toEqual({
      asset: 'BTC',
      free: 1,
      locked: 0,
    });
    expect(await executor.getBalance('ETH')).toEqual({
      asset: 'ETH',
      free: 0,
      locked: 0,
    });
    expect(await executor.getPrice('BTCUSDT')).toBe(65000);
  });
});

describe('calculateTradeQuantity', () => {
  it('should calculate quantity based on balance and max trade pct', () => {
    const quantity = calculateTradeQuantity(10_000, 65_000, 0.05);
    // 10000 * 0.05 / 65000 = 0.00769230...
    expect(quantity).toBeCloseTo(0.0076923, 4);
  });

  it('should return 0 for zero balance', () => {
    expect(calculateTradeQuantity(0, 65000, 0.05)).toBe(0);
  });

  it('should floor to 8 decimal places', () => {
    const qty = calculateTradeQuantity(100, 3, 1);
    // 100 / 3 = 33.33333... → floored to 8 decimals
    const decimals = qty.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(8);
  });
});

describe('createTradeRecord', () => {
  it('should create a trade record from order result', () => {
    const order: import('@crypto-trader/shared').OrderResult = {
      orderId: 'test-123',
      symbol: 'BTCUSDT',
      side: TradeType.BUY,
      price: 65000,
      quantity: 0.1,
      status: 'FILLED',
      executedAt: new Date(),
    };

    const record = createTradeRecord(
      order,
      'user-1',
      'pos-1',
      TradingMode.SANDBOX,
    );

    expect(record.userId).toBe('user-1');
    expect(record.positionId).toBe('pos-1');
    expect(record.type).toBe('BUY');
    expect(record.price).toBe(65000);
    expect(record.quantity).toBe(0.1);
    expect(record.fee).toBeCloseTo(6.5, 2); // 65000 * 0.1 * 0.001
    expect(record.mode).toBe('SANDBOX');
    expect(record.binanceOrderId).toBe('test-123');
  });
});
