import { NotificationType } from '@crypto-trader/shared';
import {
  ENTRY_CLIENT_ORDER_ID_PREFIX,
  EntryOrderService,
  createEntryClientOrderId,
  type EntryOrderCancelReason,
} from './entry-order.service';
import { PositionActionService } from './position-action.service';

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
      { placeInitialProtection: jest.fn() } as any,
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
    cancelReason: null,
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
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith('user-1', 'entry-order:placed', {
      configId: 'config-1',
      entryOrderId: 'entry-1',
      symbol: 'BTCUSDT',
      entryMode: 'LIMIT_MAKER',
      limitPrice: 63_000,
      stopPrice: null,
      stopLimitPrice: null,
      trailingDeltaBips: null,
      quantity: 0.01,
      plannedNotionalUsd: 630,
      placedAt: created.placedAt,
      expiresAt: created.expiresAt,
    });
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      NotificationType.TRADE_EXECUTED,
      expect.stringContaining('entryOrderPlaced'),
    );
    const placedPayload = JSON.parse(
      notificationsMock.create.mock.calls[0][2] as string,
    );
    expect(placedPayload).toMatchObject({
      key: 'entryOrderPlaced',
      configId: 'config-1',
      entryOrderId: 'entry-1',
      entryMode: 'LIMIT_MAKER',
      asset: 'BTC',
      mode: 'LIVE',
    });
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
      expect(gatewayMock.emitToUser).toHaveBeenCalledWith('user-1', 'entry-order:cancelled', {
        configId: 'config-1',
        entryOrderId: 'entry-1',
        symbol: 'BTCUSDT',
        cancelReason: reason,
      });
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
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith('user-1', 'entry-order:expired', {
      configId: 'config-1',
      entryOrderId: 'entry-1',
      symbol: 'BTCUSDT',
      placedAt: restingRow.placedAt,
      expiresAt: restingRow.expiresAt,
    });
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

  it('marks the row MISSING and notifies configId and entryOrderId alongside the previous keys', async () => {
    const prisma = makePrisma();

    await buildService(prisma).markMissing(restingRow as any);

    expect(prisma.entryOrder.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'entry-1' },
      data: { status: 'MISSING', cancelReason: 'VANISHED_ON_EXCHANGE' },
    });
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      NotificationType.AGENT_ERROR,
      expect.stringContaining('entryOrderMissing'),
    );
    const missingPayload = JSON.parse(
      notificationsMock.create.mock.calls[0][2] as string,
    );
    expect(missingPayload).toMatchObject({
      key: 'entryOrderMissing',
      configId: 'config-1',
      entryOrderId: 'entry-1',
      symbol: 'BTCUSDT',
    });
  });
});

