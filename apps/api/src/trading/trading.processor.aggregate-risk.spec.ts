import { TradingProcessor } from './trading.processor';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — executeBuy aggregate risk gate (TASK-015)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  function makePrismaMock() {
    return {
      position: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'pos-new' }),
      },
      sandboxWallet: {
        upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  function buildProcessor(prisma: any, aggregateRiskService: any) {
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
      aggregateRiskService,
    );
  }

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    maxTradePct: 0.05,
    maxConcurrentPositions: 5,
    orderPriceOffsetPct: 0,
    smartSizingEnabled: false,
  };

  beforeEach(() => {
    notificationsMock.create.mockClear();
  });

  it('blocks the BUY pre-order when aggregate risk disallows it, and records why (SANDBOX)', async () => {
    const prisma = makePrismaMock();
    const aggregateRiskService = {
      assertBuyAllowed: jest
        .fn()
        .mockResolvedValue({ allowed: false, blockedBy: 'DAILY_LOSS' }),
    };
    const processor = buildProcessor(prisma, aggregateRiskService);

    await (processor as any).executeBuy(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      65_000,
      { decisionId: 'dec-1', confidence: 0.9 },
    );

    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.trade.create).not.toHaveBeenCalled();
    expect(aggregateRiskService.assertBuyAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', plannedNotionalUsd: expect.any(Number) }),
    );
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      'AGENT_ERROR',
      expect.stringContaining('aggregateRiskBlocked'),
    );
  });

  it('places the order normally when aggregate risk allows it (SANDBOX)', async () => {
    const prisma = makePrismaMock();
    const aggregateRiskService = {
      assertBuyAllowed: jest.fn().mockResolvedValue({ allowed: true, blockedBy: null }),
    };
    const processor = buildProcessor(prisma, aggregateRiskService);

    await (processor as any).executeBuy(
      'user-1',
      baseConfig,
      'BTCUSDT',
      'SANDBOX',
      undefined,
      undefined,
      65_000,
      { decisionId: 'dec-1', confidence: 0.9 },
    );

    expect(prisma.position.create).toHaveBeenCalledTimes(1);
    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
  });

  it('is invoked after sizing and before placeMarketOrder in the LIVE/TESTNET path', async () => {
    const prisma = makePrismaMock();
    const callOrder: string[] = [];
    const aggregateRiskService = {
      assertBuyAllowed: jest.fn().mockImplementation(async () => {
        callOrder.push('assertBuyAllowed');
        return { allowed: false, blockedBy: 'ASSET_EXPOSURE' };
      }),
    };
    jest
      .spyOn(BinanceRestClient.prototype, 'getBalances')
      .mockResolvedValue([{ asset: 'USDT', free: 10_000, locked: 0 }]);
    const placeMarketOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockImplementation(async () => {
        callOrder.push('placeMarketOrder');
        return {
          orderId: 'order-1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          price: 65_000,
          quantity: 0.01,
          status: 'FILLED',
          executedAt: new Date(),
        } as any;
      });

    const processor = buildProcessor(prisma, aggregateRiskService);
    await (processor as any).executeBuy(
      'user-1',
      { ...baseConfig, mode: 'LIVE' },
      'BTCUSDT',
      'LIVE',
      'key',
      'secret',
      65_000,
      undefined,
    );

    expect(aggregateRiskService.assertBuyAllowed).toHaveBeenCalledTimes(1);
    expect(placeMarketOrder).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['assertBuyAllowed']);

    jest.restoreAllMocks();
  });
});
