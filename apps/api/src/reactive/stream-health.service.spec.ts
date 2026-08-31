import { StreamHealthService, streamHealthKey } from './stream-health.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { NotificationType } from '@crypto-trader/shared';
import type { StreamHealthRecord } from '@crypto-trader/shared';
import type {
  MarketStreamService,
  SymbolHealthSnapshot,
} from './market-stream.service';
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
    getJson: jest.fn(async (key: string) =>
      store.has(key) ? store.get(key) : null,
    ),
    isHealthy: jest.fn(() => true),
  };
  return fake as unknown as ReactiveCoordinationPort & {
    store: Map<string, unknown>;
  };
}

function createFakePrisma(
  configs: Array<{ asset: string; pair: string; userId?: string }>,
) {
  return {
    tradingConfig: {
      findMany: jest.fn().mockResolvedValue(configs),
    },
  };
}

function createFakeGateway(): AppGateway {
  return { emitToAll: jest.fn() } as unknown as AppGateway;
}

function createFakeNotifications(): {
  create: jest.Mock;
} {
  return { create: jest.fn().mockResolvedValue(undefined) };
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
        createFakeGateway(),
        createFakeMarketStream({}),
        createFakeNotifications() as never,
      );

      const status = await service.resolve('BTCUSDT');

      expect(status).toEqual({
        symbol: 'BTCUSDT',
        state: 'UNKNOWN',
        reason: 'NO_RECORD',
        record: null,
      });
      expect(coordination.getJson).toHaveBeenCalledWith(
        streamHealthKey('BTCUSDT'),
      );
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
        createFakeGateway(),
        createFakeMarketStream({}),
        createFakeNotifications() as never,
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
        lastTickAtMs:
          now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1,
        lastHeartbeatAtMs: now,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), record);
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        createFakeMarketStream({}),
        createFakeNotifications() as never,
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
        lastHeartbeatAtMs:
          now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamHeartbeatMaxAgeMs - 1,
        publishedAt: now,
      };
      coordination.store.set(streamHealthKey('BTCUSDT'), record);
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        createFakeMarketStream({}),
        createFakeNotifications() as never,
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
        createFakeGateway(),
        createFakeMarketStream({}),
        createFakeNotifications() as never,
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
        createFakeNotifications() as never,
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

    it('emits market:stream-health on transition healthy -> degraded, but not on the first publish', async () => {
      const coordination = createFakeCoordination();
      const now = Date.now();
      const staleTick =
        now - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1;
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
        createFakeNotifications() as never,
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
        createFakeNotifications() as never,
      );

      await service.publishOwnedSymbols();
      await service.publishOwnedSymbols();

      expect(gateway.emitToAll).not.toHaveBeenCalled();
    });
  });

  describe('sustained degradation notification (architect §5.3 point 3)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('notifies once per sustained degradation, never per publish tick, and notifies again after a recovery', async () => {
      jest.useFakeTimers();
      const start = new Date('2026-01-01T00:00:00.000Z').getTime();
      jest.setSystemTime(start);

      const coordination = createFakeCoordination();
      const staleSince =
        start - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1;
      const snapshots: Record<string, SymbolHealthSnapshot | undefined> = {
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: start - 120_000,
          lastTickAtMs: staleSince,
          lastHeartbeatAtMs: start,
        },
      };
      const marketStream = createFakeMarketStream(snapshots);
      const prisma = createFakePrisma([
        { asset: 'BTC', pair: 'USDT', userId: 'user-1' },
      ]);
      const notifications = createFakeNotifications();
      const service = new StreamHealthService(
        coordination,
        prisma as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        marketStream,
        notifications as never,
      );

      await service.publishOwnedSymbols();
      expect(notifications.create).not.toHaveBeenCalled();

      jest.setSystemTime(
        start +
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs -
          1_000,
      );
      await service.publishOwnedSymbols();
      expect(notifications.create).not.toHaveBeenCalled();

      jest.setSystemTime(
        start + DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs + 1,
      );
      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenNthCalledWith(
        1,
        'user-1',
        NotificationType.AGENT_ERROR,
        JSON.stringify({ key: 'streamDegraded', symbol: 'BTCUSDT' }),
      );

      jest.setSystemTime(
        start +
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs +
          30_000,
      );
      await service.publishOwnedSymbols();
      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);

      const recoveredAt =
        start +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs +
        40_000;
      jest.setSystemTime(recoveredAt);
      snapshots.BTCUSDT = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: start - 120_000,
        lastTickAtMs: recoveredAt,
        lastHeartbeatAtMs: recoveredAt,
      };
      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);

      const redegradedAt = recoveredAt + 1_000;
      jest.setSystemTime(redegradedAt);
      snapshots.BTCUSDT = {
        symbol: 'BTCUSDT',
        ownerId: 'instance-a',
        connectedAt: start - 120_000,
        lastTickAtMs:
          redegradedAt -
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs -
          1,
        lastHeartbeatAtMs: redegradedAt,
      };
      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);

      jest.setSystemTime(
        redegradedAt +
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs +
          1,
      );
      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenNthCalledWith(
        2,
        'user-1',
        NotificationType.AGENT_ERROR,
        JSON.stringify({ key: 'streamDegraded', symbol: 'BTCUSDT' }),
      );
    });

    it('retries the notification on the next pass when the write rejects', async () => {
      jest.useFakeTimers();
      const start = new Date('2026-01-01T00:00:00.000Z').getTime();
      jest.setSystemTime(start);

      const coordination = createFakeCoordination();
      const staleSince =
        start - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1;
      const marketStream = createFakeMarketStream({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: start - 120_000,
          lastTickAtMs: staleSince,
          lastHeartbeatAtMs: start,
        },
      });
      const prisma = createFakePrisma([
        { asset: 'BTC', pair: 'USDT', userId: 'user-1' },
      ]);
      prisma.tradingConfig.findMany.mockRejectedValueOnce(
        new Error('database unavailable'),
      );
      const notifications = createFakeNotifications();
      const service = new StreamHealthService(
        coordination,
        prisma as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        marketStream,
        notifications as never,
      );

      await service.publishOwnedSymbols();
      expect(notifications.create).not.toHaveBeenCalled();

      jest.setSystemTime(
        start + DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs + 1,
      );
      await expect(service.publishOwnedSymbols()).rejects.toThrow(
        'database unavailable',
      );
      expect(notifications.create).not.toHaveBeenCalled();

      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.AGENT_ERROR,
        JSON.stringify({ key: 'streamDegraded', symbol: 'BTCUSDT' }),
      );

      await service.publishOwnedSymbols();
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('notifies once when two passes overlap while the write is still in flight', async () => {
      jest.useFakeTimers();
      const start = new Date('2026-01-01T00:00:00.000Z').getTime();
      jest.setSystemTime(start);

      const coordination = createFakeCoordination();
      const staleSince =
        start - DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.streamTickMaxAgeMs - 1;
      const marketStream = createFakeMarketStream({
        BTCUSDT: {
          symbol: 'BTCUSDT',
          ownerId: 'instance-a',
          connectedAt: start - 120_000,
          lastTickAtMs: staleSince,
          lastHeartbeatAtMs: start,
        },
      });
      const prisma = createFakePrisma([]);
      prisma.tradingConfig.findMany.mockImplementation(async () => {
        await Promise.resolve();
        await Promise.resolve();
        return [{ asset: 'BTC', pair: 'USDT', userId: 'user-1' }];
      });
      const notifications = createFakeNotifications();
      const service = new StreamHealthService(
        coordination,
        prisma as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        marketStream,
        notifications as never,
      );

      await service.publishOwnedSymbols();
      jest.setSystemTime(
        start + DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.degradedNotifyAfterMs + 1,
      );

      await Promise.all([
        service.publishOwnedSymbols(),
        service.publishOwnedSymbols(),
      ]);

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle', () => {
    it('publishes immediately, then on an interval, and stops on shutdown', () => {
      jest.useFakeTimers();
      const coordination = createFakeCoordination();
      const marketStream = createFakeMarketStream({});
      const service = new StreamHealthService(
        coordination,
        createFakePrisma([]) as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        createFakeGateway(),
        marketStream,
        createFakeNotifications() as never,
      );
      const publishSpy = jest.spyOn(service, 'publishOwnedSymbols');

      service.onModuleInit();
      expect(publishSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.healthPublishIntervalMs,
      );
      expect(publishSpy).toHaveBeenCalledTimes(2);

      service.onApplicationShutdown();
      jest.advanceTimersByTime(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.healthPublishIntervalMs * 2,
      );
      expect(publishSpy).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });
});
