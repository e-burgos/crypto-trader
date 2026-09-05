import { EventEmitter } from 'events';
import WebSocket from 'ws';

export const BINANCE_USER_STREAM_WS_URL = 'wss://stream.binance.com:9443';
export const BINANCE_TESTNET_USER_STREAM_WS_URL = 'wss://stream.testnet.binance.vision';

const DEFAULT_RECONNECT_BASE_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_WS_PING_INTERVAL_MS = 30_000;
const DEFAULT_WS_PONG_TIMEOUT_MS = 10_000;
const RECONNECT_JITTER_RATIO = 0.2;

export interface BinanceUserDataStreamConfig {
  testnet?: boolean;
  baseUrl?: string;
  autoReconnect?: boolean;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  wsPingIntervalMs?: number;
  wsPongTimeoutMs?: number;
  reconnectAttemptsBeforeExhaustion?: number;
}

export interface StreamConnectedEvent {
  at: number;
}

export interface StreamDisconnectedEvent {
  at: number;
  code: number | null;
}

export interface StreamReconnectingEvent {
  at: number;
  attempt: number;
  delayMs: number;
}

export interface StreamHeartbeatEvent {
  at: number;
}

export type StreamExpiredReason = 'LISTEN_KEY_EXPIRED' | 'RECONNECT_EXHAUSTED';

export interface StreamExpiredEvent {
  at: number;
  reason: StreamExpiredReason;
}

export interface ExecutionReportEvent {
  eventTimeMs: number;
  transactionTimeMs: number;
  symbol: string;
  clientOrderId: string;
  originalClientOrderId: string | null;
  side: 'BUY' | 'SELL';
  orderType: string;
  executionType: string;
  orderStatus: string;
  orderId: string;
  orderListId: string | null;
  orderQuantity: number;
  lastExecutedQuantity: number;
  cumulativeFilledQuantity: number;
  lastExecutedPrice: number;
  cumulativeQuoteQuantity: number;
  tradeId: string | null;
}

interface RawUserDataStreamMessage {
  e?: string;
  E?: number;
  T?: number;
  s?: string;
  c?: string;
  C?: string;
  S?: string;
  o?: string;
  x?: string;
  X?: string;
  i?: number;
  g?: number;
  q?: string;
  l?: string;
  z?: string;
  L?: string;
  Z?: string;
  t?: number;
}

function parseExecutionReport(raw: RawUserDataStreamMessage): ExecutionReportEvent {
  return {
    eventTimeMs: raw.E ?? 0,
    transactionTimeMs: raw.T ?? 0,
    symbol: raw.s ?? '',
    clientOrderId: raw.c ?? '',
    originalClientOrderId: raw.C && raw.C !== '' ? raw.C : null,
    side: raw.S === 'SELL' ? 'SELL' : 'BUY',
    orderType: raw.o ?? '',
    executionType: raw.x ?? '',
    orderStatus: raw.X ?? '',
    orderId: String(raw.i ?? ''),
    orderListId: raw.g !== undefined && raw.g !== -1 ? String(raw.g) : null,
    orderQuantity: parseFloat(raw.q ?? '0'),
    lastExecutedQuantity: parseFloat(raw.l ?? '0'),
    cumulativeFilledQuantity: parseFloat(raw.z ?? '0'),
    lastExecutedPrice: parseFloat(raw.L ?? '0'),
    cumulativeQuoteQuantity: parseFloat(raw.Z ?? '0'),
    tradeId: raw.t !== undefined && raw.t !== -1 ? String(raw.t) : null,
  };
}

function applyReconnectJitter(ms: number): number {
  const delta = ms * RECONNECT_JITTER_RATIO;
  return ms - delta + Math.random() * delta * 2;
}

export class BinanceUserDataStreamClient extends EventEmitter {
  #listenKey: string | null = null;
  private ws: WebSocket | null = null;
  private readonly baseUrl: string;
  private readonly autoReconnect: boolean;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly wsPingIntervalMs: number;
  private readonly wsPongTimeoutMs: number;
  private readonly reconnectAttemptsBeforeExhaustion?: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private connectedFlag = false;
  private isClosing = false;

