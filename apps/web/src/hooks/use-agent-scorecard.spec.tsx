import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAgentScorecard,
  useAgentScorecardSummary,
  scorecardKeys,
  type ScorecardEntry,
  type ScorecardSummary,
} from './use-agent-scorecard';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../lib/api';

const mockEntries: ScorecardEntry[] = [
  {
    agentId: 'orchestrator',
    model: 'gpt-4o',
    mode: 'LIVE',
    marketRegime: 'TRENDING_UP',
    totalDecisions: 100,
    wins: 60,
    losses: 30,
    neutral: 10,
    winRate: 0.6,
    avgPnlUsd: 12.5,
    totalCostUsd: 0.85,
    roi: 14.7,
  },
  {
    agentId: 'market',
    model: 'claude-3-haiku',
    mode: 'PAPER',
    marketRegime: 'RANGING',
    totalDecisions: 50,
    wins: 25,
    losses: 20,
    neutral: 5,
    winRate: 0.5,
    avgPnlUsd: 3.2,
    totalCostUsd: 0.12,
    roi: 26.6,
  },
];

const mockSummary: ScorecardSummary = {
  totalDecisions: 150,
  overallWinRate: 0.57,
  totalPnlUsd: 1250.0,
  totalCostUsd: 0.97,
  overallRoi: 1288.66,
  bestAgent: 'orchestrator',
  bestModel: 'gpt-4o',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAgentScorecard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches scorecard entries without filters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockEntries);

    const { result } = renderHook(() => useAgentScorecard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/agents/scorecard');
    expect(result.current.data).toEqual(mockEntries);
    expect(result.current.data).toHaveLength(2);
  });

  it('builds query string from filters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    const filters = {
      agentId: 'market',
      mode: 'LIVE',
      marketRegime: 'RANGING',
    };
    const { result } = renderHook(() => useAgentScorecard(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain('agentId=market');
    expect(calledUrl).toContain('mode=LIVE');
    expect(calledUrl).toContain('marketRegime=RANGING');
  });

  it('handles empty filters without query string', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAgentScorecard({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/agents/scorecard');
  });

  it('handles fetch error', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Timeout'));

    const { result } = renderHook(() => useAgentScorecard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAgentScorecardSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches summary data', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockSummary);

    const { result } = renderHook(() => useAgentScorecardSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith('/agents/scorecard/summary');
    expect(result.current.data).toEqual(mockSummary);
    expect(result.current.data?.bestAgent).toBe('orchestrator');
  });
});

describe('scorecardKeys', () => {
  it('generates correct keys for list with filters', () => {
    const key = scorecardKeys.list({ agentId: 'market', mode: 'LIVE' });
    expect(key).toEqual([
      'agent-scorecard',
      'list',
      { agentId: 'market', mode: 'LIVE' },
    ]);
  });

  it('summary key is static', () => {
    expect(scorecardKeys.summary).toEqual(['agent-scorecard', 'summary']);
  });
});
