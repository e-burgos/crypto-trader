import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '../../../lib/i18n';
import { ENTRY_ORDERS_DEFAULT_FILTERS, type EntryOrdersFilters } from '../../../hooks/use-entry-orders';
import { EntryOrdersPanel } from './entry-orders-panel';
import { ENTRY_ORDERS_ALL_STATES, TRADING_CONFIGS_FOR_ENTRIES } from './fixtures';

vi.mock('../../../hooks/use-entry-orders', async () => {
  const actual = await vi.importActual<typeof import('../../../hooks/use-entry-orders')>(
    '../../../hooks/use-entry-orders',
  );
  return { ...actual, useEntryOrders: vi.fn() };
});

vi.mock('../../../hooks/use-trading', async () => {
  const actual = await vi.importActual<typeof import('../../../hooks/use-trading')>(
    '../../../hooks/use-trading',
  );
  return { ...actual, useTradingConfigs: vi.fn() };
});

import { useEntryOrders } from '../../../hooks/use-entry-orders';
import { useTradingConfigs } from '../../../hooks/use-trading';

type UseEntryOrdersReturn = ReturnType<typeof useEntryOrders>;

function mockUseEntryOrders(overrides: Partial<UseEntryOrdersReturn>) {
  vi.mocked(useEntryOrders).mockReturnValue({
    data: { pages: [{ items: ENTRY_ORDERS_ALL_STATES, nextCursor: null }], pageParams: [undefined] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  } as UseEntryOrdersReturn);
}

function renderPanel(filters: EntryOrdersFilters = ENTRY_ORDERS_DEFAULT_FILTERS) {
  return render(
    <MemoryRouter>
      <EntryOrdersPanel filters={filters} onFiltersChange={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('EntryOrdersPanel — load more', () => {
  beforeEach(() => {
    vi.mocked(useTradingConfigs).mockReturnValue({
      data: TRADING_CONFIGS_FOR_ENTRIES,
    } as ReturnType<typeof useTradingConfigs>);
  });

  it('does not render "load more" when hasNextPage is false', () => {
    mockUseEntryOrders({ hasNextPage: false });
    renderPanel();

    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  });

  it('renders "load more" and calls fetchNextPage on click when hasNextPage is true', async () => {
    const fetchNextPage = vi.fn();
    mockUseEntryOrders({ hasNextPage: true, fetchNextPage });
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows the loading copy and disables the button while fetching the next page', () => {
    mockUseEntryOrders({ hasNextPage: true, isFetchingNextPage: true });
    renderPanel();

    const button = screen.getByRole('button', { name: 'Loading…' });
    expect(button).toBeDisabled();
  });

  it('keeps the filters visible while a next page is available', () => {
    mockUseEntryOrders({ hasNextPage: true });
    renderPanel();

    expect(screen.getByRole('group')).toBeInTheDocument();
  });
});

describe('EntryOrdersPanel — loading, empty and error states', () => {
  beforeEach(() => {
    vi.mocked(useTradingConfigs).mockReturnValue({
      data: TRADING_CONFIGS_FOR_ENTRIES,
    } as ReturnType<typeof useTradingConfigs>);
  });

  it('shows the table skeleton on first load and no empty-state copy', () => {
    mockUseEntryOrders({ data: undefined, isPending: true });
    renderPanel();

    expect(screen.queryByText('No resting entries')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the global empty copy when there is no active filter', () => {
    mockUseEntryOrders({ data: { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] } });
    renderPanel(ENTRY_ORDERS_DEFAULT_FILTERS);

    expect(screen.getByText('No resting entries')).toBeInTheDocument();
    expect(screen.getByText('Your bots have not left any entry on the exchange yet.')).toBeInTheDocument();
  });

  it('shows the filtered empty copy when a filter is active', () => {
    mockUseEntryOrders({ data: { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] } });
    renderPanel({ status: 'MISSING', configId: 'ALL' });

    expect(screen.getByText('No resting entries')).toBeInTheDocument();
    expect(screen.getByText('No entry matches the filters you picked.')).toBeInTheDocument();
  });

  it('shows a distinguishable error state with a retry that calls refetch', async () => {
    const refetch = vi.fn();
    mockUseEntryOrders({ isError: true, refetch });
    renderPanel();

    expect(screen.getByText("We couldn't load your entries")).toBeInTheDocument();
    expect(screen.queryByText('No resting entries')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the filters visible in the empty and error states', () => {
    mockUseEntryOrders({ isError: true });
    const { unmount } = renderPanel();
    expect(screen.getByRole('group')).toBeInTheDocument();
    unmount();

    mockUseEntryOrders({ data: { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] } });
    renderPanel();
    expect(screen.getByRole('group')).toBeInTheDocument();
  });
});
