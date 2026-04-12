import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  summary?: string;
  author?: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  publishedAt: string;
}

export interface NewsConfig {
  id: string;
  userId: string;
  intervalMinutes: number;
  newsCount: number;
  enabledSources: string[];
  onlySummary: boolean;
  botEnabled: boolean;
  newsWeight: number;
  updatedAt: string;
}

export interface NewsHeadline {
  id: string;
  source: string;
  headline: string;
  sentiment: string;
  summary?: string | null;
  author?: string | null;
  publishedAt: string;
}

export interface AiHeadline {
  id: string;
  sentiment: string;
  reasoning: string;
}

export interface NewsAnalysis {
  id: string;
  userId: string;
  analyzedAt: string;
  newsCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  score: number;
  overallSentiment: string;
  summary: string;
  headlines: NewsHeadline[];
  aiAnalyzedAt?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiPositiveCount?: number | null;
  aiNegativeCount?: number | null;
  aiNeutralCount?: number | null;
  aiScore?: number | null;
  aiOverallSentiment?: string | null;
  aiSummary?: string | null;
  aiHeadlines?: AiHeadline[] | null;
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

export function useNewsAnalysis() {
  return useQuery<NewsAnalysis | null>({
    queryKey: ['market', 'news-analysis'],
    queryFn: () => api.get<NewsAnalysis | null>('/market/news/analysis'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useNewsConfig() {
  return useQuery<NewsConfig>({
    queryKey: ['market', 'news-config'],
    queryFn: () => api.get<NewsConfig>('/market/news/config'),
    staleTime: 30_000,
  });
}

export function useUpdateNewsConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NewsConfig>) =>
      api.put<NewsConfig>('/market/news/config', data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['market', 'news-config'], updated);
    },
  });
}

export function useRunKeywordAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<NewsAnalysis>('/market/news/analysis/run', {}),
    onSuccess: (analysis) => {
      queryClient.setQueryData(['market', 'news-analysis'], analysis);
    },
  });
}

export function useRunAiAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; model?: string }) =>
      api.post<NewsAnalysis>('/market/news/analysis/ai', data),
    onSuccess: (analysis) => {
      queryClient.setQueryData(['market', 'news-analysis'], analysis);
    },
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

export type OverallSignal = 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';

export function deriveOverallSignal(snapshot: MarketSnapshot): {
  signal: OverallSignal;
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // ── RSI (-2 to +2, with mid-zone ±1) ─────────────────
  if (snapshot.rsi.signal === 'OVERSOLD') {
    score += 2;
    reasons.push('RSI oversold');
  } else if (snapshot.rsi.signal === 'OVERBOUGHT') {
    score -= 2;
    reasons.push('RSI overbought');
  } else if (snapshot.rsi.value < 45) {
    score += 1;
    reasons.push('RSI approaching oversold');
  } else if (snapshot.rsi.value > 60) {
    score -= 1;
    reasons.push('RSI approaching overbought');
  }

  // ── MACD (-2 to +2, histogram always contributes) ────
  if (snapshot.macd.crossover === 'BULLISH') {
    score += 2;
    reasons.push('MACD bullish crossover');
  } else if (snapshot.macd.crossover === 'BEARISH') {
    score -= 2;
    reasons.push('MACD bearish crossover');
  } else if (snapshot.macd.histogram > 0) {
    score += 1;
    reasons.push('MACD momentum positive');
  } else if (snapshot.macd.histogram < 0) {
    score -= 1;
    reasons.push('MACD momentum negative');
  }

  // ── EMA (-2 to +2, with partial e9/e21 direction) ────
  if (snapshot.emaCross.trend === 'BULLISH') {
    score += 2;
    reasons.push('EMA bullish trend');
  } else if (snapshot.emaCross.trend === 'BEARISH') {
    score -= 2;
    reasons.push('EMA bearish trend');
  } else {
    // EMA neutral: check short-term direction e9 vs e21
    if (snapshot.emaCross.ema9 > snapshot.emaCross.ema21) {
      score += 1;
      reasons.push('Short-term EMA bullish');
    } else if (snapshot.emaCross.ema9 < snapshot.emaCross.ema21) {
      score -= 1;
      reasons.push('Short-term EMA bearish');
    }
  }

  // ── Bollinger Bands (-1 to +1) ────────────────────────
  if (snapshot.bollingerBands.position === 'BELOW') {
    score += 1;
    reasons.push('Price below lower Bollinger band');
  } else if (snapshot.bollingerBands.position === 'ABOVE') {
    score -= 1;
    reasons.push('Price above upper Bollinger band');
  }

  // ── Volume amplifier ──────────────────────────────────
  if (snapshot.volume.signal === 'HIGH') {
    if (score > 0) {
      score += 1;
      reasons.push('High volume confirms bullish signal');
    } else if (score < 0) {
      score -= 1;
      reasons.push('High volume confirms bearish signal');
    }
  }

  // ── Final signal ──────────────────────────────────────
  // Max possible: ~8 | Min: ~-8
  // BUY/SELL: strong confluence (≥4), HOLD: moderate (2–3), NEUTRAL: weak or conflicting
  let signal: OverallSignal;
  if (score >= 4) signal = 'BUY';
  else if (score <= -4) signal = 'SELL';
  else if (score >= 2) signal = 'HOLD';
  else if (score <= -2) signal = 'HOLD';
  else signal = 'NEUTRAL';

  return { signal, score, reasons };
}

