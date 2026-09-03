import { describe, expect, it } from 'vitest';
import {
  ENTRY_ORDER_CANCEL_REASONS,
  ENTRY_ORDER_STATUSES,
  type EntryOrderCancelReasonWire,
  type EntryOrderStatusWire,
} from '@crypto-trader/shared';
import {
  ENTRY_ORDER_CANCEL_REASON_LABEL_KEY,
  ENTRY_ORDER_STATUS_BADGE_VARIANT,
  entryOrderCancelReasonLabelKey,
  entryOrderModeLabelKey,
  entryOrderStatusBadgeVariant,
  entryOrderStatusLabelKey,
  filledLegLabelKey,
  resolveEntryOrderCancelReason,
  resolveEntryOrderMode,
  resolveEntryOrderStatus,
  resolveFilledLeg,
} from './entry-order-labels';

function sorted<T>(values: readonly T[]): T[] {
  return [...values].sort();
}

describe('entry-order-labels — exhaustiveness twins', () => {
  it('ENTRY_ORDER_STATUS_BADGE_VARIANT covers exactly ENTRY_ORDER_STATUSES', () => {
    expect(sorted(Object.keys(ENTRY_ORDER_STATUS_BADGE_VARIANT))).toEqual(
      sorted(ENTRY_ORDER_STATUSES as readonly string[]),
    );
  });

  it('ENTRY_ORDER_CANCEL_REASON_LABEL_KEY covers exactly ENTRY_ORDER_CANCEL_REASONS', () => {
    expect(sorted(Object.keys(ENTRY_ORDER_CANCEL_REASON_LABEL_KEY))).toEqual(
      sorted(ENTRY_ORDER_CANCEL_REASONS as readonly string[]),
    );
  });
});

describe('resolveEntryOrderStatus', () => {
  it.each(ENTRY_ORDER_STATUSES)('resolves the known status %s to itself', (status) => {
    expect(resolveEntryOrderStatus(status)).toBe(status);
  });

  it('degrades an unknown status to "unknown"', () => {
    expect(resolveEntryOrderStatus('PENDING_REVIEW')).toBe('unknown');
  });
});

describe('entryOrderStatusBadgeVariant / entryOrderStatusLabelKey', () => {
  it.each(ENTRY_ORDER_STATUSES)('gives %s its own badge variant and key', (status) => {
    const resolved = resolveEntryOrderStatus(status);
    expect(entryOrderStatusBadgeVariant(resolved)).toBe(ENTRY_ORDER_STATUS_BADGE_VARIANT[status]);
    expect(entryOrderStatusLabelKey(resolved)).toBe(`positions.entries.status.${status}`);
  });

  it('degrades unknown to the neutral variant and the unknown key', () => {
    const resolved = resolveEntryOrderStatus('PENDING_REVIEW');
    expect(entryOrderStatusBadgeVariant(resolved)).toBe('neutral');
    expect(entryOrderStatusLabelKey(resolved)).toBe('positions.entries.status.unknown');
  });
});

describe('resolveEntryOrderCancelReason', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('resolves the known reason %s to itself', (reason) => {
    expect(resolveEntryOrderCancelReason(reason)).toBe(reason);
  });

  it('resolves null to null (no legend to render)', () => {
    expect(resolveEntryOrderCancelReason(null)).toBeNull();
  });

  it('degrades an unknown reason to "unknown"', () => {
    expect(resolveEntryOrderCancelReason('SOMETHING_ELSE')).toBe('unknown');
  });
});

describe('entryOrderCancelReasonLabelKey', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('gives %s its own key', (reason) => {
    const resolved = resolveEntryOrderCancelReason(reason) as EntryOrderCancelReasonWire;
    expect(entryOrderCancelReasonLabelKey(resolved)).toBe(`positions.entries.cancelReason.${reason}`);
  });

  it('degrades unknown to the neutral generic key', () => {
    const resolved = resolveEntryOrderCancelReason('SOMETHING_ELSE');
    expect(entryOrderCancelReasonLabelKey(resolved as EntryOrderStatusWire | 'unknown')).toBe(
      'positions.entries.cancelReason.unknown',
    );
  });
});

describe('resolveEntryOrderMode / entryOrderModeLabelKey', () => {
  it('resolves LIMIT_MAKER and OCO to themselves', () => {
    expect(resolveEntryOrderMode('LIMIT_MAKER')).toBe('LIMIT_MAKER');
    expect(resolveEntryOrderMode('OCO')).toBe('OCO');
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('LIMIT_MAKER'))).toBe(
      'positions.entries.entryMode.LIMIT_MAKER',
    );
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('OCO'))).toBe(
      'positions.entries.entryMode.OCO',
    );
  });

  it('degrades MARKET to unknown (H5: MARKET should never reach a row)', () => {
    expect(resolveEntryOrderMode('MARKET')).toBe('unknown');
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('MARKET'))).toBe(
      'positions.entries.entryMode.unknown',
    );
  });

  it('degrades any other value to unknown', () => {
    expect(resolveEntryOrderMode('SOMETHING_ELSE')).toBe('unknown');
  });
});

describe('resolveFilledLeg / filledLegLabelKey', () => {
  it('resolves LIMIT and STOP to themselves with their own key', () => {
    expect(resolveFilledLeg('LIMIT')).toBe('LIMIT');
    expect(filledLegLabelKey(resolveFilledLeg('LIMIT'))).toBe('positions.entries.fill.legLimit');
    expect(resolveFilledLeg('STOP')).toBe('STOP');
    expect(filledLegLabelKey(resolveFilledLeg('STOP'))).toBe('positions.entries.fill.legStop');
  });

  it('resolves null to null with no label key', () => {
    expect(resolveFilledLeg(null)).toBeNull();
    expect(filledLegLabelKey(resolveFilledLeg(null))).toBeNull();
  });

  it('degrades an unknown value to null with no label key', () => {
    expect(resolveFilledLeg('SOMETHING_ELSE')).toBeNull();
    expect(filledLegLabelKey(resolveFilledLeg('SOMETHING_ELSE'))).toBeNull();
  });
});
