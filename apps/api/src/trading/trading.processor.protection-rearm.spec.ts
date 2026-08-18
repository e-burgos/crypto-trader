import { TradingProcessor } from './trading.processor';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — native protection re-arm on stop move (TASK-011)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
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
      {} as any,
      aggregateRiskServiceMock as any,
    );
  }

  function makePrismaMock(position: any) {
    return {
      position: {
        findMany: jest.fn().mockResolvedValue([position]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  const basePosition = {
    id: 'pos-1',
    userId: 'user-1',
    configId: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryPrice: 100,
    quantity: 1,
    entryAt: new Date(),
    status: 'OPEN',
    exitPrice: null,
    exitAt: null,
    pnl: null,
    fees: 0,
    stopPrice: 97,
    takeProfitPrice: 130,
    highWaterPrice: null,
    trailingActive: false,
    initialQuantity: 1,
    partialExitCount: 0,
    realizedPnl: 0,
    protectionStatus: 'PROTECTED',
    protectionOrderListId: 'ol-1',
    protectionStopOrderId: 'so-1',
    protectionFailureCount: 0,
  };

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    trailingStopEnabled: true,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
    maxPositionHoldMinutes: null,
    nativeProtectionEnabled: true,
    closeOnProtectionFailure: false,
  };

  async function runCheck(prisma: any, config: any, price: number) {
    const processor = buildProcessor(prisma);
    await (processor as any).checkOpenPositions(
      'user-1',
      config,
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      price,
      undefined,
    );
    return prisma;
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('cancels and re-places the OCO once the stop moves at least 0.1% (CA-069, CA-072)', async () => {
    const prisma = makePrismaMock({ ...basePosition });
    const cancelOcoOrderList = jest
      .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
      .mockResolvedValue(undefined as any);
    const getTickerPrice = jest
      .spyOn(BinanceRestClient.prototype, 'getTickerPrice')
      .mockResolvedValue(110);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockResolvedValue({
        orderListId: 'ol-2',
        listClientOrderId: 'prot-pos-1-1',
        stopOrderId: 'so-2',
        limitOrderId: 'lo-2',
        symbol: 'BTCUSDT',
        quantity: 1,
        placedAt: new Date(),
      } as any);

    // currentPrice 110 pushes the trailing stop from 97 to 107.8 (>0.1% delta)
    await runCheck(prisma, baseConfig, 110);

    expect(cancelOcoOrderList).toHaveBeenCalledWith('BTCUSDT', 'ol-1');
    expect(getTickerPrice).toHaveBeenCalledWith('BTCUSDT');
    expect(placeOcoSellOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      expect.objectContaining({
        quantity: 1,
        stopPrice: expect.closeTo(107.8, 6),
      }),
    );
    expect(
      cancelOcoOrderList.mock.invocationCallOrder[0],
    ).toBeLessThan(placeOcoSellOrder.mock.invocationCallOrder[0]);

    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('PROTECTED');
    expect(finalUpdate.data.protectionOrderListId).toBe('ol-2');

    // No local-close fallback: trailing + native protection re-arms instead of selling.
    expect(prisma.trade.create).not.toHaveBeenCalled();
  });

  it('does not touch the OCO when the stop move stays below the 0.1% threshold (CA-070)', async () => {
    const prisma = makePrismaMock({ ...basePosition, stopPrice: 100 });
    const cancelOcoOrderList = jest
      .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
      .mockResolvedValue(undefined as any);
    const placeOcoSellOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'placeOcoSellOrder',
    );

    // currentPrice 100.5 keeps trailing below the activation threshold (1%) —
    // stopPrice stays untouched, well under the 0.1% rearm delta.
    await runCheck(prisma, { ...baseConfig, trailingStopEnabled: false }, 100.5);

    expect(cancelOcoOrderList).not.toHaveBeenCalled();
    expect(placeOcoSellOrder).not.toHaveBeenCalled();
  });

  it('leaves the position UNPROTECTED and does not attempt to place a new order when cancellation fails (CE-09)', async () => {
    const prisma = makePrismaMock({ ...basePosition });
    const cancelOcoOrderList = jest
      .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
      .mockRejectedValue(new Error('exchange unreachable'));
    const placeOcoSellOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'placeOcoSellOrder',
    );

    await runCheck(prisma, baseConfig, 110);

    expect(cancelOcoOrderList).toHaveBeenCalledTimes(1);
    expect(placeOcoSellOrder).not.toHaveBeenCalled();

    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('UNPROTECTED');
    expect(finalUpdate.data.protectionLastError).toBeDefined();
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
  });

  it('leaves the position explicitly UNPROTECTED when cancellation succeeds but re-placement fails (CE-10)', async () => {
    const prisma = makePrismaMock({ ...basePosition });
    const cancelOcoOrderList = jest
      .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
      .mockResolvedValue(undefined as any);
    jest.spyOn(BinanceRestClient.prototype, 'getTickerPrice').mockResolvedValue(110);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockRejectedValue({
        response: { data: { code: -2010, msg: 'Account has insufficient balance' } },
      });

    await runCheck(prisma, baseConfig, 110);

    expect(cancelOcoOrderList).toHaveBeenCalledTimes(1);
    expect(placeOcoSellOrder).toHaveBeenCalledTimes(1);

    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('UNPROTECTED');
    expect(finalUpdate.data.protectionLastError).toEqual(
      expect.stringContaining('-2010'),
    );
    expect(prisma.position.updateMany).not.toHaveBeenCalled();
  });
});

