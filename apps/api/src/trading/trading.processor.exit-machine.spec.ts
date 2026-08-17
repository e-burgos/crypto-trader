import { TradingProcessor } from './trading.processor';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — checkOpenPositions exit state machine (TASK-014)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
  };

  function makePrismaMock(positions: any[]) {
    return {
      position: {
        findMany: jest.fn().mockResolvedValue(positions),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
      sandboxWallet: {
        upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
      },
      $transaction: jest.fn(async (fn: any) =>
        fn({
          sandboxWallet: {
            upsert: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue({ balance: 10_100 }),
          },
        }),
      ),
    };
  }

  function buildProcessor(prisma: any) {
    return new TradingProcessor(
      prisma,
      gatewayMock as any,
      notificationsMock as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      aggregateRiskServiceMock as any,
    );
  }

  const basePosition = {
    id: 'pos-1',
    userId: 'user-1',
    configId: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    entryPrice: 100,
    quantity: 1,
    entryAt: new Date(),
    status: 'OPEN',
    exitPrice: null,
    exitAt: null,
    pnl: null,
    fees: 0,
    stopPrice: null,
    highWaterPrice: null,
    trailingActive: false,
    initialQuantity: null,
    partialExitCount: 0,
    realizedPnl: 0,
    protectionStatus: 'NONE',
  };

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    trailingStopEnabled: false,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
    maxPositionHoldMinutes: null,
  };

  async function runCheck(prisma: any, config: any, price: number, decisionContext?: any) {
    const processor = buildProcessor(prisma);
    await (processor as any).checkOpenPositions(
      'user-1',
      config,
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      price,
      decisionContext,
    );
    return prisma;
  }

  describe('all three tools at default — regression (CA-017 / CA-021)', () => {
    it('still exits on the plain stop-loss, same as before this cycle', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      await runCheck(prisma, baseConfig, 96);

      expect(prisma.trade.create).toHaveBeenCalledTimes(1);
      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'STOP_LOSS' }),
        }),
      );
    });

    it('still exits on the plain take-profit, same as before this cycle', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      await runCheck(prisma, baseConfig, 106);

      expect(prisma.trade.create).toHaveBeenCalledTimes(1);
      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'TAKE_PROFIT' }),
        }),
      );
    });

    it('holds the position with prices between the stop and the take-profit', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      await runCheck(prisma, baseConfig, 101);

      expect(prisma.trade.create).not.toHaveBeenCalled();
    });
  });

  describe('priority order — time > stop > partial > take-profit > trailing update', () => {
    it('a time-exit fires even when the price is also above take-profit', async () => {
      const staleEntry = new Date(Date.now() - 2 * 60_000);
      const prisma = makePrismaMock([
        { ...basePosition, entryAt: staleEntry },
      ]);
      await runCheck(prisma, { ...baseConfig, maxPositionHoldMinutes: 1 }, 106);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exitReason: 'TIME_EXIT' }),
        }),
      );
    });

    it('a stop-loss fires ahead of an eligible partial take-profit', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, partialTpEnabled: true, partialTpTriggerPct: 0.02 };

      await runCheck(prisma, cfg, 96);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'STOP_LOSS' }),
        }),
      );
    });

    it('an eligible partial take-profit fires ahead of the fixed take-profit', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = {
        ...baseConfig,
        partialTpEnabled: true,
        partialTpTriggerPct: 0.02,
        partialTpSellPct: 0.5,
      };

      await runCheck(prisma, cfg, 106);

      const update = prisma.position.update.mock.calls.at(-1)[0];
      expect(update.data.partialExitCount).toBe(1);
      expect(update.data.status).toBeUndefined();
    });
  });

  describe('trailing stop (CA-018)', () => {
    it('with trailing enabled, the stop rises and the position holds while price climbs', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, trailingStopEnabled: true };

      await runCheck(prisma, cfg, 103);

      expect(prisma.trade.create).not.toHaveBeenCalled();
      const update = prisma.position.update.mock.calls.at(-1)[0];
      expect(update.data.stopPrice).toBeCloseTo(103 * (1 - 0.02), 6);
      expect(update.data.trailingActive).toBe(true);
    });

    it('the trailed stop never retreats across cycles even when price pulls back', async () => {
      const prisma1 = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, trailingStopEnabled: true };
      await runCheck(prisma1, cfg, 110);
      const firstStop = prisma1.position.update.mock.calls.at(-1)[0].data.stopPrice;

      const prisma2 = makePrismaMock([
        {
          ...basePosition,
          stopPrice: firstStop,
          highWaterPrice: 110,
          trailingActive: true,
        },
      ]);
      await runCheck(prisma2, cfg, 108);

      expect(prisma2.trade.create).not.toHaveBeenCalled();
      // No field moved (stop already reflects the prior high), so no write is
      // needed — and crucially the stop was never lowered back down.
      if (prisma2.position.update.mock.calls.length > 0) {
        const secondStop = prisma2.position.update.mock.calls.at(-1)[0].data.stopPrice;
        expect(secondStop).toBe(firstStop);
      }
    });

    it('disables the fixed take-profit while trailing is active', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, trailingStopEnabled: true };

      await runCheck(prisma, cfg, 106);

      expect(prisma.trade.create).not.toHaveBeenCalled();
      const update = prisma.position.update.mock.calls.at(-1)[0];
      expect(update.data.status).toBeUndefined();
    });

    it('the trailed stop can still trigger an exit, tagged as TRAILING_STOP', async () => {
      const prisma = makePrismaMock([
        {
          ...basePosition,
          stopPrice: 107.8,
          highWaterPrice: 110,
          trailingActive: true,
        },
      ]);
      const cfg = { ...baseConfig, trailingStopEnabled: true };

      await runCheck(prisma, cfg, 107);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'TRAILING_STOP' }),
        }),
      );
    });
  });

  describe('partial take-profit (CA-019)', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
      jest
        .spyOn(BinanceRestClient.prototype, 'getSymbolFilters')
        .mockResolvedValue({
          lotSize: { minQty: 0, maxQty: 100, stepSize: 0.0001 },
          price: { minPrice: 0, maxPrice: 0, tickSize: 0.01 },
          notional: { minNotional: 5, applyToMarket: true },
        } as any);
    });

    it('sells half the position and moves the stop to breakeven net of fees', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, partialTpEnabled: true, partialTpTriggerPct: 0.02 };

      await runCheck(prisma, cfg, 103);

      expect(prisma.trade.create).toHaveBeenCalledTimes(1);
      const tradeArgs = prisma.trade.create.mock.calls[0][0].data;
      expect(tradeArgs.quantity).toBeCloseTo(0.5, 4);

      const update = prisma.position.update.mock.calls.at(-1)[0];
      expect(update.data.quantity).toBeCloseTo(0.5, 4);
      expect(update.data.partialExitCount).toBe(1);
      expect(update.data.stopPrice).toBeCloseTo(100 * (1 + 2 * 0.001), 4);
      expect(update.data.status).toBeUndefined();
    });

    it('does not fire a second partial once partialExitCount is already 1', async () => {
      const prisma = makePrismaMock([
        { ...basePosition, partialExitCount: 1, quantity: 0.5 },
      ]);
      const cfg = { ...baseConfig, partialTpEnabled: true, partialTpTriggerPct: 0.02 };

      await runCheck(prisma, cfg, 108);

      const update = prisma.position.update.mock.calls.at(-1)[0];
      expect(update.data.partialExitCount).toBeUndefined();
    });

    it('omits the partial when the remainder would fall below minNotional and falls through to take-profit instead', async () => {
      jest.restoreAllMocks();
      jest
        .spyOn(BinanceRestClient.prototype, 'getSymbolFilters')
        .mockResolvedValue({
          lotSize: { minQty: 0, maxQty: 100, stepSize: 0.0001 },
          price: { minPrice: 0, maxPrice: 0, tickSize: 0.01 },
          notional: { minNotional: 60, applyToMarket: true },
        } as any);

      const prisma = makePrismaMock([{ ...basePosition, quantity: 1 }]);
      const cfg = {
        ...baseConfig,
        partialTpEnabled: true,
        partialTpTriggerPct: 0.02,
        partialTpSellPct: 0.99,
      };

      await runCheck(prisma, cfg, 106);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'TAKE_PROFIT' }),
        }),
      );
    });

    it('carries the current cycle decisionId on the partial Trade record', async () => {
      const prisma = makePrismaMock([{ ...basePosition }]);
      const cfg = { ...baseConfig, partialTpEnabled: true, partialTpTriggerPct: 0.02 };

      await runCheck(prisma, cfg, 103, { decisionId: 'dec-cycle-1', confidence: 0.9 });

      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decisionId: 'dec-cycle-1' }),
        }),
      );
    });
  });

  describe('time exit (CA-020)', () => {
    it('never fires when maxPositionHoldMinutes is null (default)', async () => {
      const staleEntry = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const prisma = makePrismaMock([{ ...basePosition, entryAt: staleEntry }]);

      await runCheck(prisma, baseConfig, 101);

      expect(prisma.trade.create).not.toHaveBeenCalled();
    });

    it('fires once the position age reaches the configured limit', async () => {
      const staleEntry = new Date(Date.now() - 5 * 60_000);
      const prisma = makePrismaMock([{ ...basePosition, entryAt: staleEntry }]);
      const cfg = { ...baseConfig, maxPositionHoldMinutes: 5 };

      await runCheck(prisma, cfg, 101);

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'TIME_EXIT' }),
        }),
      );
    });
  });
});
