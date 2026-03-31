import { PositionManager } from './position-manager';
import { PositionData, PositionStatus, Asset, QuoteCurrency, TradingMode } from '@crypto-trader/shared';

describe('PositionManager', () => {
  let manager: PositionManager;

  beforeEach(() => {
    manager = new PositionManager();
  });

  const mockOpenPosition: PositionData = {
    id: 'pos-1',
    userId: 'user-1',
    configId: 'cfg-1',
    asset: Asset.BTC,
    pair: QuoteCurrency.USDT,
    mode: TradingMode.SANDBOX,
    entryPrice: 65_000,
    quantity: 0.1,
    entryAt: new Date(),
    status: PositionStatus.OPEN,
    fees: 6.5, // 65000 * 0.1 * 0.001
  };

  describe('openPosition', () => {
    it('should create an open position with calculated fees', () => {
      const position = manager.openPosition({
        userId: 'user-1',
        configId: 'cfg-1',
        asset: Asset.BTC,
        pair: QuoteCurrency.USDT,
        mode: TradingMode.SANDBOX,
        entryPrice: 65_000,
        quantity: 0.1,
      });

      expect(position.status).toBe('OPEN');
      expect(position.entryPrice).toBe(65_000);
      expect(position.quantity).toBe(0.1);
      expect(position.fees).toBeCloseTo(6.5, 2); // entry fee
      expect(position.entryAt).toBeDefined();
    });
  });

  describe('closePosition', () => {
    it('should close with profit', () => {
      const result = manager.closePosition(mockOpenPosition, 70_000);

      expect(result.position.status).toBe('CLOSED');
      expect(result.position.exitPrice).toBe(70_000);
      expect(result.position.exitAt).toBeDefined();
      // PnL = (70000 - 65000) * 0.1 - entry fee (6.5) - exit fee (7.0) = 500 - 13.5 = 486.5
      expect(result.pnl).toBeCloseTo(486.5, 0);
      expect(result.pnlPct).toBeGreaterThan(0);
    });

    it('should close with loss', () => {
      const result = manager.closePosition(mockOpenPosition, 60_000);

      expect(result.pnl).toBeLessThan(0);
      expect(result.pnlPct).toBeLessThan(0);
    });

    it('should close at break-even minus fees', () => {
      const result = manager.closePosition(mockOpenPosition, 65_000);

      // PnL = 0 - entry fee (6.5) - exit fee (6.5) = -13
      expect(result.pnl).toBeCloseTo(-13, 0);
    });
  });

  describe('shouldStopLoss', () => {
    it('should trigger at 3% loss', () => {
      // 3% of 65000 = 1950, so price at 63050 should trigger
      expect(manager.shouldStopLoss(mockOpenPosition, 63_050, 0.03)).toBe(true);
    });

    it('should not trigger above stop loss', () => {
      expect(manager.shouldStopLoss(mockOpenPosition, 64_000, 0.03)).toBe(false);
    });

    it('should not trigger at entry price', () => {
      expect(manager.shouldStopLoss(mockOpenPosition, 65_000, 0.03)).toBe(false);
    });
  });

  describe('shouldTakeProfit', () => {
    it('should trigger at 5% gain', () => {
      // 5% of 65000 = 3250, so price at 68250 should trigger
      expect(manager.shouldTakeProfit(mockOpenPosition, 68_250, 0.05)).toBe(true);
    });

    it('should not trigger below take profit', () => {
      expect(manager.shouldTakeProfit(mockOpenPosition, 67_000, 0.05)).toBe(false);
    });
  });

  describe('calculateUnrealizedPnl', () => {
    it('should calculate positive unrealized PnL', () => {
      const result = manager.calculateUnrealizedPnl(mockOpenPosition, 70_000);
      expect(result.pnl).toBeGreaterThan(0);
      expect(result.pnlPct).toBeGreaterThan(0);
    });

    it('should calculate negative unrealized PnL', () => {
      const result = manager.calculateUnrealizedPnl(mockOpenPosition, 60_000);
      expect(result.pnl).toBeLessThan(0);
      expect(result.pnlPct).toBeLessThan(0);
    });
  });
});
