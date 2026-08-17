import { TradingProcessor } from './trading.processor';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — native SL/TP protection on BUY (TASK-012)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  function makePrismaMock() {
    return {
      position: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'pos-1',
            userId: 'user-1',
            asset: 'BTC',
            pair: 'USDT',
            mode: 'LIVE',
            status: 'OPEN',
            fees: 0,
            protectionStatus: 'NONE',
            protectionOrderListId: null,
            protectionStopOrderId: null,
            ...data,
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
  };

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

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    maxTradePct: 0.05,
    maxConcurrentPositions: 5,
    orderPriceOffsetPct: 0,
    smartSizingEnabled: false,
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    nativeProtectionEnabled: true,
    closeOnProtectionFailure: false,
  };

  const buyOrder = {
    orderId: 'order-1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    price: 65_000,
    quantity: 0.1,
    status: 'FILLED',
    executedAt: new Date(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
    jest
      .spyOn(BinanceRestClient.prototype, 'getBalances')
      .mockResolvedValue([{ asset: 'USDT', free: 10_000, locked: 0 }]);
  });

  it('places the protection order immediately after the BUY confirms and stores PROTECTED (CA-012)', async () => {
    const prisma = makePrismaMock();
    const processor = buildProcessor(prisma);
    const placeMarketOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValue(buyOrder as any);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockResolvedValue({
        orderListId: 'ol-1',
        listClientOrderId: 'prot-pos-1-1',
        stopOrderId: 'so-1',
        limitOrderId: 'lo-1',
        symbol: 'BTCUSDT',
        quantity: 0.1,
        placedAt: new Date(),
      } as any);

    await (processor as any).executeBuy(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      65_000,
      { decisionId: 'dec-1', confidence: 0.8 },
    );

    expect(placeMarketOrder).toHaveBeenCalledTimes(1);
    expect(placeOcoSellOrder).toHaveBeenCalledTimes(1);
    expect(
      placeMarketOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(placeOcoSellOrder.mock.invocationCallOrder[0]);
    expect(placeOcoSellOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      expect.objectContaining({ listClientOrderId: 'prot-pos-1-1' }),
    );

    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('PROTECTED');
    expect(finalUpdate.data.protectionOrderListId).toBe('ol-1');
  }, 10_000);

  it('retries once on a retryable rejection and then succeeds', async () => {
    const prisma = makePrismaMock();
    const processor = buildProcessor(prisma);
    jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValue(buyOrder as any);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockRejectedValueOnce({
        response: { data: { code: -1021, msg: 'timestamp outside recvWindow' } },
      })
      .mockResolvedValueOnce({
        orderListId: 'ol-2',
        listClientOrderId: 'prot-pos-1-2',
        stopOrderId: 'so-2',
        limitOrderId: 'lo-2',
        symbol: 'BTCUSDT',
        quantity: 0.1,
        placedAt: new Date(),
      } as any);

    await (processor as any).executeBuy(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      65_000,
      undefined,
    );

    expect(placeOcoSellOrder).toHaveBeenCalledTimes(2);
    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('PROTECTED');
  }, 10_000);

  it('a definitive rejection leaves the position UNPROTECTED without closing it (CA-013)', async () => {
    const prisma = makePrismaMock();
    const processor = buildProcessor(prisma);
    jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValue(buyOrder as any);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockRejectedValue({
        response: { data: { code: -2010, msg: 'Account has insufficient balance' } },
      });

    await (processor as any).executeBuy(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      65_000,
      undefined,
    );

    expect(placeOcoSellOrder).toHaveBeenCalledTimes(1);
    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('UNPROTECTED');
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      'AGENT_ERROR',
      expect.stringContaining('positionUnprotected'),
    );
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'position:unprotected',
      expect.objectContaining({ positionId: 'pos-1' }),
    );
    expect(prisma.position.updateMany).not.toHaveBeenCalled();
    expect(prisma.trade.create).toHaveBeenCalledTimes(1); // only the BUY trade
  }, 10_000);

  it('closeOnProtectionFailure=true closes the position at market after exhausting retries (CE-02)', async () => {
    const prisma = makePrismaMock();
    const processor = buildProcessor(prisma);
    const sellOrder = {
      orderId: 'order-2',
      symbol: 'BTCUSDT',
      side: 'SELL',
      price: 64_500,
      quantity: 0.1,
      status: 'FILLED',
      executedAt: new Date(),
    };
    jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValueOnce(buyOrder as any)
      .mockResolvedValueOnce(sellOrder as any);
    jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockRejectedValue({
        response: { data: { code: -2010, msg: 'Account has insufficient balance' } },
      });

    await (processor as any).executeBuy(
      'user-1',
      { ...baseConfig, closeOnProtectionFailure: true },
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      65_000,
      undefined,
    );

    expect(prisma.position.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pos-1', status: 'OPEN' },
        data: expect.objectContaining({
          status: 'CLOSED',
          exitReason: 'PROTECTION_FAILURE',
        }),
      }),
    );
    expect(prisma.trade.create).toHaveBeenCalledTimes(2); // BUY + protection-failure SELL
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      'STOP_LOSS_TRIGGERED',
      expect.any(String),
    );
  }, 10_000);
});
