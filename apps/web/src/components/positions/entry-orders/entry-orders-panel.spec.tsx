import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '../../../lib/i18n';
import { ENTRY_ORDERS_DEFAULT_FILTERS } from '../../../hooks/use-entry-orders';
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

function renderPanel() {
  return render(
    <MemoryRouter>
      <EntryOrdersPanel filters={ENTRY_ORDERS_DEFAULT_FILTERS} onFiltersChange={vi.fn()} />
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
