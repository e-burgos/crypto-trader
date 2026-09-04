import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import '../../../lib/i18n';
import type { EntryOrderWire, EntryOrdersPageWire } from '@crypto-trader/shared';
import { AgentRestingEntries } from './agent-resting-entries';

vi.mock('../../../hooks/use-entry-orders', () => ({
  useRestingEntries: vi.fn(),
}));

import { useRestingEntries } from '../../../hooks/use-entry-orders';

const mockedUseRestingEntries = vi.mocked(useRestingEntries);

function makeEntryOrder(overrides: Partial<EntryOrderWire>): EntryOrderWire {
  return {
    id: 'eo-1',
    configId: 'cfg-1',
    symbol: 'BTCUSDT',
    mode: 'SANDBOX',
    entryMode: 'LIMIT_MAKER',
    status: 'RESTING',
    quantity: 0.0012,
    limitPrice: 61250.5,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 62000,
    plannedNotionalUsd: 73.5,
    clientOrderId: 'client-1',
    orderListId: null,
    orderId: null,
    placedAt: '2026-09-03T12:00:00.000Z',
    expiresAt: '2026-09-03T13:00:00.000Z',
    filledLeg: null,
    executedPrice: null,
    executedQuantity: null,
    positionId: null,
    cancelReason: null,
    settledAt: null,
    ...overrides,
  } satisfies EntryOrderWire;
}

function withQueryResult(page: EntryOrdersPageWire | undefined, isLoading: boolean) {
  return {
    data: page,
    isLoading,
  } as unknown as ReturnType<typeof useRestingEntries>;
}

function renderComponent(configId = 'cfg-77') {
  return render(
    <MemoryRouter>
      <AgentRestingEntries configId={configId} />
    </MemoryRouter>,
  );
}

describe('AgentRestingEntries', () => {
  it('shows a loading indicator while the query is pending', () => {
    mockedUseRestingEntries.mockReturnValue(withQueryResult(undefined, true));

    const { container } = renderComponent();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('No active entry')).not.toBeInTheDocument();
  });

  it('shows the empty state without omitting the section when there are no resting entries', () => {
    mockedUseRestingEntries.mockReturnValue(withQueryResult({ items: [], nextCursor: null }, false));

    renderComponent();

    expect(screen.getByText('Current entry on the exchange')).toBeInTheDocument();
    expect(screen.getByText('No active entry')).toBeInTheDocument();
  });

  it('renders levels and the status badge for a LIMIT_MAKER and an OCO entry', () => {
    const limitMaker = makeEntryOrder({
      id: 'eo-limit-maker',
      entryMode: 'LIMIT_MAKER',
      limitPrice: 61250.5,
    });
    const ocoTrailing = makeEntryOrder({
      id: 'eo-oco-trailing',
      entryMode: 'OCO',
      limitPrice: 61250.5,
      stopPrice: 63100,
      stopLimitPrice: 63250,
      trailingDeltaBips: 120,
    });
    mockedUseRestingEntries.mockReturnValue(
      withQueryResult({ items: [limitMaker, ocoTrailing], nextCursor: null }, false),
    );

    renderComponent();

    expect(screen.getAllByText('$61,250.50')).toHaveLength(2);
    expect(screen.getByText('Breakout trails the price (120 bips)')).toBeInTheDocument();
    expect(screen.getAllByText('Resting')).toHaveLength(2);
    expect(screen.getByText('Limit maker')).toBeInTheDocument();
    expect(screen.getByText('OCO')).toBeInTheDocument();
  });

  it('links to the Entries tab filtered by this bot config', () => {
    mockedUseRestingEntries.mockReturnValue(withQueryResult({ items: [], nextCursor: null }, false));

    renderComponent('cfg-77');

    const link = screen.getByText("View all this bot's entries").closest('a');
    expect(link).toHaveAttribute('href', '/dashboard/positions?tab=entries&configId=cfg-77');
  });

  it('never leaks a raw i18n key into the DOM', () => {
    const entry = makeEntryOrder({ id: 'eo-1' });
    mockedUseRestingEntries.mockReturnValue(withQueryResult({ items: [entry], nextCursor: null }, false));

    const { container } = renderComponent();

    expect(container.textContent).not.toMatch(/positions\.entries/);
  });
});
