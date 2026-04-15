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

interface LLMModelsResponse {
  provider: string;
  models: LLMModel[];
  fetchedAt: string;
}

export function useLLMProviderModels(provider: string, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<LLMModel[]>({
    queryKey: ['llm', 'models', provider],
    queryFn: async () => {
      const res = await api.get<LLMModelsResponse>(
        `/users/me/llm/${provider}/models`,
      );
      return res.models;
    },
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

// ── Provider Status ────────────────────────────────────────────────────────

export interface ProviderRateLimits {
  tokensRemaining: number | null;
  tokensLimit: number | null;
  requestsRemaining: number | null;
  requestsLimit: number | null;
  resetAt: string | null;
  capturedAt: string;
}

export interface ProviderUsageBySource {
  source: string;
  tokensIn: number;
  tokensOut: number;
  calls: number;
  costUsd: number;
}

export interface ProviderUsageDaily {
  date: string;
  costUsd: number;
  tokens: number;
  calls: number;
}

export interface ProviderStatus {
  provider: string;
  availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
  availabilityScore: number;
  reason?: string;
  rateLimits: ProviderRateLimits | null;
  usage: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCalls: number;
    totalErrors: number;
    estimatedCostUsd: number;
    bySource: ProviderUsageBySource[];
    dailySeries: ProviderUsageDaily[];
  };
  lastSuccessAt: string | null;
  lastError: string | null;
  keyStatus: 'ACTIVE' | 'INVALID' | 'INACTIVE';
}

export function useProviderStatuses() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ProviderStatus[]>({
    queryKey: ['llm', 'providers', 'status'],
    queryFn: () => api.get('/users/me/llm/providers/status'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isAuthenticated,
  });
}
