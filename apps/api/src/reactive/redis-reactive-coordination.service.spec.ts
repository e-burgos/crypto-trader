import type Redis from 'ioredis';
import { RedisReactiveCoordination } from './redis-reactive-coordination.service';

interface StoredEntry {
  value: string;
  expiresAt: number;
}

function createMockRedis() {
  const store = new Map<string, StoredEntry>();
  let errorHandler: ((err: Error) => void) | undefined;
  let readyHandler: (() => void) | undefined;
  let failing = false;
  let failure = new Error('ECONNREFUSED');

  function readLive(key: string): StoredEntry | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    store,
    on: jest.fn((event: string, handler: (err: Error) => void) => {
      if (event === 'error') errorHandler = handler;
      if (event === 'ready') readyHandler = handler as unknown as () => void;
    }),
    set: jest.fn(async (key: string, value: string, ...rest: unknown[]) => {
      if (failing) throw failure;
      const nx = rest.includes('NX');
      const pxIndex = rest.indexOf('PX');
      const ttlMs =
        pxIndex >= 0 ? Number(rest[pxIndex + 1]) : Number.MAX_SAFE_INTEGER;
      if (nx && readLive(key)) return null;
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return 'OK';
    }),
    get: jest.fn(async (key: string) => {
      if (failing) throw failure;
      return readLive(key)?.value ?? null;
    }),
    eval: jest.fn(
      async (
        _script: string,
        _numkeys: number,
        key: string,
        holderId: string,
        ttlMs?: number,
      ) => {
        if (failing) throw failure;
        const entry = readLive(key);
        if (!entry || entry.value !== holderId) return 0;
        if (ttlMs !== undefined) {
          store.set(key, { value: entry.value, expiresAt: Date.now() + Number(ttlMs) });
        } else {
          store.delete(key);
        }
        return 1;
      },
    ),
    emitError(err: Error) {
      failing = true;
      errorHandler?.(err);
    },
    rejectCommands(err: Error) {
      failing = true;
      failure = err;
    },
    emitReady() {
      failing = false;
      failure = new Error('ECONNREFUSED');
      readyHandler?.();
    },
  };
}

