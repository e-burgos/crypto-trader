import { BoundedTtlCache } from './bounded-ttl-cache';

describe('BoundedTtlCache', () => {
  it('returns undefined for a key never set', () => {
    const cache = new BoundedTtlCache<string>(10, 60_000);
    expect(cache.get('missing', 0)).toBeUndefined();
  });

  it('returns the stored value while it has not expired', () => {
    const cache = new BoundedTtlCache<string>(10, 60_000);
    cache.set('key', 'value', 0);
    expect(cache.get('key', 59_999)).toBe('value');
  });

  it('evicts an entry once its ttl elapses, returning undefined and shrinking size', () => {
    const cache = new BoundedTtlCache<string>(10, 60_000);
    cache.set('key', 'value', 0);
    expect(cache.get('key', 60_000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('stops size from growing past maxSize once more than maxSize distinct keys are set', () => {
    const maxSize = 5;
    const cache = new BoundedTtlCache<number>(maxSize, 60_000);
    for (let i = 0; i < maxSize + 50; i++) {
      cache.set(`key-${i}`, i, 0);
    }
    expect(cache.size).toBe(maxSize);
  });

  it('evicts the oldest inserted key first once maxSize is exceeded', () => {
    const cache = new BoundedTtlCache<string>(2, 60_000);
    cache.set('first', 'a', 0);
    cache.set('second', 'b', 0);
    cache.set('third', 'c', 0);
    expect(cache.get('first', 0)).toBeUndefined();
    expect(cache.get('second', 0)).toBe('b');
    expect(cache.get('third', 0)).toBe('c');
  });

  it('removes an entry on delete so a later get reports it as absent', () => {
    const cache = new BoundedTtlCache<string>(10, 60_000);
    cache.set('key', 'value', 0);
    cache.delete('key');
    expect(cache.get('key', 0)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('deleting a key that was never set leaves size unchanged', () => {
    const cache = new BoundedTtlCache<string>(10, 60_000);
    cache.delete('missing');
    expect(cache.size).toBe(0);
  });
});
