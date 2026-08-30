import {
  ActionGateService,
  type ActionRequest,
} from '../trading/action-gate.service';
import {
  MarketStreamService,
  ownerLeaseKey,
  type MarketStreamRestClient,
  type MarketStreamWsClient,
} from './market-stream.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { TradingMode } from '@crypto-trader/shared';
import type { SymbolFilters, TickerUpdate } from '@crypto-trader/data-fetcher';
import { EventEmitter } from 'events';

function createSpyCoordination(): ReactiveCoordinationPort {
  return {
    isHealthy: jest.fn(() => true),
    tryAcquire: jest.fn(async () => true),
    renew: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
    tryConsumeToken: jest.fn(async () => false),
    setJson: jest.fn(async () => undefined),
    getJson: jest.fn(async () => null),
  };
}

describe('ActionGateService.authorizeAndRun is a pure passthrough with the loop off (CA-001 / TASK-026)', () => {
  function makeConfig(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'config-1',
      reactiveLoopEnabled: false,
      maxActionsPerHour: 6,
      minActionIntervalSec: 60,
      ...overrides,
    };
  }

  function makeRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      mode: TradingMode.SANDBOX,
      kind: 'BUY',
      source: 'LLM_CYCLE',
      positionId: null,
      decisionId: null,
      expected: null,
      detail: 'kill-switch action',
      ...overrides,
    };
  }

  function buildGate(config: Record<string, unknown>) {
    const findUniqueOrThrow = jest.fn().mockResolvedValue(config);
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _max: { occurredAt: null },
    });
    const create = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      tradingConfig: { findUniqueOrThrow },
      botAction: { aggregate, create },
      position: { findUnique },
    };

    const emitToUser = jest.fn();
    const gateway = { emitToUser };

    const evaluateDailyLoss = jest.fn().mockResolvedValue({
      reached: false,
      realizedPnlTodayUsd: 0,
      maxDailyLossUsd: null,
    });
    const aggregateRisk = { evaluateDailyLoss };

    const coordination = createSpyCoordination();

    const gate = new ActionGateService(
      prisma as never,
      gateway as never,
      aggregateRisk as never,
      coordination,
    );

    return { gate, prisma, gateway, aggregateRisk, coordination, findUniqueOrThrow };
  }

  it('executes the action and reports EXECUTED/REACTIVE_LOOP_DISABLED without touching coordination or the bot_actions ledger', async () => {
    const { gate, findUniqueOrThrow, prisma, gateway, aggregateRisk, coordination } = buildGate(
      makeConfig(),
    );
    const execute = jest.fn().mockResolvedValue('kill-switch-executed');

    const result = await gate.authorizeAndRun(makeRequest(), execute);

    expect(result).toEqual({
      outcome: 'EXECUTED',
      blockedBy: null,
      detail: 'REACTIVE_LOOP_DISABLED',
      value: 'kill-switch-executed',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(findUniqueOrThrow).toHaveBeenCalledTimes(1);

    expect(coordination.isHealthy).not.toHaveBeenCalled();
    expect(coordination.tryAcquire).not.toHaveBeenCalled();
    expect(coordination.renew).not.toHaveBeenCalled();
    expect(coordination.release).not.toHaveBeenCalled();

    expect(prisma.botAction.create).not.toHaveBeenCalled();
    expect(prisma.botAction.aggregate).not.toHaveBeenCalled();
    expect(prisma.position.findUnique).not.toHaveBeenCalled();
    expect(aggregateRisk.evaluateDailyLoss).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('is the same passthrough regardless of source/kind: FAST_PATH and every BotActionKind bypass the gate identically', async () => {
    const kinds: ActionRequest['kind'][] = [
      'BUY',
      'SELL_FULL',
      'SELL_PARTIAL',
      'PROTECTION_REARM',
    ];

    for (const kind of kinds) {
      const { gate, coordination, prisma } = buildGate(makeConfig());
      const execute = jest.fn().mockResolvedValue('ok');

      const result = await gate.authorizeAndRun(
        makeRequest({ kind, source: 'FAST_PATH' }),
        execute,
      );

      expect(result.outcome).toBe('EXECUTED');
      expect(result.detail).toBe('REACTIVE_LOOP_DISABLED');
      expect(execute).toHaveBeenCalledTimes(1);
      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(prisma.botAction.create).not.toHaveBeenCalled();
    }
  });

  it('propagates an execute() failure untouched: no BLOCKED/EXECUTION_ERROR row is written while the loop is off', async () => {
    const { gate, prisma, coordination } = buildGate(makeConfig());
    const boom = new Error('exchange unreachable');
    const execute = jest.fn().mockRejectedValue(boom);

    await expect(gate.authorizeAndRun(makeRequest(), execute)).rejects.toThrow(
      'exchange unreachable',
    );

    expect(prisma.botAction.create).not.toHaveBeenCalled();
    expect(coordination.release).not.toHaveBeenCalled();
  });
});

class FakeWsClient extends EventEmitter implements MarketStreamWsClient {
  streams: string[] = [];
  connected = false;
  connect = jest.fn(() => {
    this.connected = true;
  });
  disconnect = jest.fn(() => {
    this.connected = false;
  });
  isConnected = jest.fn(() => this.connected);
  addStreams = jest.fn((streams: string[]) => {
    for (const s of streams) if (!this.streams.includes(s)) this.streams.push(s);
  });
  removeStreams = jest.fn((streams: string[]) => {
    this.streams = this.streams.filter((s) => !streams.includes(s));
  });
}

function createFakeRestClient(): MarketStreamRestClient {
  const filters: SymbolFilters = {
    lotSize: { minQty: 0.0001, maxQty: 1000, stepSize: 0.0001 },
    price: { minPrice: 0.01, maxPrice: 1_000_000, tickSize: 0.01 },
    notional: { minNotional: 10, applyToMarket: true },
  };
  return { getSymbolFilters: jest.fn().mockResolvedValue(filters) };
}

interface FakeTradingConfigRow {
  asset: string;
  pair: string;
  isRunning: boolean;
  reactiveLoopEnabled: boolean;
}

function createFilteringPrisma(rows: FakeTradingConfigRow[]) {
  return {
    tradingConfig: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { isRunning?: boolean; reactiveLoopEnabled?: boolean };
        }) =>
          rows
            .filter(
              (row) =>
                (where.isRunning === undefined || row.isRunning === where.isRunning) &&
                (where.reactiveLoopEnabled === undefined ||
                  row.reactiveLoopEnabled === where.reactiveLoopEnabled),
            )
            .map((row) => ({ asset: row.asset, pair: row.pair })),
      ),
    },
  };
}

