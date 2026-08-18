import type Redis from 'ioredis';
import { RedisSharedCache } from './redis-shared-cache.service';
import { STALE_RETENTION_MULTIPLIER } from './cache-record';

function createMockRedis() {
  const store = new Map<string, string>();
  let errorHandler: ((err: Error) => void) | undefined;

  return {
    store,
    on: jest.fn((event: string, handler: (err: Error) => void) => {
      if (event === 'error') errorHandler = handler;
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    emitError(err: Error) {
      errorHandler?.(err);
    },
  };
}

describe('RedisSharedCache', () => {
  it('collapses concurrent computes on the same key into a single invocation', async () => {
    const redis = createMockRedis();
    const cache = new RedisSharedCache(redis as unknown as Redis);
    let calls = 0;
    const compute = () =>
      new Promise<string>((resolve) => {
        calls++;
        setTimeout(() => resolve('value'), 10);
      });

    const results = await Promise.all([
      cache.getOrCompute('k', 1000, compute),
      cache.getOrCompute('k', 1000, compute),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual(['value', 'value']);
  });

  it('persists the record with a physical TTL six times the logical TTL', async () => {
    const redis = createMockRedis();
    const cache = new RedisSharedCache(redis as unknown as Redis);

    await cache.set('k', 'value', 1000);

    expect(redis.set).toHaveBeenCalledWith(
      'k',
      expect.any(String),
      'PX',
      1000 * STALE_RETENTION_MULTIPLIER,
    );
  });

  it('serves a fresh value straight from Redis without recomputing', async () => {
    const redis = createMockRedis();
    const cache = new RedisSharedCache(redis as unknown as Redis);
    await cache.set('k', 'stored-value', 1000);

    const compute = jest.fn().mockResolvedValue('should-not-run');
    const result = await cache.getOrCompute('k', 1000, compute);

    expect(result).toBe('stored-value');
    expect(compute).not.toHaveBeenCalled();
  });

  it('degrades to in-memory when Redis rejects and keeps serving from there', async () => {
    const redis = createMockRedis();
    redis.get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const cache = new RedisSharedCache(redis as unknown as Redis);

    const firstCompute = jest.fn().mockResolvedValue('fallback-value');
    const first = await cache.getOrCompute('k', 1000, firstCompute);
    expect(first).toBe('fallback-value');
    expect(firstCompute).toHaveBeenCalledTimes(1);

    const secondCompute = jest.fn().mockResolvedValue('should-not-run');
    const second = await cache.getOrCompute('k', 1000, secondCompute);
    expect(second).toBe('fallback-value');
    expect(secondCompute).not.toHaveBeenCalled();
  });

  it('degrades when the Redis client emits a connection error', async () => {
    const redis = createMockRedis();
    const cache = new RedisSharedCache(redis as unknown as Redis);

    redis.emitError(new Error('connection lost'));

    const compute = jest.fn().mockResolvedValue('value');
    const result = await cache.getOrCompute('k', 1000, compute);

    expect(result).toBe('value');
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('never tumbles the caller when Redis fails: no error escapes getOrCompute', async () => {
    const redis = createMockRedis();
    redis.get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const cache = new RedisSharedCache(redis as unknown as Redis);

    await expect(
      cache.getOrCompute('k', 1000, () => Promise.resolve('ok')),
    ).resolves.toBe('ok');
  });
});
