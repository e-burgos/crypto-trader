import { StreamHealthService, streamHealthKey } from './stream-health.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { StreamHealthRecord } from '@crypto-trader/shared';
import type { MarketStreamService, SymbolHealthSnapshot } from './market-stream.service';
import type { AppGateway } from '../gateway/app.gateway';

function createFakeCoordination(): ReactiveCoordinationPort & {
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>();
  const fake = {
    store,
    tryAcquire: jest.fn(async () => true),
    renew: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
    tryConsumeToken: jest.fn(async () => true),
    setJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    getJson: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    isHealthy: jest.fn(() => true),
  };
  return fake as unknown as ReactiveCoordinationPort & { store: Map<string, unknown> };
}

function createFakePrisma(configs: Array<{ asset: string; pair: string }>) {
  return {
    tradingConfig: {
      findMany: jest.fn().mockResolvedValue(configs),
    },
  };
}

function createFakeGateway(): AppGateway {
  return { emitToAll: jest.fn() } as unknown as AppGateway;
}

function createFakeMarketStream(
  snapshots: Record<string, SymbolHealthSnapshot | undefined>,
): MarketStreamService {
  return {
    getOwnedSymbols: jest.fn(() => Object.keys(snapshots)),
    getHealthSnapshot: jest.fn((symbol: string) => snapshots[symbol] ?? null),
  } as unknown as MarketStreamService;
}

