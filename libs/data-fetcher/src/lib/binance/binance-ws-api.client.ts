import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type { Ed25519Signer } from './ed25519-signer';
import { extractUserDataEvent, parseExecutionReport } from './execution-report';
import type { ExecutionReportEvent } from './execution-report';

export const BINANCE_WS_API_URL = 'wss://ws-api.binance.com/ws-api/v3';
export const BINANCE_WS_API_TESTNET_URL = 'wss://ws-api.testnet.binance.vision/ws-api/v3';

const DEFAULT_RECONNECT_BASE_DELAY_MS = 1_000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_WS_PING_INTERVAL_MS = 30_000;
const DEFAULT_WS_PONG_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const RECONNECT_JITTER_RATIO = 0.2;

export interface BinanceWsApiConfig {
  testnet?: boolean;
  baseUrl?: string;
  autoReconnect?: boolean;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectAttemptsBeforeExhaustion?: number;
  wsPingIntervalMs?: number;
  wsPongTimeoutMs?: number;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export interface WsApiConnectedEvent {
  at: number;
}

export interface WsApiDisconnectedEvent {
  at: number;
  code: number | null;
}

export interface WsApiReconnectingEvent {
  at: number;
  attempt: number;
  delayMs: number;
}

export interface WsApiHeartbeatEvent {
  at: number;
}

export type WsApiSessionLostReason = 'RECONNECT_EXHAUSTED';

export interface WsApiSessionLostEvent {
  at: number;
  reason: WsApiSessionLostReason;
}

export class BinanceWsApiError extends Error {
  readonly status: number | null;
  readonly code: number | null;
  readonly method: string;

  constructor(status: number | null, code: number | null, msg: string, method: string) {
    super(`Binance WebSocket API request '${method}' failed: status=${status} code=${code} msg=${msg}`);
    this.name = 'BinanceWsApiError';
    this.status = status;
    this.code = code;
    this.method = method;
  }
}

type WsApiMethod =
  | 'ping'
  | 'time'
  | 'session.logon'
  | 'session.logout'
  | 'userDataStream.subscribe'
  | 'userDataStream.unsubscribe';

interface WsApiRequestFrame {
  id: string;
  method: WsApiMethod;
  params: Record<string, string>;
}

interface WsApiResponseFrame {
  id?: string;
  status?: number;
  result?: unknown;
  error?: { code: number; msg: string };
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: WsApiMethod;
}

interface PendingConnect {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function applyReconnectJitter(ms: number): number {
  const delta = ms * RECONNECT_JITTER_RATIO;
  return ms - delta + Math.random() * delta * 2;
}

function randomInstancePrefix(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class BinanceWsApiClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly baseUrl: string;
  private readonly autoReconnect: boolean;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly reconnectAttemptsBeforeExhaustion?: number;
  private readonly wsPingIntervalMs: number;
  private readonly wsPongTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly instancePrefix: string;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private connectedFlag = false;
  private isClosing = false;
  private pendingConnect: PendingConnect | null = null;
  private serverTimeOffsetMs = 0;
  private unroutedMessageCount = 0;

  constructor(config: BinanceWsApiConfig = {}) {
    super();
    this.baseUrl =
      config.baseUrl ?? (config.testnet ? BINANCE_WS_API_TESTNET_URL : BINANCE_WS_API_URL);
    this.autoReconnect = config.autoReconnect ?? true;
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS;
    this.reconnectMaxDelayMs = config.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS;
    this.reconnectAttemptsBeforeExhaustion = config.reconnectAttemptsBeforeExhaustion;
    this.wsPingIntervalMs = config.wsPingIntervalMs ?? DEFAULT_WS_PING_INTERVAL_MS;
    this.wsPongTimeoutMs = config.wsPongTimeoutMs ?? DEFAULT_WS_PONG_TIMEOUT_MS;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.connectTimeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.instancePrefix = randomInstancePrefix();
  }

  connect(): Promise<void> {
    if (this.connectedFlag) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.isClosing = false;
      const timer = setTimeout(() => {
        this.pendingConnect = null;
        reject(
          new Error(`Connection to ${this.baseUrl} timed out after ${this.connectTimeoutMs}ms`),
        );
      }, this.connectTimeoutMs);
      this.pendingConnect = { resolve, reject, timer };
      this.openSocket();
    });
  }