describe('TradingProcessor — native protection after a partial take-profit (TASK-011)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
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
      {} as any,
      aggregateRiskServiceMock as any,
    );
  }

  const position = {
    id: 'pos-2',
    userId: 'user-1',
    configId: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryPrice: 100,
    quantity: 1,
    entryAt: new Date(),
    status: 'OPEN',
    exitPrice: null,
    exitAt: null,
    pnl: null,
    fees: 0,
    stopPrice: 97,
    takeProfitPrice: 130,
    highWaterPrice: null,
    trailingActive: false,
    initialQuantity: 1,
    partialExitCount: 0,
    realizedPnl: 0,
    protectionStatus: 'PROTECTED',
    protectionOrderListId: 'ol-1',
    protectionStopOrderId: 'so-1',
    protectionFailureCount: 0,
  };

  const config = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    trailingStopEnabled: false,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: true,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
    maxPositionHoldMinutes: null,
    nativeProtectionEnabled: true,
    closeOnProtectionFailure: false,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
    jest.spyOn(BinanceRestClient.prototype, 'getSymbolFilters').mockResolvedValue({
      lotSize: { minQty: 0, maxQty: 100, stepSize: 0.0001 },
      price: { minPrice: 0, maxPrice: 0, tickSize: 0.01 },
      notional: { minNotional: 5, applyToMarket: true },
    } as any);
  });

  it('places fresh native protection for the remaining quantity, without cancelling anything (§9.3)', async () => {
    const prisma = {
      position: {
        findMany: jest.fn().mockResolvedValue([position]),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    };
    const cancelOcoOrderList = jest
      .spyOn(BinanceRestClient.prototype, 'cancelOcoOrderList')
      .mockResolvedValue(undefined as any);
    const placeMarketOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValue({
        orderId: 'sell-1',
        symbol: 'BTCUSDT',
        side: 'SELL',
        price: 103,
        quantity: 0.5,
        status: 'FILLED',
        executedAt: new Date(),
      } as any);
    const placeOcoSellOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoSellOrder')
      .mockResolvedValue({
        orderListId: 'ol-3',
        listClientOrderId: 'prot-pos-2-1',
        stopOrderId: 'so-3',
        limitOrderId: 'lo-3',
        symbol: 'BTCUSDT',
        quantity: 0.5,
        placedAt: new Date(),
      } as any);

    const processor = buildProcessor(prisma);
    await (processor as any).checkOpenPositions(
      'user-1',
      config,
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      103,
      undefined,
    );

    // releaseProtectionIfNeeded cancels the pre-partial OCO exactly once —
    // the re-placement afterwards must not cancel a second time.
    expect(cancelOcoOrderList).toHaveBeenCalledTimes(1);
    expect(placeOcoSellOrder).toHaveBeenCalledTimes(1);
    expect(placeOcoSellOrder).toHaveBeenCalledWith(
      'BTCUSDT',
      expect.objectContaining({ quantity: 0.5 }),
    );

    const finalUpdate = prisma.position.update.mock.calls.at(-1)[0];
    expect(finalUpdate.data.protectionStatus).toBe('PROTECTED');
    expect(finalUpdate.data.protectionOrderListId).toBe('ol-3');
    expect(placeMarketOrder).toHaveBeenCalledTimes(1);
  });
});
