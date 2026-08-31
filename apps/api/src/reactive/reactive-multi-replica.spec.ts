import { EventEmitter } from 'events';
import type { TickerUpdate, SymbolFilters } from '@crypto-trader/data-fetcher';
import type { MarketTick } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import {
  MarketStreamService,
  type MarketStreamRestClient,
  type MarketStreamWsClient,
} from './market-stream.service';
import { FastPathService } from './fast-path.service';
import { MaterialEventService } from './material-event.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';

const planFastPathMock = jest.fn();
const detectMaterialEventMock = jest.fn();

jest.mock('@crypto-trader/trading-engine', () => ({
  ...jest.requireActual('@crypto-trader/trading-engine'),
  planFastPath: (...args: unknown[]) => planFastPathMock(...args),
}));

jest.mock('@crypto-trader/analysis', () => ({
  ...jest.requireActual('@crypto-trader/analysis'),
  detectMaterialEvent: (...args: unknown[]) => detectMaterialEventMock(...args),
}));

jest.mock('@crypto-trader/data-fetcher', () => ({
  BinanceRestClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((value: string) => `decrypted:${value}`),
}));

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

interface FakeCoordination extends ReactiveCoordinationPort {
  ownerOf(key: string): string | undefined;
}

function createSharedFakeCoordination(): FakeCoordination {
  const store = new Map<string, string>();
  return {
    ownerOf: (key: string) => store.get(key),
    isHealthy: () => true,
    tryAcquire: jest.fn(async (key: string, holderId: string) => {
      if (store.has(key)) return false;
      store.set(key, holderId);
      return true;
    }),
    renew: jest.fn(async (key: string, holderId: string) => store.get(key) === holderId),
    release: jest.fn(async (key: string, holderId: string) => {
      if (store.get(key) === holderId) store.delete(key);
    }),
    tryConsumeToken: jest.fn(async () => false),
    setJson: jest.fn(async () => undefined),
    getJson: jest.fn(async () => null),
  };
}

function createFakePrisma(config: unknown, position: unknown) {
  return {
    tradingConfig: { findMany: jest.fn().mockResolvedValue([config]) },
    position: {
      findMany: jest.fn().mockResolvedValue([position]),
      update: jest.fn().mockResolvedValue({}),
    },
    binanceCredential: { findUnique: jest.fn() },
  };
}

interface Replica {
  instanceId: string;
  wsClient: FakeWsClient;
  marketStream: MarketStreamService;
  fastPath: FastPathService;
}

function buildReplica(
  instanceId: string,
  coordination: ReactiveCoordinationPort,
  config: unknown,
  position: unknown,
  actionGate: { authorizeAndRun: jest.Mock },
  positionAction: {
    closeAtMarket: jest.Mock;
    executePartialTakeProfit: jest.Mock;
    rearmProtection: jest.Mock;
  },
): Replica {
  const wsClient = new FakeWsClient();
  const restClient = createFakeRestClient();
  const prisma = createFakePrisma(config, position);
  const marketStream = new MarketStreamService(
    prisma as never,
    coordination,
    wsClient,
    restClient,
    DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    instanceId,
  );
  const fastPath = new FastPathService(
    prisma as never,
    marketStream,
    actionGate as never,
    positionAction as never,
    DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  );
  return { instanceId, wsClient, marketStream, fastPath };
}

