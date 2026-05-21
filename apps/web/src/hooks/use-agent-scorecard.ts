import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScorecardFilters {
  agentId?: string;
  model?: string;
  mode?: string;
  marketRegime?: string;
  from?: string;
  to?: string;
}

export interface ScorecardEntry {
  agentId: string;
  model: string;
  mode: string;
  marketRegime: string;
  totalDecisions: number;
  wins: number;
  losses: number;
  neutral: number;
  winRate: number;
  avgPnlUsd: number;
  totalCostUsd: number;
  roi: number;
}

export interface ScorecardSummary {
  totalDecisions: number;
  overallWinRate: number;
  totalPnlUsd: number;
  totalCostUsd: number;
  overallRoi: number;
  bestAgent: string | null;
  bestModel: string | null;
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const scorecardKeys = {
  all: ['agent-scorecard'] as const,
  list: (filters: ScorecardFilters) =>
    ['agent-scorecard', 'list', filters] as const,
  summary: ['agent-scorecard', 'summary'] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

function buildQueryString(filters: ScorecardFilters): string {
  const params = new URLSearchParams();
  if (filters.agentId) params.set('agentId', filters.agentId);
  if (filters.model) params.set('model', filters.model);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.marketRegime) params.set('marketRegime', filters.marketRegime);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useAgentScorecard(filters: ScorecardFilters = {}) {
  return useQuery<ScorecardEntry[]>({
    queryKey: scorecardKeys.list(filters),
    queryFn: () => api.get(`/agents/scorecard${buildQueryString(filters)}`),
    staleTime: 60_000,
  });
}

export function useAgentScorecardSummary() {
  return useQuery<ScorecardSummary>({
    queryKey: scorecardKeys.summary,
    queryFn: () => api.get('/agents/scorecard/summary'),
    staleTime: 60_000,
  });
}
