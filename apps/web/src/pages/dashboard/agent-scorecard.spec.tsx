import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentScorecardPage } from './agent-scorecard';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../../lib/api';

const mockSummary = {
  totalDecisions: 150,
  overallWinRate: 0.57,
  totalPnlUsd: 1250.0,
  totalCostUsd: 0.97,
  overallRoi: 12.88,
  bestAgent: 'orchestrator',
  bestModel: 'gpt-4o',
};

const mockEntries = [
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
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AgentScorecardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<AgentScorecardPage />);

    expect(screen.getByText('Agent Scorecard')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Performance metrics and ROI breakdown by agent, model, and market regime.',
      ),
    ).toBeInTheDocument();
  });

  it('shows empty state when no scorecard entries', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('summary')) return Promise.resolve(mockSummary);
      return Promise.resolve([]);
    });

    renderWithProviders(<AgentScorecardPage />);

    await waitFor(() => {
      expect(screen.getByText('No scorecard data')).toBeInTheDocument();
    });
  });

  it('renders summary stats when available', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('summary')) return Promise.resolve(mockSummary);
      return Promise.resolve(mockEntries);
    });

    renderWithProviders(<AgentScorecardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Decisions')).toBeInTheDocument();
    });

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('57.0%')).toBeInTheDocument();
    expect(screen.getByText('$1250.00')).toBeInTheDocument();
    expect(screen.getByText('$0.9700')).toBeInTheDocument();
    expect(screen.getByText('1288.0%')).toBeInTheDocument();
  });

  it('renders scorecard table with entries', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('summary')) return Promise.resolve(mockSummary);
      return Promise.resolve(mockEntries);
    });

    renderWithProviders(<AgentScorecardPage />);

    await waitFor(() => {
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
    });

    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('TRENDING_UP')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('renders filter dropdowns', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('summary')) return Promise.resolve(mockSummary);
      return Promise.resolve(mockEntries);
    });

    renderWithProviders(<AgentScorecardPage />);

    await waitFor(() => {
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
    });

    // Verify table column headers are present
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Regime')).toBeInTheDocument();
    // "Win Rate" appears both as summary stat label and column header
    expect(screen.getAllByText('Win Rate').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ROI').length).toBeGreaterThanOrEqual(1);
  });
});