function publishTicker(replicas: Replica[], update: TickerUpdate): void {
  const streamName = `${update.symbol.toLowerCase()}@miniTicker`;
  for (const replica of replicas) {
    if (replica.wsClient.isConnected() && replica.wsClient.streams.includes(streamName)) {
      replica.wsClient.emit('ticker', update);
    }
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('reactive multi-replica ownership (CA-007 / TASK-035, entrega 1)', () => {
  const baseConfig = {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: TradingMode.SANDBOX,
    isRunning: true,
    reactiveLoopEnabled: true,
    stopLossPct: 0.03,
    takeProfitPct: 0.05,
    trailingStopEnabled: true,
    trailingStopPct: 0.02,
    trailingActivationPct: 0.01,
    partialTpEnabled: false,
    partialTpTriggerPct: 0.02,
    partialTpSellPct: 0.5,
    moveStopToBreakevenAfterPartial: true,
    nativeProtectionEnabled: false,
  };

  const basePosition = {
    id: 'pos-1',
    configId: 'config-1',
    entryPrice: 100,
    quantity: 2,
    stopPrice: 97,
    highWaterPrice: 100,
    trailingActive: false,
    partialExitCount: 0,
    protectionStatus: 'NONE',
    takeProfitPrice: null,
  };

  const REPLICA_IDS = ['replica-a', 'replica-b', 'replica-c'];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('under N replicas sharing one coordination store, exactly one subscribes to the symbol and the fast path executes exactly once', async () => {
    const coordination = createSharedFakeCoordination();
    const authorizeAndRunSpy = jest.fn(
      async (_request: unknown, execute: () => Promise<unknown>) => ({
        outcome: 'EXECUTED',
        blockedBy: null,
        detail: 'ok',
        value: await execute(),
      }),
    );
    const positionActionSpy = {
      closeAtMarket: jest.fn().mockResolvedValue({ tradeId: 'trade-1', exitPrice: 99 }),
      executePartialTakeProfit: jest.fn(),
      rearmProtection: jest.fn(),
    };
    const actionGateSpy = { authorizeAndRun: authorizeAndRunSpy };

    const replicas = REPLICA_IDS.map((id) =>
      buildReplica(id, coordination, baseConfig, basePosition, actionGateSpy, positionActionSpy),
    );

    try {
      for (const replica of replicas) {
        replica.fastPath.onModuleInit();
        await replica.marketStream.onModuleInit();
      }

      const owners = replicas.filter((r) => r.marketStream.isOwner('BTCUSDT'));
      expect(owners).toHaveLength(1);

      const subscribed = replicas.filter(
        (r) => r.wsClient.isConnected() && r.wsClient.streams.includes('btcusdt@miniTicker'),
      );
      expect(subscribed).toHaveLength(1);
      expect(subscribed[0]).toBe(owners[0]);
      expect(coordination.ownerOf('rx:v1:owner:BTCUSDT')).toBe(owners[0].instanceId);

      planFastPathMock.mockReturnValue({
        action: 'HARD_STOP_EXIT',
        trailing: { entryPrice: 100, stopPrice: 97, highWaterPrice: 100, trailingActive: false },
        effectiveStop: 97,
      });

      const tickerBase: TickerUpdate = {
        symbol: 'BTCUSDT',
        price: 99,
        volume: 1000,
        change24h: 0,
        timestamp: 1_000,
      };
      publishTicker(replicas, tickerBase);
      await flushMicrotasks();
      publishTicker(replicas, { ...tickerBase, timestamp: 2_000 });
      await flushMicrotasks();

      expect(planFastPathMock).toHaveBeenCalledTimes(1);
      expect(authorizeAndRunSpy).toHaveBeenCalledTimes(1);
      expect(positionActionSpy.closeAtMarket).toHaveBeenCalledTimes(1);
      expect(positionActionSpy.executePartialTakeProfit).not.toHaveBeenCalled();
      expect(positionActionSpy.rearmProtection).not.toHaveBeenCalled();
    } finally {
      for (const replica of replicas) {
        await replica.marketStream.onApplicationShutdown();
        replica.fastPath.onApplicationShutdown();
      }
    }
  });
});

describe('reactive multi-replica advance token (CA-007 / TASK-036, entrega 2)', () => {
  const configId = 'config-1';
  const symbol = 'BTCUSDT';
  const windowEndMs = Date.now() + 60_000;
  const tick: MarketTick = { symbol, price: 30_100, timestamp: 1_700_000_000_000 };

  interface D2Replica {
    instanceId: string;
    service: MaterialEventService;
    job: { data: { configId: string }; promote: jest.Mock };
    queue: { getDelayed: jest.Mock; add: jest.Mock };
    gateway: { emitToAll: jest.Mock; emitToUser: jest.Mock };
  }

  function createSharedTokenCoordination(): ReactiveCoordinationPort {
    const consumedTokens = new Set<string>();
    return {
      isHealthy: () => true,
      tryAcquire: jest.fn(async () => true),
      renew: jest.fn(async () => true),
      release: jest.fn(async () => undefined),
      tryConsumeToken: jest.fn(async (key: string) => {
        if (consumedTokens.has(key)) return false;
        consumedTokens.add(key);
        return true;
      }),
      setJson: jest.fn(async () => undefined),
      getJson: jest.fn(async () => ({ windowEndMs })) as ReactiveCoordinationPort['getJson'],
    };
  }

  function buildD2Replica(instanceId: string, coordination: ReactiveCoordinationPort): D2Replica {
    const job = { data: { configId }, promote: jest.fn().mockResolvedValue(undefined) };
    const queue = {
      getDelayed: jest.fn().mockResolvedValue([job]),
      add: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = { emitToAll: jest.fn(), emitToUser: jest.fn() };
    const prisma = {
      tradingConfig: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: configId,
            userId: 'user-1',
            asset: 'BTC',
            pair: 'USDT',
            isRunning: true,
            reactiveLoopEnabled: true,
            gatePriceChangePct: 0.005,
          },
        ]),
      },
      agentDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const marketStream = {
      on: jest.fn(),
      off: jest.fn(),
      isWarmupComplete: jest.fn().mockReturnValue(true),
    };
    const streamHealth = {
      resolve: jest.fn().mockResolvedValue({ symbol, state: 'HEALTHY', reason: null, record: null }),
    };

    const service = new MaterialEventService(
      prisma as never,
      marketStream as never,
      streamHealth as never,
      coordination,
      queue as never,
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      gateway as never,
    );

    return { instanceId, service, job, queue, gateway };
  }

  beforeEach(() => {
    detectMaterialEventMock.mockReset();
    detectMaterialEventMock.mockReturnValue({
      event: 'PRICE_MOVED',
      detail: 'PRICE_MOVED detected',
      state: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('N instancias comparten el store de coordinación: el mismo evento material adelanta exactamente un ciclo en total', async () => {
    const sharedCoordination = createSharedTokenCoordination();
    const replicas = ['replica-a', 'replica-b', 'replica-c'].map((id) =>
      buildD2Replica(id, sharedCoordination),
    );

    await Promise.all(replicas.map((replica) => replica.service.handleTick(tick)));

    const totalPromotes = replicas.reduce((sum, r) => sum + r.job.promote.mock.calls.length, 0);
    const totalAdvancedEmits = replicas.reduce(
      (sum, r) =>
        sum +
        r.gateway.emitToUser.mock.calls.filter(([, event]) => event === 'agent:cycle-advanced').length,
      0,
    );

    expect(totalPromotes).toBe(1);
    expect(totalAdvancedEmits).toBe(1);
    for (const replica of replicas) {
      expect(replica.queue.add).not.toHaveBeenCalled();
    }
  });
});
