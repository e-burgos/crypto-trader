import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../lib/i18n';
import { PositionsPage } from './positions';
import type { TradingPosition } from '../../hooks/use-trading';
import type { EntryOrdersFilters as EntryOrdersFiltersState } from '../../hooks/use-entry-orders';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

let lastEntryOrdersPanelProps: {
  filters: EntryOrdersFiltersState;
  onFiltersChange: (next: EntryOrdersFiltersState) => void;
  highlightEntryOrderId?: string;
} | null = null;

vi.mock('../../components/positions/entry-orders', () => ({
  EntryOrdersPanel: (props: {
    filters: EntryOrdersFiltersState;
    onFiltersChange: (next: EntryOrdersFiltersState) => void;
    highlightEntryOrderId?: string;
  }) => {
    lastEntryOrdersPanelProps = props;
    return (
      <div data-testid="entry-orders-panel">
        <span data-testid="entry-status">{props.filters.status}</span>
        <span data-testid="entry-configId">{props.filters.configId}</span>
        <span data-testid="entry-highlight">{props.highlightEntryOrderId ?? ''}</span>
        <button
          type="button"
          onClick={() => props.onFiltersChange({ status: 'FILLED', configId: 'cfg_x' })}
        >
          change-filters
        </button>
      </div>
    );
  },
}));

import { api } from '../../lib/api';

const OPEN_POSITION: TradingPosition = {
  id: 'pos_1',
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
  entryPrice: 60000,
  exitPrice: null,
  quantity: 0.01,
  entryAt: '2026-09-01T00:00:00.000Z',
  exitAt: null,
  fees: 1,
  status: 'OPEN',
  pnl: null,
};

function mockApiGet(positions: TradingPosition[] = []) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/trading/positions')) {
      return Promise.resolve({
        positions,
        total: positions.length,
        page: 1,
        limit: 20,
      });
    }
    return Promise.resolve([]);
  });
}

function findDesktopTabButton(label: string): HTMLButtonElement {
  const button = screen
    .getAllByText(label)
    .map((el) => el.closest('button'))
    .find((el): el is HTMLButtonElement => !!el && el.className.includes('rounded-md'));
  if (!button) throw new Error(`no desktop tab button found for "${label}"`);
  return button;
}

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PositionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PositionsPage — URL as source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastEntryOrdersPanelProps = null;
  });

  it('shows the Open tab by default, without the entries panel', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions');

    await waitFor(() => {
      expect(findDesktopTabButton('Open').className).toContain('shadow-sm');
    });
    expect(screen.queryByTestId('entry-orders-panel')).not.toBeInTheDocument();
  });

  it('mounts the entries panel with the filters and highlight parsed from the URL', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions?tab=entries&status=RESTING&configId=cfg_a&entryOrderId=eo_1');

    await waitFor(() => {
      expect(screen.getByTestId('entry-orders-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('entry-status').textContent).toBe('RESTING');
    expect(screen.getByTestId('entry-configId').textContent).toBe('cfg_a');
    expect(screen.getByTestId('entry-highlight').textContent).toBe('eo_1');
  });

  it('defaults an unknown status and a missing configId to ALL', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions?tab=entries&status=NOT_A_STATUS');

    await waitFor(() => {
      expect(screen.getByTestId('entry-orders-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('entry-status').textContent).toBe('ALL');
    expect(screen.getByTestId('entry-configId').textContent).toBe('ALL');
  });

  it('falls back to the Open tab for an invalid tab value', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions?tab=bogus');

    await waitFor(() => {
      expect(screen.queryByTestId('entry-orders-panel')).not.toBeInTheDocument();
    });
  });

  it('rewrites the query string when the entries filters change', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions?tab=entries');

    await waitFor(() => {
      expect(screen.getByTestId('entry-orders-panel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('change-filters'));

    await waitFor(() => {
      expect(lastEntryOrdersPanelProps?.filters).toEqual({ status: 'FILLED', configId: 'cfg_x' });
    });
  });

  it('clears status, configId and entryOrderId from the URL when leaving the entries tab', async () => {
    mockApiGet([]);
    renderPage('/dashboard/positions?tab=entries&status=RESTING&configId=cfg_a&entryOrderId=eo_1');

    await waitFor(() => {
      expect(screen.getByTestId('entry-orders-panel')).toBeInTheDocument();
    });

    fireEvent.click(findDesktopTabButton('Open'));

    await waitFor(() => {
      expect(screen.queryByTestId('entry-orders-panel')).not.toBeInTheDocument();
    });

    fireEvent.click(findDesktopTabButton('Entries'));

    await waitFor(() => {
      expect(screen.getByTestId('entry-status').textContent).toBe('ALL');
      expect(screen.getByTestId('entry-configId').textContent).toBe('ALL');
      expect(screen.getByTestId('entry-highlight').textContent).toBe('');
    });
  });

  it('hides the numbered pagination controls on the entries tab', async () => {
    const manyPositions = Array.from({ length: 25 }, (_, i) => ({
      ...OPEN_POSITION,
      id: `pos_${i}`,
    }));
    mockApiGet(manyPositions);
    renderPage('/dashboard/positions');

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    fireEvent.click(findDesktopTabButton('Entries'));

    await waitFor(() => {
      expect(screen.getByTestId('entry-orders-panel')).toBeInTheDocument();
    });
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();
  });

  it('opens the position detail modal from a positionId deep link and strips it from the URL', async () => {
    mockApiGet([OPEN_POSITION]);
    renderPage(`/dashboard/positions?positionId=${OPEN_POSITION.id}`);

    await waitFor(() => {
      expect(screen.getByText('Position Detail')).toBeInTheDocument();
    });
  });

  it('does not open any modal and does not throw for an absent positionId', async () => {
    mockApiGet([OPEN_POSITION]);
    renderPage('/dashboard/positions?positionId=does_not_exist');

    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    });
    expect(screen.queryByText('Position Detail')).not.toBeInTheDocument();
  });
});
