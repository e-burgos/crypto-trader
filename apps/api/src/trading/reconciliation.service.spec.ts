import { ReconciliationService } from './reconciliation.service';
import { EntryOrderService } from './entry-order.service';
import { PositionActionService } from './position-action.service';

describe('ReconciliationService — 6-case matrix (TASK-013)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  const baseConfig = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
  };

  function makeExecutor(overrides: Partial<Record<string, jest.Mock>> = {}) {
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

  function makePrisma(positions: any[], entryOrders: any[] = []) {
    return {
      position: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where.configId && where.configId.not) return Promise.resolve([]);
          return Promise.resolve(positions);
        }),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'pos-new', ...data }),
          ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
      botAction: { create: jest.fn().mockResolvedValue({}) },
      entryOrder: {
        findMany: jest.fn().mockResolvedValue(entryOrders),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
  }

  function buildService(prisma: any) {
    const positionAction = new PositionActionService(
      prisma,
      gatewayMock as any,
      notificationsMock as any,
    );
    return new ReconciliationService(
      prisma,
      notificationsMock as any,
      gatewayMock as any,
      new EntryOrderService(
        prisma,
        notificationsMock as any,
        gatewayMock as any,
        positionAction,
      ),
    );
  }

  const basePosition = {
    id: 'pos-1',
    configId: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryPrice: 65_000,
    quantity: 0.1,
    fees: 6.5,
    stopPrice: 63_050,
    takeProfitPrice: 68_250,
    protectionFailureCount: 0,
  };

  beforeEach(() => {
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('case 1 — PROTECTED + ACTIVE is a no-op', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'ACTIVE',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome).toMatchObject({ checked: 1, closedByExchange: 0, reprotected: 0, stillUnprotected: 0 });
    expect(prisma.position.update).not.toHaveBeenCalled();
    expect(prisma.position.updateMany).not.toHaveBeenCalled();
  });

  it('case 2 — PROTECTED + FILLED closes the position locally with the exchange price (CA-014)', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'FILLED',
        filledLeg: 'STOP',
        executedPrice: 62_500,
        executedQuantity: 0.1,
        orderId: 'so-1',
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.closedByExchange).toBe(1);
    expect(prisma.position.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pos-1', status: 'OPEN' },
        data: expect.objectContaining({
          status: 'CLOSED',
          exitPrice: 62_500,
          exitReason: 'EXCHANGE_STOP',
          protectionStatus: 'RELEASED',
        }),
      }),
    );
    expect(prisma.trade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          positionId: 'pos-1',
          type: 'SELL',
          price: 62_500,
          decisionId: null,
        }),
      }),
    );
  });

  it('idempotency — running reconcile twice on the same simulated state never creates a second Trade (CA-016)', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    prisma.position.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'FILLED',
        filledLeg: 'TAKE_PROFIT',
        executedPrice: 68_250,
        executedQuantity: 0.1,
        orderId: 'lo-1',
      }),
    });
    const service = buildService(prisma);

    const first = await service.reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });
    const second = await service.reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(first.closedByExchange).toBe(1);
    expect(second.closedByExchange).toBe(0);
    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
  });

  it('case 3 — PROTECTED + CANCELLED marks UNPROTECTED and re-places protection (CA-015)', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'CANCELLED',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      }),
      placeProtectionOrder: jest.fn().mockResolvedValue({
        kind: 'OCO',
        orderListId: 'ol-2',
        stopOrderId: 'so-2',
        limitOrderId: 'lo-2',
        placedAt: new Date(),
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.reprotected).toBe(1);
    expect(outcome.stillUnprotected).toBe(0);
    const calls = prisma.position.update.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContainEqual(
      expect.objectContaining({
        where: { id: 'pos-1' },
        data: { protectionStatus: 'UNPROTECTED' },
      }),
    );
    expect(calls.at(-1)).toMatchObject({
      where: { id: 'pos-1' },
      data: expect.objectContaining({
        protectionStatus: 'PROTECTED',
        protectionOrderListId: 'ol-2',
      }),
    });
  });

  it('case 3b — PROTECTED + MISSING that also fails to re-place stays UNPROTECTED and notifies', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'MISSING',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      }),
      placeProtectionOrder: jest
        .fn()
        .mockRejectedValue({ response: { data: { code: -2010, msg: 'rejected' } } }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.stillUnprotected).toBe(1);
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

  it('case 4 — PENDING attempts placement directly without querying exchange status', async () => {
    const position = { ...basePosition, protectionStatus: 'PENDING', protectionOrderListId: null };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      placeProtectionOrder: jest.fn().mockResolvedValue({
        kind: 'OCO',
        orderListId: 'ol-3',
        stopOrderId: 'so-3',
        limitOrderId: 'lo-3',
        placedAt: new Date(),
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(executor.getProtectionOrderStatus).not.toHaveBeenCalled();
    expect(outcome.reprotected).toBe(1);
  });

  it('case 5 — sweeps an orphaned protection order not owned by any open position (zombie)', async () => {
    const prisma = makePrisma([]);
    const executor = makeExecutor({
      getOpenOrders: jest.fn().mockResolvedValue([
        { orderId: '1', clientOrderId: 'prot-pos-old-1', orderListId: 'ol-zombie' },
        { orderId: '2', clientOrderId: 'other-order', orderListId: 'ol-unrelated' },
      ]),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.orphanOrdersCancelled).toBe(1);
    expect(executor.cancelProtectionOrder).toHaveBeenCalledTimes(1);
    expect(executor.cancelProtectionOrder).toHaveBeenCalledWith('BTCUSDT', {
      orderListId: 'ol-zombie',
    });
  });

  it('case 5b — does not sweep a protection order still owned by an OPEN+PROTECTED position', async () => {
    const position = {
      ...basePosition,
      protectionStatus: 'PROTECTED',
      protectionOrderListId: 'ol-1',
      protectionStopOrderId: 'so-1',
    };
    const prisma = makePrisma([position]);
    const executor = makeExecutor({
      getProtectionOrderStatus: jest.fn().mockResolvedValue({
        state: 'ACTIVE',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      }),
      getOpenOrders: jest.fn().mockResolvedValue([
        { orderId: '1', clientOrderId: 'prot-pos-1-1', orderListId: 'ol-1' },
      ]),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.orphanOrdersCancelled).toBe(0);
    expect(executor.cancelProtectionOrder).not.toHaveBeenCalled();
  });

  it('case 6 — NONE is a no-op, no exchange calls for that position', async () => {
    const position = { ...basePosition, protectionStatus: 'NONE', protectionOrderListId: null };
    const prisma = makePrisma([position]);
    const executor = makeExecutor();

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(executor.getProtectionOrderStatus).not.toHaveBeenCalled();
    expect(executor.placeProtectionOrder).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ checked: 1, closedByExchange: 0, reprotected: 0, stillUnprotected: 0 });
  });
  const restingEntry = {
    id: 'entry-1',
    userId: 'user-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryMode: 'LIMIT_MAKER',
    quantity: 0.02,
    limitPrice: 63_000,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 65_000,
    plannedNotionalUsd: 1_260,
    clientOrderId: 'ent-aaaa',
    orderListId: null,
    orderId: 'oid-1',
    limitLegOrderId: null,
    stopLegOrderId: null,
    placedAt: new Date('2026-09-01T10:00:00Z'),
    expiresAt: new Date('2026-09-01T12:00:00Z'),
    decisionId: 'decision-1',
  };

  it('entry step — no RESTING rows means zero entry calls to the exchange (CA-001)', async () => {
    const prisma = makePrisma([]);
    const executor = makeExecutor();

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(executor.getEntryOrderStatus).not.toHaveBeenCalled();
    expect(executor.cancelEntryOrder).not.toHaveBeenCalled();
    expect(outcome.entryOrdersSettled).toBe(0);
  });

  it('entry step — a confirmed fill creates the Position and settles the row', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue({
        state: 'FILLED',
        filledLeg: 'LIMIT',
        executedPrice: 63_000,
        executedQuantity: 0.02,
        remainingQuantity: 0,
        partial: false,
        orderId: 'oid-1',
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: { ...baseConfig, nativeProtectionEnabled: false },
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(executor.getEntryOrderStatus).toHaveBeenCalledWith('BTCUSDT', {
      orderListId: null,
      orderId: 'oid-1',
      limitLegOrderId: null,
      stopLegOrderId: null,
    });
    expect(prisma.entryOrder.updateMany.mock.calls[0][0].data.status).toBe(
      'FILLED',
    );
    expect(prisma.position.create).toHaveBeenCalledTimes(1);
    expect(prisma.trade.create.mock.calls[0][0].data.decisionId).toBeNull();
    expect(prisma.botAction.create.mock.calls[0][0].data).toMatchObject({
      source: 'EXCHANGE_TRIGGER',
      kind: 'BUY',
    });
    expect(outcome.entryOrdersSettled).toBe(1);
  });

  it('entry step — the exchange query runs before the orphan sweep so a fill is never swept', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue({
        state: 'FILLED',
        filledLeg: 'LIMIT',
        executedPrice: 63_000,
        executedQuantity: 0.02,
        remainingQuantity: 0,
        partial: false,
        orderId: 'oid-1',
      }),
    });

    await buildService(prisma).reconcile({
      userId: 'user-1',
      config: { ...baseConfig, nativeProtectionEnabled: false },
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(
      executor.getEntryOrderStatus.mock.invocationCallOrder[0],
    ).toBeLessThan(executor.getOpenOrders.mock.invocationCallOrder[0]);
  });
  function restingStatus() {
    return {
      state: 'RESTING' as const,
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      remainingQuantity: 0.02,
      partial: false,
      orderId: 'oid-1',
    };
  }

  it('entry step — an expired TTL cancels on the exchange BEFORE marking the row EXPIRED', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue(restingStatus()),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
      now: new Date('2026-09-01T12:00:01Z'),
    });

    expect(executor.cancelEntryOrder).toHaveBeenCalledTimes(1);
    const update = prisma.entryOrder.update.mock.calls[0];
    expect(
      executor.cancelEntryOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.entryOrder.update.mock.invocationCallOrder[0]);
    expect(update[0].data).toMatchObject({
      status: 'EXPIRED',
      cancelReason: 'TTL_EXPIRED',
    });
    expect(outcome.entryOrdersExpired).toBe(1);
    expect(prisma.botAction.create.mock.calls[0][0].data).toMatchObject({
      kind: 'ENTRY_CANCEL',
      detail: 'TTL_EXPIRED',
    });
  });

  it('entry step — the TTL is computed from placedAt, so a query before expiry leaves the row alone', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue(restingStatus()),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
      now: new Date('2026-09-01T11:59:59Z'),
    });

    expect(executor.cancelEntryOrder).not.toHaveBeenCalled();
    expect(prisma.entryOrder.update).not.toHaveBeenCalled();
    expect(outcome.entryOrdersExpired).toBe(0);
  });

  it('entry step — a failed cancellation leaves the expired row RESTING with lastError', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue(restingStatus()),
      cancelEntryOrder: jest.fn().mockRejectedValue(new Error('timeout')),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
      now: new Date('2026-09-01T13:00:00Z'),
    });

    expect(prisma.entryOrder.update.mock.calls[0][0].data).toEqual({
      lastError: 'timeout',
    });
    expect(outcome.entryOrdersExpired).toBe(0);
  });

  it('entry step — a confirmed fill wins over an expired TTL in the same pass', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest.fn().mockResolvedValue({
        state: 'FILLED',
        filledLeg: 'LIMIT',
        executedPrice: 63_000,
        executedQuantity: 0.02,
        remainingQuantity: 0,
        partial: false,
        orderId: 'oid-1',
      }),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: { ...baseConfig, nativeProtectionEnabled: false },
      symbol: 'BTCUSDT',
      executor: executor as any,
      now: new Date('2026-09-01T20:00:00Z'),
    });

    expect(outcome.entryOrdersSettled).toBe(1);
    expect(outcome.entryOrdersExpired).toBe(0);
    expect(executor.cancelEntryOrder).not.toHaveBeenCalled();
    expect(prisma.entryOrder.updateMany.mock.calls[0][0].data.status).toBe(
      'FILLED',
    );
  });

  it('entry step — a cancellation nobody asked for is confirmed as VANISHED_ON_EXCHANGE', async () => {
    const prisma = makePrisma([], [{ ...restingEntry, cancelReason: null }]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest
        .fn()
        .mockResolvedValue({ ...restingStatus(), state: 'CANCELLED' }),
    });

    await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'VANISHED_ON_EXCHANGE',
    });
    expect(executor.cancelEntryOrder).not.toHaveBeenCalled();
  });

  it('entry step — a cancellation we had already requested keeps its own reason', async () => {
    const prisma = makePrisma([], [
      { ...restingEntry, cancelReason: 'BOT_STOPPED' },
    ]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest
        .fn()
        .mockResolvedValue({ ...restingStatus(), state: 'CANCELLED' }),
    });

    await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(prisma.entryOrder.update.mock.calls[0][0].data.cancelReason).toBe(
      'BOT_STOPPED',
    );
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('entry step — MISSING persists the row and raises an AGENT_ERROR, never deleting it', async () => {
    const prisma = makePrisma([], [restingEntry]);
    const executor = makeExecutor({
      getEntryOrderStatus: jest
        .fn()
        .mockResolvedValue({ ...restingStatus(), state: 'MISSING' }),
    });

    await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'MISSING',
      cancelReason: 'VANISHED_ON_EXCHANGE',
    });
    expect((prisma.entryOrder as any).delete).toBeUndefined();
    expect(
      notificationsMock.create.mock.calls.some((call: any) =>
        call[2].includes('entryOrderMissing'),
      ),
    ).toBe(true);
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:missing',
      expect.objectContaining({ entryOrderId: 'entry-1' }),
    );
  });

  it('orphan sweep — one getOpenOrders call feeds both sweeps and each keeps to its own prefix', async () => {
    const prisma = makePrisma([], []);
    prisma.entryOrder.findMany = jest
      .fn()
      .mockImplementation(({ select }: any) =>
        Promise.resolve(select ? [{ clientOrderId: 'ent-alive' }] : []),
      );
    const executor = makeExecutor({
      getOpenOrders: jest.fn().mockResolvedValue([
        { orderId: '1', clientOrderId: 'prot-pos-9-1', orderListId: 'ol-9' },
        { orderId: '2', clientOrderId: 'ent-alive-l', orderListId: 'ol-1' },
        { orderId: '3', clientOrderId: 'ent-alive-s', orderListId: 'ol-1' },
        { orderId: '4', clientOrderId: 'ent-orphan', orderListId: null },
        { orderId: '5', clientOrderId: 'manual-order', orderListId: null },
      ]),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(executor.getOpenOrders).toHaveBeenCalledTimes(1);
    expect(outcome.entryOrphansCancelled).toBe(1);
    expect(executor.cancelEntryOrder).toHaveBeenCalledTimes(1);
    expect(executor.cancelEntryOrder.mock.calls[0][1]).toMatchObject({
      orderId: '4',
    });
    expect(outcome.orphanOrdersCancelled).toBe(1);
    expect(executor.cancelProtectionOrder).toHaveBeenCalledTimes(1);
    expect(executor.cancelProtectionOrder.mock.calls[0][1]).toEqual({
      orderListId: 'ol-9',
    });
  });

  it('orphan sweep — an entry of another config of the same user is never swept', async () => {
    const prisma = makePrisma([], []);
    prisma.entryOrder.findMany = jest
      .fn()
      .mockImplementation(({ where, select }: any) =>
        Promise.resolve(
          select && where.userId ? [{ clientOrderId: 'ent-other-bot' }] : [],
        ),
      );
    const executor = makeExecutor({
      getOpenOrders: jest
        .fn()
        .mockResolvedValue([
          { orderId: '9', clientOrderId: 'ent-other-bot', orderListId: null },
        ]),
    });

    const outcome = await buildService(prisma).reconcile({
      userId: 'user-1',
      config: baseConfig,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.entryOrphansCancelled).toBe(0);
    expect(executor.cancelEntryOrder).not.toHaveBeenCalled();
  });
});
