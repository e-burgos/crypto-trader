import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import {
  COORDINATION_UNAVAILABLE_AT_BOOTSTRAP,
  MarketStreamService,
  ownerLeaseKey,
  type MarketStreamRestClient,
  type MarketStreamWsClient,
} from './market-stream.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveRuntimeThresholds } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { SymbolFilters, TickerUpdate, KlineUpdate } from '@crypto-trader/data-fetcher';

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
  setHealthy(value: boolean): void;
  ownerOf(key: string): string | undefined;
}

function createSharedFakeCoordination(): FakeCoordination {
  const store = new Map<string, string>();
  let healthy = true;
  return {
    setHealthy(value: boolean) {
      healthy = value;
    },
    ownerOf(key: string) {
      return store.get(key);
    },
    isHealthy: () => healthy,
    tryAcquire: jest.fn(async (key: string, holderId: string) => {
      if (!healthy) return false;
      if (store.has(key)) return false;
      store.set(key, holderId);
      return true;
    }),
    renew: jest.fn(async (key: string, holderId: string) => {
      if (!healthy) return false;
      return store.get(key) === holderId;
    }),
    release: jest.fn(async (key: string, holderId: string) => {
      if (store.get(key) === holderId) store.delete(key);
    }),
    tryConsumeToken: jest.fn(async () => false),
    setJson: jest.fn(async () => undefined),
    getJson: jest.fn(async () => null),
  };
}

function createFakePrisma(configs: Array<{ asset: string; pair: string }>) {
  return {
    tradingConfig: {
      findMany: jest.fn().mockResolvedValue(configs),
    },
  };
}

function buildService(
  prisma: ReturnType<typeof createFakePrisma>,
  coordination: ReactiveCoordinationPort,
  wsClient: MarketStreamWsClient,
  restClient: MarketStreamRestClient,
  instanceId: string,
  thresholds: ReactiveRuntimeThresholds = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
) {
  return new MarketStreamService(
    prisma as never,
    coordination,
    wsClient,
    restClient,
    thresholds,
    instanceId,
  );
}

