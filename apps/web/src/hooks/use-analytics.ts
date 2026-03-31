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
  mode: 'LIVE' | 'PAPER';
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
