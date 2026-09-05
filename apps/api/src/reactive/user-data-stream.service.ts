import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type {
  EntryOrderExchangeStatus,
  StreamHealthState,
  UserDataStreamHealthRecord,
} from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import { getBinanceErrorCode, BinanceRestClient } from '@crypto-trader/data-fetcher';
import type { ExecutionReportEvent } from '@crypto-trader/data-fetcher';
import { LiveOrderExecutor, type OrderExecutorPort } from '@crypto-trader/trading-engine';
import {
  resolveUserDataStreamHealth,
  type UserDataStreamHealthReason,
} from '@crypto-trader/analysis';
import type { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import {
  normalizeEntryClientOrderId,
  type EntryOrderService,
  type RestingEntryOrder,
  type SettleFillOutcome,
} from '../trading/entry-order.service';
import type { FastPathService } from './fast-path.service';
import { toEntryFillStatus } from './execution-report-fill';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { ReactiveRuntimeThresholds } from './reactive-runtime-thresholds';

export const USER_STREAM_REST_FACTORY = Symbol('USER_STREAM_REST_FACTORY');
export const USER_STREAM_WS_FACTORY = Symbol('USER_STREAM_WS_FACTORY');

const OWNER_KEY_PREFIX = 'rx:v1:uds:owner:';
const HEALTH_KEY_PREFIX = 'rx:v1:uds:health:';

export const USER_STREAM_COORDINATION_UNAVAILABLE =
  'user data stream coordination unavailable: Redis not reachable; the tick probe and reconciliation remain the only fill detectors';

export type CredentialEnv = 'live' | 'testnet';

export function userStreamOwnerLeaseKey(userId: string, env: CredentialEnv): string {
  return `${OWNER_KEY_PREFIX}${userId}:${env}`;
}

export function userStreamHealthKey(userId: string, env: CredentialEnv): string {
  return `${HEALTH_KEY_PREFIX}${userId}:${env}`;
}

export function credentialKeyOf(userId: string, env: CredentialEnv): string {
  return `${userId}:${env}`;
}

function envOf(mode: TradingMode): CredentialEnv {
  return mode === TradingMode.TESTNET ? 'testnet' : 'live';
}

function seenEventIdentity(report: ExecutionReportEvent): string {
  return `${report.symbol}:${report.orderId}:${report.orderStatus}:${report.cumulativeFilledQuantity}`;
}

export interface UserStreamRestClient {
  createListenKey(): Promise<string>;
  keepAliveListenKey(listenKey: string): Promise<void>;
  closeListenKey(listenKey: string): Promise<void>;
  getBaseUrl(): string;
}

export interface UserStreamWsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener: (...args: any[]) => void): unknown;
  connect(listenKey: string): void;
  disconnect(): void;
  isConnected(): boolean;
  getBaseUrl(): string;
}

export type UserStreamRestFactory = (creds: {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}) => UserStreamRestClient;

export type UserStreamWsFactory = (opts: { testnet: boolean }) => UserStreamWsClient;

export type CredentialReleaseReason =
  | 'INACTIVE'
  | 'LEASE_LOST'
  | 'COORDINATION_UNHEALTHY'
  | 'SHUTDOWN';

interface ActiveCredential {
  userId: string;
  env: CredentialEnv;
}

interface OwnedCredentialListeners {
  heartbeat: (payload: { at: number }) => void;
  connected: () => void;
  reconnecting: () => void;
  executionReport: (report: ExecutionReportEvent) => void;
  streamExpired: (payload: { reason: string }) => void;
}

interface OwnedCredentialStream {
  userId: string;
  env: CredentialEnv;
  listenKey: string;
  ws: UserStreamWsClient;
  rest: UserStreamRestClient;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastKeepaliveAtMs: number;
  lastEventAtMs: number | null;
  keepaliveTimer: ReturnType<typeof setInterval> | null;
  reconnectAttempts: number;
  listeners?: OwnedCredentialListeners;
}

interface CredentialsCacheEntry {
  apiKey: string;
  apiSecret: string;
  fetchedAt: number;
}

interface ConfigCacheEntry {
  config: any;
  fetchedAt: number;
}

