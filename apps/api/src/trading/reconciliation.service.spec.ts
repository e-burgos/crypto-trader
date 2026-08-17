import { ReconciliationService } from './reconciliation.service';

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
      ...overrides,
    };
  }

  function makePrisma(positions: any[]) {
    return {
      position: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where.configId && where.configId.not) return Promise.resolve([]);
          return Promise.resolve(positions);
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      trade: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  function buildService(prisma: any) {
    return new ReconciliationService(
      prisma,
      notificationsMock as any,
      gatewayMock as any,
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
});
