import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../../lib/i18n';
import {
  ENTRY_ORDER_CANCEL_REASONS,
  type EntryOrderCancelReasonWire,
} from '@crypto-trader/shared';
import { EntryOrderCancelReasonLegend } from './entry-order-cancel-reason-legend';

const EXPECTED_LABEL: Record<EntryOrderCancelReasonWire, string> = {
  TTL_EXPIRED: 'It expired before it could fill',
  LATER_DECISION: 'The bot dropped it after a later decision',
  DAILY_LOSS_DISCARDED: 'Discarded by the daily loss limit',
  BOT_STOPPED: 'The bot was stopped',
  REPLACED_BY_NEW_ENTRY: 'Replaced by a newer entry',
  PARTIAL_FILL_REMAINDER: 'The unfilled remainder was cancelled',
  ORPHAN_SWEEP: 'Cleaned up: no bot cycle was behind it',
  VANISHED_ON_EXCHANGE: 'Vanished from the exchange without confirmation',
};

describe('EntryOrderCancelReasonLegend', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('maps %s to its own legend text', (reason) => {
    render(<EntryOrderCancelReasonLegend cancelReason={reason} />);

    expect(screen.getByText(EXPECTED_LABEL[reason])).toBeInTheDocument();
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });

  it('renders nothing for a null cancelReason', () => {
    const { container } = render(<EntryOrderCancelReasonLegend cancelReason={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the neutral generic legend for an unknown cancelReason', () => {
    render(
      <EntryOrderCancelReasonLegend
        cancelReason={'SOMETHING_ELSE' as EntryOrderCancelReasonWire}
      />,
    );

    expect(screen.getByText('Unknown reason')).toBeInTheDocument();
    expect(screen.queryByText('SOMETHING_ELSE')).not.toBeInTheDocument();
  });
});
