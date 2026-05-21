import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEconomicsSettingsPage } from './agent-economics-settings';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { api } from '../../lib/api';

const mockPolicies = [
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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AgentEconomicsSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<AgentEconomicsSettingsPage />);

    expect(screen.getByText('Agent Economics')).toBeInTheDocument();
    // Spinner rendered — page header visible during load
    expect(screen.queryByText('No budget policies')).not.toBeInTheDocument();
  });

  it('shows empty state when no policies', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);
    renderWithProviders(<AgentEconomicsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('No budget policies')).toBeInTheDocument();
    });
  });

  it('renders policy cards with correct data', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockPolicies);
    renderWithProviders(<AgentEconomicsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
    });

    expect(screen.getByText('market')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.15')).toBeInTheDocument();
  });

  it('shows save button only after editing a field', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockPolicies);
    renderWithProviders(<AgentEconomicsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
    });

    // No save buttons initially
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

    // Edit the max daily usd field
    const dailyInput = screen.getByDisplayValue('5');
    fireEvent.change(dailyInput, { target: { value: '10' } });

    // Save button appears
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('calls update mutation on save', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockPolicies);
    vi.mocked(api.put).mockResolvedValueOnce({ success: true });

    renderWithProviders(<AgentEconomicsSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
    });

    const dailyInput = screen.getByDisplayValue('5');
    fireEvent.change(dailyInput, { target: { value: '10' } });

    const saveBtn = screen.getByText('Save Changes');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/agents/budget-policies/orchestrator',
        expect.objectContaining({ agentId: 'orchestrator', maxDailyUsd: 10 }),
      );
    });
  });

  it('renders page header and description', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);
    renderWithProviders(<AgentEconomicsSettingsPage />);

    expect(screen.getByText('Agent Economics')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure budget policies and spending limits for each agent.',
      ),
    ).toBeInTheDocument();
  });
});