export interface OpportunityAnalysis {
  action: 'BUY' | 'SELL' | 'WAIT';
  confidence: number; // 0–100 (based on passing checks)
  /** score bias when action=WAIT: positive = bullish lean, negative = bearish lean */
  scoreBias: number;
  summary: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  checks: {
    label: string;
    value: string;
    ok: boolean;
    weight: 'strong' | 'medium' | 'weak';
  }[];
  warnings: string[];
}

export function deriveOpportunity(
  snapshot: MarketSnapshot,
  livePrice: number,
): OpportunityAnalysis {
  const price = livePrice || snapshot.currentPrice;
  const { signal, score } = deriveOverallSignal(snapshot);
  const checks: OpportunityAnalysis['checks'] = [];
  const warnings: string[] = [];

  // ── RSI check ────────────────────────────────────────
  // BUY-ok: RSI not approaching overbought (< 60 is safe territory)
  // SELL-ok: RSI not approaching oversold (> 40 is safe territory)
  const rsiBuyOk = snapshot.rsi.value < 60;
  const rsiSellOk = snapshot.rsi.value > 40;
  checks.push({
    label: 'RSI',
    value: `${snapshot.rsi.value.toFixed(1)} — ${snapshot.rsi.signal}`,
    ok: signal === 'SELL' ? rsiSellOk : rsiBuyOk,
    weight: 'strong',
  });
  if (snapshot.rsi.value > 70)
    warnings.push('RSI > 70: overbought market, risk of correction');
  if (snapshot.rsi.value < 30)
    warnings.push('RSI < 30: possible bounce, confirm with volume');

  // ── MACD check ───────────────────────────────────────
  const macdBull =
    snapshot.macd.crossover === 'BULLISH' || snapshot.macd.histogram > 0;
  const macdBear =
    snapshot.macd.crossover === 'BEARISH' || snapshot.macd.histogram < 0;
  checks.push({
    label: 'MACD',
    value:
      snapshot.macd.crossover !== 'NONE'
        ? snapshot.macd.crossover
        : `Hist ${snapshot.macd.histogram > 0 ? '+' : ''}${snapshot.macd.histogram.toFixed(2)}`,
    ok: signal === 'SELL' ? macdBear : macdBull,
    weight: snapshot.macd.crossover !== 'NONE' ? 'strong' : 'medium',
  });

  // ── EMA check ────────────────────────────────────────
  const emaOk =
    snapshot.emaCross.trend === 'BULLISH' ||
    snapshot.emaCross.ema9 > snapshot.emaCross.ema21;
  const emaBearOk =
    snapshot.emaCross.trend === 'BEARISH' ||
    snapshot.emaCross.ema9 < snapshot.emaCross.ema21;
  checks.push({
    label: 'EMA',
    value: `${snapshot.emaCross.trend} (9>${snapshot.emaCross.ema9 > snapshot.emaCross.ema21 ? '21 ✓' : '21 ✗'})`,
    ok: signal === 'SELL' ? emaBearOk : emaOk,
    weight: 'strong',
  });
  if (price < snapshot.emaCross.ema200)
    warnings.push('Price below EMA 200: bearish macro trend');

  // ── Bollinger check ──────────────────────────────────
  const bbOk = snapshot.bollingerBands.position === 'BELOW';
  const bbSellOk = snapshot.bollingerBands.position === 'ABOVE';
  checks.push({
    label: 'Bollinger',
    value: `${snapshot.bollingerBands.position} (BW: ${snapshot.bollingerBands.bandwidth.toFixed(0)})`,
    ok:
      signal === 'SELL'
        ? bbSellOk
        : bbOk || snapshot.bollingerBands.position === 'INSIDE',
    weight: 'medium',
  });
  if (snapshot.bollingerBands.bandwidth < 500 && price > 1000)
    warnings.push('Bollinger Bands compressed: strong move imminent');

  // ── Volume check ─────────────────────────────────────
  const volOk = snapshot.volume.signal === 'HIGH';
  checks.push({
    label: 'Volume',
    value: `${snapshot.volume.signal} (×${snapshot.volume.ratio.toFixed(2)} avg)`,
    ok: volOk,
    weight: 'medium',
  });
  if (snapshot.volume.signal === 'LOW')
    warnings.push('Low volume: signal unreliable, wait for confirmation');

  // ── Confidence ───────────────────────────────────────
  // Based on how many checks pass — avoids score-cancellation giving 0%
  // Strong checks count double, medium/weak count once
  const passedWeight = checks.reduce(
    (sum, c) => sum + (c.ok ? (c.weight === 'strong' ? 2 : 1) : 0),
    0,
  );
  const totalWeight = checks.reduce(
    (sum, c) => sum + (c.weight === 'strong' ? 2 : 1),
    0,
  );
  const confidence = Math.min(
    100,
    Math.round((passedWeight / totalWeight) * 100),
  );

  // ── Action ───────────────────────────────────────────
  const action: OpportunityAnalysis['action'] =
    signal === 'BUY' ? 'BUY' : signal === 'SELL' ? 'SELL' : 'WAIT';

  // ── Price levels ─────────────────────────────────────
  // Use Bollinger + support/resistance to suggest levels
  const isBuy = action === 'BUY';
  const slPct = 0.03; // 3% stop loss
  const tpPct = isBuy ? 0.06 : 0.06; // 6% take profit (2:1 R/R)

  const supports = snapshot.supportResistance.support;
  const resistances = snapshot.supportResistance.resistance;

  // Stop loss: nearest support below (or -3%)
  const nearestSupport = supports.filter((s) => s < price).at(-1);
  const stopLoss = nearestSupport
    ? Math.max(nearestSupport * 0.995, price * (1 - slPct))
    : price * (isBuy ? 1 - slPct : 1 + slPct);

  // Take profit: nearest resistance above (or +6%)
  const nearestResistance = resistances.find((r) => r > price);
  const takeProfit = nearestResistance
    ? Math.min(nearestResistance * 1.005, price * (1 + tpPct))
    : price * (isBuy ? 1 + tpPct : 1 - tpPct);

  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(takeProfit - price);
  const riskReward = risk > 0 ? Math.round((reward / risk) * 10) / 10 : 0;

  const summary =
    action === 'BUY'
      ? `Oportunidad de compra con ${confidence}% de confirmación. Los indicadores muestran confluencia alcista.`
      : action === 'SELL'
        ? `Señal de venta con ${confidence}% de confirmación. Los indicadores muestran presión bajista.`
        : score > 0
          ? `Sesgo alcista leve (${confidence}% de indicadores a favor). Esperar confirmación antes de entrar.`
          : score < 0
            ? `Sesgo bajista leve (${confidence}% de indicadores negativos). Esperar confirmación antes de operar.`
            : `Señales neutrales (${confidence}% de confirmación). El mercado está en equilibrio.`;

  return {
    action,
    confidence,
    scoreBias: score,
    summary,
    entryPrice: price,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    riskReward,
    checks,
    warnings,
  };
}

export function useMarketSnapshot(symbol: string) {
  return useQuery<MarketSnapshot>({
    queryKey: ['market', 'snapshot', symbol],
    queryFn: () => api.get(`/market/snapshot/${symbol}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
