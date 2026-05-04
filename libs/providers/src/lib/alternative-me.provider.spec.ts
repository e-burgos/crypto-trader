import { AlternativeMeProvider } from './alternative-me.provider';
import type { FearGreedData } from '@crypto-trader/shared';
import type { ProviderConfig } from './data-source.interface';

const config: ProviderConfig = {
  baseUrl: 'https://api.alternative.me',
  rateLimitPerMin: 100,
  pollingIntervalMs: 1_800_000,
};

const mockFngResponse = {
  data: [
    { value: '47', value_classification: 'Neutral', timestamp: '1714300000' },
    { value: '42', value_classification: 'Fear', timestamp: '1714213600' },
  ],
};

describe('AlternativeMeProvider', () => {
  let provider: AlternativeMeProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new AlternativeMeProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has correct metadata', () => {
    expect(provider.name).toBe('alternative_me');
    expect(provider.category).toBe('SENTIMENT');
  });

  describe('fetchData', () => {
    it('returns fear_greed payload with current and previous values', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFngResponse),
      });

      const result = await provider.fetchData(config);

      expect(result.type).toBe('fear_greed');
      expect(result.data).toEqual({
        value: 47,
        classification: 'Neutral',
        timestamp: '1714300000',
        previousClose: 42,
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.alternative.me/fng/?limit=2',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('falls back to current value when previous is missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                value: '55',
                value_classification: 'Greed',
                timestamp: '1714300000',
              },
            ],
          }),
      });

      const result = await provider.fetchData(config);
      expect((result.data as FearGreedData).previousClose).toBe(55);
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(provider.fetchData(config)).rejects.toThrow(
        'Alternative.me returned 503',
      );
    });

    it('throws on empty data array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await expect(provider.fetchData(config)).rejects.toThrow(
        'Alternative.me returned empty data array',
      );
    });
  });

  describe('healthCheck', () => {
    it('returns available: true on 200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('returns available: false on network error', async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network failure'));

      const result = await provider.healthCheck(config);
      expect(result.available).toBe(false);
      expect(result.error).toBe('Network failure');
    });
  });
});
