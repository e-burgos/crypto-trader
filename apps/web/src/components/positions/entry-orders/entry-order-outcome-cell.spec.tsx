import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../lib/i18n';
import { ENTRY_ORDER_CANCEL_REASONS, type EntryOrderCancelReasonWire } from '@crypto-trader/shared';
import { EntryOrderOutcomeCell } from './entry-order-outcome-cell';
import { ENTRY_ORDERS_ALL_CANCEL_REASONS, makeFixtureEntry } from './fixtures';

const EXPECTED_CANCEL_REASON_LABEL: Record<EntryOrderCancelReasonWire, string> = {
  TTL_EXPIRED: 'It expired before it could fill',
  LATER_DECISION: 'The bot dropped it after a later decision',
  DAILY_LOSS_DISCARDED: 'Discarded by the daily loss limit',
  BOT_STOPPED: 'The bot was stopped',
  REPLACED_BY_NEW_ENTRY: 'Replaced by a newer entry',
  PARTIAL_FILL_REMAINDER: 'The unfilled remainder was cancelled',
  ORPHAN_SWEEP: 'Cleaned up: no bot cycle was behind it',
  VANISHED_ON_EXCHANGE: 'Vanished from the exchange without confirmation',
};

function renderCell(entry: Parameters<typeof EntryOrderOutcomeCell>[0]['entry']) {
  return render(
    <MemoryRouter>
      <EntryOrderOutcomeCell entry={entry} />
    </MemoryRouter>,
  );
}

function mustFindEntry(
  predicate: (entry: (typeof ENTRY_ORDERS_ALL_CANCEL_REASONS)[number]) => boolean,
) {
  const found = ENTRY_ORDERS_ALL_CANCEL_REASONS.find(predicate);
  if (!found) throw new Error('no fixture entry matched the predicate');
  return found;
}

describe('EntryOrderOutcomeCell — cancelReason legend', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('shows the legend for %s under a CANCELLED entry', (reason) => {
    const entry = mustFindEntry((e) => e.cancelReason === reason);
    renderCell(entry);

    expect(screen.getByText(EXPECTED_CANCEL_REASON_LABEL[reason])).toBeInTheDocument();
  });

  it('renders no legend when cancelReason is null', () => {
    const entry = mustFindEntry((e) => e.cancelReason === null);
    renderCell(entry);

    for (const label of Object.values(EXPECTED_CANCEL_REASON_LABEL)) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('shows the generic unknown legend for an invented cancelReason', () => {
    const entry = mustFindEntry(
      (e) => e.cancelReason === ('SOMETHING_ELSE' as EntryOrderCancelReasonWire),
    );
    renderCell(entry);

    expect(screen.getByText('Unknown reason')).toBeInTheDocument();
  });

  it('never shows fill details for a CANCELLED entry, even with executedPrice/executedQuantity populated', () => {
    const entry = ENTRY_ORDERS_ALL_CANCEL_REASONS[0];
    renderCell(entry);

    expect(screen.queryByText(/12,345/)).not.toBeInTheDocument();
    expect(screen.queryByText('Filled on the support leg')).not.toBeInTheDocument();
  });
});

describe('EntryOrderOutcomeCell — per status', () => {
  it('RESTING shows the absolute expiry date', () => {
    const entry = makeFixtureEntry({ status: 'RESTING', expiresAt: '2026-09-05T10:00:00.000Z' });
    renderCell(entry);

    expect(screen.getByText(/Expires on/)).toBeInTheDocument();
  });

  it('FILLED with a positionId renders a link to the open position', () => {
    const entry = makeFixtureEntry({
      status: 'FILLED',
      filledLeg: 'LIMIT',
      executedPrice: 100,
      executedQuantity: 1,
      positionId: 'pos_42',
    });
    renderCell(entry);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard/positions?tab=open&positionId=pos_42');
  });

  it('FILLED with no positionId renders no link', () => {
    const entry = makeFixtureEntry({
      status: 'FILLED',
      filledLeg: 'STOP',
      executedPrice: 100,
      executedQuantity: 1,
      positionId: null,
    });
    renderCell(entry);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('CANCELLED shows the absolute settlement date', () => {
    const entry = makeFixtureEntry({ status: 'CANCELLED', settledAt: '2026-09-06T00:00:00.000Z' });
    renderCell(entry);

    expect(screen.getByText(/Cancelled on/)).toBeInTheDocument();
  });

  it('EXPIRED falls back to expiresAt when settledAt is null', () => {
    const entry = makeFixtureEntry({
      status: 'EXPIRED',
      settledAt: null,
      expiresAt: '2026-09-07T00:00:00.000Z',
    });
    renderCell(entry);

    expect(screen.getByText(/Expired on/)).toBeInTheDocument();
  });

  it('MISSING shows the attention copy', () => {
    const entry = makeFixtureEntry({ status: 'MISSING' });
    renderCell(entry);

    expect(screen.getByText('The backend cannot confirm it on the exchange')).toBeInTheDocument();
  });

  it('an unknown status renders no primary line and no error', () => {
    const entry = makeFixtureEntry({ status: 'PENDING_REVIEW' as never });
    expect(() => renderCell(entry)).not.toThrow();
  });
});
