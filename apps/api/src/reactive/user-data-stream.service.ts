import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { StreamHealthState, UserDataStreamHealthRecord } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import { BinanceRestClient, BinanceWsApiError } from '@crypto-trader/data-fetcher';
import type { Ed25519Signer, ExecutionReportEvent } from '@crypto-trader/data-fetcher';
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
import type { UserStreamAuthCredentialPort } from './user-stream-auth-credential.port';
import type { UserStreamWsApiClient, UserStreamWsApiFactory } from './user-stream-ws-api.test-double';
import { BoundedTtlCache } from './bounded-ttl-cache';

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

const AUTH_REJECTED_ERROR_CODES = new Set<number>([-1022, -2015, -1102]);
const SESSION_UNAUTHENTICATED_ERROR_CODE = -1193;

type WsApiFailureClass = 'AUTH_REJECTED' | 'SESSION_UNAUTHENTICATED' | 'TRANSIENT';

function classifyWsApiError(err: unknown): WsApiFailureClass {
  if (!(err instanceof BinanceWsApiError) || err.code === null) return 'TRANSIENT';
  if (AUTH_REJECTED_ERROR_CODES.has(err.code)) return 'AUTH_REJECTED';
  if (err.code === SESSION_UNAUTHENTICATED_ERROR_CODE) return 'SESSION_UNAUTHENTICATED';
  return 'TRANSIENT';
}

type NegotiationFailureClass = 'TRANSIENT' | 'AUTH_REJECTED' | 'ABSENT' | 'INVALID';

function negotiationFailureClassForError(err: unknown): NegotiationFailureClass {
  return classifyWsApiError(err) === 'AUTH_REJECTED' ? 'AUTH_REJECTED' : 'TRANSIENT';
}

interface NegotiationBackoff {
  attempts: number;
  nextAttemptAtMs: number;
  failureClass: NegotiationFailureClass;
}

export type CredentialReleaseReason =
  | 'INACTIVE'
  | 'LEASE_LOST'
  | 'COORDINATION_UNHEALTHY'
  | 'SHUTDOWN'
  | 'SESSION_LOST'
  | 'AUTH_REJECTED';

interface ActiveCredential {
  userId: string;
  env: CredentialEnv;
}

interface OwnedCredentialListeners {
  connected: () => void;
  disconnected: () => void;
  heartbeat: (payload: { at: number }) => void;
  executionReport: (report: ExecutionReportEvent) => void;
  sessionLost: () => void;
  error: (err: Error) => void;
}

interface OwnedCredentialStream {
  userId: string;
  env: CredentialEnv;
  apiKey: string;
  signer: Ed25519Signer;
  ws: UserStreamWsApiClient;
  serverTimeOffsetMs: number;
  connectedAt: number;
  lastHeartbeatAtMs: number;
  lastSessionAuthAtMs: number;
  lastEventAtMs: number | null;
  relogonTimer: ReturnType<typeof setInterval> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  reconnectAttempts: number;
  authenticating: boolean;
  listeners?: OwnedCredentialListeners;
}

