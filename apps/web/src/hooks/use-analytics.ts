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
  mode: 'LIVE' | 'PAPER' | 'SANDBOX';
  position?: { asset: string; pair: string };
}

export interface AgentDecision {
  id: string;
  asset: string;
  pair: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  waitMinutes?: number;
  createdAt: string;
}

export interface TradeInfo {
  pnl: number | null;
  asset: string;
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
