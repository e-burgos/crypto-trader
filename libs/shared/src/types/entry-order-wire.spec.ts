import {
  ENTRY_ORDER_CANCEL_REASONS,
  ENTRY_ORDER_STATUSES,
  ENTRY_ORDER_WIRE_FIELDS,
  ENTRY_ORDER_WS_EVENTS,
  type EntryOrderWire,
} from './entry-order-wire';

const SAMPLE_ENTRY_ORDER: EntryOrderWire = {
  id: 'entry-1',
  configId: 'config-1',
  symbol: 'BTCUSDT',
  mode: 'TESTNET',
  entryMode: 'OCO',
  status: 'RESTING',
  quantity: 0.01,
  limitPrice: 60000,
  stopPrice: 59000,
  stopLimitPrice: 58900,
  trailingDeltaBips: null,
  referencePrice: 60100,
  plannedNotionalUsd: 600,
  clientOrderId: 'client-1',
  orderListId: 'order-list-1',
  orderId: null,
  placedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  filledLeg: null,
  executedPrice: null,
  executedQuantity: null,
  positionId: null,
  cancelReason: null,
  settledAt: null,
};

describe('EntryOrder wire field list', () => {
  it('has exactly 24 entries', () => {
    expect(ENTRY_ORDER_WIRE_FIELDS.length).toBe(24);
  });

  it('has no duplicate fields', () => {
    expect(new Set(ENTRY_ORDER_WIRE_FIELDS).size).toBe(ENTRY_ORDER_WIRE_FIELDS.length);
  });

  it('is set-equal to the keys of an EntryOrderWire', () => {
    const actualKeys = Object.keys(SAMPLE_ENTRY_ORDER).sort();
    const declaredFields = [...ENTRY_ORDER_WIRE_FIELDS].sort();
    expect(actualKeys).toEqual(declaredFields);
  });
});

describe('EntryOrder status and cancel reason lists', () => {
  it('has exactly 5 statuses', () => {
    expect(ENTRY_ORDER_STATUSES.length).toBe(5);
  });

  it('has exactly 8 cancel reasons', () => {
    expect(ENTRY_ORDER_CANCEL_REASONS.length).toBe(8);
  });
});

describe('EntryOrder websocket events', () => {
  it('has exactly 6 events', () => {
    expect(ENTRY_ORDER_WS_EVENTS.length).toBe(6);
  });

  it('all events start with "entry-order:"', () => {
    for (const event of ENTRY_ORDER_WS_EVENTS) {
      expect(event.startsWith('entry-order:')).toBe(true);
    }
  });
});
