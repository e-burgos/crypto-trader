import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BudgetPolicy {
  agentId: string;
  maxDailyUsd: number;
  maxCostPerDecisionUsd: number;
  blockFreeModels: boolean;
  updatedAt: string;
}

export interface UpdateBudgetPolicyDto {
  agentId: string;
  maxDailyUsd?: number;
  maxCostPerDecisionUsd?: number;
  blockFreeModels?: boolean;
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const budgetPolicyKeys = {
  all: ['agent-budget-policies'] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useAgentBudgetPolicies() {
  return useQuery<BudgetPolicy[]>({
    queryKey: budgetPolicyKeys.all,
    queryFn: () => api.get('/agents/budget-policies'),
    staleTime: 30_000,
  });
}

export function useUpdateBudgetPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateBudgetPolicyDto) =>
      api.put(`/agents/budget-policies/${dto.agentId}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetPolicyKeys.all });
      toast.success('Budget policy updated');
    },
    onError: () => {
      toast.error('Failed to update budget policy');
    },
  });
}
