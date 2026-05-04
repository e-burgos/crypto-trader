import { DataSourceCacheService } from './data-source-cache.service';
import type { DataSourcePayload } from '@crypto-trader/providers';

describe('DataSourceCacheService', () => {
  let cache: DataSourceCacheService;

  beforeEach(() => {
    cache = new DataSourceCacheService();
  });

  const mockPayload: DataSourcePayload = {
    type: 'fear_greed',
    data: {
      value: 50,
      classification: 'Neutral',
      timestamp: '1714300000',
      previousClose: 48,
    },
  };

  it('returns null for missing entries', () => {
    expect(cache.get('unknown')).toBeNull();
  });

  it('stores and retrieves entries', () => {
    cache.set('test', mockPayload, 60_000);
    expect(cache.get('test')).toEqual(mockPayload);
  });

  it('returns null for expired entries', () => {
    // Set with 0ms TTL → immediately expired
    cache.set('test', mockPayload, 0);
    expect(cache.get('test')).toBeNull();
  });

  it('has() returns true for valid entries', () => {
    cache.set('test', mockPayload, 60_000);
    expect(cache.has('test')).toBe(true);
  });

  it('has() returns false for expired entries', () => {
    cache.set('test', mockPayload, 0);
    expect(cache.has('test')).toBe(false);
  });

  it('invalidate() removes an entry', () => {
    cache.set('test', mockPayload, 60_000);
    cache.invalidate('test');
    expect(cache.get('test')).toBeNull();
  });

  it('clear() removes all entries', () => {
    cache.set('a', mockPayload, 60_000);
    cache.set('b', mockPayload, 60_000);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });

  it('stats() returns only non-expired entries', () => {
    cache.set('valid', mockPayload, 60_000);
    cache.set('expired', mockPayload, 0);
    const s = cache.stats();
    expect(s.entries).toBe(1);
    expect(s.sources).toEqual(['valid']);
  });
});
