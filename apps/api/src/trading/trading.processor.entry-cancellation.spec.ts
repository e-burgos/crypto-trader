import { TradingProcessor } from './trading.processor';
import { TradingService } from './trading.service';
import { ReconciliationService } from './reconciliation.service';
import { EntryOrderService } from './entry-order.service';
import { PositionActionService } from './position-action.service';
import {
  createTradingPrismaMock,
  createTradingProcessorCollaborators,
} from './__mocks__/trading-processor-deps';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { BinanceRestClient } from '@crypto-trader/data-fetcher';

jest.mock('../users/utils/encryption.util', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn().mockReturnValue('plaintext-secret'),
}));

const gatewayMock = { emitToUser: jest.fn() };
const notificationsMock = { create: jest.fn().mockResolvedValue({}) };

function restingRow(overrides: any = {}) {
  return {
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
    decisionId: 'dec-1',
    cancelReason: null,
    ...overrides,
  };
}

function passthroughGate() {
  return {
    authorizeAndRun: jest
      .fn()
      .mockImplementation(async (_req: any, execute: any) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      })),
  };
}

describe('c1 — a later decision that will not place an entry cancels the resting one', () => {
  function buildProcessor(prisma: any, actionGate: any) {
    const prismaMock = createTradingPrismaMock(prisma);
    return new TradingProcessor(
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
      {} as any,
      ...createTradingProcessorCollaborators({
        prisma: prismaMock,
        gateway: gatewayMock,
        notificationsService: notificationsMock,
        actionGate,
      }),
    );
  }

  const config = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    entryOrderMode: 'LIMIT_MAKER',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('cancels through the gate with LATER_DECISION and confirms on the exchange', async () => {
    const cancelEntryOrder = jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockResolvedValue(undefined as any);
    const actionGate = passthroughGate();
    const prisma = {
      entryOrder: {
        findMany: jest.fn().mockResolvedValue([restingRow()]),
        update: jest.fn().mockResolvedValue({}),
      },
      botAction: { create: jest.fn().mockResolvedValue({}) },
    };
    const processor = buildProcessor(prisma, actionGate);

    await (processor as any).cancelRestingEntriesAfterDecision({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
      apiKey: 'key',
      apiSecret: 'secret',
      decisionId: 'dec-2',
    });

    expect(cancelEntryOrder).toHaveBeenCalledTimes(1);
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'ENTRY_CANCEL',
      source: 'LLM_CYCLE',
      detail: 'LATER_DECISION',
      decisionId: 'dec-2',
    });
    expect(prisma.entryOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'LATER_DECISION',
    });
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('does nothing — not even a gate call — when there is no resting entry', async () => {
    const cancelEntryOrder = jest.spyOn(
      BinanceRestClient.prototype,
      'cancelEntryOrder',
    );
    const actionGate = passthroughGate();
    const prisma = {
      entryOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      botAction: { create: jest.fn() },
    };
    const processor = buildProcessor(prisma, actionGate);

    await (processor as any).cancelRestingEntriesAfterDecision({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
      apiKey: 'key',
      apiSecret: 'secret',
      decisionId: 'dec-2',
    });

    expect(cancelEntryOrder).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).not.toHaveBeenCalled();
  });
});

