import { CoinGeckoProvider } from './coingecko.provider';
import type { GlobalMarketData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.coingecko.com/api/v3',
  rateLimitPerMin: 30,
  pollingIntervalMs: 1_800_000,
};

const mockGlobal = {
  data: {
    active_cryptocurrencies: 14000,
    total_market_cap: { usd: 2_500_000_000_000 },
    total_volume: { usd: 120_000_000_000 },
    market_cap_percentage: { btc: 52.3, eth: 16.1 },
  },
};

const mockTrending = {
  coins: [
    { item: { id: 'pepe', symbol: 'PEPE', name: 'Pepe' } },
    { item: { id: 'bonk', symbol: 'BONK', name: 'Bonk' } },
    { item: { id: 'wif', symbol: 'WIF', name: 'dogwifhat' } },
  ],
};

const mockMarkets = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 95000,
    market_cap: 1_800_000_000_000,
    price_change_percentage_24h: 3.5,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 3200,
    market_cap: 380_000_000_000,
    price_change_percentage_24h: 2.1,
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    current_price: 150,
    market_cap: 65_000_000_000,
    price_change_percentage_24h: -4.2,
  },
  {
    id: 'dogecoin',
    symbol: 'doge',
    name: 'Dogecoin',
    current_price: 0.15,
    market_cap: 20_000_000_000,
    price_change_percentage_24h: -7.8,
  },
];

describe('CoinGeckoProvider', () => {
  let provider: CoinGeckoProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new CoinGeckoProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('coingecko');
    expect(provider.category).toBe('MARKET_DATA');
  });

  describe('fetchData', () => {
    it('returns global_market payload from 3 endpoints', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/global')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGlobal),
          });
        }
        if (url.includes('/search/trending')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTrending),
          });
        }
        if (url.includes('/coins/markets')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMarkets),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await provider.fetchData(config, 'demo-key');

      expect(result.type).toBe('global_market');
      const data = result.data as GlobalMarketData;
      expect(data.totalMarketCap).toBe(2_500_000_000_000);
      expect(data.btcDominance).toBe(52.3);
      expect(data.ethDominance).toBe(16.1);
      expect(data.trendingCoins).toEqual(['PEPE', 'BONK', 'WIF']);
      expect(data.topGainers24h[0]).toBe('BTC');
      expect(data.topLosers24h[0]).toBe('DOGE');
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('passes API key in header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGlobal),
      });

      // Will fail on trending/markets parse but we just check the header
      try {
        await provider.fetchData(config, 'my-key');
      } catch {
        // expected
      }

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/global'),
        expect.objectContaining({
          headers: { 'x-cg-demo-api-key': 'my-key' },
        }),
      );
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
      await expect(provider.fetchData(config, 'demo-key')).rejects.toThrow(
        '429',
      );
    });

    it('works without API key (no auth header)', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/global')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGlobal),
          });
        }
        if (url.includes('/search/trending')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTrending),
          });
        }
        if (url.includes('/coins/markets')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMarkets),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await provider.fetchData(config);
      expect(result.type).toBe('global_market');

      // Should NOT send auth header
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/global'),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });
});
