import { MessariProvider } from './messari.provider';
import type { TokenUnlockData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.messari.io',
  rateLimitPerMin: 20,
  pollingIntervalMs: 21_600_000,
};

const mockFreeResponse = {
  data: [
    {
      id: 'cyber',
      symbol: 'CYBER',
      name: 'CyberConnect',
      genesisDate: '2023-01-01T00:00:00Z',
      projectedEndDate: '2028-08-01T00:00:00Z',
      slug: 'cyberconnect',
      category: 'defi',
      sector: 'social',
      tags: null,
    },
    {
      id: 'pyth',
      symbol: 'PYTH',
      name: 'Pyth Network',
      genesisDate: '2023-06-01T00:00:00Z',
      projectedEndDate: '2028-05-20T00:00:00Z',
      slug: 'pyth-network',
      category: 'defi',
      sector: 'oracle',
      tags: null,
    },
  ],
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
    it('returns token unlocks from free endpoint (no API key)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFreeResponse),
      });

      const result = await provider.fetchData(config);
      expect(result.type).toBe('token_unlocks');
      const data = result.data as TokenUnlockData[];
      expect(data.length).toBe(2);
      expect(data[0].symbol).toBe('CYBER');
      expect(data[0].unlockDate).toBe('2028-08-01T00:00:00Z');
      expect(data[0].type).toBe('linear');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.messari.io/token-unlocks/v1/assets?hasUpcomingEvent=true&limit=30',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('uses detailed events when API key is provided', async () => {
      const detailedEventsResponse = {
        data: [
          {
            date: '2026-06-01T00:00:00Z',
            type: 'cliff',
            tokenAmount: 1000000,
            usdValue: 5000000,
            percentOfCirculating: 2.5,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/assets?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockFreeResponse),
          });
        }
        // Detailed events endpoint
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(detailedEventsResponse),
        });
      });

      const result = await provider.fetchData(config, 'test-key');
      expect(result.type).toBe('token_unlocks');
      const data = result.data as TokenUnlockData[];
      expect(data.length).toBeGreaterThan(0);
    });

    it('throws on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      await expect(provider.fetchData(config)).rejects.toThrow('Network error');
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(provider.fetchData(config)).rejects.toThrow('500');
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: false on non-ok (new API does not use 401)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
    });

    it('returns available: false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
    });
  });
});
