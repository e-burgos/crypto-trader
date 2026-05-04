import { DefiLlamaProvider } from './defillama.provider';
import type { DefiHealthData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.llama.fi',
  rateLimitPerMin: 60,
  pollingIntervalMs: 3_600_000,
};

const mockTvlHistory = [
  { date: 1714100000, tvl: 90_000_000_000 }, // 7 days ago
  { date: 1714186400, tvl: 91_000_000_000 },
  { date: 1714272800, tvl: 91_500_000_000 },
  { date: 1714359200, tvl: 92_000_000_000 },
  { date: 1714445600, tvl: 92_500_000_000 },
  { date: 1714532000, tvl: 93_000_000_000 },
  { date: 1714618400, tvl: 94_000_000_000 }, // yesterday
  { date: 1714704800, tvl: 95_000_000_000 }, // latest
];

const mockStablecoins = {
  peggedAssets: [
    {
      name: 'Tether',
      symbol: 'USDT',
      circulating: { peggedUSD: 100_000_000_000 },
    },
    {
      name: 'USDC',
      symbol: 'USDC',
      circulating: { peggedUSD: 30_000_000_000 },
    },
    { name: 'DAI', symbol: 'DAI', circulating: { peggedUSD: 5_000_000_000 } },
  ],
};

describe('DefiLlamaProvider', () => {
  let provider: DefiLlamaProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new DefiLlamaProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('defillama');
    expect(provider.category).toBe('DEFI_ONCHAIN');
  });

  describe('fetchData', () => {
    it('returns defi_health payload with TVL and stablecoin data', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('historicalChainTvl')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTvlHistory),
          });
        }
        if (url.includes('stablecoins')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStablecoins),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await provider.fetchData(config);

      expect(result.type).toBe('defi_health');
      const data = result.data as DefiHealthData;
      expect(data.totalTvl).toBe(95_000_000_000);
      // 24h change: (95B - 94B) / 94B * 100 ≈ 1.064%
      expect(data.tvlChange24h).toBeCloseTo(1.064, 1);
      // 7d change: (95B - 90B) / 90B * 100 ≈ 5.556%
      expect(data.tvlChange7d).toBeCloseTo(5.556, 1);
      // Stablecoin mcap: 100B + 30B + 5B
      expect(data.stablecoinMcap).toBe(135_000_000_000);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('handles empty TVL history', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('historicalChainTvl')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        // stablecoins endpoint
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ peggedAssets: [] }),
        });
      });

      const result = await provider.fetchData(config);
      const data = result.data as DefiHealthData;
      expect(data.totalTvl).toBe(0);
      expect(data.tvlChange24h).toBe(0);
      expect(data.stablecoinMcap).toBe(0);
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(provider.fetchData(config)).rejects.toThrow('500');
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
