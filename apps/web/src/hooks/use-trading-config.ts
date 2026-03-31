import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface TradingConfig {
  id: string;
  asset: string;
  pair: string;
  mode: string;
  isRunning: boolean;
  capitalUsdt: number;
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxDailyLossPct: number;
  agentIntervalMinutes: number;
  createdAt: string;
}

export function useTradingConfigs() {
  return useQuery<TradingConfig[]>({
    queryKey: ['trading-configs'],
    queryFn: () => api.get('/trading-config'),
    staleTime: 60_000,
  });
}

export function useCreateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TradingConfig>) => api.post<TradingConfig>('/trading-config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading-configs'] });
      toast.success('Configuration saved');
    },
    onError: (err: { message?: string }) => toast.error(err?.message || 'Failed to save'),
  });
}

export function useToggleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start }: { id: string; start: boolean }) =>
      api.post(`/trading-config/${id}/${start ? 'start' : 'stop'}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading-configs'] });
    },
  });
}
