import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../../lib/i18n';
import { ENTRY_ORDER_STATUSES, type EntryOrderStatusWire } from '@crypto-trader/shared';
import { EntryOrderStatusBadge } from './entry-order-status-badge';

const EXPECTED_LABEL: Record<EntryOrderStatusWire, string> = {
  RESTING: 'Resting',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  MISSING: 'Missing',
};

const EXPECTED_VARIANT_CLASS: Record<EntryOrderStatusWire, string> = {
  RESTING: 'bg-sky-500/10',
  FILLED: 'bg-emerald-500/10',
  CANCELLED: 'bg-muted',
  EXPIRED: 'bg-amber-500/10',
  MISSING: 'bg-red-500/10',
};

describe('EntryOrderStatusBadge', () => {
  it.each(ENTRY_ORDER_STATUSES)('renders the label and variant for %s', (status) => {
    render(<EntryOrderStatusBadge status={status} />);

    const badge = screen.getByText(EXPECTED_LABEL[status]);
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveClass(EXPECTED_VARIANT_CLASS[status]);
  });

  it('renders the neutral badge with the neutral label for an unknown status', () => {
    render(<EntryOrderStatusBadge status={'PENDING_REVIEW' as EntryOrderStatusWire} />);

    const badge = screen.getByText('Unknown');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveClass('bg-muted');
    expect(screen.queryByText('PENDING_REVIEW')).not.toBeInTheDocument();
  });

  it('never renders the raw wire status string in the DOM', () => {
    for (const status of ENTRY_ORDER_STATUSES) {
      const { unmount } = render(<EntryOrderStatusBadge status={status} />);
      expect(screen.queryByText(status)).not.toBeInTheDocument();
      unmount();
    }
  });
});
