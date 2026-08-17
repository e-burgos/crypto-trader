import {
  PositionManager,
  updateTrailingStop,
  shouldExitByTime,
  resolvePartialTakeProfit,
  applyPartialExit,
  TrailingState,
} from './position-manager';
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

describe('updateTrailingStop', () => {
  const disabledCfg = {
    trailingStopEnabled: false,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
  };
  const enabledCfg = {
    trailingStopEnabled: true,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
  };
  const baseState: TrailingState = {
    entryPrice: 100,
    stopPrice: null,
    highWaterPrice: null,
    trailingActive: false,
  };

  it('tracks the high-water mark but leaves stopPrice untouched when disabled (CA-017)', () => {
    const s1 = updateTrailingStop(baseState, 105, disabledCfg, 0.03);
    expect(s1.stopPrice).toBeNull();
    expect(s1.trailingActive).toBe(false);
    expect(s1.highWaterPrice).toBe(105);

    const s2 = updateTrailingStop(s1, 95, disabledCfg, 0.03);
    expect(s2.stopPrice).toBeNull();
    expect(s2.highWaterPrice).toBe(105);
  });

  it('does not activate before the activation threshold is reached', () => {
    const s1 = updateTrailingStop(baseState, 100.5, enabledCfg, 0.03);
    expect(s1.trailingActive).toBe(false);
    expect(s1.stopPrice).toBeNull();
  });

  it('activates and sets the stop below the high-water mark once activation is reached', () => {
    const s1 = updateTrailingStop(baseState, 102, enabledCfg, 0.03);
    expect(s1.trailingActive).toBe(true);
    expect(s1.stopPrice).toBeCloseTo(102 * (1 - 0.02), 6);
  });

  it('the stop rises with an ascending price sequence and never retreats when price falls back (CA-018)', () => {
    let state = baseState;
    const ascending = [101, 103, 106, 110, 108, 104, 101];
    const seenStops: Array<number | null> = [];

    for (const price of ascending) {
      state = updateTrailingStop(state, price, enabledCfg, 0.03);
      seenStops.push(state.stopPrice);
    }

    for (let i = 1; i < seenStops.length; i++) {
      expect(seenStops[i]!).toBeGreaterThanOrEqual(seenStops[i - 1]!);
    }
    expect(state.stopPrice).toBeCloseTo(110 * (1 - 0.02), 6);
  });

  it('the trailing candidate never pulls the stop below the base stop-loss', () => {
    const activated = updateTrailingStop(baseState, 101.5, enabledCfg, 0.03);
    expect(activated.stopPrice).toBeGreaterThanOrEqual(100 * (1 - 0.03));
  });
});

describe('shouldExitByTime', () => {
  it('never fires when maxHoldMinutes is null (default, CA-017-style regression)', () => {
    const entryAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-05T00:00:00Z');
    expect(shouldExitByTime(entryAt, now, null)).toBe(false);
  });

  it('fires once the position age reaches the configured limit (CA-020)', () => {
    const entryAt = new Date('2026-01-01T00:00:00.000Z');
    const belowLimit = new Date('2026-01-01T00:59:00.000Z');
    const atLimit = new Date('2026-01-01T01:00:00.000Z');

    expect(shouldExitByTime(entryAt, belowLimit, 60)).toBe(false);
    expect(shouldExitByTime(entryAt, atLimit, 60)).toBe(true);
  });
});

describe('resolvePartialTakeProfit', () => {
  const cfg = {
    partialTpEnabled: true,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
  };

  it('returns null when disabled', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg: { ...cfg, partialTpEnabled: false },
      lotStep: 1e-8,
      minNotional: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null once a partial has already been taken (single escalation per cycle-02)', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 1,
      cfg,
      lotStep: 1e-8,
      minNotional: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null below the trigger threshold', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 101.5,
      partialExitCount: 0,
      cfg,
      lotStep: 1e-8,
      minNotional: 0,
    });
    expect(result).toBeNull();
  });

  it('sells the configured fraction and moves the stop to breakeven net of fees (CA-019)', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg,
      lotStep: 1e-8,
      minNotional: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sellQuantity).toBeCloseTo(0.5, 6);
    expect(result!.newStopPrice).toBeCloseTo(100 * (1 + 2 * 0.001), 6);
  });

  it('does not move the stop when moveStopToBreakevenAfterPartial is off', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg: { ...cfg, moveStopToBreakevenAfterPartial: false },
      lotStep: 1e-8,
      minNotional: 0,
    });
    expect(result!.newStopPrice).toBeNull();
  });

  it('is omitted when the sold slice would be below minNotional', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg,
      lotStep: 1e-8,
      minNotional: 1_000_000,
    });
    expect(result).toBeNull();
  });

  it('is omitted when the remaining slice after the partial would be below minNotional', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg: { ...cfg, partialTpSellPct: 0.99 },
      lotStep: 1e-8,
      minNotional: 60,
    });
    // remainder = 0.01 * 103 = 1.03 < 60 -> omitted
    expect(result).toBeNull();
  });

  it('floors the sell quantity to the lot step', () => {
    const result = resolvePartialTakeProfit({
      entryPrice: 100,
      quantity: 1,
      currentPrice: 103,
      partialExitCount: 0,
      cfg,
      lotStep: 0.001,
      minNotional: 0,
    });
    expect(result!.sellQuantity).toBeCloseTo(0.5, 3);
  });
});

describe('applyPartialExit', () => {
  const position: PositionData = {
    id: 'pos-1',
    userId: 'user-1',
    configId: 'cfg-1',
    asset: Asset.BTC,
    pair: QuoteCurrency.USDT,
    mode: TradingMode.SANDBOX,
    entryPrice: 100,
    quantity: 1,
    entryAt: new Date(),
    status: PositionStatus.OPEN,
    fees: 0.1,
  };

  it('reduces the open quantity by exactly the sold amount', () => {
    const result = applyPartialExit(position, 103, 0.5);
    expect(result.quantity).toBeCloseTo(0.5, 8);
  });

  it('realizes PnL net of the exit fee on the sold slice only', () => {
    const result = applyPartialExit(position, 103, 0.5);
    // gross = (103 - 100) * 0.5 = 1.5; fee = 103 * 0.5 * 0.001 = 0.0515
    expect(result.realizedPnlDelta).toBeCloseTo(1.5 - 103 * 0.5 * 0.001, 2);
    expect(result.fees).toBeCloseTo(103 * 0.5 * 0.001, 2);
  });

  it('does not close the position', () => {
    const result = applyPartialExit(position, 103, 0.5);
    expect(result.quantity).toBeGreaterThan(0);
  });
});
