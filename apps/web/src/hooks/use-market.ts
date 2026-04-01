import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OhlcvCandle {
  time: number;
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

export function useOhlcv(asset: string, interval: string, limit = 200) {
  return useQuery<OhlcvCandle[]>({
    queryKey: ['market', 'ohlcv', asset, interval, limit],
    queryFn: () =>
      api.get<OhlcvCandle[]>(`/market/ohlcv/${asset}/${interval}?limit=${limit}`),
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
