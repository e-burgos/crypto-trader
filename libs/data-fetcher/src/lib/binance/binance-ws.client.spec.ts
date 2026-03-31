import { BinanceWsClient } from './binance-ws.client';
import WebSocket from 'ws';

vi.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    close = vi.fn();
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
});
