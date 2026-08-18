import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../lib/i18n';
import { AgentCostPanel } from './agent-cost-panel';
import type { AgentCostBreakdown } from '../../hooks/use-agent-costs';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../../lib/api';

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

const emptyBreakdown: AgentCostBreakdown = {
  period: '30d',
  from: '2026-07-19T00:00:00.000Z',
  to: '2026-08-18T23:59:59.999Z',
  costUsd: 0,
  decisions: 0,
  llmDecisions: 0,
  gateDecisions: 0,
  unpricedDecisions: 0,
  byBot: [],
  dailySeries: [],
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentCostPanel />
    </QueryClientProvider>,
  );
}

describe('AgentCostPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders totals, per-bot table and the gate-vs-llm distinction with data', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockBreakdown);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('$12.4831')).toBeInTheDocument();
    });

    expect(screen.getByText('1104')).toBeInTheDocument();
    expect(screen.getByText('1776')).toBeInTheDocument();
    expect(screen.getByText('2880')).toBeInTheDocument();

    expect(screen.getByText('BTC agresivo')).toBeInTheDocument();
    expect(screen.getByText('$8.9102')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();

    expect(
      screen.getByText(/3 decisions with no available rate/),
    ).toBeInTheDocument();
  });

  it('shows the empty state when the period has no decisions', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(emptyBreakdown);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No cost data')).toBeInTheDocument();
    });

    expect(screen.queryByText('BTC agresivo')).not.toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('Could not load LLM cost. Try again later.'),
      ).toBeInTheDocument();
    });
  });
});
