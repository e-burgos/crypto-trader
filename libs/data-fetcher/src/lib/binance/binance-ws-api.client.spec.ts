import {
  BinanceWsApiClient,
  BinanceWsApiError,
  BINANCE_WS_API_URL,
  BINANCE_WS_API_TESTNET_URL,
} from './binance-ws-api.client';
import type { Ed25519Signer } from './ed25519-signer';

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
function currentWs(client: BinanceWsApiClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).ws;
}

function sentFrames(ws: { send: (data: string) => void }): Array<{
  id: string;
  method: string;
  params: Record<string, string>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ws.send as any).mock.calls.map(([raw]: [string]) => JSON.parse(raw));
}

function respond(
  ws: { emit: (event: string, ...args: unknown[]) => void },
  id: string,
  body: { status: number; result?: unknown; error?: { code: number; msg: string } },
): void {
  ws.emit('message', Buffer.from(JSON.stringify({ id, ...body })));
}

function fakeSigner(signature = 'SIGNATURE-STUB'): Ed25519Signer & {
  sign: ReturnType<typeof vi.fn>;
} {
  return { sign: vi.fn().mockReturnValue(signature) };
}

async function openConnection(client: BinanceWsApiClient): Promise<void> {
  const connectPromise = client.connect();
  currentWs(client).emit('open');
  await connectPromise;
}

