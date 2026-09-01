import { TradingProcessor } from './trading.processor';
import {
  createTradingPrismaMock,
  createTradingProcessorCollaborators,
} from './__mocks__/trading-processor-deps';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

describe('TradingProcessor — resting entry placement (TASK-013)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  const aggregateRiskServiceMock = {
    assertBuyAllowed: jest
      .fn()
      .mockResolvedValue({ allowed: true, blockedBy: null }),
  };

  const levels = { support: [60_000, 63_000, 66_000], resistance: [67_000, 70_000] };

  function makePrismaMock(entryOrder: any = {}) {
    return {
      position: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'pos-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sandboxWallet: {
        upsert: jest.fn().mockResolvedValue({ balance: 10_000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
      botAction: { create: jest.fn().mockResolvedValue({}) },
      entryOrder,
    };
  }

  function buildProcessor(prisma: any, actionGate?: any) {
    const prismaMock = createTradingPrismaMock(prisma);
    return {
      prismaMock,
      processor: new TradingProcessor(
        prismaMock,
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
        ...createTradingProcessorCollaborators({
          prisma: prismaMock,
          gateway: gatewayMock,
          notificationsService: notificationsMock,
          aggregateRiskService: aggregateRiskServiceMock,
          actionGate,
        }),
      ),
    };
  }

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    maxTradePct: 0.05,
    maxConcurrentPositions: 2,
    orderPriceOffsetPct: 0,
    smartSizingEnabled: false,
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    nativeProtectionEnabled: false,
    entryOrderMode: 'LIMIT_MAKER',
    entryOrderTtlMinutes: 120,
    entryTrailingDeltaBips: null,
  };

  function runBuy(processor: any, config: any, overrides: any = {}) {
    return (processor as any).executeBuy(
      'user-1',
      config,
      'BTCUSDT',
      config.mode,
      'key',
      'secret',
      65_000,
      { decisionId: 'dec-1', confidence: 0.8 },
      overrides.levels === undefined ? levels : overrides.levels,
    );
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
    aggregateRiskServiceMock.assertBuyAllowed.mockClear();
    aggregateRiskServiceMock.assertBuyAllowed.mockResolvedValue({
      allowed: true,
      blockedBy: null,
    });
    jest
      .spyOn(BinanceRestClient.prototype, 'getBalances')
      .mockResolvedValue([{ asset: 'USDT', free: 10_000, locked: 0 }] as any);
  });

  it('places a LIMIT_MAKER at the nearest support below the raw market price, inside the gate', async () => {
    const placeLimitMaker = jest
      .spyOn(BinanceRestClient.prototype, 'placeLimitMakerBuyOrder')
      .mockResolvedValue({
        orderId: 'oid-1',
        clientOrderId: 'ent-x',
        placedAt: new Date('2026-09-01T10:00:00Z'),
      } as any);
    const placeMarketOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'placeMarketOrder',
    );
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'entry-1', ...data }),
        ),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(placeMarketOrder).not.toHaveBeenCalled();
    expect(placeLimitMaker).toHaveBeenCalledTimes(1);
    expect(placeLimitMaker.mock.calls[0][1]).toMatchObject({
      price: 63_000,
      referencePrice: 65_000,
    });
    expect(placeLimitMaker.mock.calls[0][1].clientOrderId).toMatch(/^ent-/);

    expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'BUY',
      source: 'LLM_CYCLE',
      detail: 'ENTRY_PLACED_LIMIT_MAKER',
      decisionId: 'dec-1',
    });
    expect(
      actionGate.authorizeAndRun.mock.invocationCallOrder[0],
    ).toBeLessThan(placeLimitMaker.mock.invocationCallOrder[0]);

    const row = prisma.entryOrder.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      status: 'RESTING',
      entryMode: 'LIMIT_MAKER',
      limitPrice: 63_000,
      referencePrice: 65_000,
      orderId: 'oid-1',
    });
    expect(row.clientOrderId.startsWith('prot-')).toBe(false);
  });

  it('places an OCO and sizes with the worst-case (stop-limit) price', async () => {
    const placeOco = jest
      .spyOn(BinanceRestClient.prototype, 'placeOcoBuyOrder')
      .mockResolvedValue({
        orderListId: 'ol-1',
        listClientOrderId: 'ent-y',
        stopOrderId: 'so-1',
        limitOrderId: 'lo-1',
        placedAt: new Date('2026-09-01T10:00:00Z'),
      } as any);
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: 400 } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'entry-1', ...data }),
        ),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, {
      ...baseConfig,
      entryOrderMode: 'OCO',
      entryTrailingDeltaBips: 50,
    });

    const worstCasePrice = 67_000 * 1.002;
    const expectedQuantity = (10_000 * 0.05) / worstCasePrice;

    expect(placeOco).toHaveBeenCalledTimes(1);
    expect(placeOco.mock.calls[0][1]).toMatchObject({
      belowPrice: 63_000,
      aboveStopPrice: 67_000,
      referencePrice: 65_000,
      aboveTrailingDeltaBips: 50,
    });
    expect(placeOco.mock.calls[0][1].abovePrice).toBeCloseTo(worstCasePrice, 6);
    expect(placeOco.mock.calls[0][1].quantity).toBeCloseTo(expectedQuantity, 6);

    expect(
      aggregateRiskServiceMock.assertBuyAllowed.mock.calls[0][0]
        .plannedNotionalUsd,
    ).toBeCloseTo(expectedQuantity * worstCasePrice + 400, 2);

    const row = prisma.entryOrder.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      entryMode: 'OCO',
      orderListId: 'ol-1',
      limitLegOrderId: 'lo-1',
      stopLegOrderId: 'so-1',
      trailingDeltaBips: 50,
    });
    expect(row.plannedNotionalUsd).toBeCloseTo(
      expectedQuantity * worstCasePrice,
      2,
    );
  });

  it('reaffirms an identical live entry: no exchange call, no row, no bot_action', async () => {
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    const cancelEntryOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'cancelEntryOrder',
    );
    const actionGate = { authorizeAndRun: jest.fn() };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'entry-1',
          userId: 'user-1',
          configId: 'config-1',
          symbol: 'BTCUSDT',
          entryMode: 'LIMIT_MAKER',
          limitPrice: 63_000,
          stopPrice: null,
          orderListId: null,
          orderId: 'oid-1',
          limitLegOrderId: null,
          stopLegOrderId: null,
          expiresAt: new Date(Date.now() + 60 * 60_000),
          cancelReason: null,
        },
      ]),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(cancelEntryOrder).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('replaces a stale entry: cancel confirmed first, then the new placement', async () => {
    const placeLimitMaker = jest
      .spyOn(BinanceRestClient.prototype, 'placeLimitMakerBuyOrder')
      .mockResolvedValue({
        orderId: 'oid-2',
        clientOrderId: 'ent-z',
        placedAt: new Date(),
      } as any);
    const cancelEntryOrder = jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockResolvedValue(undefined as any);
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'entry-old',
          userId: 'user-1',
          configId: 'config-1',
          symbol: 'BTCUSDT',
          entryMode: 'LIMIT_MAKER',
          limitPrice: 60_000,
          stopPrice: null,
          orderListId: null,
          orderId: 'oid-old',
          limitLegOrderId: null,
          stopLegOrderId: null,
          expiresAt: new Date(Date.now() + 60 * 60_000),
          cancelReason: null,
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'entry-new', ...data }),
        ),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(cancelEntryOrder).toHaveBeenCalledTimes(1);
    expect(
      cancelEntryOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(placeLimitMaker.mock.invocationCallOrder[0]);
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'REPLACED_BY_NEW_ENTRY',
    });
    expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(2);
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'ENTRY_CANCEL',
      detail: 'REPLACED_BY_NEW_ENTRY',
    });
    expect(actionGate.authorizeAndRun.mock.calls[1][0]).toMatchObject({
      kind: 'BUY',
      detail: 'ENTRY_PLACED_LIMIT_MAKER',
    });
  });

  it('aborts the placement when the replacement cancellation cannot be confirmed', async () => {
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockRejectedValue(new Error('exchange down'));
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'entry-old',
          userId: 'user-1',
          configId: 'config-1',
          symbol: 'BTCUSDT',
          entryMode: 'LIMIT_MAKER',
          limitPrice: 60_000,
          stopPrice: null,
          orderListId: null,
          orderId: 'oid-old',
          limitLegOrderId: null,
          stopLegOrderId: null,
          expiresAt: new Date(Date.now() + 60 * 60_000),
          cancelReason: null,
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toEqual({
      lastError: 'exchange down',
    });
  });

  it('a resting entry occupies a concurrency slot exactly like an open position', async () => {
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    const placeMarketOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'placeMarketOrder',
    );
    const actionGate = { authorizeAndRun: jest.fn() };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    });
    prisma.position.count = jest.fn().mockResolvedValue(1);
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(placeMarketOrder).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
  });

  it('with no usable level nothing is placed and nothing reaches the gate', async () => {
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    const actionGate = { authorizeAndRun: jest.fn() };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig, {
      levels: { support: [], resistance: [] },
    });

    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.botAction.create).not.toHaveBeenCalled();
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:skipped',
      expect.objectContaining({ reason: 'NO_USABLE_LEVEL' }),
    );
  });

  it('a DAILY_LOSS block cancels the bot resting entries through a second gate call', async () => {
    jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockResolvedValue(undefined as any);
    const actionGate = {
      authorizeAndRun: jest
        .fn()
        .mockImplementationOnce(async () => ({
          outcome: 'BLOCKED',
          blockedBy: 'DAILY_LOSS',
          detail: 'DAILY_LOSS_LIMIT_REACHED',
          value: null,
        }))
        .mockImplementationOnce(async (_req: any, execute: any) => ({
          outcome: 'EXECUTED',
          blockedBy: null,
          detail: 'ok',
          value: await execute(),
        })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          {
            id: 'entry-1',
            userId: 'user-1',
            configId: 'config-1',
            symbol: 'BTCUSDT',
            entryMode: 'LIMIT_MAKER',
            limitPrice: 63_000,
            stopPrice: null,
            orderListId: null,
            orderId: 'oid-1',
            limitLegOrderId: null,
            stopLegOrderId: null,
            expiresAt: new Date(Date.now() + 60 * 60_000),
            cancelReason: null,
          },
        ]),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, baseConfig);

    expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(2);
    expect(actionGate.authorizeAndRun.mock.calls[1][0]).toMatchObject({
      kind: 'ENTRY_CANCEL',
      detail: 'DAILY_LOSS_DISCARDED',
    });
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'DAILY_LOSS_DISCARDED',
    });
  });

  it('SANDBOX ignores entryOrderMode entirely and never writes an entry_orders row', async () => {
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    jest
      .spyOn(BinanceRestClient.prototype, 'getTickerPrice')
      .mockResolvedValue(65_000);
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, {
      ...baseConfig,
      mode: 'SANDBOX',
      entryOrderMode: 'OCO',
    });

    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.position.create).toHaveBeenCalledTimes(1);
    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
  });

  it('with entryOrderMode MARKET the market path runs untouched and writes no entry row', async () => {
    const placeMarketOrder = jest
      .spyOn(BinanceRestClient.prototype, 'placeMarketOrder')
      .mockResolvedValue({
        orderId: 'order-1',
        price: 65_000,
        quantity: 0.007,
      } as any);
    const placeLimitMaker = jest.spyOn(
      BinanceRestClient.prototype,
      'placeLimitMakerBuyOrder',
    );
    const placeOco = jest.spyOn(
      BinanceRestClient.prototype,
      'placeOcoBuyOrder',
    );
    const actionGate = {
      authorizeAndRun: jest.fn().mockImplementation(async (_req, execute) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
    };
    const prisma = makePrismaMock({
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    });
    const { processor } = buildProcessor(prisma, actionGate);

    await runBuy(processor, { ...baseConfig, entryOrderMode: 'MARKET' });

    expect(placeMarketOrder).toHaveBeenCalledTimes(1);
    expect(placeLimitMaker).not.toHaveBeenCalled();
    expect(placeOco).not.toHaveBeenCalled();
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.entryOrder.findMany).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'BUY',
      detail: 'BUY',
    });
  });
});