interface ExecutorCacheEntry {
  executor: OrderExecutorPort;
  fetchedAt: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function restErrorSummary(err: unknown): string {
  return `code=${getBinanceErrorCode(err)} message=${errorMessage(err)}`;
}

const LISTEN_KEY_MISSING_ERROR_CODE = -1125;

@Injectable()
export class UserDataStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(UserDataStreamService.name);
  private readonly ownedCredentials = new Map<string, OwnedCredentialStream>();
  private readonly credentialsCache = new Map<string, CredentialsCacheEntry>();
  private readonly configCache = new Map<string, ConfigCacheEntry>();
  private readonly executorCache = new Map<string, ExecutorCacheEntry>();
  private readonly seenEvents = new Map<string, number>();
  private readonly lastKnownHealthState = new Map<string, StreamHealthState>();
  private uncorrelatedEventCount = 0;
  private activeCredentials = new Map<string, ActiveCredential>();
  private subscriptionRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private healthPublishTimer: ReturnType<typeof setInterval> | null = null;
  private coordinationUnavailableLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: ReactiveCoordinationPort,
    private readonly entryOrders: EntryOrderService,
    private readonly fastPath: FastPathService,
    private readonly restFactory: UserStreamRestFactory,
    private readonly wsFactory: UserStreamWsFactory,
    private readonly thresholds: ReactiveRuntimeThresholds,
    private readonly instanceId: string,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshActiveCredentials();
    await this.runOwnershipCycle();