describe('BinanceWsApiClient', () => {
  let client: BinanceWsApiClient;

  afterEach(() => {
    client?.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('base URL selection', () => {
    it('defaults to the live URL', () => {
      client = new BinanceWsApiClient();
      expect(client.getBaseUrl()).toBe(BINANCE_WS_API_URL);
    });

    it('uses the testnet URL when testnet is true', () => {
      client = new BinanceWsApiClient({ testnet: true });
      expect(client.getBaseUrl()).toBe(BINANCE_WS_API_TESTNET_URL);
    });

    it('honors an explicit baseUrl override', () => {
      client = new BinanceWsApiClient({ baseUrl: 'wss://custom.example/ws-api/v3' });
      expect(client.getBaseUrl()).toBe('wss://custom.example/ws-api/v3');
    });
  });

  describe('connect', () => {
    it('resolves on the first open and reports isConnected', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const onConnected = vi.fn();
      client.on('connected', onConnected);

      const connectPromise = client.connect();
      expect(client.isConnected()).toBe(false);

      currentWs(client).emit('open');
      await connectPromise;

      expect(client.isConnected()).toBe(true);
      expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ at: expect.any(Number) }));
    });

    it('resolves immediately when already connected, without opening a second socket', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const firstWs = currentWs(client);

      await client.connect();

      expect(currentWs(client)).toBe(firstWs);
    });

    it('rejects if connectTimeoutMs elapses before the socket opens', async () => {
      vi.useFakeTimers();
      client = new BinanceWsApiClient({ autoReconnect: false, connectTimeoutMs: 5_000 });

      const connectPromise = client.connect();
      const assertion = expect(connectPromise).rejects.toThrow(/timed out/);
      await vi.advanceTimersByTimeAsync(5_000);
      await assertion;
    });

    it('emits connected on every reconnection, not only the first', async () => {
      client = new BinanceWsApiClient({ reconnectBaseDelayMs: 100 });
      const connectedEvents: number[] = [];
      client.on('connected', () => connectedEvents.push(Date.now()));

      await openConnection(client);
      expect(connectedEvents).toHaveLength(1);

      currentWs(client).emit('close', 1006);
      currentWs(client).emit('open');
      expect(connectedEvents).toHaveLength(2);
    });
  });

  describe('disconnect', () => {
    it('closes the socket, stops reconnecting and rejects in-flight requests', async () => {
      client = new BinanceWsApiClient({ reconnectBaseDelayMs: 100 });
      await openConnection(client);
      const ws = currentWs(client);

      const pending = client.ping();
      const onReconnecting = vi.fn();
      client.on('reconnecting', onReconnecting);

      client.disconnect();

      await expect(pending).rejects.toThrow(BinanceWsApiError);
      expect(ws.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);

      ws.emit('close', 1000);
      expect(onReconnecting).not.toHaveBeenCalled();
    });

    it('rejects a connect() still pending when disconnect() is called', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const connectPromise = client.connect();

      client.disconnect();

      await expect(connectPromise).rejects.toThrow();
    });
  });

  describe('reconnection with backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('reconnects with a growing exponential delay after the socket closes', () => {
      client = new BinanceWsApiClient({ reconnectBaseDelayMs: 100, reconnectMaxDelayMs: 1_000 });
      const attempts: Array<{ attempt: number; delayMs: number }> = [];
      client.on('reconnecting', (event) => attempts.push(event));

      client.connect().catch(() => undefined);
      currentWs(client).emit('open');

      const firstWs = currentWs(client);
      firstWs.emit('close', 1006);

      expect(attempts).toEqual([{ at: expect.any(Number), attempt: 0, delayMs: 100 }]);

      vi.advanceTimersByTime(100);
      const secondWs = currentWs(client);
      expect(secondWs).not.toBe(firstWs);

      secondWs.emit('close', 1006);

      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toEqual({ at: expect.any(Number), attempt: 1, delayMs: 200 });
    });

    it('resets the attempt counter after a successful reconnect', () => {
      client = new BinanceWsApiClient({ reconnectBaseDelayMs: 100, reconnectMaxDelayMs: 1_000 });
      const attempts: number[] = [];
      client.on('reconnecting', (event) => attempts.push(event.attempt));

      client.connect().catch(() => undefined);
      currentWs(client).emit('open');
      currentWs(client).emit('close', 1006);

      vi.advanceTimersByTime(100);
      currentWs(client).emit('open');
      currentWs(client).emit('close', 1006);

      expect(attempts).toEqual([0, 0]);
    });

    it('emits session-lost with RECONNECT_EXHAUSTED after the configured attempts, and stops reconnecting', () => {
      client = new BinanceWsApiClient({
        reconnectBaseDelayMs: 100,
        reconnectAttemptsBeforeExhaustion: 2,
      });
      const onSessionLost = vi.fn();
      const onReconnecting = vi.fn();
      client.on('session-lost', onSessionLost);
      client.on('reconnecting', onReconnecting);

      client.connect().catch(() => undefined);
      currentWs(client).emit('close', 1006);
      vi.advanceTimersByTime(100);
      currentWs(client).emit('close', 1006);
      expect(onSessionLost).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      currentWs(client).emit('close', 1006);

      expect(onSessionLost).toHaveBeenCalledWith({ at: expect.any(Number), reason: 'RECONNECT_EXHAUSTED' });
      expect(onReconnecting).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(10_000);
      expect(onReconnecting).toHaveBeenCalledTimes(2);
    });
  });

  describe('heartbeat', () => {
    it('pings the socket on the configured interval and terminates it if no pong arrives in time', () => {
      vi.useFakeTimers();
      client = new BinanceWsApiClient({
        autoReconnect: false,
        wsPingIntervalMs: 1_000,
        wsPongTimeoutMs: 500,
      });
      client.connect().catch(() => undefined);
      currentWs(client).emit('open');
      const ws = currentWs(client);

      vi.advanceTimersByTime(1_000);
      expect(ws.ping).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);
      expect(ws.terminate).toHaveBeenCalledTimes(1);
    });

    it('emits heartbeat on pong and clears the termination timer', () => {
      vi.useFakeTimers();
      client = new BinanceWsApiClient({
        autoReconnect: false,
        wsPingIntervalMs: 1_000,
        wsPongTimeoutMs: 500,
      });
      const onHeartbeat = vi.fn();
      client.on('heartbeat', onHeartbeat);
      client.connect().catch(() => undefined);
      currentWs(client).emit('open');
      const ws = currentWs(client);

      vi.advanceTimersByTime(1_000);
      ws.emit('pong');
      vi.advanceTimersByTime(500);

      expect(ws.terminate).not.toHaveBeenCalled();
      expect(onHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ at: expect.any(Number) }));
    });

    it('emits heartbeat on an incoming server ping frame', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const onHeartbeat = vi.fn();
      client.on('heartbeat', onHeartbeat);
      await openConnection(client);

      currentWs(client).emit('ping');

      expect(onHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ at: expect.any(Number) }));
    });
  });

  describe('request/response correlation', () => {
    it('time() resolves the serverTime from a successful response', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      const timePromise = client.time();
      const [frame] = sentFrames(ws);
      expect(frame.method).toBe('time');
      expect(frame.params).toEqual({});

      respond(ws, frame.id, { status: 200, result: { serverTime: 1_788_574_991_966 } });

      await expect(timePromise).resolves.toBe(1_788_574_991_966);
    });

    it('logon() signs apiKey + timestamp corrected by the offset measured via time(), and sends the signature', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      const timePromise = client.time();
      respond(ws, sentFrames(ws)[0].id, { status: 200, result: { serverTime: 1_000_000 + 5_000 } });
      await timePromise;

      const signer = fakeSigner('SIG-XYZ');
      const logonPromise = client.logon({ apiKey: 'API-KEY-1', signer });
      const logonFrame = sentFrames(ws)[1];

      expect(logonFrame.method).toBe('session.logon');
      expect(logonFrame.params['apiKey']).toBe('API-KEY-1');
      expect(logonFrame.params['timestamp']).toBe('1005000');
      expect(logonFrame.params['signature']).toBe('SIG-XYZ');
      expect(signer.sign).toHaveBeenCalledWith({ apiKey: 'API-KEY-1', timestamp: '1005000' });

      respond(ws, logonFrame.id, { status: 200, result: {} });
      await expect(logonPromise).resolves.toBeUndefined();
    });

    it('logout(), subscribeUserDataStream() and unsubscribeUserDataStream() round-trip on status 200', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      const calls: Array<[Promise<void>, string]> = [
        [client.subscribeUserDataStream(), 'userDataStream.subscribe'],
        [client.unsubscribeUserDataStream(), 'userDataStream.unsubscribe'],
        [client.logout(), 'session.logout'],
      ];

      const frames = sentFrames(ws);
      for (const [, method] of calls) {
        expect(frames.some((f) => f.method === method)).toBe(true);
      }
      for (const frame of frames) {
        respond(ws, frame.id, { status: 200, result: {} });
      }
      for (const [promise] of calls) {
        await expect(promise).resolves.toBeUndefined();
      }
    });

    it('rejects with BinanceWsApiError carrying status/code/msg/method when status is not 200', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      const pingPromise = client.ping();
      const frame = sentFrames(ws)[0];
      respond(ws, frame.id, { status: 400, error: { code: -1102, msg: 'Mandatory parameter missing' } });

      await expect(pingPromise).rejects.toMatchObject({
        status: 400,
        code: -1102,
        method: 'ping',
      });
    });

    it('rejects a request that times out and clears its pending entry', async () => {
      vi.useFakeTimers();
      client = new BinanceWsApiClient({ autoReconnect: false, requestTimeoutMs: 2_000 });
      await openConnection(client);

      const pingPromise = client.ping();
      const assertion = expect(pingPromise).rejects.toMatchObject({ status: null, code: null });
      await vi.advanceTimersByTimeAsync(2_000);
      await assertion;

      const ws = currentWs(client);
      const [frame] = sentFrames(ws);
      expect(() => respond(ws, frame.id, { status: 200, result: {} })).not.toThrow();
    });

    it('resolves out-of-order responses to their matching request', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      const pingPromise = client.ping();
      const timePromise = client.time();
      const [pingFrame, timeFrame] = sentFrames(ws);

      respond(ws, timeFrame.id, { status: 200, result: { serverTime: 42 } });
      respond(ws, pingFrame.id, { status: 200, result: {} });

      await expect(timePromise).resolves.toBe(42);
      await expect(pingPromise).resolves.toBeUndefined();
    });

    it('rejects all in-flight requests with WS_API_DISCONNECTED when the socket closes', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      const pingPromise = client.ping();
      ws.emit('close', 1006);

      await expect(pingPromise).rejects.toThrow(BinanceWsApiError);
    });

    it('a response with an unknown id neither throws nor blocks subsequent event routing', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);
      await openConnection(client);
      const ws = currentWs(client);

      expect(() => respond(ws, 'unknown-id-123', { status: 200, result: {} })).not.toThrow();

      ws.emit(
        'message',
        Buffer.from(JSON.stringify({ e: 'executionReport', s: 'BTCUSDT', S: 'BUY', X: 'FILLED' })),
      );

      expect(onReport).toHaveBeenCalledTimes(1);
    });

    it('ignores malformed JSON messages without throwing', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      await openConnection(client);
      const ws = currentWs(client);

      expect(() => ws.emit('message', Buffer.from('not json'))).not.toThrow();
    });

    it('rejects immediately when a request is made while not connected', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });

      await expect(client.ping()).rejects.toThrow(BinanceWsApiError);
    });
  });

  describe('execution-report emission', () => {
    it('emits an identical execution-report for both plausible push envelopes', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const reports: unknown[] = [];
      client.on('execution-report', (report) => reports.push(report));
      await openConnection(client);
      const ws = currentWs(client);

      const rawReport = {
        e: 'executionReport',
        E: 1,
        T: 2,
        s: 'BTCUSDT',
        c: 'entry-1',
        C: '',
        S: 'BUY',
        o: 'LIMIT_MAKER',
        x: 'TRADE',
        X: 'FILLED',
        i: 1,
        g: -1,
        q: '1',
        l: '1',
        z: '1',
        L: '1',
        Z: '1',
        t: -1,
      };

      ws.emit('message', Buffer.from(JSON.stringify({ event: rawReport })));
      ws.emit('message', Buffer.from(JSON.stringify(rawReport)));

      expect(reports).toHaveLength(2);
      expect(reports[0]).toEqual(reports[1]);
      expect(reports[0]).toMatchObject({ symbol: 'BTCUSDT', side: 'BUY', orderStatus: 'FILLED' });
    });

    it('does not emit execution-report for a push event of a different type', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);
      await openConnection(client);
      const ws = currentWs(client);

      ws.emit('message', Buffer.from(JSON.stringify({ e: 'outboundAccountPosition' })));

      expect(onReport).not.toHaveBeenCalled();
    });

    it('never treats a response frame as a push event even if it carried an "e" field', async () => {
      client = new BinanceWsApiClient({ autoReconnect: false });
      const onReport = vi.fn();
      client.on('execution-report', onReport);
      await openConnection(client);
      const ws = currentWs(client);

      const pingPromise = client.ping();
      const frame = sentFrames(ws)[0];
      respond(ws, frame.id, { status: 200, result: { e: 'executionReport' } });

      await pingPromise;
      expect(onReport).not.toHaveBeenCalled();
    });
  });
});
