import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

export interface LLMModel {
  id: string;
  label: string;
  contextWindow?: number;
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  deprecated?: boolean;
}

export interface LLMUsageByModel {
  model: string;
  label: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  callCount: number;
}

export interface LLMUsageByProvider {
  provider: string;
  label: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  callCount: number;
  byModel: LLMUsageByModel[];
}

export interface LLMUsageDaily {
  date: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMUsageResponse {
  period: string;
  from: string;
  to: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byProvider: LLMUsageByProvider[];
  dailySeries: LLMUsageDaily[];
}

export function useLLMProviderModels(provider: string, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<LLMModel[]>({
    queryKey: ['llm', 'models', provider],
    queryFn: () => api.get(`/users/me/llm/${provider}/models`),
    staleTime: 300_000,
    enabled: isAuthenticated && enabled && !!provider,
  });
}

export function useLLMUsageStats(period: '7d' | '30d' | '90d' = '30d') {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<LLMUsageResponse>({
    queryKey: ['llm', 'usage', period],
    queryFn: () => api.get(`/users/me/llm/usage?period=${period}`),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}
