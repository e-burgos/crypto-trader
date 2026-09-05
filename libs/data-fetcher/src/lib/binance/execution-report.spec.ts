import { extractUserDataEvent, parseExecutionReport } from './execution-report';

describe('parseExecutionReport', () => {
  it('parses a plain executionReport message', () => {
    const report = parseExecutionReport({
      e: 'executionReport',
      E: 1_700_000_000_000,
      T: 1_700_000_000_050,
      s: 'BTCUSDT',
      c: 'entry-client-id',
      C: 'orig-client-id',
      S: 'BUY',
      o: 'LIMIT_MAKER',
      x: 'TRADE',
      X: 'FILLED',
      i: 987654321,
      g: 555,
      q: '0.00100000',
      l: '0.00100000',
      z: '0.00100000',
      L: '65000.50',
      Z: '65.00050000',
      t: 111222,
    });

    expect(report).toEqual({
      eventTimeMs: 1_700_000_000_000,
      transactionTimeMs: 1_700_000_000_050,
      symbol: 'BTCUSDT',
      clientOrderId: 'entry-client-id',
      originalClientOrderId: 'orig-client-id',
      side: 'BUY',
      orderType: 'LIMIT_MAKER',
      executionType: 'TRADE',
      orderStatus: 'FILLED',
      orderId: '987654321',
      orderListId: '555',
      orderQuantity: 0.001,
      lastExecutedQuantity: 0.001,
      cumulativeFilledQuantity: 0.001,
      lastExecutedPrice: 65000.5,
      cumulativeQuoteQuantity: 65.0005,
      tradeId: '111222',
    });
  });

  it('maps sentinel values (-1 orderListId/tradeId, empty originalClientOrderId) to null', () => {
    const report = parseExecutionReport({
      e: 'executionReport',
      E: 1,
      T: 2,
      s: 'ETHUSDT',
      c: 'plain-client-id',
      C: '',
      S: 'SELL',
      o: 'STOP_LOSS_LIMIT',
      x: 'NEW',
      X: 'NEW',
      i: 42,
      g: -1,
      q: '1.00000000',
      l: '0.00000000',
      z: '0.00000000',
      L: '0.00000000',
      Z: '0.00000000',
      t: -1,
    });

    expect(report.originalClientOrderId).toBeNull();
    expect(report.orderListId).toBeNull();
    expect(report.tradeId).toBeNull();
    expect(report.side).toBe('SELL');
  });

  it('defaults side to BUY when S is anything other than SELL', () => {
    const report = parseExecutionReport({ S: undefined });

    expect(report.side).toBe('BUY');
  });
});

describe('extractUserDataEvent', () => {
  it('extracts the nested event from envelope A ({ event: { e, ... } })', () => {
    const frame = { event: { e: 'executionReport', c: 'abc' } };

    expect(extractUserDataEvent(frame)).toEqual({ e: 'executionReport', c: 'abc' });
  });

  it('extracts the bare payload from envelope B ({ e, ... })', () => {
    const frame = { e: 'executionReport', c: 'abc' };

    expect(extractUserDataEvent(frame)).toEqual({ e: 'executionReport', c: 'abc' });
  });

  it('extracts a non-executionReport user event as-is (caller decides to ignore it)', () => {
    const frame = { event: { e: 'outboundAccountPosition' } };

    expect(extractUserDataEvent(frame)).toEqual({ e: 'outboundAccountPosition' });
  });

  it('returns null for a WebSocket API response frame (id/status/result, no e anywhere)', () => {
    const frame = { id: 'req-1', status: 200, result: {} };

    expect(extractUserDataEvent(frame)).toBeNull();
  });

  it('returns null when frame.event is present but not an object', () => {
    expect(extractUserDataEvent({ event: 'executionReport' })).toBeNull();
  });

  it.each([{}, null, [], 'texto'])('returns null for %p', (frame) => {
    expect(extractUserDataEvent(frame)).toBeNull();
  });
});
