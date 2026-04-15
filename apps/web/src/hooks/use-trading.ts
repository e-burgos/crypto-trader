import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export type TradingMode = 'SANDBOX' | 'LIVE' | 'TESTNET';
export type TradingAsset = 'BTC' | 'ETH';
export type TradingPair = 'USDT' | 'USDC';
export type IntervalMode = 'AGENT' | 'CUSTOM';
export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

export interface TradingConfig {
  id: string;
  name: string;
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: IntervalMode;
  orderPriceOffsetPct: number;
  isActive: boolean;
  isRunning: boolean;
  primaryProvider: string | null;
  primaryModel: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  riskProfile: RiskProfile;
  createdAt: string;
}

export interface TradingConfigDto {
  name?: string;
  asset: TradingAsset;
  pair: TradingPair;
  mode: TradingMode;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: IntervalMode;
  orderPriceOffsetPct: number;
  primaryProvider?: string | null;
  primaryModel?: string | null;
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
  riskProfile?: RiskProfile;
}

export interface AgentStatus {
  id: string;
  asset: string;
  pair: string;
  isRunning: boolean;
  mode: TradingMode;
  jobQueued: boolean;
  nextRunAt: number | null;
}

export interface TradingPosition {
  id: string;
  asset: string;
  pair: string;
  mode: TradingMode;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryAt: string;
  exitAt: string | null;
  fees: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number | null;
  config?: {
    stopLossPct: number;
    takeProfitPct: number;
    maxTradePct: number;
    buyThreshold: number;
    sellThreshold: number;
    minIntervalMinutes: number;
    orderPriceOffsetPct: number;
    maxConcurrentPositions: number;
  };
  trades?: {
    id: string;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    fee: number;
    executedAt: string;
    binanceOrderId?: string | null;
  }[];
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
  configId?: string;
  configName?: string;
  createdAt: string;
}

export function useTradingConfigs() {
  return useQuery<TradingConfig[]>({
    queryKey: ['trading', 'config'],
    queryFn: () => api.get('/trading/config'),
    staleTime: 30_000,
  });
}

export function useCreateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TradingConfigDto) =>
      api.post<TradingConfig>('/trading/config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', 'config'] });
      toast.success('Configuración creada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al crear la configuración'),
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TradingConfigDto>;
    }) => api.put<TradingConfig>(`/trading/config/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', 'config'] });
      toast.success('Configuración actualizada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al actualizar la configuración'),
  });
}

export function useDeleteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) =>
      api.delete<{ deleted: boolean }>(`/trading/config/${configId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', 'config'] });
      qc.invalidateQueries({ queryKey: ['trading', 'status'] });
      toast.success('Configuración eliminada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al eliminar la configuración'),
  });
}

export function useStartAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) => api.post('/trading/start', { configId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading'] });
      toast.success('Agente iniciado');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al iniciar el agente'),
  });
}

export function useStopAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configId: string) => api.post('/trading/stop', { configId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading'] });
      toast.success('Agente detenido');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al detener el agente'),
  });
}

export function useStopAgentsByMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: TradingMode) =>
      api.post<{ stopped: number }>('/trading/stop-by-mode', { mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading'] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al detener los agentes'),
  });
}

export function useAgentStatus() {
  return useQuery<AgentStatus[]>({
    queryKey: ['trading', 'status'],
    queryFn: () => api.get('/trading/status'),
    refetchInterval: 10_000,
  });
}

export function usePositions(page = 1, limit = 20, status?: 'OPEN' | 'CLOSED') {
  return useQuery<{
    positions: TradingPosition[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['trading', 'positions', page, limit, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      return api.get(`/trading/positions?${params.toString()}`);
    },
    refetchInterval: 15_000,
  });
}

export function useClosePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positionId: string) =>
      api.post<{
        positionId: string;
        exitPrice: number;
        pnl: number;
        status: string;
      }>(`/trading/positions/${positionId}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trading', 'positions'] });
      qc.invalidateQueries({ queryKey: ['trading', 'sandbox-wallet'] });
      toast.success('Position closed successfully');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to close position'),
  });
}

/** @deprecated use usePositions */
export function useOpenPositions(page = 1, limit = 20) {
  return usePositions(page, limit, 'OPEN');
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

export interface SandboxWalletEntry {
  currency: string;
  balance: number;
  updatedAt: string | null;
}

export function useSandboxWallet() {
  return useQuery<SandboxWalletEntry[]>({
    queryKey: ['trading', 'sandbox-wallet'],
    queryFn: () => api.get('/trading/wallet'),
    refetchInterval: 30_000,
  });
}

export interface BinanceBalanceEntry {
  currency: string;
  balance: number;
}

export function useBinanceBalance(mode: 'LIVE' | 'TESTNET', hasKeys: boolean) {
  return useQuery<BinanceBalanceEntry[]>({
    queryKey: ['trading', 'binance-balance', mode],
    queryFn: () => api.get(`/trading/balance?mode=${mode}`),
    enabled: hasKeys,
    // Backend caches this for 5 minutes — polling more often only wastes requests.
    // For TESTNET this avoids IP-ban escalation on testnet.binance.vision.
    refetchInterval: 5 * 60_000, // 5 minutes
    retry: false,
  });
}
