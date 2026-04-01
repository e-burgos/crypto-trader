import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export type TradingMode = 'SANDBOX' | 'LIVE';
export type TradingAsset = 'BTC' | 'ETH';
export type TradingPair = 'USDT' | 'USDC';

export interface TradingConfig {
  id: string;
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface TradingConfigDto {
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
}

export interface AgentStatus {
  asset: string;
  pair: string;
  isRunning: boolean;
  mode: TradingMode;
}

export interface TradingPosition {
  id: string;
  asset: string;
  pair: string;
  mode: TradingMode;
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  openedAt: string;
}

export interface TradingHistoryItem {
  id: string;
  type: 'BUY' | 'SELL';
  asset: string;
  pair: string;
  price: number;
  quantity: number;
  fee: number;
  mode: TradingMode;
  executedAt: string;
}

export interface TradingDecision {
  id: string;
  asset: string;
  pair: string;
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string;
  waitMinutes?: number;
  createdAt: string;
}

export function useTradingConfigs() {
  return useQuery<TradingConfig[]>({
    queryKey: ['trading', 'config'],
    queryFn: () => api.get('/trading/config'),
    staleTime: 30_000,
  });
}

export function useUpsertConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TradingConfigDto) => api.put<TradingConfig>('/trading/config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', 'config'] });
      toast.success('Configuration saved');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to save configuration'),
  });
}

export function useStartAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { asset: string; pair: string }) =>
      api.post('/trading/start', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading'] });
      toast.success('Agent started');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to start agent'),
  });
}

export function useStopAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { asset: string; pair: string }) =>
      api.post('/trading/stop', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading'] });
      toast.success('Agent stopped');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to stop agent'),
  });
}

export function useAgentStatus() {
  return useQuery<AgentStatus[]>({
    queryKey: ['trading', 'status'],
    queryFn: () => api.get('/trading/status'),
    refetchInterval: 10_000,
  });
}

export function useOpenPositions(page = 1, limit = 20) {
  return useQuery<{ data: TradingPosition[]; total: number }>({
    queryKey: ['trading', 'positions', page, limit],
    queryFn: () => api.get(`/trading/positions?page=${page}&limit=${limit}`),
    refetchInterval: 15_000,
  });
}

export function useTradingHistory(page = 1, limit = 50) {
  return useQuery<{ data: TradingHistoryItem[]; total: number }>({
    queryKey: ['trading', 'history', page, limit],
    queryFn: () => api.get(`/trading/history?page=${page}&limit=${limit}`),
    refetchInterval: 60_000,
  });
}

export function useTradingDecisions(page = 1, limit = 20) {
  return useQuery<{ data: TradingDecision[]; total: number }>({
    queryKey: ['trading', 'decisions', page, limit],
    queryFn: () => api.get(`/trading/decisions?page=${page}&limit=${limit}`),
    refetchInterval: 30_000,
  });
}
