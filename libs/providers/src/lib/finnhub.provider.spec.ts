import { FinnhubProvider } from './finnhub.provider';
import type { NewsWithSentiment } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://finnhub.io/api/v1',
  rateLimitPerMin: 60,
  pollingIntervalMs: 600_000,
};

const mockArticles = [
  {
    category: 'crypto',
    datetime: 1714704800,
    headline: 'Bitcoin Surges Past $100k',
    id: 1,
    image: 'https://example.com/img.png',
    related: 'BTC,ETH',
    source: 'CoinDesk',
    summary: 'Bitcoin reached a new milestone...',
    url: 'https://example.com/article1',
    sentiment: 0.8,
  },
  {
    category: 'crypto',
    datetime: 1714700000,
    headline: 'SEC Regulatory Concerns Weigh on Market',
    id: 2,
    image: '',
    related: 'BTC',
    source: 'Bloomberg',
    summary: 'The SEC...',
    url: 'https://example.com/article2',
    sentiment: -0.5,
  },
  {
    category: 'crypto',
    datetime: 1714696000,
    headline: 'Ethereum Staking Grows Steadily',
    id: 3,
    image: '',
    related: 'ETH',
    source: 'TheBlock',
    summary: 'Ethereum staking...',
    url: 'https://example.com/article3',
    // No sentiment field
  },
];

describe('FinnhubProvider', () => {
  let provider: FinnhubProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new FinnhubProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('finnhub');
    expect(provider.category).toBe('NEWS');
  });

  describe('fetchData', () => {
    it('returns news payload with sentiment normalization', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArticles),
      });

      const result = await provider.fetchData(config, 'test-api-key');

      expect(result.type).toBe('news');
      const news = result.data as NewsWithSentiment[];
      expect(news).toHaveLength(3);

      // First article: positive sentiment
      expect(news[0].headline).toBe('Bitcoin Surges Past $100k');
      expect(news[0].sentiment).toBe(0.8);
      expect(news[0].sentimentLabel).toBe('positive');
      expect(news[0].relatedSymbols).toEqual(['BTC', 'ETH']);

      // Second article: negative sentiment
      expect(news[1].sentiment).toBe(-0.5);
      expect(news[1].sentimentLabel).toBe('negative');

      // Third article: no sentiment → defaults to 0 / neutral
      expect(news[2].sentiment).toBe(0);
      expect(news[2].sentimentLabel).toBe('neutral');

      // API key is passed in the header
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://finnhub.io/api/v1/news?category=crypto',
        expect.objectContaining({
          headers: { 'X-Finnhub-Token': 'test-api-key' },
        }),
      );
    });

    it('throws when no API key provided', async () => {
      await expect(provider.fetchData(config)).rejects.toThrow(
        'Finnhub requires an API key',
      );
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(provider.fetchData(config, 'bad-key')).rejects.toThrow(
        '401',
      );
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: true on 401 (server reachable, key needed)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: false on 500', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('returns available: false on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });
});
