import {
  ENTRY_CLIENT_ORDER_ID_PREFIX,
  EntryOrderService,
  createEntryClientOrderId,
  type EntryOrderCancelReason,
} from './entry-order.service';

const CANCEL_REASONS: EntryOrderCancelReason[] = [
  'LATER_DECISION',
  'DAILY_LOSS_DISCARDED',
  'BOT_STOPPED',
  'REPLACED_BY_NEW_ENTRY',
  'ORPHAN_SWEEP',
];

export function makeEntryExecutor(
  overrides: Partial<Record<string, jest.Mock>> = {},
) {
  return {
    placeMarketOrder: jest.fn(),
    getBalance: jest.fn(),
    getPrice: jest.fn().mockResolvedValue(65_000),
    placeLimitOrder: jest.fn(),
    placeStopLossLimitOrder: jest.fn(),
    placeProtectionOrder: jest.fn(),
    getProtectionOrderStatus: jest.fn(),
    cancelProtectionOrder: jest.fn().mockResolvedValue(undefined),
    getOpenOrders: jest.fn().mockResolvedValue([]),
    placeEntryOrder: jest.fn(),
    getEntryOrderStatus: jest.fn(),
    cancelEntryOrder: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('EntryOrderService — placement and cancellation (TASK-012)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  const config = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    entryOrderTtlMinutes: 120,
    entryTrailingDeltaBips: 50,
  };

  function makePrisma(overrides: any = {}) {
    const { entryOrder, ...rest } = overrides;
    return {
      entryOrder: {
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'entry-1', ...data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { plannedNotionalUsd: null } }),
        ...entryOrder,
      },
      botAction: { create: jest.fn().mockResolvedValue({}) },
      ...rest,
    };
  }

  function buildService(prisma: any) {
    return new EntryOrderService(
      prisma,
      notificationsMock as any,
      gatewayMock as any,
    );
  }

  const restingRow = {
    id: 'entry-1',
    userId: 'user-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryMode: 'LIMIT_MAKER' as const,
    quantity: 0.01,
    limitPrice: 63_000,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 65_000,
    plannedNotionalUsd: 630,
    clientOrderId: 'ent-aaaaaaaaaaaaaaaaaaaaaaaa',
    orderListId: null,
    orderId: 'oid-1',
    limitLegOrderId: null,
    stopLegOrderId: null,
    placedAt: new Date('2026-09-01T10:00:00Z'),
    expiresAt: new Date('2026-09-01T12:00:00Z'),
    decisionId: 'decision-1',
  };

  beforeEach(() => {
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('generates a client order id with the ent- prefix, disjoint from prot-', () => {
    const cid = createEntryClientOrderId();
    expect(cid.startsWith(ENTRY_CLIENT_ORDER_ID_PREFIX)).toBe(true);
    expect(cid.startsWith('prot-')).toBe(false);
    expect(cid).toHaveLength(28);
    expect(cid).not.toBe(createEntryClientOrderId());
  });

  it('places a LIMIT_MAKER and persists a RESTING row with the exchange orderId', async () => {
    const prisma = makePrisma();
    const executor = makeEntryExecutor({
      placeEntryOrder: jest.fn().mockResolvedValue({
        mode: 'LIMIT_MAKER',
        orderListId: null,
        orderId: 'oid-42',
        limitLegOrderId: null,
        stopLegOrderId: null,
        clientOrderId: 'ent-from-exchange',
        placedAt: new Date('2026-09-01T10:00:00Z'),
      }),
    });

    const created = await buildService(prisma).placeResting({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      plan: {
        mode: 'LIMIT_MAKER',
        limitPrice: 63_000,
        limitSource: 'SUPPORT',
        stopPrice: null,
        stopSource: null,
        degradedFromOco: false,
      },
      stopLimitPrice: null,
      quantity: 0.01,
      referencePrice: 65_000,
      plannedNotionalUsd: 630,
      decisionId: 'decision-1',
    });

    const request = executor.placeEntryOrder.mock.calls[0][0];
    expect(request.mode).toBe('LIMIT_MAKER');
    expect(request.clientOrderId.startsWith('ent-')).toBe(true);
    expect(request.trailingDeltaBips).toBeNull();

    const persisted = prisma.entryOrder.create.mock.calls[0][0].data;
    expect(persisted).toMatchObject({
      status: 'RESTING',
      entryMode: 'LIMIT_MAKER',
      orderId: 'oid-42',
      orderListId: null,
      clientOrderId: 'ent-from-exchange',
      decisionId: 'decision-1',
    });
    expect(persisted.expiresAt.getTime() - persisted.placedAt.getTime()).toBe(
      120 * 60_000,
    );
    expect(created.id).toBe('entry-1');
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:placed',
      expect.objectContaining({ entryOrderId: 'entry-1', entryMode: 'LIMIT_MAKER' }),
    );
    expect(notificationsMock.create.mock.calls[0][2]).toContain(
      'entryOrderPlaced',
    );
  });

  it('places an OCO as a single row carrying both leg order ids and the trailing delta', async () => {
    const prisma = makePrisma();
    const executor = makeEntryExecutor({
      placeEntryOrder: jest.fn().mockResolvedValue({
        mode: 'OCO',
        orderListId: 'ol-7',
        orderId: null,
        limitLegOrderId: 'leg-limit',
        stopLegOrderId: 'leg-stop',
        clientOrderId: 'ent-oco',
        placedAt: new Date('2026-09-01T10:00:00Z'),
      }),
    });

    await buildService(prisma).placeResting({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      plan: {
        mode: 'OCO',
        limitPrice: 63_000,
        limitSource: 'SUPPORT',
        stopPrice: 67_000,
        stopSource: 'RESISTANCE',
        degradedFromOco: false,
      },
      stopLimitPrice: 67_134,
      quantity: 0.01,
      referencePrice: 65_000,
      plannedNotionalUsd: 671.34,
      decisionId: null,
    });

    expect(prisma.entryOrder.create).toHaveBeenCalledTimes(1);
    expect(prisma.entryOrder.create.mock.calls[0][0].data).toMatchObject({
      status: 'RESTING',
      entryMode: 'OCO',
      orderListId: 'ol-7',
      limitLegOrderId: 'leg-limit',
      stopLegOrderId: 'leg-stop',
      stopPrice: 67_000,
      stopLimitPrice: 67_134,
      trailingDeltaBips: 50,
    });
  });

  it('never persists a row when the exchange rejects the placement', async () => {
    const prisma = makePrisma();
    const executor = makeEntryExecutor({
      placeEntryOrder: jest.fn().mockRejectedValue(new Error('-2010')),
    });

    await expect(
      buildService(prisma).placeResting({
        userId: 'user-1',
        config,
        symbol: 'BTCUSDT',
        mode: 'LIVE' as any,
        executor: executor as any,
        plan: {
          mode: 'LIMIT_MAKER',
          limitPrice: 63_000,
          limitSource: 'SUPPORT',
          stopPrice: null,
          stopSource: null,
          degradedFromOco: false,
        },
        stopLimitPrice: null,
        quantity: 0.01,
        referencePrice: 65_000,
        plannedNotionalUsd: 630,
        decisionId: null,
      }),
    ).rejects.toThrow('-2010');

    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
  });

  it('emits entry-order:skipped without touching the database', () => {
    const prisma = makePrisma();
    buildService(prisma).markSkipped({
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      entryMode: 'OCO',
    });

    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:skipped',
      {
        configId: 'config-1',
        symbol: 'BTCUSDT',
        entryMode: 'OCO',
        reason: 'NO_USABLE_LEVEL',
      },
    );
    expect(prisma.entryOrder.create).not.toHaveBeenCalled();
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it.each(CANCEL_REASONS)(
    'cancelResting cancels on the exchange and settles the row with reason %s',
    async (reason) => {
      const prisma = makePrisma({
        entryOrder: { findMany: jest.fn().mockResolvedValue([restingRow]) },
      });
      const executor = makeEntryExecutor();

      const outcome = await buildService(prisma).cancelResting({
        userId: 'user-1',
        configId: 'config-1',
        symbol: 'BTCUSDT',
        executor: executor as any,
        reason,
        recordAction: true,
      });

      expect(executor.cancelEntryOrder).toHaveBeenCalledWith('BTCUSDT', {
        orderListId: null,
        orderId: 'oid-1',
        limitLegOrderId: null,
        stopLegOrderId: null,
      });
      expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
        status: 'CANCELLED',
        cancelReason: reason,
      });
      expect(outcome).toEqual({ cancelled: ['entry-1'], failed: [] });
      expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'entry-order:cancelled',
        expect.objectContaining({ entryOrderId: 'entry-1', cancelReason: reason }),
      );
      expect(prisma.botAction.create.mock.calls[0][0].data).toMatchObject({
        kind: 'ENTRY_CANCEL',
        source: 'LLM_CYCLE',
        outcome: 'EXECUTED',
        detail: reason,
      });
    },
  );

  it('cancelResting with recordAction false leaves the bot_actions row to the gate', async () => {
    const prisma = makePrisma({
      entryOrder: { findMany: jest.fn().mockResolvedValue([restingRow]) },
    });
    const executor = makeEntryExecutor();

    await buildService(prisma).cancelResting({
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      executor: executor as any,
      reason: 'LATER_DECISION',
      recordAction: false,
    });

    expect(prisma.entryOrder.update).toHaveBeenCalledTimes(1);
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('keeps the row RESTING with lastError when the exchange cancellation fails', async () => {
    const prisma = makePrisma({
      entryOrder: { findMany: jest.fn().mockResolvedValue([restingRow]) },
    });
    const executor = makeEntryExecutor({
      cancelEntryOrder: jest.fn().mockRejectedValue(new Error('network down')),
    });

    const outcome = await buildService(prisma).cancelResting({
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      executor: executor as any,
      reason: 'BOT_STOPPED',
      recordAction: true,
    });

    expect(outcome).toEqual({ cancelled: [], failed: ['entry-1'] });
    expect(prisma.entryOrder.update).toHaveBeenCalledTimes(1);
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toEqual({
      lastError: 'network down',
    });
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('settles a TTL cancellation as EXPIRED and emits entry-order:expired', async () => {
    const prisma = makePrisma();
    const executor = makeEntryExecutor();

    await buildService(prisma).cancelResting({
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      executor: executor as any,
      reason: 'TTL_EXPIRED',
      terminalStatus: 'EXPIRED',
      rows: [restingRow],
      recordAction: true,
    });

    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'EXPIRED',
      cancelReason: 'TTL_EXPIRED',
    });
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:expired',
      expect.objectContaining({ entryOrderId: 'entry-1' }),
    );
  });

  it('reaffirms only an identical, unexpired resting order', () => {
    const service = buildService(makePrisma());
    const now = new Date('2026-09-01T11:00:00Z');
    const samePlan = {
      mode: 'LIMIT_MAKER' as const,
      limitPrice: 63_000,
      limitSource: 'SUPPORT' as const,
      stopPrice: null,
      stopSource: null,
      degradedFromOco: false,
    };

    expect(service.reaffirms(restingRow, samePlan, now)).toBe(true);
    expect(
      service.reaffirms(restingRow, { ...samePlan, limitPrice: 62_000 }, now),
    ).toBe(false);
    expect(
      service.reaffirms(
        restingRow,
        { ...samePlan, mode: 'OCO', stopPrice: 67_000, stopSource: 'RESISTANCE' },
        now,
      ),
    ).toBe(false);
    expect(
      service.reaffirms(restingRow, samePlan, new Date('2026-09-01T13:00:00Z')),
    ).toBe(false);
  });

  it('counts and sums only RESTING rows of the requested scope', async () => {
    const prisma = makePrisma({
      entryOrder: {
        count: jest.fn().mockResolvedValue(2),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { plannedNotionalUsd: 1_260 } }),
      },
    });
    const service = buildService(prisma);

    await expect(
      service.countResting({ configId: 'config-1', asset: 'BTC', mode: 'LIVE' }),
    ).resolves.toBe(2);
    expect(prisma.entryOrder.count.mock.calls[0][0].where).toMatchObject({
      configId: 'config-1',
      asset: 'BTC',
      mode: 'LIVE',
      status: 'RESTING',
    });

    await expect(
      service.sumRestingPlannedNotionalUsd({
        userId: 'user-1',
        asset: 'BTC',
        mode: 'LIVE',
      }),
    ).resolves.toBe(1_260);
    expect(prisma.entryOrder.aggregate.mock.calls[0][0].where).toMatchObject({
      userId: 'user-1',
      status: 'RESTING',
    });
  });

  it('sums zero when there is no resting exposure', async () => {
    const prisma = makePrisma();
    await expect(
      buildService(prisma).sumRestingPlannedNotionalUsd({
        userId: 'user-1',
        asset: 'BTC',
        mode: 'LIVE',
      }),
    ).resolves.toBe(0);
  });
});