describe('RedisReactiveCoordination', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('grants the lease to the first holder and denies a second one (NX semantics)', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    const first = await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);
    const second = await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-b', 30_000);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('renews only for the current holder and rejects every other one (CAS)', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);

    const ownHolder = await coordination.renew('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);
    const otherHolder = await coordination.renew('rx:v1:owner:BTCUSDT', 'replica-b', 30_000);

    expect(ownHolder).toBe(true);
    expect(otherHolder).toBe(false);
  });

  it('fails the renewal once the lease already expired, even for the former holder', async () => {
    jest.useFakeTimers();
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 1_000);

    jest.advanceTimersByTime(1_001);

    expect(await coordination.renew('rx:v1:owner:BTCUSDT', 'replica-a', 1_000)).toBe(false);
  });

  it('releases the lease only when the caller is the current holder (CAS)', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);

    await coordination.release('rx:v1:owner:BTCUSDT', 'replica-b');
    expect(await coordination.renew('rx:v1:owner:BTCUSDT', 'replica-a', 30_000)).toBe(true);

    await coordination.release('rx:v1:owner:BTCUSDT', 'replica-a');
    expect(await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-b', 30_000)).toBe(true);
  });

  it('consumes a window token exactly once within its TTL', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    const first = await coordination.tryConsumeToken('rx:v1:advance:cfg-1:1700', 5_000);
    const second = await coordination.tryConsumeToken('rx:v1:advance:cfg-1:1700', 5_000);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('round-trips a JSON value through its TTL and expires it afterwards', async () => {
    jest.useFakeTimers();
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    await coordination.setJson('rx:v1:health:BTCUSDT', { symbol: 'BTCUSDT' }, 1_000);
    expect(await coordination.getJson('rx:v1:health:BTCUSDT')).toEqual({ symbol: 'BTCUSDT' });

    jest.advanceTimersByTime(1_001);
    expect(await coordination.getJson('rx:v1:health:BTCUSDT')).toBeNull();
  });

  it('returns null reading a key that was never written', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    expect(await coordination.getJson('rx:v1:health:ETHUSDT')).toBeNull();
  });

  it('starts unhealthy until the client reports ready, so the first ownership cycle never runs against a dead client', () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    expect(coordination.isHealthy()).toBe(false);
    redis.emitReady();
    expect(coordination.isHealthy()).toBe(true);
  });

  it('turns unhealthy on the client error event and recovers on ready', () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    redis.emitReady();

    redis.emitError(new Error('connection lost'));
    expect(coordination.isHealthy()).toBe(false);
    redis.emitReady();
    expect(coordination.isHealthy()).toBe(true);
  });

  it('reports itself as an enabled rail, unlike the disabled driver', () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    expect(coordination.isEnabled()).toBe(true);
  });

  it('marks itself unhealthy and answers false when the command is rejected because the offline queue is disabled', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    redis.emitReady();
    redis.rejectCommands(
      new Error("Stream isn't writeable and enableOfflineQueue options is false"),
    );

    const acquired = await coordination.tryAcquire(
      'rx:v1:owner:BTCUSDT',
      'replica-a',
      30_000,
    );

    expect(acquired).toBe(false);
    expect(coordination.isHealthy()).toBe(false);
  });

  it('answers a rejected command without waiting for the client to reconnect', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);
    redis.emitReady();
    redis.rejectCommands(new Error('Command timed out'));

    const startedAt = Date.now();
    await Promise.all([
      coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000),
      coordination.renew('rx:v1:owner:BTCUSDT', 'replica-a', 30_000),
      coordination.tryConsumeToken('rx:v1:advance:cfg-1:1700', 5_000),
      coordination.getJson('rx:v1:health:BTCUSDT'),
      coordination.release('rx:v1:owner:BTCUSDT', 'replica-a'),
    ]);

    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it('fails closed on every operation while Redis is down: never fabricates a lease, a token or a read from memory', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    redis.emitError(new Error('ECONNREFUSED'));
    expect(coordination.isHealthy()).toBe(false);

    const acquiredWhileDown = await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);
    const renewedWhileDown = await coordination.renew('rx:v1:owner:BTCUSDT', 'replica-a', 30_000);
    const tokenWhileDown = await coordination.tryConsumeToken('rx:v1:advance:cfg-1:1700', 5_000);
    const readWhileDown = await coordination.getJson('rx:v1:health:BTCUSDT');
    await coordination.setJson('rx:v1:health:BTCUSDT', { symbol: 'BTCUSDT' }, 1_000);
    await coordination.release('rx:v1:owner:BTCUSDT', 'replica-a');

    expect(acquiredWhileDown).toBe(false);
    expect(renewedWhileDown).toBe(false);
    expect(tokenWhileDown).toBe(false);
    expect(readWhileDown).toBeNull();
    expect(redis.store.size).toBe(0);

    redis.emitReady();
    expect(coordination.isHealthy()).toBe(true);
    expect(await coordination.tryAcquire('rx:v1:owner:BTCUSDT', 'replica-a', 30_000)).toBe(true);
  });

  it('never resolves getJson to a stale in-process value once Redis recovers with the key gone', async () => {
    const redis = createMockRedis();
    const coordination = new RedisReactiveCoordination(redis as unknown as Redis);

    await coordination.setJson('rx:v1:health:BTCUSDT', { symbol: 'BTCUSDT' }, 1_000);
    redis.emitError(new Error('ECONNREFUSED'));
    expect(await coordination.getJson('rx:v1:health:BTCUSDT')).toBeNull();

    redis.emitReady();
    expect(await coordination.getJson('rx:v1:health:BTCUSDT')).toEqual({ symbol: 'BTCUSDT' });
  });
});
