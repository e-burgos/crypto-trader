import { AltFinsProvider } from './altfins.provider';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.altfins.com',
  rateLimitPerMin: 30,
  pollingIntervalMs: 1_800_000,
};

describe('AltFinsProvider', () => {
  let provider: AltFinsProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new AltFinsProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('altfins');
    expect(provider.category).toBe('TECHNICAL');
  });

  describe('fetchData', () => {
    it('returns null indicators without API key (fallback)', async () => {
      const result = await provider.fetchData(config);
      expect(result.type).toBe('indicators');
      expect(result.data).toBeNull();
    });

    it('returns signals with API key', async () => {
      const mockResponse = {
        content: [
          {
            timestamp: '2026-04-29T13:15:20Z',
            direction: 'BULLISH',
            signalKey: 'SIGNALS_SUMMARY_BEAR_POWER',
            signalName: 'Bear Power',
            symbol: 'BTC',
            lastPrice: '95000',
            marketCap: '1,800,000,000,000',
            priceChange: '2.5%',
            symbolName: 'Bitcoin',
          },
        ],
        totalElements: 1,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.fetchData(config, 'test-key');

      expect(result.type).toBe('indicators');
      expect(result.data).toEqual({
        signals: mockResponse.content,
        source: 'altfins',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.altfins.com/api/v2/public/signals-feed/search-requests?page=0&size=20',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-KEY': 'test-key',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
      await expect(provider.fetchData(config, 'bad-key')).rejects.toThrow(
        '403',
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
    });

    it('returns available: false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('DNS failed'));
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('DNS failed');
    });
  });
});
