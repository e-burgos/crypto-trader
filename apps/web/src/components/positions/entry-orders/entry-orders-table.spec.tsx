import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../lib/i18n';
import { EntryOrdersTable } from './entry-orders-table';
import { ENTRY_ORDERS_ALL_STATES, TRADING_CONFIGS_FOR_ENTRIES, makeFixtureEntry } from './fixtures';

function renderTable(
  entries = ENTRY_ORDERS_ALL_STATES,
  configs = TRADING_CONFIGS_FOR_ENTRIES,
  highlightEntryOrderId?: string,
) {
  return render(
    <MemoryRouter>
      <EntryOrdersTable entries={entries} configs={configs} highlightEntryOrderId={highlightEntryOrderId} />
    </MemoryRouter>,
  );
}

function rows() {
  return document.querySelectorAll('tbody tr');
}

function mustFindRow(predicate: (row: Element) => boolean): HTMLElement {
  const found = [...rows()].find(predicate);
  if (!found) throw new Error('no row matched the predicate');
  return found as HTMLElement;
}

describe('EntryOrdersTable', () => {
  it('renders one row per entry without throwing', () => {
    renderTable();
    expect(rows()).toHaveLength(ENTRY_ORDERS_ALL_STATES.length);
  });

  it('shows the neutral unknown badge for an invented status, with every other cell holding its real value', () => {
    renderTable();
    const row = mustFindRow((r) => Boolean(within(r).queryByText('BTCUSDT') && within(r).queryByText('Unknown')));
    const scoped = within(row);
    expect(scoped.getByText('$60,300.00')).toBeInTheDocument();
    expect(scoped.getByText('TESTNET')).toBeInTheDocument();
  });

  it('a LIMIT_MAKER row shows a single level line, no stop pair or trailing text', () => {
    renderTable();
    const row = mustFindRow((r) => Boolean(within(r).queryByText('$59,500.00')));
    expect(within(row).queryByText(/Breakout/)).not.toBeInTheDocument();
  });

  it('an OCO row with trailingDeltaBips shows the trailing text and not a fixed stop pair', () => {
    renderTable();
    const row = mustFindRow((r) => Boolean(within(r).queryByText('$61,250.50')));
    const scoped = within(row);
    expect(scoped.getByText('Breakout trails the price (120 bips)')).toBeInTheDocument();
    expect(scoped.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('an OCO row with fixed levels shows the stop pair text', () => {
    renderTable();
    const row = mustFindRow((r) => Boolean(within(r).queryByText('$3,350.00')));
    expect(within(row).getByText('Breakout $3,500.00 → $3,510.00')).toBeInTheDocument();
  });

  it('the notional cell is exactly plannedNotionalUsd, never derived from quantity * limitPrice', () => {
    const entry = makeFixtureEntry({
      id: 'eo_notional_check',
      quantity: 999,
      limitPrice: 999,
      plannedNotionalUsd: 42.42,
    });
    renderTable([entry], []);
    expect(screen.getByText('$42.42')).toBeInTheDocument();
    expect(screen.queryByText('$998,001.00')).not.toBeInTheDocument();
  });

  it('a RESTING entry with an expiresAt in the past still shows the Resting badge (RN-01)', () => {
    renderTable();
    const row = mustFindRow((r) => Boolean(within(r).queryByText('$59,800.00')));
    expect(within(row).getByText('Resting')).toBeInTheDocument();
  });

  it('falls back to the raw configId for an entry whose bot is not in the configs list', () => {
    renderTable();
    expect(() => mustFindRow((r) => Boolean(within(r).queryByText('cfg_ghost')))).not.toThrow();
  });

  it('never renders a raw wire literal in the table', () => {
    renderTable();
    const text = document.body.textContent ?? '';
    for (const raw of ['RESTING', 'TTL_EXPIRED', 'LIMIT_MAKER', 'PENDING_REVIEW']) {
      expect(text).not.toContain(raw);
    }
    expect(text).not.toMatch(/\bnull\b/);
    expect(text).not.toMatch(/\bundefined\b/);
    expect(text).not.toMatch(/\bNaN\b/);
  });

  it('highlights the row matching highlightEntryOrderId with a screen-reader label', () => {
    renderTable(ENTRY_ORDERS_ALL_STATES, TRADING_CONFIGS_FOR_ENTRIES, 'eo_missing');
    expect(screen.getByText('Entry from the notification')).toBeInTheDocument();
  });

  it('renders no screen-reader highlight label when nothing matches', () => {
    renderTable();
    expect(screen.queryByText('Entry from the notification')).not.toBeInTheDocument();
  });
});
