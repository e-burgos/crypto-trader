import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAgentBudgetPolicies,
  useUpdateBudgetPolicy,
  budgetPolicyKeys,
  type BudgetPolicy,
} from './use-agent-budget-policies';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

// Suppress sonner toasts in tests
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../lib/api';

const mockPolicies: BudgetPolicy[] = [
  {
    agentId: 'orchestrator',
    maxDailyUsd: 5.0,
    maxCostPerDecisionUsd: 0.15,
    blockFreeModels: false,
    updatedAt: '2026-05-10T10:00:00Z',
  },
  {
    agentId: 'market',
    maxDailyUsd: 2.0,
    maxCostPerDecisionUsd: 0.05,
    blockFreeModels: true,
    updatedAt: '2026-05-11T10:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAgentBudgetPolicies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches budget policies', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockPolicies);

    const { result } = renderHook(() => useAgentBudgetPolicies(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/agents/budget-policies');
    expect(result.current.data).toEqual(mockPolicies);
    expect(result.current.data).toHaveLength(2);
  });

  it('handles fetch error gracefully', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAgentBudgetPolicies(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('has correct query key', () => {
    expect(budgetPolicyKeys.all).toEqual(['agent-budget-policies']);
  });
});

describe('useUpdateBudgetPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT with correct endpoint and payload', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useUpdateBudgetPolicy(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      agentId: 'orchestrator',
      maxDailyUsd: 10.0,
      blockFreeModels: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.put).toHaveBeenCalledWith(
      '/agents/budget-policies/orchestrator',
      {
        agentId: 'orchestrator',
        maxDailyUsd: 10.0,
        blockFreeModels: true,
      },
    );
  });

  it('shows error toast on mutation failure', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Server error'));
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useUpdateBudgetPolicy(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ agentId: 'market', maxDailyUsd: 3.0 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to update budget policy');
  });
});
