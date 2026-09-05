import {
  BinanceUserDataStreamClient,
  BINANCE_USER_STREAM_WS_URL,
  BINANCE_TESTNET_USER_STREAM_WS_URL,
} from './binance-user-data-stream.client';

vi.mock('ws', () => {
  const { EventEmitter } = require('events');
  class MockWebSocket extends EventEmitter {
    url: string;
    close = vi.fn();
    send = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
    constructor(url: string) {
      super();
      this.url = url;
    }
  }
  return { default: MockWebSocket };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function currentWs(client: BinanceUserDataStreamClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).ws;
}

describe('BinanceUserDataStreamClient', () => {
  let client: BinanceUserDataStreamClient;

  afterEach(() => {
    client?.disconnect();
    vi.restoreAllMocks();
  });

  describe('base URL selection', () => {
    it('defaults to the live URL', () => {
      client = new BinanceUserDataStreamClient();
      expect(client.getBaseUrl()).toBe(BINANCE_USER_STREAM_WS_URL);
    });

    it('uses the testnet URL when testnet is true', () => {
      client = new BinanceUserDataStreamClient({ testnet: true });
      expect(client.getBaseUrl()).toBe(BINANCE_TESTNET_USER_STREAM_WS_URL);
    });

    it('honors an explicit baseUrl override', () => {
      client = new BinanceUserDataStreamClient({ baseUrl: 'wss://custom.example' });
      expect(client.getBaseUrl()).toBe('wss://custom.example');
    });
  });

  describe('connect', () => {
    it('opens the single-stream endpoint with the listenKey as part of the URL', () => {
      client = new BinanceUserDataStreamClient({ testnet: true, autoReconnect: false });
      client.connect('lk-abc-123');

      expect(currentWs(client).url).toBe(`${BINANCE_TESTNET_USER_STREAM_WS_URL}/ws/lk-abc-123`);
    });

    it('emits connected on ws open and reports isConnected', () => {
      client = new BinanceUserDataStreamClient({ autoReconnect: false });
      const onConnected = vi.fn();
      client.on('connected', onConnected);

      client.connect('lk-1');
      expect(client.isConnected()).toBe(false);

      currentWs(client).emit('open');

      expect(client.isConnected()).toBe(true);
      expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ at: expect.any(Number) }));
    });
  });

  describe('reconnection with backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reconnects with a growing exponential delay after the socket closes', () => {
      client = new BinanceUserDataStreamClient({
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 1_000,
      });
      const attempts: Array<{ attempt: number; delayMs: number }> = [];
      client.on('reconnecting', (event) => attempts.push(event));

      client.connect('lk-1');
      currentWs(client).emit('open');

      const firstWs = currentWs(client);
      firstWs.emit('close', 1006);

      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toEqual({ at: expect.any(Number), attempt: 0, delayMs: 100 });

      vi.advanceTimersByTime(100);
      const secondWs = currentWs(client);
      expect(secondWs).not.toBe(firstWs);

      secondWs.emit('close', 1006);

      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toEqual({ at: expect.any(Number), attempt: 1, delayMs: 200 });
    });

    it('resets the attempt counter after a successful reconnect', () => {
      client = new BinanceUserDataStreamClient({
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 1_000,
      });
      const attempts: Array<{ attempt: number; delayMs: number }> = [];
      client.on('reconnecting', (event) => attempts.push(event));

      client.connect('lk-1');
      currentWs(client).emit('open');
      currentWs(client).emit('close', 1006);

      vi.advanceTimersByTime(100);
      currentWs(client).emit('open');
      currentWs(client).emit('close', 1006);

      expect(attempts.map((a) => a.attempt)).toEqual([0, 0]);
    });

    it('does not reconnect once disconnect() was called explicitly', () => {
      client = new BinanceUserDataStreamClient({ reconnectBaseDelayMs: 100 });
      const onReconnecting = vi.fn();
      client.on('reconnecting', onReconnecting);

      client.connect('lk-1');
      currentWs(client).emit('open');
      client.disconnect();

      expect(onReconnecting).not.toHaveBeenCalled();
    });

    it('emits stream-expired with RECONNECT_EXHAUSTED after reconnectAttemptsBeforeExhaustion consecutive failures, and stops reconnecting', () => {
      client = new BinanceUserDataStreamClient({
        reconnectBaseDelayMs: 100,
        reconnectAttemptsBeforeExhaustion: 2,
      });
      const attempts: Array<{ attempt: number }> = [];
      const onExpired = vi.fn();
      client.on('reconnecting', (event) => attempts.push(event));
      client.on('stream-expired', onExpired);

      client.connect('lk-1');
      currentWs(client).emit('close', 1006);
      expect(attempts).toEqual([{ at: expect.any(Number), attempt: 0, delayMs: 100 }]);

      vi.advanceTimersByTime(100);
      currentWs(client).emit('close', 1006);
      expect(attempts.map((a) => a.attempt)).toEqual([0, 1]);
      expect(onExpired).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      currentWs(client).emit('close', 1006);

      expect(onExpired).toHaveBeenCalledWith({ at: expect.any(Number), reason: 'RECONNECT_EXHAUSTED' });
      expect(attempts).toHaveLength(2);

      vi.advanceTimersByTime(10_000);
      expect(attempts).toHaveLength(2);
    });

    it('reconnects forever when reconnectAttemptsBeforeExhaustion is left unset (default behaviour)', () => {
      client = new BinanceUserDataStreamClient({ reconnectBaseDelayMs: 100 });
      const onExpired = vi.fn();
      const attempts: number[] = [];
      client.on('stream-expired', onExpired);
      client.on('reconnecting', (event) => attempts.push(event.attempt));

      client.connect('lk-1');
      for (let i = 0; i < 5; i += 1) {
        currentWs(client).emit('close', 1006);
        vi.advanceTimersByTime(30_000);
      }

      expect(attempts).toEqual([0, 1, 2, 3, 4]);
      expect(onExpired).not.toHaveBeenCalled();
    });
  });

  describe('session invalidation vs generic disconnect', () => {
    it('emits stream-expired with LISTEN_KEY_EXPIRED on the exchange listenKeyExpired message, and suppresses auto-reconnect afterwards', () => {
      client = new BinanceUserDataStreamClient({ reconnectBaseDelayMs: 50 });
      const onExpired = vi.fn();
      const onReconnecting = vi.fn();
      client.on('stream-expired', onExpired);
      client.on('reconnecting', onReconnecting);

      client.connect('lk-1');
      currentWs(client).emit('open');
      currentWs(client).emit(
        'message',
        Buffer.from(JSON.stringify({ e: 'listenKeyExpired', E: 1_700_000_000_000 })),
      );

      expect(onExpired).toHaveBeenCalledWith({ at: expect.any(Number), reason: 'LISTEN_KEY_EXPIRED' });

      currentWs(client).emit('close', 1006);

      expect(onReconnecting).not.toHaveBeenCalled();
    });

    it('emits a plain disconnected event (no stream-expired) on a generic socket close', () => {
      client = new BinanceUserDataStreamClient({ autoReconnect: false });
      const onExpired = vi.fn();
      const onDisconnected = vi.fn();
      client.on('stream-expired', onExpired);
      client.on('disconnected', onDisconnected);

      client.connect('lk-1');
      currentWs(client).emit('open');
      currentWs(client).emit('close', 1006);

      expect(onDisconnected).toHaveBeenCalledWith({ at: expect.any(Number), code: 1006 });
      expect(onExpired).not.toHaveBeenCalled();
    });
  });

  describe('execution-report parsing', () => {
    it('parses a plain executionReport message', () => {
      client = new BinanceUserDataStreamClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);

      client.connect('lk-1');
      currentWs(client).emit('open');
      currentWs(client).emit(
        'message',
        Buffer.from(
          JSON.stringify({
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
          }),
        ),
      );

      expect(onReport).toHaveBeenCalledWith({
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
      client = new BinanceUserDataStreamClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);

      client.connect('lk-1');
      currentWs(client).emit('open');
      currentWs(client).emit(
        'message',
        Buffer.from(
          JSON.stringify({
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
          }),
        ),
      );

      const report = onReport.mock.calls[0][0];
      expect(report.originalClientOrderId).toBeNull();
      expect(report.orderListId).toBeNull();
      expect(report.tradeId).toBeNull();
      expect(report.side).toBe('SELL');
    });

    it('ignores malformed and unrelated messages without throwing', () => {
      client = new BinanceUserDataStreamClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);

      client.connect('lk-1');
      currentWs(client).emit('open');

      expect(() => currentWs(client).emit('message', Buffer.from('not json'))).not.toThrow();
      expect(() =>
        currentWs(client).emit('message', Buffer.from(JSON.stringify({ e: 'outboundAccountPosition' }))),
      ).not.toThrow();
      expect(onReport).not.toHaveBeenCalled();
    });
  });
});
