import { CoinalyzeProvider } from './coinalyze.provider';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.coinalyze.net',
  rateLimitPerMin: 40,
  pollingIntervalMs: 900_000,
};

describe('CoinalyzeProvider', () => {
  let provider: CoinalyzeProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new CoinalyzeProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('coinalyze');
    expect(provider.category).toBe('DERIVATIVES');
  });

  describe('fetchData', () => {
    it('returns derivatives payload from 4 endpoints', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('open-interest')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  symbol: 'BTCUSD_PERP.A',
                  value: 18_000_000_000,
                  change24h: 2.5,
                },
              ]),
          });
        }
        if (url.includes('funding-rate')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ symbol: 'BTCUSD_PERP.A', value: 0.0042 }]),
          });
        }
        if (url.includes('liquidation-history')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  symbol: 'BTCUSD_PERP.A',
                  history: [{ t: 1700000000, l: 50_000_000, s: 30_000_000 }],
                },
              ]),
          });
        }
        if (url.includes('long-short-ratio-history')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  symbol: 'BTCUSD_PERP.A',
                  history: [{ t: 1700000000, r: 1.15, l: 53.5, s: 46.5 }],
                },
              ]),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await provider.fetchData(config, 'test-api-key');

      expect(result.type).toBe('derivatives');
      expect(result.data).toEqual({
        openInterest: 18_000_000_000,
        openInterestChange24h: 2.5,
        fundingRate: 0.0042,
        longShortRatio: 1.15,
        liquidations24h: 80_000_000,
        liquidationsBuy24h: 50_000_000,
        liquidationsSell24h: 30_000_000,
        cvd: 0,
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });

    it('handles missing values with defaults', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await provider.fetchData(config, 'test-api-key');

      expect(result.data).toEqual({
        openInterest: 0,
        openInterestChange24h: 0,
        fundingRate: 0,
        longShortRatio: 1,
        liquidations24h: 0,
        liquidationsBuy24h: 0,
        liquidationsSell24h: 0,
        cvd: 0,
      });
    });

    it('throws when an endpoint returns non-ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(provider.fetchData(config, 'test-api-key')).rejects.toThrow(
        '429',
      );
    });

    it('throws when no API key is provided', async () => {
      await expect(provider.fetchData(config)).rejects.toThrow(
        'requires an API key',
      );
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: true on 401 (server reachable)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns available: false on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });
});
