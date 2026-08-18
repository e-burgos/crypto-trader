import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAgentCosts,
  agentCostKeys,
  type AgentCostBreakdown,
} from './use-agent-costs';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../lib/api';

const mockBreakdown: AgentCostBreakdown = {
  period: '30d',
  from: '2026-07-19T00:00:00.000Z',
  to: '2026-08-18T23:59:59.999Z',
  costUsd: 12.4831,
  decisions: 2880,
  llmDecisions: 1104,
  gateDecisions: 1776,
  unpricedDecisions: 3,
  byBot: [
    {
      configId: 'clx-btc',
      configName: 'BTC agresivo',
      asset: 'BTC',
      pair: 'USDT',
      mode: 'LIVE',
      costUsd: 8.9102,
      decisions: 1440,
      llmDecisions: 620,
      gateDecisions: 820,
      unpricedDecisions: 1,
    },
  ],
  dailySeries: [
    {
      date: '2026-08-18',
      costUsd: 0.4123,
      decisions: 96,
      llmDecisions: 37,
      gateDecisions: 59,
      unpricedDecisions: 0,
      byBot: [{ configId: 'clx-btc', costUsd: 0.2841 }],
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAgentCosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the breakdown without filters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockBreakdown);

    const { result } = renderHook(() => useAgentCosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/analytics/agent-costs');
    expect(result.current.data).toEqual(mockBreakdown);
  });

  it('builds the query string from period, mode and configId', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockBreakdown);

    const { result } = renderHook(
      () => useAgentCosts({ period: '7d', mode: 'LIVE', configId: 'clx-btc' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain('period=7d');
    expect(calledUrl).toContain('mode=LIVE');
    expect(calledUrl).toContain('configId=clx-btc');
  });

  it('handles fetch error', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAgentCosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('agentCostKeys', () => {
  it('builds a breakdown key scoped to its filters', () => {
    const key = agentCostKeys.breakdown({ period: '30d' });
    expect(key).toEqual(['agent-costs', 'breakdown', { period: '30d' }]);
  });
});
