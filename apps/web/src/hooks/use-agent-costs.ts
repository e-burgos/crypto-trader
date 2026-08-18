import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type AgentCostPeriod = '7d' | '30d' | '90d';

export interface AgentCostFilters {
  period?: AgentCostPeriod;
  mode?: string;
  configId?: string;
}

export interface AgentCostBucket {
  costUsd: number;
  decisions: number;
  llmDecisions: number;
  gateDecisions: number;
  unpricedDecisions: number;
}

export interface AgentCostBotBucket extends AgentCostBucket {
  configId: string | null;
  configName: string | null;
  asset: string;
  pair: string;
  mode: string;
}

export interface AgentCostDailyBotBucket {
  configId: string | null;
  costUsd: number;
}

export interface AgentCostDailyBucket extends AgentCostBucket {
  date: string;
  byBot: AgentCostDailyBotBucket[];
}

export interface AgentCostBreakdown extends AgentCostBucket {
  period: AgentCostPeriod;
  from: string;
  to: string;
  byBot: AgentCostBotBucket[];
  dailySeries: AgentCostDailyBucket[];
}

export const agentCostKeys = {
  all: ['agent-costs'] as const,
  breakdown: (filters: AgentCostFilters) =>
    ['agent-costs', 'breakdown', filters] as const,
};

function buildQueryString(filters: AgentCostFilters): string {
  const params = new URLSearchParams();
  if (filters.period) params.set('period', filters.period);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.configId) params.set('configId', filters.configId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useAgentCosts(filters: AgentCostFilters = {}) {
  return useQuery<AgentCostBreakdown>({
    queryKey: agentCostKeys.breakdown(filters),
    queryFn: () => api.get(`/analytics/agent-costs${buildQueryString(filters)}`),
    staleTime: 60_000,
  });
}
