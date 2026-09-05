import { EventEmitter } from 'node:events';
import {
  BinanceWsApiError,
  type Ed25519Signer,
  type ExecutionReportEvent,
} from '@crypto-trader/data-fetcher';

export const USER_STREAM_WS_API_FACTORY = Symbol('USER_STREAM_WS_API_FACTORY');

export interface UserStreamWsApiEvents {
  connected: (payload: { at: number }) => void;
  disconnected: (payload: { at: number; code: number | null }) => void;
  reconnecting: (payload: { at: number; attempt: number; delayMs: number }) => void;
  heartbeat: (payload: { at: number }) => void;
  'execution-report': (report: ExecutionReportEvent) => void;
  'session-lost': (payload: { at: number; reason: 'RECONNECT_EXHAUSTED' }) => void;
  error: (err: Error) => void;
}

export interface UserStreamWsApiClient {
  on<E extends keyof UserStreamWsApiEvents>(e: E, l: UserStreamWsApiEvents[E]): unknown;
  off<E extends keyof UserStreamWsApiEvents>(e: E, l: UserStreamWsApiEvents[E]): unknown;
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;
  time(): Promise<number>;
  ping(): Promise<void>;
  logon(auth: { apiKey: string; signer: Ed25519Signer }): Promise<void>;
  logout(): Promise<void>;
  subscribeUserDataStream(): Promise<void>;
  unsubscribeUserDataStream(): Promise<void>;
}

export type UserStreamWsApiFactory = (opts: { testnet: boolean }) => UserStreamWsApiClient;

const DEFAULT_EXECUTION_REPORT: ExecutionReportEvent = {
  eventTimeMs: 0,
  transactionTimeMs: 0,
  symbol: 'BTCUSDT',
  clientOrderId: 'fake-client-order-id',
  originalClientOrderId: null,
  side: 'BUY',
  orderType: 'LIMIT',
  executionType: 'TRADE',
  orderStatus: 'FILLED',
  orderId: 'fake-order-id',
  orderListId: null,
  orderQuantity: 1,
  lastExecutedQuantity: 1,
  cumulativeFilledQuantity: 1,
  lastExecutedPrice: 100,
  cumulativeQuoteQuantity: 100,
  tradeId: 'fake-trade-id',
};

interface PendingRejection {
  status: number;
  code: number;
  msg: string;
}

export class FakeUserStreamWsApiClient extends EventEmitter implements UserStreamWsApiClient {
  connectCallCount = 0;
  disconnectCallCount = 0;
  timeCallCount = 0;
  pingCallCount = 0;
  logonCallCount = 0;
  logoutCallCount = 0;
  subscribeUserDataStreamCallCount = 0;
  unsubscribeUserDataStreamCallCount = 0;
  readonly logonApiKeys: string[] = [];

  private connectedState = false;
  private readonly baseUrl: string;
  private readonly fakeServerTimeMs: number;
  private pendingLogonFailure: PendingRejection | null = null;
  private pendingSubscribeFailure: PendingRejection | null = null;

  constructor(options?: { baseUrl?: string; serverTimeMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? 'wss://fake-user-stream-ws-api.invalid/ws-api/v3';
    this.fakeServerTimeMs = options?.serverTimeMs ?? Date.now();
  }

  async connect(): Promise<void> {
    this.connectCallCount += 1;
    this.connectedState = true;
  }

  disconnect(): void {
    this.disconnectCallCount += 1;
    this.connectedState = false;
  }

  isConnected(): boolean {
    return this.connectedState;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async time(): Promise<number> {
    this.timeCallCount += 1;
    return this.fakeServerTimeMs;
  }

  async ping(): Promise<void> {
    this.pingCallCount += 1;
  }

  async logon(auth: { apiKey: string; signer: Ed25519Signer }): Promise<void> {
    this.logonCallCount += 1;
    this.logonApiKeys.push(auth.apiKey);
    auth.signer.sign({ apiKey: auth.apiKey, timestamp: String(this.fakeServerTimeMs) });

    const failure = this.pendingLogonFailure;
    if (failure) {
      this.pendingLogonFailure = null;
      throw new BinanceWsApiError(failure.status, failure.code, failure.msg, 'session.logon');
    }
  }

  async logout(): Promise<void> {
    this.logoutCallCount += 1;
  }

  async subscribeUserDataStream(): Promise<void> {
    this.subscribeUserDataStreamCallCount += 1;

    const failure = this.pendingSubscribeFailure;
    if (failure) {
      this.pendingSubscribeFailure = null;
      throw new BinanceWsApiError(
        failure.status,
        failure.code,
        failure.msg,
        'userDataStream.subscribe',
      );
    }
  }

  async unsubscribeUserDataStream(): Promise<void> {
    this.unsubscribeUserDataStreamCallCount += 1;
  }

  failNextLogonWith(status: number, code: number, msg = 'rejected by FakeUserStreamWsApiClient'): void {
    this.pendingLogonFailure = { status, code, msg };
  }

  failNextSubscribeWith(
    status: number,
    code: number,
    msg = 'rejected by FakeUserStreamWsApiClient',
  ): void {
    this.pendingSubscribeFailure = { status, code, msg };
  }

  emitConnected(): void {
    this.connectedState = true;
    this.emit('connected', { at: Date.now() });
  }

  emitExecutionReport(partial?: Partial<ExecutionReportEvent>): void {
    this.emit('execution-report', { ...DEFAULT_EXECUTION_REPORT, ...partial });
  }

  emitClose(code: number | null = null): void {
    this.connectedState = false;
    this.emit('disconnected', { at: Date.now(), code });
  }

  emitHeartbeat(): void {
    this.emit('heartbeat', { at: Date.now() });
  }

  emitSessionLost(): void {
    this.emit('session-lost', { at: Date.now(), reason: 'RECONNECT_EXHAUSTED' });
  }

  emitError(err: Error): void {
    this.emit('error', err);
  }
}