describe('MarketStreamService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ownership acquisition (TASK-016)', () => {
    it('acquires the lease for every active symbol and subscribes its streams', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();

      expect(service.isOwner('BTCUSDT')).toBe(true);
      expect(coordination.tryAcquire).toHaveBeenCalledWith(
        ownerLeaseKey('BTCUSDT'),
        'instance-a',
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.ownerLeaseTtlMs,
      );
      expect(wsClient.streams).toEqual(
        expect.arrayContaining(['btcusdt@miniTicker', 'btcusdt@kline_1h']),
      );
      expect(wsClient.connect).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('resolves lotStep/minNotional once via getSymbolFilters when ownership is acquired', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'ETH', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      await Promise.resolve();
      await Promise.resolve();

      expect(restClient.getSymbolFilters).toHaveBeenCalledWith('ETHUSDT');
      expect(service.getSymbolFilters('ETHUSDT')).toBeDefined();

      await service.onApplicationShutdown();
    });

    it('releases the lease, unsubscribes and disconnects when a symbol stops being active', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      expect(service.isOwner('BTCUSDT')).toBe(true);

      prisma.tradingConfig.findMany.mockResolvedValue([]);
      await service.refreshActiveSymbols();

      expect(service.isOwner('BTCUSDT')).toBe(false);
      expect(coordination.release).toHaveBeenCalledWith(
        ownerLeaseKey('BTCUSDT'),
        'instance-a',
      );
      expect(wsClient.streams).toEqual([]);
      expect(wsClient.disconnect).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('drops ownership immediately when the CAS renewal fails, without calling release', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      expect(service.isOwner('BTCUSDT')).toBe(true);

      (coordination.renew as jest.Mock).mockResolvedValueOnce(false);
      await service.runOwnershipCycle();

      expect(service.isOwner('BTCUSDT')).toBe(false);
      expect(coordination.release).not.toHaveBeenCalled();
      expect(wsClient.disconnect).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('performs an ordered shutdown: releases every lease, disconnects the WS client and stops the timers', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([
        { asset: 'BTC', pair: 'USDT' },
        { asset: 'ETH', pair: 'USDT' },
      ]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      expect(service.getOwnedSymbols().sort()).toEqual(['BTCUSDT', 'ETHUSDT']);

      await service.onApplicationShutdown();

      expect(service.getOwnedSymbols()).toEqual([]);
      expect(coordination.release).toHaveBeenCalledWith(
        ownerLeaseKey('BTCUSDT'),
        'instance-a',
      );
      expect(coordination.release).toHaveBeenCalledWith(
        ownerLeaseKey('ETHUSDT'),
        'instance-a',
      );
      expect(wsClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('gives exactly one of two replicas ownership of the same symbol', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClientA = new FakeWsClient();
      const wsClientB = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);

      const serviceA = buildService(prisma, coordination, wsClientA, restClient, 'instance-a');
      const serviceB = buildService(prisma, coordination, wsClientB, restClient, 'instance-b');

      await serviceA.onModuleInit();
      await serviceB.onModuleInit();

      expect(serviceA.isOwner('BTCUSDT')).not.toBe(serviceB.isOwner('BTCUSDT'));
      expect(wsClientA.connect).toHaveBeenCalledTimes(serviceA.isOwner('BTCUSDT') ? 1 : 0);
      expect(wsClientB.connect).toHaveBeenCalledTimes(serviceB.isOwner('BTCUSDT') ? 1 : 0);

      const owner = serviceA.isOwner('BTCUSDT') ? serviceA : serviceB;
      const standby = serviceA.isOwner('BTCUSDT') ? serviceB : serviceA;
      const standbyWs = standby === serviceA ? wsClientA : wsClientB;

      await owner.onApplicationShutdown();
      await standby.runOwnershipCycle();

      expect(standby.isOwner('BTCUSDT')).toBe(true);
      expect(standbyWs.connect).toHaveBeenCalledTimes(1);

      await standby.onApplicationShutdown();
    });
  });

  describe('fail-closed (precondiciones de CA-007 / TASK-035)', () => {
    it('never calls tryAcquire nor connects the WS client when the coordination port is unhealthy', async () => {
      const coordination = createSharedFakeCoordination();
      coordination.setHealthy(false);
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connect).not.toHaveBeenCalled();
      expect(service.getOwnedSymbols()).toEqual([]);

      await service.onApplicationShutdown();
    });

    it('releases every owned lease and disconnects as soon as the coordination port turns unhealthy', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      expect(service.isOwner('BTCUSDT')).toBe(true);

      coordination.setHealthy(false);
      await service.runOwnershipCycle();

      expect(service.isOwner('BTCUSDT')).toBe(false);
      expect(wsClient.disconnect).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('never calls tryAcquire when no TradingConfig has reactiveLoopEnabled=true (isRunning alone is not enough)', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();

      expect(prisma.tradingConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isRunning: true, reactiveLoopEnabled: true },
        }),
      );
      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connect).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });
  });

  describe('WS subscription, warmup and tick fan-out (TASK-015)', () => {
    it('discards fan-out until streamWarmupTicks ticks arrived, then reports warmup complete', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');
      await service.onModuleInit();

      expect(service.isWarmupComplete('BTCUSDT')).toBe(false);

      const ticks: unknown[] = [];
      service.on('tick', (tick) => ticks.push(tick));

      const update: TickerUpdate = {
        symbol: 'BTCUSDT',
        price: 65_000,
        volume: 1000,
        change24h: 1.2,
        timestamp: 1_000,
      };
      wsClient.emit('ticker', update);
      expect(service.isWarmupComplete('BTCUSDT')).toBe(false);
      expect(ticks).toHaveLength(1);
      expect(ticks[0]).toEqual({ symbol: 'BTCUSDT', price: 65_000, timestamp: 1_000 });

      wsClient.emit('ticker', { ...update, timestamp: 2_000 });
      expect(service.isWarmupComplete('BTCUSDT')).toBe(true);
      expect(ticks).toHaveLength(2);

      await service.onApplicationShutdown();
    });

    it('ignores ticker/kline events for symbols this instance no longer owns', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');
      await service.onModuleInit();

      const ticks: unknown[] = [];
      service.on('tick', (tick) => ticks.push(tick));

      wsClient.emit('ticker', {
        symbol: 'ETHUSDT',
        price: 3_000,
        volume: 10,
        change24h: 0.1,
        timestamp: 1,
      } as TickerUpdate);

      expect(ticks).toHaveLength(0);

      await service.onApplicationShutdown();
    });

    it('maps kline updates for owned symbols into candle fan-out events', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');
      await service.onModuleInit();

      const candles: unknown[] = [];
      service.on('candle', (candle) => candles.push(candle));

      const kline: KlineUpdate = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: 1_000,
        open: 64_000,
        high: 65_500,
        low: 63_900,
        close: 65_000,
        volume: 120,
        closeTime: 4_600_000,
        isClosed: false,
      };
      wsClient.emit('kline', kline);

      expect(candles).toEqual([
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: 1_000,
          closeTime: 4_600_000,
          close: 65_000,
          volume: 120,
          isClosed: false,
        },
      ]);

      await service.onApplicationShutdown();
    });

    it('tracks lastTickAtMs and lastHeartbeatAtMs for the health snapshot of an owned symbol', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');
      await service.onModuleInit();

      expect(service.getHealthSnapshot('BTCUSDT')).toMatchObject({
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        lastTickAtMs: null,
        lastHeartbeatAtMs: null,
      });

      wsClient.emit('ticker', {
        symbol: 'BTCUSDT',
        price: 65_000,
        volume: 1,
        change24h: 0,
        timestamp: 42,
      } as TickerUpdate);
      wsClient.emit('heartbeat', { at: 99 });

      const snapshot = service.getHealthSnapshot('BTCUSDT');
      expect(snapshot?.lastTickAtMs).toBe(42);
      expect(snapshot?.lastHeartbeatAtMs).toBe(99);
      expect(service.getHealthSnapshot('ETHUSDT')).toBeNull();

      await service.onApplicationShutdown();
    });

    it('keeps a single shared WS connection across multiple owned symbols and only disconnects once none remain', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([
        { asset: 'BTC', pair: 'USDT' },
        { asset: 'ETH', pair: 'USDT' },
      ]);
      const service = buildService(prisma, coordination, wsClient, restClient, 'instance-a');

      await service.onModuleInit();
      expect(wsClient.connect).toHaveBeenCalledTimes(1);

      prisma.tradingConfig.findMany.mockResolvedValue([{ asset: 'BTC', pair: 'USDT' }]);
      await service.refreshActiveSymbols();
      expect(wsClient.disconnect).not.toHaveBeenCalled();
      expect(service.isOwner('BTCUSDT')).toBe(true);
      expect(service.isOwner('ETHUSDT')).toBe(false);

      prisma.tradingConfig.findMany.mockResolvedValue([]);
      await service.refreshActiveSymbols();
      expect(wsClient.disconnect).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });
  });
  describe('bootstrap with the coordination rail unreachable', () => {
    const bootstrapThresholds: ReactiveRuntimeThresholds = {
      ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      coordinationBootstrapTimeoutMs: 30,
    };

    function createStalledCoordination(): ReactiveCoordinationPort {
      return {
        isHealthy: () => true,
        isEnabled: () => true,
        tryAcquire: jest.fn(() => new Promise<boolean>(() => undefined)),
        renew: jest.fn(() => new Promise<boolean>(() => undefined)),
        release: jest.fn(async () => undefined),
        tryConsumeToken: jest.fn(async () => false),
        setJson: jest.fn(async () => undefined),
        getJson: jest.fn(async () => null),
      };
    }

    it('finishes onModuleInit within the bootstrap timeout when the coordination command never resolves', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const coordination = createStalledCoordination();
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(
        prisma,
        coordination,
        wsClient,
        restClient,
        'instance-a',
        bootstrapThresholds,
      );

      const startedAt = Date.now();
      await service.onModuleInit();
      const elapsed = Date.now() - startedAt;

      expect(elapsed).toBeLessThan(1_000);
      expect(service.isOwner('BTCUSDT')).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(COORDINATION_UNAVAILABLE_AT_BOOTSTRAP),
      );

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });

    it('reports the unreachable rail once and keeps sweeping, instead of failing the bootstrap', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const coordination = createSharedFakeCoordination();
      coordination.setHealthy(false);
      const wsClient = new FakeWsClient();
      const restClient = createFakeRestClient();
      const prisma = createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]);
      const service = buildService(
        prisma,
        coordination,
        wsClient,
        restClient,
        'instance-a',
        bootstrapThresholds,
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(COORDINATION_UNAVAILABLE_AT_BOOTSTRAP);

      coordination.setHealthy(true);
      await service.runOwnershipCycle();
      expect(service.isOwner('BTCUSDT')).toBe(true);

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });

    it('stays silent when the rail is disabled by configuration, which is not an outage', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const coordination: ReactiveCoordinationPort = {
        ...createSharedFakeCoordination(),
        isHealthy: () => false,
        isEnabled: () => false,
      };
      const service = buildService(
        createFakePrisma([{ asset: 'BTC', pair: 'USDT' }]),
        coordination,
        new FakeWsClient(),
        createFakeRestClient(),
        'instance-a',
        bootstrapThresholds,
      );

      await service.onModuleInit();

      expect(errorSpy).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });
  });
});