describe('EntryOrderService.settleFill (TASK-015)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

  const config = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
    nativeProtectionEnabled: true,
    closeOnProtectionFailure: false,
  };

  const restingOco = {
    id: 'entry-1',
    userId: 'user-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryMode: 'OCO' as const,
    quantity: 0.02,
    limitPrice: 63_000,
    stopPrice: 67_000,
    stopLimitPrice: 67_134,
    trailingDeltaBips: null,
    referencePrice: 65_000,
    plannedNotionalUsd: 1_342.68,
    clientOrderId: 'ent-oco',
    orderListId: 'ol-7',
    orderId: null,
    limitLegOrderId: 'leg-limit',
    stopLegOrderId: 'leg-stop',
    placedAt: new Date('2026-09-01T10:00:00Z'),
    expiresAt: new Date('2026-09-01T12:00:00Z'),
    decisionId: 'decision-1',
    cancelReason: null,
  };

  function makePrisma(overrides: any = {}) {
    const { entryOrder, ...rest } = overrides;
    return {
      entryOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        ...entryOrder,
      },
      position: {
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
      ...rest,
    };
  }

  function buildService(prisma: any, positionAction: any) {
    return new EntryOrderService(
      prisma,
      notificationsMock as any,
      gatewayMock as any,
      positionAction,
    );
  }

  function fullFill(overrides: any = {}) {
    return {
      state: 'FILLED' as const,
      filledLeg: 'LIMIT' as const,
      executedPrice: 63_000,
      executedQuantity: 0.02,
      remainingQuantity: 0,
      partial: false,
      orderId: 'leg-limit',
      ...overrides,
    };
  }

  beforeEach(() => {
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('creates Position, Trade with decisionId null and one EXCHANGE_TRIGGER bot_action', async () => {
    const prisma = makePrisma();
    const positionAction = { placeInitialProtection: jest.fn() };
    const executor = makeEntryExecutor();

    const outcome = await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill(),
    });

    expect(outcome).toBe('SETTLED');
    expect(prisma.entryOrder.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'entry-1', status: 'RESTING' },
      data: { status: 'FILLED', filledLeg: 'LIMIT', executedPrice: 63_000 },
    });

    const positionData = prisma.position.create.mock.calls[0][0].data;
    expect(positionData).toMatchObject({
      entryPrice: 63_000,
      quantity: 0.02,
      protectionStatus: 'PENDING',
      highWaterPrice: 63_000,
      initialQuantity: 0.02,
    });
    expect(positionData.stopPrice).toBeCloseTo(63_000 * 0.97, 6);
    expect(positionData.takeProfitPrice).toBeCloseTo(63_000 * 1.05, 6);

    expect(prisma.trade.create.mock.calls[0][0].data).toMatchObject({
      type: 'BUY',
      price: 63_000,
      quantity: 0.02,
      binanceOrderId: 'leg-limit',
      decisionId: null,
    });

    expect(prisma.entryOrder.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'entry-1' },
      data: { positionId: 'pos-new' },
    });

    expect(prisma.botAction.create).toHaveBeenCalledTimes(1);
    expect(prisma.botAction.create.mock.calls[0][0].data).toMatchObject({
      kind: 'BUY',
      source: 'EXCHANGE_TRIGGER',
      outcome: 'EXECUTED',
      positionId: 'pos-new',
      decisionId: 'decision-1',
      detail: 'ENTRY_FILLED_LIMIT',
    });

    expect(positionAction.placeInitialProtection).toHaveBeenCalledTimes(1);
    expect(notificationsMock.create).toHaveBeenCalledWith(
      'user-1',
      NotificationType.TRADE_EXECUTED,
      expect.stringContaining('entryOrderFilled'),
    );
    const filledPayload = JSON.parse(
      notificationsMock.create.mock.calls[0][2] as string,
    );
    expect(filledPayload).toMatchObject({
      key: 'entryOrderFilled',
      configId: 'config-1',
      entryOrderId: 'entry-1',
      asset: 'BTC',
      mode: 'LIVE',
    });
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith('user-1', 'entry-order:filled', {
      configId: 'config-1',
      entryOrderId: 'entry-1',
      symbol: 'BTCUSDT',
      positionId: 'pos-new',
      filledLeg: 'LIMIT',
      executedPrice: 63_000,
      executedQuantity: 0.02,
      partial: false,
    });
  });

  it('settles the STOP leg of an OCO exactly like the LIMIT leg, reading the leg from the exchange', async () => {
    const prisma = makePrisma();
    const positionAction = { placeInitialProtection: jest.fn() };
    const executor = makeEntryExecutor();

    await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill({
        filledLeg: 'STOP',
        executedPrice: 67_134,
        orderId: 'leg-stop',
      }),
    });

    expect(prisma.entryOrder.updateMany.mock.calls[0][0].data.filledLeg).toBe(
      'STOP',
    );
    expect(prisma.position.create.mock.calls[0][0].data.entryPrice).toBe(67_134);
    expect(prisma.botAction.create.mock.calls[0][0].data.detail).toBe(
      'ENTRY_FILLED_STOP',
    );
    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(positionAction.placeInitialProtection).toHaveBeenCalledTimes(1);
  });

  it('cancels the remainder of a partial fill BEFORE creating the Position', async () => {
    const prisma = makePrisma();
    const positionAction = { placeInitialProtection: jest.fn() };
    const executor = makeEntryExecutor();

    await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill({
        executedQuantity: 0.008,
        remainingQuantity: 0.012,
        partial: true,
      }),
    });

    expect(executor.cancelEntryOrder).toHaveBeenCalledTimes(1);
    expect(
      executor.cancelEntryOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.position.create.mock.invocationCallOrder[0]);
    expect(
      executor.cancelEntryOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.entryOrder.updateMany.mock.invocationCallOrder[0]);
    expect(prisma.position.create.mock.calls[0][0].data.quantity).toBe(0.008);
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'entry-order:filled',
      expect.objectContaining({ partial: true, executedQuantity: 0.008 }),
    );
  });

  it('aborts the settlement and leaves the row RESTING when the remainder cannot be cancelled', async () => {
    const prisma = makePrisma();
    const positionAction = { placeInitialProtection: jest.fn() };
    const executor = makeEntryExecutor({
      cancelEntryOrder: jest.fn().mockRejectedValue(new Error('exchange down')),
    });

    const outcome = await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill({ executedQuantity: 0.008, partial: true }),
    });

    expect(outcome).toBe('REMAINDER_CANCEL_FAILED');
    expect(prisma.entryOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toEqual({
      lastError: 'exchange down',
    });
  });

  it('stops when the conditional claim finds no RESTING row (another pass already settled it)', async () => {
    const prisma = makePrisma({
      entryOrder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    });
    const positionAction = { placeInitialProtection: jest.fn() };

    const outcome = await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: makeEntryExecutor() as any,
      order: restingOco,
      status: fullFill(),
    });

    expect(outcome).toBe('ALREADY_SETTLED');
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.trade.create).not.toHaveBeenCalled();
    expect(prisma.botAction.create).not.toHaveBeenCalled();
    expect(positionAction.placeInitialProtection).not.toHaveBeenCalled();
  });

  it('skips native protection entirely when the bot does not use it', async () => {
    const prisma = makePrisma();
    const positionAction = { placeInitialProtection: jest.fn() };

    await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config: { ...config, nativeProtectionEnabled: false },
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: makeEntryExecutor() as any,
      order: restingOco,
      status: fullFill(),
    });

    expect(positionAction.placeInitialProtection).not.toHaveBeenCalled();
    expect(prisma.position.create.mock.calls[0][0].data.protectionStatus).toBeUndefined();
  });

  it('reuses the market-buy protection path: exhausting retries leaves UNPROTECTED with its notification and event', async () => {
    const prisma = makePrisma();
    const positionAction = new PositionActionService(
      prisma as any,
      gatewayMock as any,
      notificationsMock as any,
    );
    const executor = makeEntryExecutor({
      placeProtectionOrder: jest
        .fn()
        .mockRejectedValue(new Error('MIN_NOTIONAL')),
    });

    await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill(),
    });

    const unprotected = prisma.position.update.mock.calls.find(
      (call: any) => call[0].data.protectionStatus === 'UNPROTECTED',
    );
    expect(unprotected).toBeDefined();
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'position:unprotected',
      expect.objectContaining({ positionId: 'pos-new' }),
    );
    expect(
      notificationsMock.create.mock.calls.some((call: any) =>
        call[2].includes('positionUnprotected'),
      ),
    ).toBe(true);
    expect(executor.placeMarketOrder).not.toHaveBeenCalled();
  });

  it('closes the position after a protection failure only when closeOnProtectionFailure is on', async () => {
    const prisma = makePrisma();
    const positionAction = new PositionActionService(
      prisma as any,
      gatewayMock as any,
      notificationsMock as any,
    );
    const executor = makeEntryExecutor({
      placeProtectionOrder: jest
        .fn()
        .mockRejectedValue(new Error('MIN_NOTIONAL')),
      placeMarketOrder: jest
        .fn()
        .mockResolvedValue({ price: 62_000, quantity: 0.02, orderId: 'x' }),
    });

    await buildService(prisma, positionAction).settleFill({
      userId: 'user-1',
      config: { ...config, closeOnProtectionFailure: true },
      symbol: 'BTCUSDT',
      mode: 'LIVE' as any,
      executor: executor as any,
      order: restingOco,
      status: fullFill(),
    });

    expect(executor.placeMarketOrder).toHaveBeenCalledTimes(1);
  });
});
