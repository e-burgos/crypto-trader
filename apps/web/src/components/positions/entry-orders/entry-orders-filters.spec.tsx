import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '../../../lib/i18n';
import { ENTRY_ORDER_STATUSES } from '@crypto-trader/shared';
import { ENTRY_ORDERS_DEFAULT_FILTERS, type EntryOrdersFilters as EntryOrdersFiltersState } from '../../../hooks/use-entry-orders';
import { EntryOrdersFilters } from './entry-orders-filters';
import { TRADING_CONFIGS_FOR_ENTRIES } from './fixtures';

describe('EntryOrdersFilters — status pills', () => {
  it('renders one pill per status plus "all", six in total', () => {
    render(
      <EntryOrdersFilters filters={ENTRY_ORDERS_DEFAULT_FILTERS} configs={[]} onChange={vi.fn()} />,
    );

    const group = within(screen.getByRole('group'));
    expect(group.getAllByRole('button')).toHaveLength(1 + ENTRY_ORDER_STATUSES.length);
  });

  it('marks exactly the active pill as pressed', () => {
    const filters: EntryOrdersFiltersState = { status: 'MISSING', configId: 'ALL' };
    render(<EntryOrdersFilters filters={filters} configs={[]} onChange={vi.fn()} />);

    const group = within(screen.getByRole('group'));
    const pressed = group.getAllByRole('button', { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('Missing');
  });

  it('clicking a pill reports the new status while preserving the bot filter', async () => {
    const onChange = vi.fn();
    const filters: EntryOrdersFiltersState = { status: 'ALL', configId: 'cfg_btc' };
    render(<EntryOrdersFilters filters={filters} configs={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Missing' }));

    expect(onChange).toHaveBeenCalledWith({ status: 'MISSING', configId: 'cfg_btc' });
  });
});

describe('EntryOrdersFilters — bot select', () => {
  it('lists the known bots plus "all bots"', () => {
    render(
      <EntryOrdersFilters
        filters={ENTRY_ORDERS_DEFAULT_FILTERS}
        configs={TRADING_CONFIGS_FOR_ENTRIES}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('All bots')).toBeInTheDocument();
  });

  it('preserves a configId from the URL that is not in the known configs as a raw option', () => {
    const filters: EntryOrdersFiltersState = { status: 'ALL', configId: 'cfg_ghost' };
    render(
      <EntryOrdersFilters filters={filters} configs={TRADING_CONFIGS_FOR_ENTRIES} onChange={vi.fn()} />,
    );

    expect(screen.getByText('cfg_ghost')).toBeInTheDocument();
  });

  it('selecting a known bot reports its id while preserving the status filter', async () => {
    const onChange = vi.fn();
    const filters: EntryOrdersFiltersState = { status: 'RESTING', configId: 'ALL' };
    render(
      <EntryOrdersFilters filters={filters} configs={TRADING_CONFIGS_FOR_ENTRIES} onChange={onChange} />,
    );

    await userEvent.click(screen.getByText('All bots'));
    await userEvent.click(screen.getByText('BTC Momentum'));

    expect(onChange).toHaveBeenCalledWith({ status: 'RESTING', configId: 'cfg_btc' });
  });
});