  disconnect(): void {
    this.isClosing = true;
    this.connectedFlag = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.rejectAllPending('WS_API_DISCONNECTED');
    this.rejectPendingConnect(new Error('disconnect() called'));
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

  async time(): Promise<number> {
    const result = await this.request('time', {});
    const serverTime = isRecord(result) ? result['serverTime'] : undefined;
    if (typeof serverTime !== 'number') {
      throw new BinanceWsApiError(null, null, "'time' response is missing serverTime", 'time');
    }
    this.serverTimeOffsetMs = serverTime - Date.now();
    return serverTime;
  }

  async ping(): Promise<void> {
    await this.request('ping', {});
  }

  async logon(auth: { apiKey: string; signer: Ed25519Signer }): Promise<void> {
    const timestamp = String(Date.now() + this.serverTimeOffsetMs);
    const signature = auth.signer.sign({ apiKey: auth.apiKey, timestamp });
    await this.request('session.logon', { apiKey: auth.apiKey, timestamp, signature });
  }

  async logout(): Promise<void> {
    await this.request('session.logout', {});
  }

  async subscribeUserDataStream(): Promise<void> {
    await this.request('userDataStream.subscribe', {});
  }

  async unsubscribeUserDataStream(): Promise<void> {
    await this.request('userDataStream.unsubscribe', {});
  }

  private request(method: WsApiMethod, params: Record<string, string>): Promise<unknown> {
    if (!this.ws || !this.connectedFlag) {
      return Promise.reject(new BinanceWsApiError(null, null, 'WS_API_NOT_CONNECTED', method));
    }

    const id = `${this.instancePrefix}-${this.requestCounter++}`;
    const ws = this.ws;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new BinanceWsApiError(null, null, `request '${method}' timed out`, method));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer, method });

      const frame: WsApiRequestFrame = { id, method, params };
      ws.send(JSON.stringify(frame));
    });
  }

  private openSocket(): void {
    this.ws = new WebSocket(this.baseUrl);

    this.ws.on('open', () => {
      this.connectedFlag = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.resolvePendingConnect();
      this.emit('connected', { at: Date.now() } satisfies WsApiConnectedEvent);
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      this.handleMessage(raw);
    });

    this.ws.on('ping', () => {
      this.emit('heartbeat', { at: Date.now() } satisfies WsApiHeartbeatEvent);
    });

    this.ws.on('pong', () => {
      this.clearPongTimeout();
      this.emit('heartbeat', { at: Date.now() } satisfies WsApiHeartbeatEvent);
    });

    this.ws.on('close', (code: number) => {
      this.connectedFlag = false;
      this.stopHeartbeat();
      this.rejectAllPending('WS_API_DISCONNECTED');
      this.emit('disconnected', { at: Date.now(), code } satisfies WsApiDisconnectedEvent);

      if (this.autoReconnect && !this.isClosing) {
        if (this.reconnectAttemptsExhausted()) {
          this.isClosing = true;
          this.emit('session-lost', {
            at: Date.now(),
            reason: 'RECONNECT_EXHAUSTED',
          } satisfies WsApiSessionLostEvent);
          this.rejectPendingConnect(new Error('reconnect attempts exhausted'));
          return;
        }
        this.scheduleReconnect();
        return;
      }

      this.rejectPendingConnect(new Error(`socket closed before 'open' (code=${code})`));
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  private handleMessage(raw: WebSocket.RawData): void {
    let frame: unknown;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      this.unroutedMessageCount += 1;
      return;
    }

    const responseId = this.matchPendingResponseId(frame);
    if (responseId !== null) {
      this.settleResponse(responseId, frame as WsApiResponseFrame);
      return;
    }

    const rawEvent = extractUserDataEvent(frame);
    if (rawEvent && rawEvent.e === 'executionReport') {
      this.emit('execution-report', parseExecutionReport(rawEvent) satisfies ExecutionReportEvent);
      return;
    }

    this.unroutedMessageCount += 1;
  }

  private matchPendingResponseId(frame: unknown): string | null {
    if (!isRecord(frame)) return null;
    const id = frame['id'];
    return typeof id === 'string' && this.pendingRequests.has(id) ? id : null;
  }

  private settleResponse(id: string, response: WsApiResponseFrame): void {
    const pending = this.pendingRequests.get(id);
    if (!pending) return;
    this.pendingRequests.delete(id);
    clearTimeout(pending.timer);

    if (response.status === 200) {
      pending.resolve(response.result);
      return;
    }

    pending.reject(
      new BinanceWsApiError(
        response.status ?? null,
        response.error?.code ?? null,
        response.error?.msg ?? 'unknown error',
        pending.method,
      ),
    );
  }

  private rejectAllPending(reasonMsg: string): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new BinanceWsApiError(null, null, reasonMsg, pending.method));
    }
    this.pendingRequests.clear();
  }

  private resolvePendingConnect(): void {
    if (!this.pendingConnect) return;
    clearTimeout(this.pendingConnect.timer);
    const { resolve } = this.pendingConnect;
    this.pendingConnect = null;
    resolve();
  }

  private rejectPendingConnect(err: Error): void {
    if (!this.pendingConnect) return;
    clearTimeout(this.pendingConnect.timer);
    const { reject } = this.pendingConnect;
    this.pendingConnect = null;
    reject(err);
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
    const rawDelay = Math.min(this.reconnectBaseDelayMs * 2 ** attempt, this.reconnectMaxDelayMs);
    const delayMs = applyReconnectJitter(rawDelay);
    this.emit('reconnecting', {
      at: Date.now(),
      attempt,
      delayMs,
    } satisfies WsApiReconnectingEvent);
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