    this.subscriptionRefreshTimer = setInterval(() => {
      this.refreshActiveCredentials().catch((err) =>
        this.logger.error(`Failed to refresh active user data stream credentials: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamSubscriptionRefreshIntervalMs);

    this.sweepTimer = setInterval(() => {
      this.runOwnershipCycle().catch((err) =>
        this.logger.error(`User data stream ownership cycle failed: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamSweepIntervalMs);

    await this.publishHealth();
    this.healthPublishTimer = setInterval(() => {
      this.publishHealth().catch((err) =>
        this.logger.error(`Failed to publish user data stream health: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamHealthPublishIntervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.subscriptionRefreshTimer) clearInterval(this.subscriptionRefreshTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.healthPublishTimer) clearInterval(this.healthPublishTimer);
    this.subscriptionRefreshTimer = null;
    this.sweepTimer = null;
    this.healthPublishTimer = null;

    const owned = [...this.ownedCredentials.keys()];
    await Promise.all(owned.map((key) => this.releaseCredential(key, 'SHUTDOWN')));
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  isOwner(userId: string, env: CredentialEnv): boolean {
    return this.ownedCredentials.has(credentialKeyOf(userId, env));
  }

  getOwnedCredentialKeys(): string[] {
    return [...this.ownedCredentials.keys()];
  }

  async refreshActiveCredentials(): Promise<void> {
    const [runningConfigs, restingOrders] = await Promise.all([
      this.prisma.tradingConfig.findMany({
        where: {
          isRunning: true,
          mode: { in: [TradingMode.LIVE, TradingMode.TESTNET] },
          entryOrderMode: { not: 'MARKET' },
        },
        select: { userId: true, mode: true },
      }),
      this.prisma.entryOrder.findMany({
        where: { status: 'RESTING' },
        select: { userId: true, mode: true },
      }),
    ]);

    const next = new Map<string, ActiveCredential>();
    for (const row of [
      ...(runningConfigs as Array<{ userId: string; mode: TradingMode }>),
      ...(restingOrders as Array<{ userId: string; mode: TradingMode }>),
    ]) {
      if (row.mode === TradingMode.SANDBOX) continue;
      const env = envOf(row.mode);
      next.set(credentialKeyOf(row.userId, env), { userId: row.userId, env });
    }

    const noLongerActive = [...this.activeCredentials.keys()].filter((key) => !next.has(key));
    this.activeCredentials = next;

    await Promise.all(
      noLongerActive
        .filter((key) => this.ownedCredentials.has(key))
        .map((key) => this.releaseCredential(key, 'INACTIVE')),
    );
  }

  async runOwnershipCycle(): Promise<void> {
    if (!this.coordination.isHealthy()) {
      this.reportCoordinationUnavailable();
      await this.releaseAllOwned('COORDINATION_UNHEALTHY');
      return;
    }
    this.coordinationUnavailableLogged = false;

    await this.renewOwnedLeases();
    await this.acquireActiveCredentials();
  }

  private reportCoordinationUnavailable(): void {
    if (this.coordinationUnavailableLogged) return;
    if (this.coordination.isEnabled?.() === false) return;
    this.coordinationUnavailableLogged = true;
    this.logger.error(USER_STREAM_COORDINATION_UNAVAILABLE);
  }

  private async renewOwnedLeases(): Promise<void> {
    for (const key of [...this.ownedCredentials.keys()]) {
      const state = this.ownedCredentials.get(key);
      if (!state) continue;
      const renewed = await this.coordination.renew(
        userStreamOwnerLeaseKey(state.userId, state.env),
        this.instanceId,
        this.thresholds.userStreamOwnerLeaseTtlMs,
      );
      if (!renewed) this.handleLeaseLost(key);
    }
  }

  private async acquireActiveCredentials(): Promise<void> {
    for (const [key, active] of this.activeCredentials) {
      if (this.ownedCredentials.has(key)) continue;
      const acquired = await this.coordination.tryAcquire(
        userStreamOwnerLeaseKey(active.userId, active.env),
        this.instanceId,
        this.thresholds.userStreamOwnerLeaseTtlMs,
      );
      if (acquired) await this.negotiateAndConnect(key, active);
    }
  }

  private async releaseAllOwned(reason: CredentialReleaseReason): Promise<void> {
    const owned = [...this.ownedCredentials.keys()];
    await Promise.all(owned.map((key) => this.releaseCredential(key, reason)));
  }

  private async resolveCredentials(
    userId: string,
    isTestnet: boolean,
  ): Promise<{ apiKey: string; apiSecret: string } | null> {
    const now = Date.now();
    const cacheKey = `${userId}:${isTestnet}`;
    const cached = this.credentialsCache.get(cacheKey);
    if (cached && now - cached.fetchedAt < this.thresholds.userStreamSubscriptionRefreshIntervalMs) {
      return { apiKey: cached.apiKey, apiSecret: cached.apiSecret };
    }

    const record = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet } },
    });
    if (!record) return null;

    const apiKey = decrypt(record.apiKeyEncrypted, record.apiKeyIv);
    const apiSecret = decrypt(record.secretEncrypted, record.secretIv);
    this.credentialsCache.set(cacheKey, { apiKey, apiSecret, fetchedAt: now });
    return { apiKey, apiSecret };
  }

  private async releaseLeaseOnly(active: ActiveCredential): Promise<void> {
    try {
      await this.coordination.release(
        userStreamOwnerLeaseKey(active.userId, active.env),
        this.instanceId,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to release the lease for ${credentialKeyOf(active.userId, active.env)}: ${errorMessage(err)}`,
      );
    }
  }

  private async negotiateAndConnect(key: string, active: ActiveCredential): Promise<void> {
    const testnet = active.env === 'testnet';
    const credentials = await this.resolveCredentials(active.userId, testnet);
    if (!credentials) {
      this.logger.warn(`No ${active.env} credentials for user ${active.userId} — releasing the user data stream lease`);
      await this.releaseLeaseOnly(active);
      return;
    }

    const rest = this.restFactory({ apiKey: credentials.apiKey, apiSecret: credentials.apiSecret, testnet });

    let listenKey: string;
    try {
      listenKey = await rest.createListenKey();
    } catch (err) {
      this.logger.warn(`Failed to create the listenKey for ${key}: ${restErrorSummary(err)}`);
      await this.releaseLeaseOnly(active);
      return;
    }

    const ws = this.wsFactory({ testnet });
    const now = Date.now();
    const state: OwnedCredentialStream = {
      userId: active.userId,
      env: active.env,
      listenKey,
      ws,
      rest,
      connectedAt: now,
      lastHeartbeatAtMs: now,
      lastKeepaliveAtMs: now,
      lastEventAtMs: null,
      keepaliveTimer: null,
      reconnectAttempts: 0,
    };

    this.ownedCredentials.set(key, state);
    this.attachWsListeners(key, state);
    ws.connect(listenKey);
    this.startKeepalive(key, state);
    this.logger.log(`Acquired the user data stream lease for ${key}`);
  }

  private attachWsListeners(key: string, state: OwnedCredentialStream): void {
    const heartbeat = (payload: { at: number }) => {
      state.lastHeartbeatAtMs = payload?.at ?? Date.now();
    };
    const connected = () => {
      state.reconnectAttempts = 0;
    };
    const reconnecting = () => {
      state.reconnectAttempts += 1;
    };
    const executionReport = (report: ExecutionReportEvent) => {
      this.handleExecutionReport(state, report);
    };
    const streamExpired = (payload: { reason: string }) => {
      this.handleStreamExpired(key, payload?.reason).catch((err) =>
        this.logger.error(`Renegotiation failed for ${key}: ${errorMessage(err)}`),
      );
    };

    state.ws.on('heartbeat', heartbeat);
    state.ws.on('connected', connected);
    state.ws.on('reconnecting', reconnecting);
    state.ws.on('execution-report', executionReport);
    state.ws.on('stream-expired', streamExpired);

    state.listeners = { heartbeat, connected, reconnecting, executionReport, streamExpired };
  }

  private detachWsListeners(state: OwnedCredentialStream): void {
    if (!state.listeners) return;
    state.ws.off('heartbeat', state.listeners.heartbeat);
    state.ws.off('connected', state.listeners.connected);
    state.ws.off('reconnecting', state.listeners.reconnecting);
    state.ws.off('execution-report', state.listeners.executionReport);
    state.ws.off('stream-expired', state.listeners.streamExpired);
  }

  private handleExecutionReport(state: OwnedCredentialStream, report: ExecutionReportEvent): void {
    const now = Date.now();
    state.lastEventAtMs = now;

    if (this.isSeenEvent(report, now)) return;
    this.recordSeenEvent(report, now);

    const fillStatus = toEntryFillStatus(report);
    if (!fillStatus) return;

    this.settleExecutionReport(state, report, fillStatus).catch((err) =>
      this.logger.error(
        `Failed to settle the execution report for ${credentialKeyOf(state.userId, state.env)}: ${errorMessage(err)}`,
      ),
    );
  }

  private isSeenEvent(report: ExecutionReportEvent, now: number): boolean {
    const identity = seenEventIdentity(report);
    const seenAt = this.seenEvents.get(identity);
    if (seenAt === undefined) return false;
    if (now - seenAt > this.thresholds.userStreamSeenEventTtlMs) {
      this.seenEvents.delete(identity);
      return false;
    }
    return true;
  }

  private recordSeenEvent(report: ExecutionReportEvent, now: number): void {
    this.seenEvents.set(seenEventIdentity(report), now);
    while (this.seenEvents.size > this.thresholds.userStreamSeenEventCacheSize) {
      const oldestIdentity = this.seenEvents.keys().next().value;
      if (oldestIdentity === undefined) break;
      this.seenEvents.delete(oldestIdentity);
    }
  }

  getUncorrelatedEventCount(): number {
    return this.uncorrelatedEventCount;
  }

  private async settleExecutionReport(
    state: OwnedCredentialStream,
    report: ExecutionReportEvent,
    status: EntryOrderExchangeStatus,
  ): Promise<void> {
    const credentialKey = credentialKeyOf(state.userId, state.env);
    const order = await this.correlateRestingOrder(state.userId, report);
    if (!order) {
      this.uncorrelatedEventCount += 1;
      this.logger.debug(
        `Execution report for ${credentialKey} did not correlate with any RESTING entry order (uncorrelated so far: ${this.uncorrelatedEventCount})`,
      );
      return;
    }

    const config = await this.resolveTradingConfig(order.configId);
    if (!config) {
      this.logger.warn(
        `No trading config ${order.configId} for the entry order correlated to an execution report on ${credentialKey} — skipping settle`,
      );
      return;
    }

    const executor = await this.resolveOrderExecutor(state.userId, state.env === 'testnet');
    if (!executor) {
      this.logger.warn(`No ${state.env} credentials for ${credentialKey} — skipping settle`);
      return;
    }

    const outcome: SettleFillOutcome = await this.entryOrders.settleFill({
      userId: state.userId,
      config,
      symbol: report.symbol,
      mode: config.mode,
      executor,
      order,
      status,
    });

    if (outcome === 'SETTLED') {
      this.fastPath.invalidateOpenPositions(order.configId);
    }
  }

  private isAcceptableEntryOrderMatch(
    row: { status: string; symbol: string } | null,
    report: ExecutionReportEvent,
  ): boolean {
    return (
      row !== null &&
      report.side === 'BUY' &&
      row.status === 'RESTING' &&
      row.symbol === report.symbol
    );
  }

  private async correlateRestingOrder(
    userId: string,
    report: ExecutionReportEvent,
  ): Promise<RestingEntryOrder | null> {
    const normalizedClientOrderId = normalizeEntryClientOrderId(report.clientOrderId);
    const byClientOrderId = await this.prisma.entryOrder.findUnique({
      where: { clientOrderId: normalizedClientOrderId },
    });
    if (this.isAcceptableEntryOrderMatch(byClientOrderId, report)) {
      return byClientOrderId as unknown as RestingEntryOrder;
    }

    const byBackupIdentifier = await this.prisma.entryOrder.findFirst({
      where: {
        userId,
        status: 'RESTING',
        symbol: report.symbol,
        OR: [
          { orderId: report.orderId },
          { limitLegOrderId: report.orderId },
          { stopLegOrderId: report.orderId },
          ...(report.orderListId ? [{ orderListId: report.orderListId }] : []),
        ],
      },
    });
    if (this.isAcceptableEntryOrderMatch(byBackupIdentifier, report)) {
      return byBackupIdentifier as unknown as RestingEntryOrder;
    }

    return null;
  }

  private async resolveTradingConfig(configId: string): Promise<any | null> {
    const now = Date.now();
    const cached = this.configCache.get(configId);
    if (cached && now - cached.fetchedAt < this.thresholds.userStreamSubscriptionRefreshIntervalMs) {
      return cached.config;
    }

    const config = await this.prisma.tradingConfig.findUnique({ where: { id: configId } });
    if (!config) return null;

    this.configCache.set(configId, { config, fetchedAt: now });
    return config;
  }

  private async resolveOrderExecutor(
    userId: string,
    isTestnet: boolean,
  ): Promise<OrderExecutorPort | null> {
    const now = Date.now();
    const cacheKey = `${userId}:${isTestnet}`;
    const cached = this.executorCache.get(cacheKey);
    if (cached && now - cached.fetchedAt < this.thresholds.userStreamSubscriptionRefreshIntervalMs) {
      return cached.executor;
    }

    const credentials = await this.resolveCredentials(userId, isTestnet);
    if (!credentials) return null;

    const executor = new LiveOrderExecutor(
      new BinanceRestClient({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        testnet: isTestnet,
      }),
    );
    this.executorCache.set(cacheKey, { executor, fetchedAt: now });
    return executor;
  }

  getHealth(
    userId: string,
    env: CredentialEnv,
  ): { state: StreamHealthState; reason: UserDataStreamHealthReason } {
    const owned = this.ownedCredentials.get(credentialKeyOf(userId, env));
    const record = owned ? this.healthRecordFor(owned) : null;
    return this.resolveHealthRecord(record);
  }

  private resolveHealthRecord(
    record: UserDataStreamHealthRecord | null,
  ): { state: StreamHealthState; reason: UserDataStreamHealthReason } {
    return resolveUserDataStreamHealth({
      now: Date.now(),
      record,
      thresholds: {
        heartbeatMaxAgeMs: this.thresholds.userStreamHeartbeatMaxAgeMs,
        keepaliveMaxAgeMs: this.thresholds.userStreamKeepaliveMaxAgeMs,
      },
    });
  }

  private healthRecordFor(state: OwnedCredentialStream): UserDataStreamHealthRecord {
    return {
      credentialKey: credentialKeyOf(state.userId, state.env),
      ownerId: this.instanceId,
      connectedAt: state.connectedAt,
      lastHeartbeatAtMs: state.lastHeartbeatAtMs,
      lastKeepaliveAtMs: state.lastKeepaliveAtMs,
      lastEventAtMs: state.lastEventAtMs,
      publishedAt: Date.now(),
    };
  }

  private async publishHealth(): Promise<void> {
    await Promise.all(
      [...this.ownedCredentials.values()].map((state) => this.publishCredentialHealth(state)),
    );
  }

  private async publishCredentialHealth(state: OwnedCredentialStream): Promise<void> {
    const key = credentialKeyOf(state.userId, state.env);
    const record = this.healthRecordFor(state);

    await this.coordination.setJson(
      userStreamHealthKey(state.userId, state.env),
      record,
      this.thresholds.userStreamHealthTtlMs,
    );

    const { state: verdict, reason } = this.resolveHealthRecord(record);
    this.checkHealthTransition(key, verdict, reason);
  }

  private checkHealthTransition(
    key: string,
    state: StreamHealthState,
    reason: UserDataStreamHealthReason,
  ): void {
    const previous = this.lastKnownHealthState.get(key);
    this.lastKnownHealthState.set(key, state);
    if (previous === undefined || previous === state) return;

    this.logger.log(
      `User data stream health transition for ${key}: ${previous} -> ${state}${reason ? ` (${reason})` : ''}`,
    );
  }

  private async handleStreamExpired(key: string, _reason: string): Promise<void> {
    await this.renegotiate(key);
  }

  private startKeepalive(key: string, state: OwnedCredentialStream): void {
    state.keepaliveTimer = setInterval(() => {
      this.runKeepaliveTick(key).catch((err) =>
        this.logger.error(`Keepalive tick failed for ${key}: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamKeepaliveIntervalMs);
  }

  private stopKeepalive(state: OwnedCredentialStream): void {
    if (state.keepaliveTimer) {
      clearInterval(state.keepaliveTimer);
      state.keepaliveTimer = null;
    }
  }

  private async runKeepaliveTick(key: string): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    const stillOwner = await this.coordination.renew(
      userStreamOwnerLeaseKey(state.userId, state.env),
      this.instanceId,
      this.thresholds.userStreamOwnerLeaseTtlMs,
    );
    if (!stillOwner) {
      this.handleLeaseLost(key);
      return;
    }

    const now = Date.now();
    const staleThresholdMs = this.thresholds.userStreamKeyExpiryMs - this.thresholds.userStreamKeepaliveGraceMs;
    if (now - state.lastKeepaliveAtMs > staleThresholdMs) {
      await this.renegotiate(key);
      return;
    }

    try {
      await state.rest.keepAliveListenKey(state.listenKey);
      state.lastKeepaliveAtMs = Date.now();
    } catch (err) {
      const code = getBinanceErrorCode(err);
      this.logger.warn(`keepAliveListenKey failed for ${key}: ${restErrorSummary(err)}`);
      if (code === LISTEN_KEY_MISSING_ERROR_CODE) {
        await this.renegotiate(key);
      }
    }
  }

  private async renegotiate(key: string): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    const stillOwner = await this.coordination.renew(
      userStreamOwnerLeaseKey(state.userId, state.env),
      this.instanceId,
      this.thresholds.userStreamOwnerLeaseTtlMs,
    );
    if (!stillOwner) {
      this.handleLeaseLost(key);
      return;
    }

    this.stopKeepalive(state);
    state.ws.disconnect();

    try {
      await state.rest.closeListenKey(state.listenKey);
    } catch (err) {
      this.logger.debug(`Stale closeListenKey failed for ${key}: ${restErrorSummary(err)}`);
    }

    let newListenKey: string;
    try {
      newListenKey = await state.rest.createListenKey();
    } catch (err) {
      this.logger.warn(`Failed to renegotiate the listenKey for ${key}: ${restErrorSummary(err)}`);
      return;
    }

    const now = Date.now();
    state.listenKey = newListenKey;
    state.connectedAt = now;
    state.lastKeepaliveAtMs = now;
    state.lastHeartbeatAtMs = now;
    state.ws.connect(newListenKey);
    this.startKeepalive(key, state);
    this.logger.log(`Renegotiated the user data stream listenKey for ${key}`);
  }

  private handleLeaseLost(key: string): void {
    const state = this.ownedCredentials.get(key);
    if (!state) return;
    this.stopKeepalive(state);
    state.ws.disconnect();
    this.detachWsListeners(state);
    this.ownedCredentials.delete(key);
    this.lastKnownHealthState.delete(key);
    this.logger.log(`Released the user data stream for ${key} (LEASE_LOST)`);
  }

  private async releaseCredential(key: string, reason: CredentialReleaseReason): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    this.stopKeepalive(state);
    state.ws.disconnect();
    this.detachWsListeners(state);

    try {
      await state.rest.closeListenKey(state.listenKey);
    } catch (err) {
      this.logger.debug(`closeListenKey failed for ${key}: ${restErrorSummary(err)}`);
    }

    try {
      await this.coordination.release(userStreamOwnerLeaseKey(state.userId, state.env), this.instanceId);
    } catch (err) {
      this.logger.warn(`Failed to release the lease for ${key}: ${errorMessage(err)}`);
    }

    this.ownedCredentials.delete(key);
    this.lastKnownHealthState.delete(key);
    this.logger.log(`Released the user data stream for ${key} (${reason})`);
  }
}