describe('c2 — the daily-loss cap discards every resting entry of the bot', () => {
  function buildReconciliation(prisma: any, aggregateRisk: any, actionGate: any) {
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
      aggregateRisk,
      actionGate,
    );
  }

  function makeExecutor(overrides: any = {}) {
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

  const config = {
    id: 'config-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    stopLimitOffsetPct: 0.002,
  };

  beforeEach(() => {
    gatewayMock.emitToUser.mockClear();
    notificationsMock.create.mockClear();
  });

  it('cancels every resting entry and never queries their exchange status', async () => {
    const prisma = {
      position: { findMany: jest.fn().mockResolvedValue([]) },
      entryOrder: {
        findMany: jest
          .fn()
          .mockResolvedValue([restingRow(), restingRow({ id: 'entry-2' })]),
        update: jest.fn().mockResolvedValue({}),
      },
      botAction: { create: jest.fn().mockResolvedValue({}) },
    };
    const aggregateRisk = {
      evaluateDailyLoss: jest.fn().mockResolvedValue({ reached: true }),
    };
    const actionGate = passthroughGate();
    const executor = makeExecutor();

    const outcome = await buildReconciliation(
      prisma,
      aggregateRisk,
      actionGate,
    ).reconcile({
      userId: 'user-1',
      config,
      symbol: 'BTCUSDT',
      executor: executor as any,
    });

    expect(outcome.entryOrdersDiscarded).toBe(2);
    expect(executor.cancelEntryOrder).toHaveBeenCalledTimes(2);
    expect(executor.getEntryOrderStatus).not.toHaveBeenCalled();
    expect(actionGate.authorizeAndRun).toHaveBeenCalledTimes(1);
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'ENTRY_CANCEL',
      detail: 'DAILY_LOSS_DISCARDED',
    });
    expect(prisma.entryOrder.update.mock.calls[0][0].data.cancelReason).toBe(
      'DAILY_LOSS_DISCARDED',
    );
    expect(prisma.botAction.create).not.toHaveBeenCalled();
  });

  it('does not evaluate the daily loss at all when there is no resting entry', async () => {
    const prisma = {
      position: { findMany: jest.fn().mockResolvedValue([]) },
      entryOrder: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      botAction: { create: jest.fn() },
    };
    const aggregateRisk = { evaluateDailyLoss: jest.fn() };

    await buildReconciliation(prisma, aggregateRisk, passthroughGate()).reconcile(
      {
        userId: 'user-1',
        config,
        symbol: 'BTCUSDT',
        executor: makeExecutor() as any,
      },
    );

    expect(aggregateRisk.evaluateDailyLoss).not.toHaveBeenCalled();
  });
});

