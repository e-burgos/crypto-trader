import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OhlcvCandle {
  time?: number;
  openTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  source: string;
  headline: string;
  url: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  publishedAt: string;
}

/** Fetch OHLCV directly from Binance public REST API (no auth, no CORS issues) */
async function fetchBinanceFallback(
  asset: string,
  interval: string,
  limit: number,
): Promise<OhlcvCandle[]> {
  const symbol = `${asset}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Binance API error');
  // Each element: [openTime, open, high, low, close, volume, ...]
  const raw: (string | number)[][] = await res.json();
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

export function useOhlcv(asset: string, interval: string, limit = 200) {
  return useQuery<OhlcvCandle[]>({
    queryKey: ['market', 'ohlcv', asset, interval, limit],
    queryFn: async () => {
      try {
        return await api.get<OhlcvCandle[]>(
          `/market/ohlcv/${asset}/${interval}?limit=${limit}`,
        );
      } catch {
        // Backend unavailable — fall back to Binance public API
        return fetchBinanceFallback(asset, interval, limit);
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarketNews(limit = 30) {
  return useQuery<NewsItem[]>({
    queryKey: ['market', 'news', limit],
    queryFn: () => api.get<NewsItem[]>(`/market/news?limit=${limit}`),
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}
