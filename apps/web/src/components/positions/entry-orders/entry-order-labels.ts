import type {
  EntryOrderCancelReasonWire,
  EntryOrderLeg,
  EntryOrderMode,
  EntryOrderStatusWire,
} from '@crypto-trader/shared';
import { ENTRY_ORDER_CANCEL_REASONS, ENTRY_ORDER_STATUSES } from '@crypto-trader/shared';
import type { BadgeVariant } from '@crypto-trader/ui';

export type ResolvedEntryOrderStatus = EntryOrderStatusWire | 'unknown';
export type ResolvedEntryOrderCancelReason = EntryOrderCancelReasonWire | 'unknown';
export type ResolvedEntryOrderMode = Exclude<EntryOrderMode, 'MARKET'> | 'unknown';
export type ResolvedFilledLeg = EntryOrderLeg | null;

export function resolveEntryOrderStatus(value: string): ResolvedEntryOrderStatus {
  return (ENTRY_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as EntryOrderStatusWire)
    : 'unknown';
}

export function resolveEntryOrderCancelReason(
  value: string | null,
): ResolvedEntryOrderCancelReason | null {
  if (value === null) return null;
  return (ENTRY_ORDER_CANCEL_REASONS as readonly string[]).includes(value)
    ? (value as EntryOrderCancelReasonWire)
    : 'unknown';
}

const KNOWN_ENTRY_MODES = ['LIMIT_MAKER', 'OCO'] as const satisfies readonly Exclude<
  EntryOrderMode,
  'MARKET'
>[];

export function resolveEntryOrderMode(value: string): ResolvedEntryOrderMode {
  return (KNOWN_ENTRY_MODES as readonly string[]).includes(value)
    ? (value as ResolvedEntryOrderMode)
    : 'unknown';
}

const KNOWN_FILLED_LEGS = ['LIMIT', 'STOP'] as const satisfies readonly EntryOrderLeg[];

export function resolveFilledLeg(value: string | null): ResolvedFilledLeg {
  if (value === null) return null;
  return (KNOWN_FILLED_LEGS as readonly string[]).includes(value)
    ? (value as EntryOrderLeg)
    : null;
}

export const ENTRY_ORDER_STATUS_BADGE_VARIANT: Record<EntryOrderStatusWire, BadgeVariant> = {
  RESTING: 'info',
  FILLED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'warning',
  MISSING: 'error',
};

export function entryOrderStatusBadgeVariant(status: ResolvedEntryOrderStatus): BadgeVariant {
  return status === 'unknown' ? 'neutral' : ENTRY_ORDER_STATUS_BADGE_VARIANT[status];
}

export function entryOrderStatusLabelKey(status: ResolvedEntryOrderStatus): string {
  return `positions.entries.status.${status}`;
}

export const ENTRY_ORDER_CANCEL_REASON_LABEL_KEY: Record<EntryOrderCancelReasonWire, string> = {
  TTL_EXPIRED: 'positions.entries.cancelReason.TTL_EXPIRED',
  LATER_DECISION: 'positions.entries.cancelReason.LATER_DECISION',
  DAILY_LOSS_DISCARDED: 'positions.entries.cancelReason.DAILY_LOSS_DISCARDED',
  BOT_STOPPED: 'positions.entries.cancelReason.BOT_STOPPED',
  REPLACED_BY_NEW_ENTRY: 'positions.entries.cancelReason.REPLACED_BY_NEW_ENTRY',
  PARTIAL_FILL_REMAINDER: 'positions.entries.cancelReason.PARTIAL_FILL_REMAINDER',
  ORPHAN_SWEEP: 'positions.entries.cancelReason.ORPHAN_SWEEP',
  VANISHED_ON_EXCHANGE: 'positions.entries.cancelReason.VANISHED_ON_EXCHANGE',
};

export function entryOrderCancelReasonLabelKey(reason: ResolvedEntryOrderCancelReason): string {
  return reason === 'unknown'
    ? 'positions.entries.cancelReason.unknown'
    : ENTRY_ORDER_CANCEL_REASON_LABEL_KEY[reason];
}

export function entryOrderModeLabelKey(mode: ResolvedEntryOrderMode): string {
  return `positions.entries.entryMode.${mode}`;
}

export function filledLegLabelKey(leg: ResolvedFilledLeg): string | null {
  if (leg === 'LIMIT') return 'positions.entries.fill.legLimit';
  if (leg === 'STOP') return 'positions.entries.fill.legStop';
  return null;
}
