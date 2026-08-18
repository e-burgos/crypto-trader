import { InMemorySharedCache } from './in-memory-shared-cache.service';
import { STALE_RETENTION_MULTIPLIER } from './cache-record';

describe('InMemorySharedCache', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  afterEach(() => {
    nowSpy?.mockRestore();
  });

  it('collapses concurrent computes on the same key into a single invocation', async () => {
    const cache = new InMemorySharedCache();
    let calls = 0;
    const compute = () =>
      new Promise<string>((resolve) => {
        calls++;
        setTimeout(() => resolve('value'), 10);
      });

    const results = await Promise.all([
      cache.getOrCompute('k', 1000, compute),
      cache.getOrCompute('k', 1000, compute),
      cache.getOrCompute('k', 1000, compute),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual(['value', 'value', 'value']);
  });

  it('serves the cached value while fresh and recomputes once the TTL expires', async () => {
    const cache = new InMemorySharedCache();
    nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    let calls = 0;
    const compute = () => {
      calls++;
      return Promise.resolve(`v${calls}`);
    };

    expect(await cache.getOrCompute('k', 100, compute)).toBe('v1');

    nowSpy.mockReturnValue(1050);
    expect(await cache.getOrCompute('k', 100, compute)).toBe('v1');
    expect(calls).toBe(1);

    nowSpy.mockReturnValue(1200);
    expect(await cache.getOrCompute('k', 100, compute)).toBe('v2');
    expect(calls).toBe(2);
  });

  it('serves the stale value when compute fails after the TTL expires', async () => {
    const cache = new InMemorySharedCache();
    nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    await cache.set('k', 'fresh-value', 100);

    nowSpy.mockReturnValue(500);
    const failing = () => Promise.reject(new Error('compute failed'));

    await expect(cache.getOrCompute('k', 100, failing)).resolves.toBe(
      'fresh-value',
    );
  });

  it('propagates the error when compute fails with no stored value to fall back to', async () => {
    const cache = new InMemorySharedCache();
    const failing = () => Promise.reject(new Error('boom'));

    await expect(cache.getOrCompute('missing', 100, failing)).rejects.toThrow(
      'boom',
    );
  });

  it('drops entries once they age past the stale retention window', async () => {
    const cache = new InMemorySharedCache();
    nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    await cache.set('k', 'fresh-value', 100);

    nowSpy.mockReturnValue(100 * STALE_RETENTION_MULTIPLIER + 1);
    const compute = jest.fn().mockResolvedValue('recomputed');

    await expect(cache.getOrCompute('k', 100, compute)).resolves.toBe(
      'recomputed',
    );
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('isolates values across distinct keys', async () => {
    const cache = new InMemorySharedCache();
    await cache.set('a', 'A', 1000);
    await cache.set('b', 'B', 1000);

    expect(await cache.get('a')).toBe('A');
    expect(await cache.get('b')).toBe('B');
    expect(await cache.get('c')).toBeNull();
  });

  it('invalidate removes both the stored value and any in-flight computation', async () => {
    const cache = new InMemorySharedCache();
    await cache.set('k', 'value', 1000);
    await cache.invalidate('k');

    expect(await cache.get('k')).toBeNull();
  });
});
