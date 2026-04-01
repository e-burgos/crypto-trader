import {
  SandboxOrderExecutor,
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