export interface UserStreamTradingConfig {
  id: string;
  userId: string;
  mode: TradingMode;
  asset: string;
  pair: string;
  nativeProtectionEnabled: boolean;
  stopLossPct: number;
  takeProfitPct: number;
  stopLimitOffsetPct: number;
  closeOnProtectionFailure: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class UserDataStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(UserDataStreamService.name);
  private readonly ownedCredentials = new Map<string, OwnedCredentialStream>();
  private readonly credentialsCache: BoundedTtlCache<{ apiKey: string; apiSecret: string }>;
  private readonly configCache: BoundedTtlCache<UserStreamTradingConfig>;
  private readonly executorCache: BoundedTtlCache<OrderExecutorPort>;
  private readonly seenEvents = new Map<string, number>();
  private readonly inFlightEvents = new Set<string>();
  private readonly lastKnownHealthState = new Map<string, StreamHealthState>();
  private readonly negotiationBackoff = new Map<string, NegotiationBackoff>();
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
    private readonly authCredentials: UserStreamAuthCredentialPort,
    private readonly wsApiFactory: UserStreamWsApiFactory,
    private readonly thresholds: ReactiveRuntimeThresholds,
    private readonly instanceId: string,
  ) {
    this.credentialsCache = new BoundedTtlCache(
      thresholds.userStreamResolverCacheSize,
      thresholds.userStreamSubscriptionRefreshIntervalMs,
    );
    this.configCache = new BoundedTtlCache(
      thresholds.userStreamResolverCacheSize,
      thresholds.userStreamSubscriptionRefreshIntervalMs,
    );
    this.executorCache = new BoundedTtlCache(
      thresholds.userStreamResolverCacheSize,
      thresholds.userStreamSubscriptionRefreshIntervalMs,
    );
  }

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

    this.purgeStaleNegotiationBackoff(Date.now());
    await this.renewOwnedLeases();
    await this.acquireActiveCredentials();
  }

  private purgeStaleNegotiationBackoff(now: number): void {
    for (const [key, backoff] of this.negotiationBackoff) {
      const expiredForMs = now - backoff.nextAttemptAtMs;
      const isStale = expiredForMs > this.thresholds.userStreamNegotiateMaxDelayMs;
      if (isStale && !this.activeCredentials.has(key)) {
        this.negotiationBackoff.delete(key);
      }
    }
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
    const now = Date.now();
    for (const [key, active] of this.activeCredentials) {
      if (this.ownedCredentials.has(key)) continue;
      if (this.isNegotiationBackoffActive(key, now)) continue;

      const resolution = await this.authCredentials.resolve(active.userId, active.env);
      if (resolution.kind === 'ABSENT') {
        this.logger.warn(
          `No Ed25519 credential configured for ${key} — the user data stream stays off; the tick probe and reconciliation keep covering it`,
        );
        this.registerNegotiationFailure(key, 'ABSENT');
        continue;
      }
      if (resolution.kind === 'INVALID') {
        this.logger.warn(
          `Invalid Ed25519 credential for ${key} (${resolution.reason}) — the user data stream stays off`,
        );
        this.registerNegotiationFailure(key, 'INVALID');
        continue;
      }

      const acquired = await this.coordination.tryAcquire(
        userStreamOwnerLeaseKey(active.userId, active.env),
        this.instanceId,
        this.thresholds.userStreamOwnerLeaseTtlMs,
      );
      if (acquired) {
        await this.connectCredential(key, active, resolution.apiKey, resolution.signer);
      }
    }
  }

  private isNegotiationBackoffActive(key: string, now: number): boolean {
    const backoff = this.negotiationBackoff.get(key);
    return backoff !== undefined && backoff.nextAttemptAtMs > now;
  }

  private registerNegotiationFailure(key: string, failureClass: NegotiationFailureClass): void {
    const now = Date.now();
    const attempts = (this.negotiationBackoff.get(key)?.attempts ?? 0) + 1;
    const nextAttemptAtMs = now + this.negotiationBackoffDelayMs(failureClass, attempts);
    this.negotiationBackoff.set(key, { attempts, nextAttemptAtMs, failureClass });
  }

  private negotiationBackoffDelayMs(failureClass: NegotiationFailureClass, attempts: number): number {
    if (failureClass === 'AUTH_REJECTED' || failureClass === 'INVALID') {
      return this.thresholds.userStreamAuthRejectedCooldownMs;
    }
    if (failureClass === 'ABSENT') {
      return this.thresholds.userStreamMissingCredentialLogIntervalMs;
    }
    const uncappedDelayMs = this.thresholds.userStreamNegotiateBaseDelayMs * 2 ** (attempts - 1);
    const cappedDelayMs = Math.min(uncappedDelayMs, this.thresholds.userStreamNegotiateMaxDelayMs);
    const jitterRatio = 1 + (Math.random() * 0.4 - 0.2);
    return Math.max(0, Math.round(cappedDelayMs * jitterRatio));
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
    const cached = this.credentialsCache.get(cacheKey, now);
    if (cached) return cached;

    const record = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet } },
    });
    if (!record) return null;

    const apiKey = decrypt(record.apiKeyEncrypted, record.apiKeyIv);
    const apiSecret = decrypt(record.secretEncrypted, record.secretIv);
    const credentials = { apiKey, apiSecret };
    this.credentialsCache.set(cacheKey, credentials, now);
    return credentials;
  }

  private releaseReasonForError(err: unknown): CredentialReleaseReason {
    return classifyWsApiError(err) === 'AUTH_REJECTED' ? 'AUTH_REJECTED' : 'SESSION_LOST';
  }

  private async connectCredential(
    key: string,
    active: ActiveCredential,
    apiKey: string,
    signer: Ed25519Signer,
  ): Promise<void> {
    const ws = this.wsApiFactory({ testnet: active.env === 'testnet' });
    const now = Date.now();
    const state: OwnedCredentialStream = {
      userId: active.userId,
      env: active.env,
      apiKey,
      signer,
      ws,
      serverTimeOffsetMs: 0,
      connectedAt: now,
      lastHeartbeatAtMs: now,
      lastSessionAuthAtMs: now,
      lastEventAtMs: null,
      relogonTimer: null,
      pingTimer: null,
      reconnectAttempts: 0,
      authenticating: false,
    };

    this.ownedCredentials.set(key, state);
    this.attachWsListeners(key, state);

    try {
      await ws.connect();
    } catch (err) {
      this.logger.warn(`Failed to open the user data stream socket for ${key}: ${errorMessage(err)}`);
      await this.failSession(key, this.releaseReasonForError(err), negotiationFailureClassForError(err));
      return;
    }

    this.logger.log(`Acquired the user data stream lease for ${key}`);
  }

  private attachWsListeners(key: string, state: OwnedCredentialStream): void {
    const connected = () => {
      this.authenticateAndSubscribe(key, state).catch((err) =>
        this.logger.error(
          `Unexpected user data stream authentication failure for ${key}: ${errorMessage(err)}`,
        ),
      );
    };
    const disconnected = () => {
      this.clearSessionTimers(state);
    };
    const heartbeat = (payload: { at: number }) => {
      state.lastHeartbeatAtMs = payload?.at ?? Date.now();
    };
    const executionReport = (report: ExecutionReportEvent) => {
      this.handleExecutionReport(state, report);
    };
    const sessionLost = () => {
      this.logger.warn(`User data stream session lost for ${key}`);
      this.failSession(key, 'SESSION_LOST', 'TRANSIENT').catch((err) =>
        this.logger.error(`Failed to release ${key} after session-lost: ${errorMessage(err)}`),
      );
    };
    const error = (err: Error) => {
      this.logger.warn(err.message);
    };

    state.ws.on('connected', connected);
    state.ws.on('disconnected', disconnected);
    state.ws.on('heartbeat', heartbeat);
    state.ws.on('execution-report', executionReport);
    state.ws.on('session-lost', sessionLost);
    state.ws.on('error', error);

    state.listeners = { connected, disconnected, heartbeat, executionReport, sessionLost, error };
  }

  private detachWsListeners(state: OwnedCredentialStream): void {
    if (!state.listeners) return;
    state.ws.off('connected', state.listeners.connected);
    state.ws.off('disconnected', state.listeners.disconnected);
    state.ws.off('heartbeat', state.listeners.heartbeat);
    state.ws.off('execution-report', state.listeners.executionReport);
    state.ws.off('session-lost', state.listeners.sessionLost);
    state.ws.off('error', state.listeners.error);
  }

  private async authenticateAndSubscribe(key: string, state: OwnedCredentialStream): Promise<void> {
    if (state.authenticating) return;
    state.authenticating = true;

    try {
      const serverTimeMs = await state.ws.time();
      state.serverTimeOffsetMs = serverTimeMs - Date.now();
      await state.ws.logon({ apiKey: state.apiKey, signer: state.signer });
      await state.ws.subscribeUserDataStream();

      const authenticatedAt = Date.now();
      state.lastSessionAuthAtMs = authenticatedAt;
      state.lastHeartbeatAtMs = authenticatedAt;
      state.reconnectAttempts = 0;
      this.negotiationBackoff.delete(key);
      this.scheduleRelogon(key, state);
      this.schedulePing(key, state);
    } catch (err) {
      this.logger.warn(`User data stream session negotiation failed for ${key}: ${errorMessage(err)}`);
      await this.failSession(key, this.releaseReasonForError(err), negotiationFailureClassForError(err));
    } finally {
      state.authenticating = false;
    }
  }

  private scheduleRelogon(key: string, state: OwnedCredentialStream): void {
    this.clearRelogonTimer(state);
    state.relogonTimer = setInterval(() => {
      this.runRelogonTick(key).catch((err) =>
        this.logger.error(`Relogon tick failed for ${key}: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamRelogonIntervalMs);
  }

  private schedulePing(key: string, state: OwnedCredentialStream): void {
    this.clearPingTimer(state);
    state.pingTimer = setInterval(() => {
      this.runPingTick(key).catch((err) =>
        this.logger.error(`Heartbeat ping failed for ${key}: ${errorMessage(err)}`),
      );
    }, this.thresholds.userStreamSessionPingIntervalMs);
  }

  private async runRelogonTick(key: string): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    try {
      await state.ws.logon({ apiKey: state.apiKey, signer: state.signer });
      state.lastSessionAuthAtMs = Date.now();
      this.negotiationBackoff.delete(key);
    } catch (err) {
      this.logger.warn(`Relogon failed for ${key}: ${errorMessage(err)}`);
      await this.failSession(key, this.releaseReasonForError(err), negotiationFailureClassForError(err));
    }
  }

  private async runPingTick(key: string): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    try {
      await state.ws.ping();
      state.lastHeartbeatAtMs = Date.now();
    } catch (err) {
      this.logger.debug(`Heartbeat ping failed for ${key}: ${errorMessage(err)}`);
    }
  }

  private clearRelogonTimer(state: OwnedCredentialStream): void {
    if (state.relogonTimer) {
      clearInterval(state.relogonTimer);
      state.relogonTimer = null;
    }
  }

  private clearPingTimer(state: OwnedCredentialStream): void {
    if (state.pingTimer) {
      clearInterval(state.pingTimer);
      state.pingTimer = null;
    }
  }

  private clearSessionTimers(state: OwnedCredentialStream): void {
    this.clearRelogonTimer(state);
    this.clearPingTimer(state);
  }

  private handleExecutionReport(state: OwnedCredentialStream, report: ExecutionReportEvent): void {
    const now = Date.now();
    state.lastEventAtMs = now;

    const identity = seenEventIdentity(report);
    if (this.isSeenEvent(identity, now)) return;
    if (this.inFlightEvents.has(identity)) return;

    this.inFlightEvents.add(identity);
    this.settleExecutionReport(state, report, identity).catch((err) =>
      this.logger.error(
        `Failed to settle the execution report for ${credentialKeyOf(state.userId, state.env)}: ${errorMessage(err)}`,
      ),
    );
  }

  private isSeenEvent(identity: string, now: number): boolean {
    const seenAt = this.seenEvents.get(identity);
    if (seenAt === undefined) return false;
    if (now - seenAt > this.thresholds.userStreamSeenEventTtlMs) {
      this.seenEvents.delete(identity);
      return false;
    }
    return true;
  }

  private recordSeenEvent(identity: string, now: number): void {
    this.seenEvents.set(identity, now);
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
    identity: string,
  ): Promise<void> {
    try {
      const fillStatus = toEntryFillStatus(report);
      if (!fillStatus) {
        this.recordSeenEvent(identity, Date.now());
        return;
      }

      const credentialKey = credentialKeyOf(state.userId, state.env);
      const order = await this.correlateRestingOrder(state.userId, report);
      if (!order) {
        this.uncorrelatedEventCount += 1;
        this.logger.debug(
          `Execution report for ${credentialKey} did not correlate with any RESTING entry order (uncorrelated so far: ${this.uncorrelatedEventCount})`,
        );
        this.recordSeenEvent(identity, Date.now());
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
        status: fillStatus,
      });

      this.recordSeenEvent(identity, Date.now());
      if (outcome === 'SETTLED') {
        this.fastPath.invalidateOpenPositions(order.configId);
      }
    } finally {
      this.inFlightEvents.delete(identity);
    }
  }

  private isAcceptableEntryOrderMatch(
    row: { userId: string; status: string; symbol: string } | null,
    report: ExecutionReportEvent,
    userId: string,
  ): boolean {
    return (
      row !== null &&
      row.userId === userId &&
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
    if (this.isAcceptableEntryOrderMatch(byClientOrderId, report, userId)) {
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
    if (this.isAcceptableEntryOrderMatch(byBackupIdentifier, report, userId)) {
      return byBackupIdentifier as unknown as RestingEntryOrder;
    }

    return null;
  }

  private async resolveTradingConfig(configId: string): Promise<UserStreamTradingConfig | null> {
    const now = Date.now();
    const cached = this.configCache.get(configId, now);
    if (cached) return cached;

    const row = await this.prisma.tradingConfig.findUnique({ where: { id: configId } });
    if (!row) return null;

    // Prisma's generated TradingMode is a plain string union; the shared TradingMode is a
    // nominal enum with the same values, so the field needs an explicit conversion here.
    const config: UserStreamTradingConfig = { ...row, mode: row.mode as TradingMode };
    this.configCache.set(configId, config, now);
    return config;
  }

  private async resolveOrderExecutor(
    userId: string,
    isTestnet: boolean,
  ): Promise<OrderExecutorPort | null> {
    const now = Date.now();
    const cacheKey = `${userId}:${isTestnet}`;
    const cached = this.executorCache.get(cacheKey, now);
    if (cached) return cached;

    const credentials = await this.resolveCredentials(userId, isTestnet);
    if (!credentials) return null;

    const executor = new LiveOrderExecutor(
      new BinanceRestClient({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        testnet: isTestnet,
      }),
    );
    this.executorCache.set(cacheKey, executor, now);
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
        sessionAuthMaxAgeMs: this.thresholds.userStreamSessionAuthMaxAgeMs,
      },
    });
  }

  private healthRecordFor(state: OwnedCredentialStream): UserDataStreamHealthRecord {
    return {
      credentialKey: credentialKeyOf(state.userId, state.env),
      ownerId: this.instanceId,
      connectedAt: state.connectedAt,
      lastHeartbeatAtMs: state.lastHeartbeatAtMs,
      lastSessionAuthAtMs: state.lastSessionAuthAtMs,
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

  private handleLeaseLost(key: string): void {
    const state = this.ownedCredentials.get(key);
    if (!state) return;
    this.clearSessionTimers(state);
    state.ws.disconnect();
    this.detachWsListeners(state);
    this.ownedCredentials.delete(key);
    this.lastKnownHealthState.delete(key);
    this.logger.log(`Released the user data stream for ${key} (LEASE_LOST)`);
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`operation timed out after ${ms}ms`)), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private async failSession(
    key: string,
    reason: CredentialReleaseReason,
    failureClass: NegotiationFailureClass,
  ): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    this.clearSessionTimers(state);
    this.detachWsListeners(state);
    state.ws.disconnect();

    try {
      await this.coordination.release(userStreamOwnerLeaseKey(state.userId, state.env), this.instanceId);
    } catch (err) {
      this.logger.warn(`Failed to release the lease for ${key}: ${errorMessage(err)}`);
    }

    this.ownedCredentials.delete(key);
    this.lastKnownHealthState.delete(key);
    this.registerNegotiationFailure(key, failureClass);
    this.logger.log(`Released the user data stream for ${key} (${reason})`);
  }

  private async releaseCredential(key: string, reason: CredentialReleaseReason): Promise<void> {
    const state = this.ownedCredentials.get(key);
    if (!state) return;

    this.clearSessionTimers(state);

    try {
      await this.withTimeout(
        state.ws.unsubscribeUserDataStream(),
        this.thresholds.userStreamRequestTimeoutMs,
      );
    } catch (err) {
      this.logger.debug(`unsubscribeUserDataStream failed for ${key}: ${errorMessage(err)}`);
    }

    try {
      await this.withTimeout(state.ws.logout(), this.thresholds.userStreamRequestTimeoutMs);
    } catch (err) {
      this.logger.debug(`logout failed for ${key}: ${errorMessage(err)}`);
    }

    state.ws.disconnect();
    this.detachWsListeners(state);

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
