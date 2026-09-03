import type { EntryOrderLeg, EntryOrderMode } from './interfaces';
import type { AssertNoKeyDrift, ExactKeys, TradingModeWire } from './trading-config-wire';

export type EntryOrderStatusWire =
  | 'RESTING'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'MISSING';

export type EntryOrderCancelReasonWire =
  | 'TTL_EXPIRED'
  | 'LATER_DECISION'
  | 'DAILY_LOSS_DISCARDED'
  | 'BOT_STOPPED'
  | 'REPLACED_BY_NEW_ENTRY'
  | 'PARTIAL_FILL_REMAINDER'
  | 'ORPHAN_SWEEP'
  | 'VANISHED_ON_EXCHANGE';

export interface EntryOrderWire {
  id: string;
  configId: string;
  symbol: string;
  mode: TradingModeWire;
  entryMode: EntryOrderMode;
  status: EntryOrderStatusWire;
  quantity: number;
  limitPrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  referencePrice: number;
  plannedNotionalUsd: number;
  clientOrderId: string;
  orderListId: string | null;
  orderId: string | null;
  placedAt: string;
  expiresAt: string;
  filledLeg: EntryOrderLeg | null;
  executedPrice: number | null;
  executedQuantity: number | null;
  positionId: string | null;
  cancelReason: EntryOrderCancelReasonWire | null;
  settledAt: string | null;
}

export interface EntryOrdersPageWire {
  items: EntryOrderWire[];
  nextCursor: string | null;
}

export interface ListEntryOrdersQuery {
  configId?: string;
  status?: EntryOrderStatusWire;
  since?: string;
  limit?: number;
  cursor?: string;
}

export const ENTRY_ORDER_STATUSES = [
  'RESTING', 'FILLED', 'CANCELLED', 'EXPIRED', 'MISSING',
] as const satisfies readonly EntryOrderStatusWire[];

export const ENTRY_ORDER_CANCEL_REASONS = [
  'TTL_EXPIRED', 'LATER_DECISION', 'DAILY_LOSS_DISCARDED', 'BOT_STOPPED',
  'REPLACED_BY_NEW_ENTRY', 'PARTIAL_FILL_REMAINDER', 'ORPHAN_SWEEP', 'VANISHED_ON_EXCHANGE',
] as const satisfies readonly EntryOrderCancelReasonWire[];

export const ENTRY_ORDER_WIRE_FIELDS = [
  'id', 'configId', 'symbol', 'mode', 'entryMode', 'status', 'quantity', 'limitPrice',
  'stopPrice', 'stopLimitPrice', 'trailingDeltaBips', 'referencePrice', 'plannedNotionalUsd',
  'clientOrderId', 'orderListId', 'orderId', 'placedAt', 'expiresAt', 'filledLeg',
  'executedPrice', 'executedQuantity', 'positionId', 'cancelReason', 'settledAt',
] as const;

export const ENTRY_ORDER_WS_EVENTS = [
  'entry-order:placed',
  'entry-order:filled',
  'entry-order:skipped',
  'entry-order:missing',
  'entry-order:expired',
  'entry-order:cancelled',
] as const;

export type EntryOrderWireField = (typeof ENTRY_ORDER_WIRE_FIELDS)[number];
export type EntryOrderWsEvent = (typeof ENTRY_ORDER_WS_EVENTS)[number];

export type _EntryOrderWireFieldsAreExhaustive = AssertNoKeyDrift<
  ExactKeys<EntryOrderWire, Record<EntryOrderWireField, unknown>>
>;
export type _EntryOrderStatusesAreExhaustive = AssertNoKeyDrift<
  ExactKeys<Record<EntryOrderStatusWire, true>, Record<(typeof ENTRY_ORDER_STATUSES)[number], true>>
>;
export type _EntryOrderCancelReasonsAreExhaustive = AssertNoKeyDrift<
  ExactKeys<Record<EntryOrderCancelReasonWire, true>, Record<(typeof ENTRY_ORDER_CANCEL_REASONS)[number], true>>
>;