  constructor(config: BinanceUserDataStreamConfig = {}) {
    super();
    this.baseUrl =
      config.baseUrl ??
      (config.testnet ? BINANCE_TESTNET_USER_STREAM_WS_URL : BINANCE_USER_STREAM_WS_URL);
    this.autoReconnect = config.autoReconnect ?? true;
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS;
    this.reconnectMaxDelayMs = config.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS;
    this.wsPingIntervalMs = config.wsPingIntervalMs ?? DEFAULT_WS_PING_INTERVAL_MS;
    this.wsPongTimeoutMs = config.wsPongTimeoutMs ?? DEFAULT_WS_PONG_TIMEOUT_MS;
    this.reconnectAttemptsBeforeExhaustion = config.reconnectAttemptsBeforeExhaustion;
  }

  connect(listenKey: string): void {
    this.isClosing = false;
    this.#listenKey = listenKey;
    this.openSocket();
  }

  disconnect(): void {
    this.isClosing = true;
    this.connectedFlag = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.connectedFlag;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private openSocket(): void {
    const listenKey = this.#listenKey;
    if (!listenKey) return;

    this.ws = new WebSocket(`${this.baseUrl}/ws/${listenKey}`);

    this.ws.on('open', () => {
      this.connectedFlag = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected', { at: Date.now() } satisfies StreamConnectedEvent);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as RawUserDataStreamMessage;
        this.handleMessage(msg);
      } catch {
        return;
      }
    });

    this.ws.on('ping', () => {
      this.emit('heartbeat', { at: Date.now() } satisfies StreamHeartbeatEvent);
    });

    this.ws.on('pong', () => {
      this.clearPongTimeout();
      this.emit('heartbeat', { at: Date.now() } satisfies StreamHeartbeatEvent);
    });

    this.ws.on('close', (code: number) => {
      this.connectedFlag = false;
      this.stopHeartbeat();
      this.emit('disconnected', { at: Date.now(), code } satisfies StreamDisconnectedEvent);
      if (this.autoReconnect && !this.isClosing) {
        if (this.reconnectAttemptsExhausted()) {
          this.isClosing = true;
          this.emit('stream-expired', {
            at: Date.now(),
            reason: 'RECONNECT_EXHAUSTED',
          } satisfies StreamExpiredEvent);
          return;
        }
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  private handleMessage(msg: RawUserDataStreamMessage): void {
    if (msg.e === 'executionReport') {
      this.emit('execution-report', parseExecutionReport(msg));
      return;
    }
    if (msg.e === 'listenKeyExpired') {
      this.isClosing = true;
      this.emit('stream-expired', {
        at: Date.now(),
        reason: 'LISTEN_KEY_EXPIRED',
      } satisfies StreamExpiredEvent);
    }
  }

  private reconnectAttemptsExhausted(): boolean {
    return (
      this.reconnectAttemptsBeforeExhaustion !== undefined &&
      this.reconnectAttempts >= this.reconnectAttemptsBeforeExhaustion
    );
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const attempt = this.reconnectAttempts;
    this.reconnectAttempts += 1;
    const rawDelay = Math.min(
      this.reconnectBaseDelayMs * 2 ** attempt,
      this.reconnectMaxDelayMs,
    );
    const delayMs = applyReconnectJitter(rawDelay);
    this.emit('reconnecting', {
      at: Date.now(),
      attempt,
      delayMs,
    } satisfies StreamReconnectingEvent);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => this.sendOwnPing(), this.wsPingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimeout();
  }

  private sendOwnPing(): void {
    if (!this.ws) return;
    this.ws.ping();
    this.clearPongTimeout();
    this.pongTimeoutTimer = setTimeout(() => {
      this.ws?.terminate();
    }, this.wsPongTimeoutMs);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }
}
