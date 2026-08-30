import { PositionActionService } from './position-action.service';
import { TradeType, TradingMode } from '@crypto-trader/shared';

describe('PositionActionService', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  function makePrismaMock() {
    return {
      position: {
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({ id: 'trade-1' }) },
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

  function buildService(prisma: any) {
    return new PositionActionService(
      prisma,
      gatewayMock as any,
      notificationsMock as any,
    );
  }

  const basePosition = {
    id: 'pos-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    status: 'OPEN',
    entryPrice: 100,
    quantity: 1,
    fees: 0,
    exitPrice: null,
    exitAt: null,
    pnl: null,
    protectionStatus: 'NONE',
    protectionOrderListId: null,
    protectionStopOrderId: null,
  };

  const baseConfig = {
    asset: 'BTC',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    nativeProtectionEnabled: true,
    closeOnProtectionFailure: false,
  };

  beforeEach(() => {
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  describe('closeAtMarket (CA-006)', () => {
    it('releases an active native protection order before selling — order of invocation', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const cancelProtectionOrder = jest.fn().mockResolvedValue(undefined);
      const placeMarketOrder = jest
        .fn()
        .mockResolvedValue({ orderId: 'o-1', price: 95, quantity: 1 });
      const executor = { cancelProtectionOrder, placeMarketOrder } as any;

      await service.closeAtMarket({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: { ...basePosition, protectionStatus: 'PROTECTED' },
        positionData: { ...basePosition, protectionStatus: 'PROTECTED' },
        exitReason: 'STOP_LOSS',
      });

      expect(cancelProtectionOrder).toHaveBeenCalledTimes(1);
      expect(placeMarketOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        TradeType.SELL,
        1,
      );
      expect(
        cancelProtectionOrder.mock.invocationCallOrder[0],
      ).toBeLessThan(placeMarketOrder.mock.invocationCallOrder[0]);
    });

    it('does not attempt to cancel protection when the position has none active', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const cancelProtectionOrder = jest.fn().mockResolvedValue(undefined);
      const placeMarketOrder = jest
        .fn()
        .mockResolvedValue({ orderId: 'o-1', price: 95, quantity: 1 });
      const executor = { cancelProtectionOrder, placeMarketOrder } as any;

      await service.closeAtMarket({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: basePosition,
        positionData: basePosition,
        exitReason: 'STOP_LOSS',
      });

      expect(cancelProtectionOrder).not.toHaveBeenCalled();
      expect(placeMarketOrder).toHaveBeenCalledTimes(1);
    });

    it('persists the closed position, records the SELL trade and returns tradeId + exitPrice', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        cancelProtectionOrder: jest.fn(),
        placeMarketOrder: jest
          .fn()
          .mockResolvedValue({ orderId: 'o-1', price: 95, quantity: 1 }),
      } as any;

      const result = await service.closeAtMarket({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: basePosition,
        positionData: basePosition,
        exitReason: 'TAKE_PROFIT',
      });

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pos-1' },
          data: expect.objectContaining({ status: 'CLOSED', exitReason: 'TAKE_PROFIT' }),
        }),
      );
      expect(prisma.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: TradeType.SELL, price: 95 }),
        }),
      );
      expect(result).toEqual({ tradeId: 'trade-1', exitPrice: 95 });
    });

    it('credits the sandbox wallet through a single $transaction in SANDBOX mode', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        cancelProtectionOrder: jest.fn(),
        placeMarketOrder: jest
          .fn()
          .mockResolvedValue({ orderId: 'o-1', price: 95, quantity: 1 }),
      } as any;

      await service.closeAtMarket({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.SANDBOX,
        executor,
        position: { ...basePosition, mode: 'SANDBOX' },
        positionData: { ...basePosition, mode: 'SANDBOX' },
        exitReason: 'STOP_LOSS',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('executePartialTakeProfit', () => {
    it('releases native protection before placing the partial SELL order', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const cancelProtectionOrder = jest.fn().mockResolvedValue(undefined);
      const placeMarketOrder = jest
        .fn()
        .mockResolvedValue({ orderId: 'o-2', price: 103, quantity: 0.5 });
      const executor = { cancelProtectionOrder, placeMarketOrder } as any;

      const result = await service.executePartialTakeProfit({
        userId: 'user-1',
        config: { ...baseConfig, nativeProtectionEnabled: false },
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: { ...basePosition, protectionStatus: 'PROTECTED' },
        positionData: { ...basePosition, protectionStatus: 'PROTECTED' },
        partial: { sellQuantity: 0.5, newStopPrice: 101 },
        trailingState: {
          entryPrice: 100,
          stopPrice: 97,
          highWaterPrice: 103,
          trailingActive: false,
        },
      });

      expect(cancelProtectionOrder).toHaveBeenCalledTimes(1);
      expect(placeMarketOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        TradeType.SELL,
        0.5,
      );
      expect(
        cancelProtectionOrder.mock.invocationCallOrder[0],
      ).toBeLessThan(placeMarketOrder.mock.invocationCallOrder[0]);
      expect(result).toEqual({ tradeId: 'trade-1' });
    });
  });

  describe('rearmProtection', () => {
    it('cancels the existing OCO and places a new one for the moved stop, returning PROTECTED', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        cancelProtectionOrder: jest.fn().mockResolvedValue(undefined),
        getPrice: jest.fn().mockResolvedValue(110),
        placeProtectionOrder: jest.fn().mockResolvedValue({
          kind: 'OCO',
          orderListId: 'ol-2',
          stopOrderId: 'so-2',
          limitOrderId: 'lo-2',
          placedAt: new Date(),
        }),
      } as any;

      const result = await service.rearmProtection({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: {
          ...basePosition,
          protectionStatus: 'PROTECTED',
          protectionOrderListId: 'ol-1',
          protectionStopOrderId: 'so-1',
        },
        levels: { stopPrice: 107.8, takeProfitPrice: 130, quantity: 1 },
      });

      expect(executor.cancelProtectionOrder).toHaveBeenCalledWith('BTCUSDT', {
        orderListId: 'ol-1',
        stopOrderId: 'so-1',
      });
      expect(executor.placeProtectionOrder).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ protectionStatus: 'PROTECTED' });
    });

    it('returns UNPROTECTED without re-placing when cancellation fails', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        cancelProtectionOrder: jest
          .fn()
          .mockRejectedValue(new Error('exchange unreachable')),
        placeProtectionOrder: jest.fn(),
      } as any;

      const result = await service.rearmProtection({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: {
          ...basePosition,
          protectionStatus: 'PROTECTED',
          protectionOrderListId: 'ol-1',
          protectionStopOrderId: 'so-1',
        },
        levels: { stopPrice: 107.8, takeProfitPrice: 130, quantity: 1 },
      });

      expect(executor.placeProtectionOrder).not.toHaveBeenCalled();
      expect(result).toEqual({ protectionStatus: 'UNPROTECTED' });
      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ protectionStatus: 'UNPROTECTED' }),
        }),
      );
    });
  });

  describe('placeInitialProtection', () => {
    it('places protection for a freshly opened position and marks it PROTECTED', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        placeProtectionOrder: jest.fn().mockResolvedValue({
          kind: 'OCO',
          orderListId: 'ol-1',
          stopOrderId: 'so-1',
          limitOrderId: 'lo-1',
          placedAt: new Date(),
        }),
      } as any;

      await service.placeInitialProtection({
        userId: 'user-1',
        config: baseConfig,
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        executor,
        position: basePosition,
        order: { price: 100, quantity: 1 },
      });

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            protectionStatus: 'PROTECTED',
            protectionOrderListId: 'ol-1',
          }),
        }),
      );
    });

    it('marks the position UNPROTECTED, without throwing, when placement fails definitively', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const executor = {
        placeProtectionOrder: jest
          .fn()
          .mockRejectedValue({ response: { data: { code: -2010, msg: 'Account has insufficient balance' } } }),
      } as any;

      await expect(
        service.placeInitialProtection({
          userId: 'user-1',
          config: baseConfig,
          symbol: 'BTCUSDT',
          mode: TradingMode.LIVE,
          executor,
          position: basePosition,
          order: { price: 100, quantity: 1 },
        }),
      ).resolves.toBeUndefined();

      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ protectionStatus: 'UNPROTECTED' }),
        }),
      );
    });
  });

  describe('releaseProtectionIfNeeded', () => {
    it('does nothing when the position has no active protection', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const cancelProtectionOrder = jest.fn();

      await service.releaseProtectionIfNeeded(
        'BTCUSDT',
        { cancelProtectionOrder } as any,
        { ...basePosition, protectionStatus: 'NONE' },
      );

      expect(cancelProtectionOrder).not.toHaveBeenCalled();
      expect(prisma.position.update).not.toHaveBeenCalled();
    });

    it('cancels the order and marks the position RELEASED when it was protected', async () => {
      const prisma = makePrismaMock();
      const service = buildService(prisma);
      const cancelProtectionOrder = jest.fn().mockResolvedValue(undefined);

      await service.releaseProtectionIfNeeded(
        'BTCUSDT',
        { cancelProtectionOrder } as any,
        {
          ...basePosition,
          protectionStatus: 'PROTECTED',
          protectionOrderListId: 'ol-1',
          protectionStopOrderId: 'so-1',
        },
      );

      expect(cancelProtectionOrder).toHaveBeenCalledWith('BTCUSDT', {
        orderListId: 'ol-1',
        stopOrderId: 'so-1',
      });
      expect(prisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { protectionStatus: 'RELEASED' },
        }),
      );
    });
  });
});
