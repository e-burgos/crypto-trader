import { BinanceWsClient } from './binance-ws.client';
import WebSocket from 'ws';

vi.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    close = vi.fn();
    send = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
    static OPEN = 1;
  }
  return { default: MockWebSocket };
});

describe('BinanceWsClient', () => {
  let client: BinanceWsClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BinanceWsClient({ autoReconnect: false });
  });

  afterEach(() => {
    client.disconnect();
  });

  it('should throw if no subscriptions before connect', () => {
    expect(() => client.connect()).toThrow('No subscriptions set');
  });

  it('should emit connected on ws open', () => {
    return new Promise<void>((resolve) => {
      client.subscribeTicker(['BTCUSDT']);
      client.on('connected', () => {
        resolve();
      });
      client.connect();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');
    });
  });

  it('should parse ticker messages', () => {
    return new Promise<void>((resolve) => {
      client.subscribeTicker(['BTCUSDT']);
      client.on('ticker', (ticker) => {
        expect(ticker.symbol).toBe('BTCUSDT');
        expect(ticker.price).toBe(65000.5);
        resolve();
      });
      client.connect();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      const msg = JSON.stringify({
        stream: 'btcusdt@miniTicker',
        data: {
          s: 'BTCUSDT',
          c: '65000.50',
          v: '1234.56',
          p: '500.00',
          E: 1672531200000,
        },
      });
      ws.emit('message', Buffer.from(msg));
    });
  });

  it('should parse kline messages', () => {
    return new Promise<void>((resolve) => {
      client.subscribeKline('BTCUSDT', '1h');
      client.on('kline', (kline) => {
        expect(kline.symbol).toBe('BTCUSDT');
        expect(kline.close).toBe(65500);
        expect(kline.isClosed).toBe(true);
        resolve();
      });
      client.connect();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      const msg = JSON.stringify({
        stream: 'btcusdt@kline_1h',
        data: {
          k: {
            s: 'BTCUSDT',
            i: '1h',
            t: 1672531200000,
            o: '65000.00',
            h: '65600.00',
            l: '64900.00',
            c: '65500.00',
            v: '500.00',
            T: 1672534799999,
            x: true,
          },
        },
      });
      ws.emit('message', Buffer.from(msg));
    });
  });

  it('should emit disconnected on ws close', () => {
    return new Promise<void>((resolve) => {
      client.subscribeTicker(['BTCUSDT']);
      client.on('disconnected', () => {
        resolve();
      });
      client.connect();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('close');
    });
  });

  it('should handle malformed messages gracefully', () => {
    client.subscribeTicker(['BTCUSDT']);
    client.connect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (client as any).ws;
    // Should not throw
    ws.emit('message', Buffer.from('not json'));
    ws.emit('message', Buffer.from('{}'));
  });

  it('should disconnect and cleanup', () => {
    client.subscribeTicker(['BTCUSDT']);
    client.connect();
    client.disconnect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).ws).toBeNull();
  });

  describe('isConnected', () => {
    it('is false until the socket opens', () => {
      client.subscribeTicker(['BTCUSDT']);
      expect(client.isConnected()).toBe(false);

      client.connect();
      expect(client.isConnected()).toBe(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');
      expect(client.isConnected()).toBe(true);
    });

    it('turns false again once the socket closes', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');
      ws.emit('close');

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('addStreams / removeStreams', () => {
    it('only updates the pending list while disconnected', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.addStreams(['ethusdt@miniTicker']);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).subscriptions).toEqual(['btcusdt@miniTicker', 'ethusdt@miniTicker']);
    });

    it('sends a SUBSCRIBE message and extends the active list once connected', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      client.addStreams(['ethusdt@miniTicker']);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ method: 'SUBSCRIBE', params: ['ethusdt@miniTicker'], id: 1 }),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).subscriptions).toContain('ethusdt@miniTicker');
    });

    it('does not re-send a stream that is already subscribed', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      client.addStreams(['btcusdt@miniTicker']);

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('only updates the pending list when removing streams while disconnected', () => {
      client.subscribeTicker(['BTCUSDT', 'ETHUSDT']);
      client.removeStreams(['ethusdt@miniTicker']);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).subscriptions).toEqual(['btcusdt@miniTicker']);
    });

    it('sends an UNSUBSCRIBE message once connected', () => {
      client.subscribeTicker(['BTCUSDT', 'ETHUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      client.removeStreams(['ethusdt@miniTicker']);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ method: 'UNSUBSCRIBE', params: ['ethusdt@miniTicker'], id: 1 }),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).subscriptions).toEqual(['btcusdt@miniTicker']);
    });

    it('ignores a stream that was never subscribed', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      client.removeStreams(['ethusdt@miniTicker']);

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat events', () => {
    it('emits heartbeat when the server sends a ping frame', () => {
      return new Promise<void>((resolve) => {
        client.subscribeTicker(['BTCUSDT']);
        client.on('heartbeat', (event) => {
          expect(event.at).toBeGreaterThan(0);
          resolve();
        });
        client.connect();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ws = (client as any).ws;
        ws.emit('open');
        ws.emit('ping');
      });
    });

    it('emits heartbeat when the server acknowledges our ping with a pong', () => {
      return new Promise<void>((resolve) => {
        client.subscribeTicker(['BTCUSDT']);
        client.on('heartbeat', (event) => {
          expect(event.at).toBeGreaterThan(0);
          resolve();
        });
        client.connect();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ws = (client as any).ws;
        ws.emit('open');
        ws.emit('pong');
      });
    });
  });

  describe('own ping and pong timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('pings the socket every wsPingIntervalMs once connected', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      vi.advanceTimersByTime(30_000);

      expect(ws.ping).toHaveBeenCalledTimes(1);
    });

    it('terminates the socket when no pong arrives within wsPongTimeoutMs', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      vi.advanceTimersByTime(30_000);
      vi.advanceTimersByTime(10_000);

      expect(ws.terminate).toHaveBeenCalledTimes(1);
    });

    it('does not terminate the socket when a pong arrives before the timeout', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');

      vi.advanceTimersByTime(30_000);
      ws.emit('pong');
      vi.advanceTimersByTime(10_000);

      expect(ws.terminate).not.toHaveBeenCalled();
    });

    it('stops pinging once disconnected', () => {
      client.subscribeTicker(['BTCUSDT']);
      client.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (client as any).ws;
      ws.emit('open');
      client.disconnect();

      vi.advanceTimersByTime(60_000);

      expect(ws.ping).not.toHaveBeenCalled();
    });

    it('honors a custom wsPingIntervalMs / wsPongTimeoutMs', () => {
      const fastClient = new BinanceWsClient({
        autoReconnect: false,
        wsPingIntervalMs: 5_000,
        wsPongTimeoutMs: 2_000,
      });
      fastClient.subscribeTicker(['BTCUSDT']);
      fastClient.connect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (fastClient as any).ws;
      ws.emit('open');

      vi.advanceTimersByTime(5_000);
      expect(ws.ping).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2_000);
      expect(ws.terminate).toHaveBeenCalledTimes(1);

      fastClient.disconnect();
    });
  });
});
