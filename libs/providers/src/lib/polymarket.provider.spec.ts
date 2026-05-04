import { PolymarketProvider } from './polymarket.provider';
import type { PredictionData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://gamma-api.polymarket.com',
  rateLimitPerMin: 60,
  pollingIntervalMs: 3_600_000,
};

const mockMarketsResponse = [
  {
    condition_id: 'c1',
    question: 'Will BTC reach $100k by June?',
    outcomePrices: '["0.72", "0.28"]',
    volume: '5000000',
    active: true,
    closed: false,
    endDateIso: '2026-06-30',
  },
  {
    condition_id: 'c2',
    question: 'ETH above $5000 by Q3?',
    outcomePrices: '["0.35", "0.65"]',
    volume: '2000000',
    active: true,
    closed: false,
    endDateIso: '2026-09-30',
  },
  {
    condition_id: 'c3',
    question: 'Will SEC approve Solana ETF by end of 2026?',
    outcomePrices: '["0.60", "0.40"]',
    volume: '8000000',
    active: true,
    closed: false,
    endDateIso: '2026-07-31',
  },
  {
    condition_id: 'c4',
    question: 'Inactive market',
    outcomePrices: '["0.50", "0.50"]',
    volume: '100000',
    active: false,
    closed: true,
    endDateIso: '2026-01-01',
  },
  {
    condition_id: 'c5',
    question: 'Will France win the 2026 FIFA World Cup?',
    outcomePrices: '["0.16", "0.84"]',
    volume: '26000000',
    active: true,
    closed: false,
    endDateIso: '2026-07-19',
  },
];

describe('PolymarketProvider', () => {
  let provider: PolymarketProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new PolymarketProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('polymarket');
    expect(provider.category).toBe('PREDICTION');
  });

  describe('fetchData', () => {
    it('returns predictions from Gamma API markets', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMarketsResponse),
      });

      const result = await provider.fetchData(config);

      expect(result.type).toBe('predictions');
      const data = result.data as PredictionData[];
      // 3 active crypto-relevant markets (inactive + non-crypto filtered out)
      expect(data).toHaveLength(3);

      // Sorted by volume desc — SEC/Solana ETF first (8M)
      expect(data[0].volume).toBe(8_000_000);
      expect(data[0].probability).toBe(0.6);
      expect(data[0].source).toBe('polymarket');
      expect(data[0].question).toBe(
        'Will SEC approve Solana ETF by end of 2026?',
      );

      // BTC market second (5M)
      expect(data[1].volume).toBe(5_000_000);
      expect(data[1].probability).toBe(0.72);

      // Non-crypto market (FIFA) should NOT appear
      expect(data.every((d) => !d.question.includes('FIFA'))).toBe(true);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/markets?'),
        expect.any(Object),
      );
    });

    it('handles markets with no volume', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              condition_id: 'c1',
              question: 'Zero volume market',
              outcomePrices: '["0.50", "0.50"]',
              volume: '0',
              active: true,
              closed: false,
              endDateIso: '2026-12-31',
            },
          ]),
      });

      const result = await provider.fetchData(config);
      expect(result.data).toHaveLength(0);
    });

    it('filters out closed and inactive markets', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMarketsResponse),
      });

      const result = await provider.fetchData(config);
      const data = result.data as PredictionData[];
      // c4 is inactive+closed, should be filtered out
      expect(data.every((d) => d.question !== 'Inactive market')).toBe(true);
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      await expect(provider.fetchData(config)).rejects.toThrow('503');
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
    });

    it('returns available: false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });
});