describe('c3 — stopping the bot cancels its resting entries', () => {
  const credential = {
    apiKeyEncrypted: 'enc',
    apiKeyIv: 'iv',
    secretEncrypted: 'enc',
    secretIv: 'iv',
  };

  function buildService(prisma: any, actionGate: any, entryOrders: any) {
    return new TradingService(
      prisma,
      { add: jest.fn(), getJob: jest.fn(), getWaiting: jest.fn().mockResolvedValue([]), getDelayed: jest.fn().mockResolvedValue([]) } as any,
      gatewayMock as any,
      notificationsMock as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      entryOrders,
      actionGate,
    );
  }

  function makePrisma(config: any, credentials: any = credential) {
    return {
      tradingConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      binanceCredential: { findUnique: jest.fn().mockResolvedValue(credentials) },
      position: { update: jest.fn() },
    };
  }

  const runningConfig = {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'LIVE',
    isRunning: true,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    gatewayMock.emitToUser.mockClear();
  });

  it('cancels the resting entries with BOT_STOPPED and leaves open positions untouched', async () => {
    jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockResolvedValue(undefined as any);
    const prisma = makePrisma(runningConfig);
    const entryOrders = {
      findResting: jest.fn().mockResolvedValue([restingRow()]),
      cancelResting: jest
        .fn()
        .mockResolvedValue({ cancelled: ['entry-1'], failed: [] }),
    };
    const actionGate = passthroughGate();

    const result = await buildService(prisma, actionGate, entryOrders).stopAgentById(
      'user-1',
      'config-1',
    );

    expect(result).toMatchObject({ stopped: true });
    expect(actionGate.authorizeAndRun.mock.calls[0][0]).toMatchObject({
      kind: 'ENTRY_CANCEL',
      detail: 'BOT_STOPPED',
    });
    expect(entryOrders.cancelResting.mock.calls[0][0]).toMatchObject({
      reason: 'BOT_STOPPED',
      recordAction: false,
    });
    expect(prisma.position.update).not.toHaveBeenCalled();
  });

  it('stops the bot anyway when there are no credentials to cancel with', async () => {
    const prisma = makePrisma(runningConfig, null);
    const entryOrders = {
      findResting: jest.fn().mockResolvedValue([restingRow()]),
      cancelResting: jest.fn(),
    };
    const actionGate = passthroughGate();

    const result = await buildService(prisma, actionGate, entryOrders).stopAgentById(
      'user-1',
      'config-1',
    );

    expect(result).toMatchObject({ stopped: true, configId: 'config-1' });
    expect(entryOrders.cancelResting).not.toHaveBeenCalled();
    expect(prisma.tradingConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { isRunning: false },
    });
  });

  it('stops the bot anyway when the cancellation itself throws', async () => {
    const prisma = makePrisma(runningConfig);
    const entryOrders = {
      findResting: jest.fn().mockRejectedValue(new Error('db down')),
      cancelResting: jest.fn(),
    };

    const result = await buildService(
      prisma,
      passthroughGate(),
      entryOrders,
    ).stopAgentById('user-1', 'config-1');

    expect(result).toMatchObject({ stopped: true });
  });

  it('a SANDBOX bot never reaches the exchange when it stops', async () => {
    const prisma = makePrisma({ ...runningConfig, mode: 'SANDBOX' });
    const entryOrders = { findResting: jest.fn(), cancelResting: jest.fn() };

    await buildService(prisma, passthroughGate(), entryOrders).stopAgentById(
      'user-1',
      'config-1',
    );

    expect(entryOrders.findResting).not.toHaveBeenCalled();
    expect(prisma.binanceCredential.findUnique).not.toHaveBeenCalled();
  });

  it('deleteConfig cancels on the exchange before the row (and its CASCADE) is deleted', async () => {
    jest
      .spyOn(BinanceRestClient.prototype, 'cancelEntryOrder')
      .mockResolvedValue(undefined as any);
    const prisma = makePrisma({ ...runningConfig, isRunning: false });
    const entryOrders = {
      findResting: jest.fn().mockResolvedValue([restingRow()]),
      cancelResting: jest
        .fn()
        .mockResolvedValue({ cancelled: ['entry-1'], failed: [] }),
    };

    await buildService(prisma, passthroughGate(), entryOrders).deleteConfig(
      'user-1',
      'config-1',
    );

    expect(entryOrders.cancelResting).toHaveBeenCalledTimes(1);
    expect(
      entryOrders.cancelResting.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.tradingConfig.delete.mock.invocationCallOrder[0]);
  });

  it('the bulk stops delegate to the same per-config cancellation', async () => {
    const configs = [
      runningConfig,
      { ...runningConfig, id: 'config-2', userId: 'user-2' },
    ];
    const prisma = {
      tradingConfig: {
        findMany: jest.fn().mockResolvedValue(configs),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      binanceCredential: { findUnique: jest.fn().mockResolvedValue(credential) },
      position: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const entryOrders = {
      findResting: jest.fn().mockResolvedValue([restingRow()]),
      cancelResting: jest
        .fn()
        .mockResolvedValue({ cancelled: ['entry-1'], failed: [] }),
    };
    const actionGate = passthroughGate();
    const service = buildService(prisma, actionGate, entryOrders);

    await service.stopAllAgents();
    expect(entryOrders.cancelResting).toHaveBeenCalledTimes(2);

    entryOrders.cancelResting.mockClear();
    await service.stopAllAgentsForUser('user-1');
    expect(entryOrders.cancelResting).toHaveBeenCalledTimes(2);

    entryOrders.cancelResting.mockClear();
    await service.stopAgentsByModeForUser('user-1', 'LIVE');
    expect(entryOrders.cancelResting).toHaveBeenCalledTimes(2);
  });
});
