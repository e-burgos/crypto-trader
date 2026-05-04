import { MessariProvider } from './messari.provider';
import type { TokenUnlockData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.messari.io',
  rateLimitPerMin: 20,
  pollingIntervalMs: 21_600_000,
};

describe('MessariProvider', () => {
  let provider: MessariProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new MessariProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('messari');
    expect(provider.category).toBe('TOKEN_UNLOCKS');
  });

  describe('fetchData', () => {
    it('returns empty array without API key (stub)', async () => {
      const result = await provider.fetchData(config);
      expect(result.type).toBe('token_unlocks');
      expect(result.data).toEqual([]);
    });

    it('fetches metrics for multiple assets with API key', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              supply: {
                stock_to_flow_ratio: 50,
                annual_inflation_usd: 1_000_000,
                annual_inflation_percent: 1.8,
              },
            },
          }),
      });

      const result = await provider.fetchData(config, 'test-key');

      expect(result.type).toBe('token_unlocks');
      const data = result.data as TokenUnlockData[];
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].type).toBe('linear');
      expect(data[0].unlockAmountUsd).toBe(1_000_000);

      // Fetches 5 symbols
      expect(globalThis.fetch).toHaveBeenCalledTimes(5);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/assets/bitcoin/metrics'),
        expect.any(Object),
      );
    });

    it('gracefully handles failing asset requests', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.fetchData(config, 'test-key');
      expect(result.type).toBe('token_unlocks');
      expect(result.data).toEqual([]);
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
    });

    it('returns available: false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
    });
  });
});