describe('MarketStreamService takes no owner lease for a config with the loop off (CA-001 / TASK-026)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('never subscribes nor acquires rx:v1:owner:{symbol} for a reactiveLoopEnabled=false config, while a sibling config with the loop on is owned normally', async () => {
    const rows: FakeTradingConfigRow[] = [
      { asset: 'BTC', pair: 'USDT', isRunning: true, reactiveLoopEnabled: false },
      { asset: 'ETH', pair: 'USDT', isRunning: true, reactiveLoopEnabled: true },
    ];
    const prisma = createFilteringPrisma(rows);
    const coordination = createSpyCoordination();
    const wsClient = new FakeWsClient();
    const restClient = createFakeRestClient();
    const service = new MarketStreamService(
      prisma as never,
      coordination,
      wsClient,
      restClient,
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      'instance-kill-switch',
    );

    try {
      await service.onModuleInit();

      expect(service.isOwner('BTCUSDT')).toBe(false);
      expect(service.isOwner('ETHUSDT')).toBe(true);

      expect(coordination.tryAcquire).not.toHaveBeenCalledWith(
        ownerLeaseKey('BTCUSDT'),
        expect.any(String),
        expect.any(Number),
      );
      expect(coordination.tryAcquire).toHaveBeenCalledWith(
        ownerLeaseKey('ETHUSDT'),
        'instance-kill-switch',
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.ownerLeaseTtlMs,
      );

      expect(wsClient.streams).not.toEqual(
        expect.arrayContaining(['btcusdt@miniTicker', 'btcusdt@kline_1h']),
      );
      expect(wsClient.streams).toEqual(
        expect.arrayContaining(['ethusdt@miniTicker', 'ethusdt@kline_1h']),
      );
    } finally {
      await service.onApplicationShutdown();
    }
  });

  it('acquires no owner lease at all and never connects the WS client when every active config has the loop off', async () => {
    const rows: FakeTradingConfigRow[] = [
      { asset: 'BTC', pair: 'USDT', isRunning: true, reactiveLoopEnabled: false },
      { asset: 'ETH', pair: 'USDT', isRunning: true, reactiveLoopEnabled: false },
    ];
    const prisma = createFilteringPrisma(rows);
    const coordination = createSpyCoordination();
    const wsClient = new FakeWsClient();
    const restClient = createFakeRestClient();
    const service = new MarketStreamService(
      prisma as never,
      coordination,
      wsClient,
      restClient,
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      'instance-kill-switch',
    );

    try {
      await service.onModuleInit();

      expect(service.getOwnedSymbols()).toEqual([]);
      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connect).not.toHaveBeenCalled();
      expect(wsClient.isConnected()).toBe(false);

      const ticks: unknown[] = [];
      service.on('tick', (tick) => ticks.push(tick));
      const tickerUpdate: TickerUpdate = {
        symbol: 'BTCUSDT',
        price: 65_000,
        volume: 1,
        change24h: 0,
        timestamp: 1,
      };
      wsClient.emit('ticker', tickerUpdate);
      expect(ticks).toHaveLength(0);
    } finally {
      await service.onApplicationShutdown();
    }
  });
});
