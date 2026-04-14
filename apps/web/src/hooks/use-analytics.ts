import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PortfolioSummary {
  openPositions: number;
  closedPositions: number;
  realizedPnl: number;
  totalFees: number;
  netPnl: number;
  activeConfigs: number;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  fee: number;
  executedAt: string;
  mode: 'LIVE' | 'PAPER' | 'SANDBOX' | 'TESTNET';
  position?: {
    asset: string;
    pair: string;
    entryPrice: number;
    exitPrice?: number | null;
    pnl?: number | null;
    fees: number;
    status: string;
    entryAt: string;
    exitAt?: string | null;
    config?: {
      stopLossPct: number;
      takeProfitPct: number;
      maxTradePct: number;
      buyThreshold: number;
      sellThreshold: number;
      minIntervalMinutes: number;
      orderPriceOffsetPct: number;
    };
  };
}

export interface AgentDecisionIndicators {
  rsi?: { value: number; signal: string };
  macd?: { macd: number; signal: number; histogram: number; crossover: string };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    position: string;
  };
  emaCross?: {
    ema9: number;
    ema21: number;
    ema200: number;
    trend: string;
  };
  volume?: { current: number; average: number; ratio: number; signal: string };
  supportResistance?: { support: number[]; resistance: number[] };
}

export interface AgentDecisionHeadline {
  headline: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  summary?: string | null;
  author?: string | null;
  source: string;
}

export interface AgentDecisionConfigDetails {
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: string;
  orderPriceOffsetPct: number;
  isRunning: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDecision {
  id: string;
  asset: string;
  pair: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  waitMinutes?: number;
  configId?: string;
  configName?: string;
  mode?: string;
  createdAt: string;
  indicators?: AgentDecisionIndicators;
  newsHeadlines?: AgentDecisionHeadline[];
  configDetails?: AgentDecisionConfigDetails | null;
  llmProvider?: string | null;
  llmModel?: string | null;
}

export interface TradeInfo {
  pnl: number | null;
  asset: string;
  pair: string;
  executedAt: string | null;
}

export interface AnalyticsSummary {
  winRate: number;
  totalPnl: number;
  totalTrades: number;
  avgPnl: number;
  bestTrade: TradeInfo | null;
  worstTrade: TradeInfo | null;
  sharpeRatio: number;
  currentDrawdown: number;
}

export interface PnlChartPoint {
  date: string;
  pnl: number;
}

export interface AssetBreakdown {
  asset: string;
  totalPnl: number;
  tradeCount: number;
}

export function usePortfolioSummary() {
  return useQuery<PortfolioSummary>({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => api.get('/analytics/portfolio'),
    refetchInterval: 30_000,
  });
}

export function useTradeHistory(limit = 50) {
  return useQuery<Trade[]>({
    queryKey: ['analytics', 'trades', limit],
    queryFn: () => api.get(`/analytics/trades?limit=${limit}`),
    refetchInterval: 60_000,
  });
}

export function useAgentDecisions(limit = 20) {
  return useQuery<AgentDecision[]>({
    queryKey: ['analytics', 'decisions', limit],
    queryFn: () => api.get(`/analytics/decisions?limit=${limit}`),
    refetchInterval: 60_000,
  });
}

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api.get('/analytics/summary'),
    refetchInterval: 60_000,
  });
}

export function usePnlChart() {
  return useQuery<PnlChartPoint[]>({
    queryKey: ['analytics', 'pnl-chart'],
    queryFn: () => api.get('/analytics/pnl-chart'),
    refetchInterval: 120_000,
  });
}

export function useAssetBreakdown() {
  return useQuery<AssetBreakdown[]>({
    queryKey: ['analytics', 'asset-breakdown'],
    queryFn: () => api.get('/analytics/asset-breakdown'),
    refetchInterval: 120_000,
  });
}
