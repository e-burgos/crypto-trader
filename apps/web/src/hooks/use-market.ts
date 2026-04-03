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

export const MARKET_SYMBOLS = [
  { symbol: 'BTCUSDT', label: 'BTC / USDT', asset: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH / USDT', asset: 'ETH' },
  { symbol: 'BTCUSDC', label: 'BTC / USDC', asset: 'BTC' },
  { symbol: 'ETHUSDC', label: 'ETH / USDC', asset: 'ETH' },
] as const;

export interface RSIResult {
  value: number;
  signal: 'OVERBOUGHT' | 'NEUTRAL' | 'OVERSOLD';
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: 'BULLISH' | 'BEARISH' | 'NONE';
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  position: 'ABOVE' | 'INSIDE' | 'BELOW';
}

export interface EMAResult {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface VolumeResult {
  current: number;
  average: number;
  ratio: number;
  signal: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
}

export interface MarketSnapshot {
  symbol: string;
  currentPrice: number;
  change24h: number;
  rsi: RSIResult;
  macd: MACDResult;
  bollingerBands: BollingerResult;
  emaCross: EMAResult;
  volume: VolumeResult;
  supportResistance: SupportResistance;
  timestamp: number;
}

export type OverallSignal = 'BUY' | 'SELL' | 'NEUTRAL';

export function deriveOverallSignal(snapshot: MarketSnapshot): {
  signal: OverallSignal;
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  if (snapshot.rsi.signal === 'OVERSOLD') {
    score += 2;
    reasons.push('RSI oversold');
  } else if (snapshot.rsi.signal === 'OVERBOUGHT') {
    score -= 2;
    reasons.push('RSI overbought');
  }

  if (snapshot.macd.crossover === 'BULLISH') {
    score += 2;
    reasons.push('MACD bullish crossover');
  } else if (snapshot.macd.crossover === 'BEARISH') {
    score -= 2;
    reasons.push('MACD bearish crossover');
  } else if (snapshot.macd.histogram > 0) {
    score += 1;
  } else if (snapshot.macd.histogram < 0) {
    score -= 1;
  }

  if (snapshot.emaCross.trend === 'BULLISH') {
    score += 2;
    reasons.push('EMA bullish trend');
  } else if (snapshot.emaCross.trend === 'BEARISH') {
    score -= 2;
    reasons.push('EMA bearish trend');
  }

  if (snapshot.bollingerBands.position === 'BELOW') {
    score += 1;
    reasons.push('Price below lower Bollinger band');
  } else if (snapshot.bollingerBands.position === 'ABOVE') {
    score -= 1;
    reasons.push('Price above upper Bollinger band');
  }

  if (snapshot.volume.signal === 'HIGH') {
    score += score > 0 ? 1 : -1;
    reasons.push('High volume confirms signal');
  }

  const signal: OverallSignal =
    score >= 3 ? 'BUY' : score <= -3 ? 'SELL' : 'NEUTRAL';

  return { signal, score, reasons };
}

export function useMarketSnapshot(symbol: string) {
  return useQuery<MarketSnapshot>({
    queryKey: ['market', 'snapshot', symbol],
    queryFn: () => api.get(`/market/snapshot/${symbol}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