describe('StreamHealthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolve (read side, cross-replica via coordination)', () => {
    it('reports UNKNOWN/NO_RECORD when no record exists', async () => {
      const coordination = createFakeCoordination();
      const prisma = createFakePrisma([]);
      const service = new StreamHealthService(
        coordination,
        prisma as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      const status = await service.resolve('BTCUSDT');

      expect(status).toEqual({
        symbol: 'BTCUSDT',
        state: 'UNKNOWN',
        reason: 'NO_RECORD',
        record: null,
      });
      expect(coordination.getJson).toHaveBeenCalledWith(streamHealthKey('BTCUSDT'));
    });

    it('reports HEALTHY for a fresh record within both thresholds', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const record: StreamHealthRecord = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: now - 60_000,
        lastTickAtMs: now,
        lastHeartbeatAtMs: now,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), record);
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      const status = await service.resolve('BTCUSDT');

      expect(status.state).toBe('HEALTHY');
      expect(status.reason).toBeNull();
      expect(status.record).toEqual(record);
    });

    it('reports DEGRADED/TICK_STALE when the tick is older than tickMaxAgeMs', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const record: StreamHealthRecord = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: now - 60_000,
        lastTickAtMs: now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1,
        lastHeartbeatAtMs: now,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), record);
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      const status = await service.resolve('BTCUSDT');

      expect(status.state).toBe('DEGRADED');
      expect(status.reason).toBe('TICK_STALE');
    });

    it('reports DEGRADED/HEARTBEAT_STALE when the heartbeat is older than heartbeatMaxAgeMs', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const record: StreamHealthRecord = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: now - 60_000,
        lastTickAtMs: now,
        lastHeartbeatAtMs: now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamHeartbeatMaxAgeMs - 1,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), record);
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      const status = await service.resolve('BTCUSDT');

      expect(status.state).toBe('DEGRADED');
      expect(status.reason).toBe('HEARTBEAT_STALE');
    });
  });

  describe('getHealthForUser (EP-015)', () => {
    it('returns one entry per distinct running symbol, never omitting an unknown one', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const healthyRecord: StreamHealthRecord = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: now - 60_000,
        lastTickAtMs: now,
        lastHeartbeatAtMs: now,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), healthyRecord);
      const prisma = createFakePrisma([
        { asset: 'BTC', pair: 'USDT' },
        { asset: 'BTC', pair: 'USDT' },
        { asset: 'ETH', pair: 'USDC' },
      ]);
      const service = new StreamHealthService(
        coordination,
        prisma as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      const result = await service.getHealthForUser('user-1');

      expect(prisma.tradingConfig.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRunning: true },
        select: { asset: true, pair: true },
      });
      expect(result.symbols).toHaveLength(2);
      expect(result.symbols).toEqual(
        expect.arrayContaining([
          {
            symbol: 'BTCUSDT',
            state: 'HEALTHY',
            reason: null,
            lastTickAt: new Date(healthyRecord.lastTickAtMs).toISOString(),
            ownerId: 'instance-a',
            updatedAt: new Date(healthyRecord.publishedAt).toISOString(),
          },
          {
            symbol: 'ETHUSDC',
            state: 'UNKNOWN',
            reason: 'NO_RECORD',
            lastTickAt: null,
            ownerId: null,
            updatedAt: null,
          },
        ]),
      );
    });
  });

  describe('publishOwnedSymbols (publish side, shared across replicas)', () => {
    it('writes a StreamHealthRecord to coordination with the health TTL for every owned symbol', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const marketStream = createFakeMarketStream({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: now - 30_000,
          lastTickAtMs: now,
          lastHeartbeatAtMs: now,
        },
      });
      const gateway = createFakeGateway();
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        gateway,
        marketStream,
      );

      await service.publishOwnedSymbols();

      expect(coordination.setJson).toHaveBeenCalledWith(
        streamHealthKey('BTCUSDT'),
        expect.objectContaining({
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          lastTickAtMs: now,
          lastHeartbeatAtMs: now,
        }),
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamHealthTtlMs,
      );
    });

    it('does nothing when no MarketStreamService was wired (read-only instance)', async () => {
      const coordination = createFakeCoordination();
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      await expect(service.publishOwnedSymbols()).resolves.toBeUndefined();
      expect(coordination.setJson).not.toHaveBeenCalled();
    });

    it('emits market:stream-health on transition healthy -> degraded, but not on the first publish', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const staleTick = now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1;
      const marketStream = createFakeMarketStream({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: now - 60_000,
          lastTickAtMs: now,
          lastHeartbeatAtMs: now,
        },
      });
      const gateway = createFakeGateway();
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        gateway,
        marketStream,
      );

      await service.publishOwnedSymbols();
      expect(gateway.emitToAll).not.toHaveBeenCalled();

      (marketStream.getHealthSnapshot as jest.Mock).mockReturnValue({
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: now - 60_000,
        lastTickAtMs: staleTick,
        lastHeartbeatAtMs: now,
      });

      await service.publishOwnedSymbols();

      expect(gateway.emitToAll).toHaveBeenCalledTimes(1);
      expect(gateway.emitToAll).toHaveBeenCalledWith(
        'market:stream-health',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          state: 'DEGRADED',
          reason: 'TICK_STALE',
          ownerId: 'instance-a',
        }),
      );
    });

    it('does not emit again while the state stays the same across publishes', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const marketStream = createFakeMarketStream({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: now - 60_000,
          lastTickAtMs: now,
          lastHeartbeatAtMs: now,
        },
      });
      const gateway = createFakeGateway();
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        gateway,
        marketStream,
      );

      await service.publishOwnedSymbols();
      await service.publishOwnedSymbols();

      expect(gateway.emitToAll).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('publishes immediately and on an interval when a MarketStreamService is wired', () => {
      jest.useFakeTimers();
      const coordination = createFakeCoordination();
      const marketStream = createFakeMarketStream({});
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        marketStream,
      );
      const publishSpy = jest.spyOn(service, 'publishOwnedSymbols');

      service.onModuleInit();
      expect(publishSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.healthPublishIntervalMs);
      expect(publishSpy).toHaveBeenCalledTimes(2);

      service.onApplicationShutdown();
      jest.advanceTimersByTime(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.healthPublishIntervalMs * 2);
      expect(publishSpy).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('does nothing on init when no MarketStreamService was wired', () => {
      const coordination = createFakeCoordination();
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
      );

      expect(() => service.onModuleInit()).not.toThrow();
      expect(() => service.onApplicationShutdown()).not.toThrow();
    });
  });
});
