import { DataSourceRegistryService } from './data-source-registry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DataSourceCacheService } from './data-source-cache.service';
import { RateLimiterService } from './rate-limiter.service';

const SOURCE = 'coinalyze';
const TRADER_A = 'trader-a';
const TRADER_B = 'trader-b';

const CONFIG = {
  id: 'ds-1',
  name: SOURCE,
  isActive: true,
  baseUrl: 'https://example.test',
  rateLimitPerMin: 60,
  pollingIntervalMs: 60_000,
};

function payloadFor(owner: string) {
  return { type: 'derivatives', data: { owner } } as any;
}

describe('Data source tenant isolation — cache, rate limit and circuit per credential owner', () => {
  let registry: DataSourceRegistryService;
  let circuitBreaker: CircuitBreakerService;
  let cache: DataSourceCacheService;
  let rateLimiter: RateLimiterService;
  let fetchData: jest.Mock;
  let findUnique: jest.Mock;

  const withQuotaOf = (rateLimitPerMin: number) =>
    findUnique.mockResolvedValue({ ...CONFIG, rateLimitPerMin });

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerService();
    cache = new DataSourceCacheService();
    rateLimiter = new RateLimiterService();
    fetchData = jest.fn();

    findUnique = jest.fn().mockResolvedValue(CONFIG);
    const prisma = {
      dataSourceConfig: {
        findUnique,
        update: jest.fn().mockResolvedValue(CONFIG),
      },
    } as any;

    registry = new DataSourceRegistryService(
      prisma,
      circuitBreaker,
      cache,
      undefined,
      rateLimiter,
      undefined,
    );
    registry.registerProvider({ name: SOURCE, fetchData } as any);
  });

  it('CA-020: does not serve a cached payload across credential owners', async () => {
    fetchData.mockResolvedValueOnce(payloadFor(TRADER_A));
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    fetchData.mockRejectedValueOnce(new Error('provider down'));
    const result = await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

    expect(result).toBeNull();
  });

  it('CA-020: serves the cached payload back to the same owner on failure', async () => {
    fetchData.mockResolvedValueOnce(payloadFor(TRADER_A));
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    fetchData.mockRejectedValueOnce(new Error('provider down'));
    const result = await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    expect(result).toEqual(payloadFor(TRADER_A));
  });

  it('CA-019: exhausting one owner rate limit does not block another owner', async () => {
    withQuotaOf(2);
    fetchData.mockResolvedValue(payloadFor(TRADER_A));
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    fetchData.mockClear();
    fetchData.mockResolvedValue(payloadFor(TRADER_B));
    await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('CA-019: a rate limited owner stops reaching the provider', async () => {
    withQuotaOf(2);
    fetchData.mockResolvedValue(payloadFor(TRADER_A));
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    fetchData.mockClear();
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    expect(fetchData).not.toHaveBeenCalled();
  });

  it('CA-021: two traders resolving the same shared credential share the bucket', async () => {
    const ADMIN = 'admin-1';
    withQuotaOf(2);
    fetchData.mockResolvedValue(payloadFor(ADMIN));
    await registry.fetchFromProvider(SOURCE, 'shared-key', ADMIN);
    await registry.fetchFromProvider(SOURCE, 'shared-key', ADMIN);

    fetchData.mockClear();
    await registry.fetchFromProvider(SOURCE, 'shared-key', ADMIN);

    expect(fetchData).not.toHaveBeenCalled();
  });

  it('CA-022: opening the circuit for one owner leaves the other owner able to execute', async () => {
    fetchData.mockRejectedValue(new Error('unauthorized'));
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
    await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

    fetchData.mockClear();
    fetchData.mockResolvedValue(payloadFor(TRADER_B));
    const result = await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payloadFor(TRADER_B));
  });

  it('CA-018: a payload cached under the admin owner is unreachable once the trader stops resolving to it', async () => {
    const ADMIN = 'admin-1';
    fetchData.mockResolvedValueOnce(payloadFor(ADMIN));
    await registry.fetchFromProvider(SOURCE, 'shared-key', ADMIN);

    fetchData.mockRejectedValueOnce(new Error('no credential'));
    const result = await registry.fetchFromProvider(
      SOURCE,
      undefined,
      TRADER_A,
    );

    expect(result).toBeNull();
  });

  describe('diagnostics stay aggregated by source name', () => {
    it('reports one circuit entry per source, at its worst state across owners', async () => {
      fetchData.mockResolvedValue(payloadFor(TRADER_B));
      await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

      fetchData.mockRejectedValue(new Error('unauthorized'));
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);

      const states = registry.getCircuitStates();

      expect(Object.keys(states)).toEqual([SOURCE]);
      expect(states[SOURCE].state).toBe('OPEN');
    });

    it('reports one cache entry name per source across owners', async () => {
      fetchData.mockResolvedValue(payloadFor(TRADER_A));
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
      await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

      const stats = registry.getCacheStats();

      expect(stats.sources).toEqual([SOURCE]);
      expect(stats.entries).toBe(2);
    });

    it('reports the most constrained owner as the remaining quota of the source', async () => {
      withQuotaOf(2);
      fetchData.mockResolvedValue(payloadFor(TRADER_A));
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
      await registry.fetchFromProvider(SOURCE, 'key-a', TRADER_A);
      await registry.fetchFromProvider(SOURCE, 'key-b', TRADER_B);

      const stats = registry.getRateLimiterStats();

      expect(Object.keys(stats)).toEqual([SOURCE]);
      expect(stats[SOURCE]).toEqual({ remaining: 0, limit: 2 });
    });
  });
});
