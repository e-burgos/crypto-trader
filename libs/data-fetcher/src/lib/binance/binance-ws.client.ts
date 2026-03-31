import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface BinanceWsConfig {
  /** Base WebSocket URL (default: wss://stream.binance.com:9443) */
  baseUrl?: string;
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
}

export interface TickerUpdate {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  timestamp: number;
}

export interface KlineUpdate {
  symbol: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  isClosed: boolean;
}

const DEFAULT_WS_URL = 'wss://stream.binance.com:9443';

export class BinanceWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly baseUrl: string;
  private readonly autoReconnect: boolean;
  private readonly reconnectDelay: number;
  private subscriptions: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  constructor(config: BinanceWsConfig = {}) {
    super();
    this.baseUrl = config.baseUrl ?? DEFAULT_WS_URL;
    this.autoReconnect = config.autoReconnect ?? true;
    this.reconnectDelay = config.reconnectDelay ?? 5000;
  }

  /**
   * Subscribe to mini ticker stream for given symbols.
   * Emits 'ticker' events.
   */
  subscribeTicker(symbols: string[]): void {
    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`);
    this.subscribe(streams);
  }

  /**
   * Subscribe to kline/candlestick stream.
   * Emits 'kline' events.
   */
  subscribeKline(symbol: string, interval: string): void {
    this.subscribe([`${symbol.toLowerCase()}@kline_${interval}`]);
  }

  /**
   * Connect to the combined stream endpoint.
   */
  connect(): void {
    if (this.subscriptions.length === 0) {
      throw new Error('No subscriptions set. Call subscribeTicker/subscribeKline first.');
    }

    this.isClosing = false;
    const url = `${this.baseUrl}/stream?streams=${this.subscriptions.join('/')}`;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.emit('connected');
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.on('close', () => {
      this.emit('disconnected');
      if (this.autoReconnect && !this.isClosing) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  /**
   * Gracefully close the WebSocket connection.
   */
  disconnect(): void {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private subscribe(streams: string[]): void {
    this.subscriptions.push(...streams);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.emit('reconnecting');
      this.connect();
    }, this.reconnectDelay);
  }

  private handleMessage(msg: { stream?: string; data?: Record<string, unknown> }): void {
    if (!msg.stream || !msg.data) return;

    if (msg.stream.includes('@miniTicker')) {
      const d = msg.data;
      const ticker: TickerUpdate = {
        symbol: d['s'] as string,
        price: parseFloat(d['c'] as string),
        volume: parseFloat(d['v'] as string),
        change24h: parseFloat(d['p'] as string),
        timestamp: d['E'] as number,
      };
      this.emit('ticker', ticker);
    } else if (msg.stream.includes('@kline_')) {
      const k = msg.data['k'] as Record<string, unknown>;
      const kline: KlineUpdate = {
        symbol: k['s'] as string,
        interval: k['i'] as string,
        openTime: k['t'] as number,
        open: parseFloat(k['o'] as string),
        high: parseFloat(k['h'] as string),
        low: parseFloat(k['l'] as string),
        close: parseFloat(k['c'] as string),
        volume: parseFloat(k['v'] as string),
        closeTime: k['T'] as number,
        isClosed: k['x'] as boolean,
      };
      this.emit('kline', kline);
    }
  }
}
