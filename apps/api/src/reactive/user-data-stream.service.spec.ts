import { Logger } from '@nestjs/common';
import { TradingMode } from '@crypto-trader/shared';
import { BinanceWsApiError, redactWsApiRequest } from '@crypto-trader/data-fetcher';
import type { Ed25519Signer, ExecutionReportEvent } from '@crypto-trader/data-fetcher';
import {
  UserDataStreamService,
  userStreamOwnerLeaseKey,
  userStreamHealthKey,
  type CredentialEnv,
} from './user-data-stream.service';
import {
  DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  type ReactiveRuntimeThresholds,
} from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { createSharedFakeCoordination } from './reactive-coordination.test-double';
import { FakeUserStreamWsApiClient } from './user-stream-ws-api.test-double';
import type {
  UserStreamAuthCredentialPort,
  UserStreamAuthResolution,
} from './user-stream-auth-credential.port';
import { decrypt } from '../users/utils/encryption.util';
import type { SettleFillOutcome } from '../trading/entry-order.service';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((value: string) => `decrypted:${value}`),
}));

const DEFAULT_CREDENTIAL_ROW = {
  apiKeyEncrypted: 'enc-key',
  apiKeyIv: 'iv-key',
  secretEncrypted: 'enc-secret',
  secretIv: 'iv-secret',
};

function buildFakeSigner(sentinel = 'fake-signature'): Ed25519Signer {
  return { sign: jest.fn().mockReturnValue(sentinel) };
}

function resolvedResolution(apiKey = 'fake-api-key'): UserStreamAuthResolution {
  return { kind: 'RESOLVED', apiKey, signer: buildFakeSigner() };
}

class FakeUserStreamAuthCredentialResolver implements UserStreamAuthCredentialPort {
  private readonly resolutions = new Map<string, UserStreamAuthResolution>();

  constructor(private readonly defaultResolution: UserStreamAuthResolution = resolvedResolution()) {}

  setResolution(userId: string, env: CredentialEnv, resolution: UserStreamAuthResolution): void {
    this.resolutions.set(`${userId}:${env}`, resolution);
  }

  async resolve(userId: string, env: CredentialEnv): Promise<UserStreamAuthResolution> {
    return this.resolutions.get(`${userId}:${env}`) ?? this.defaultResolution;
  }
}

function createFakePrisma(
  opts: {
    configs?: Array<{ userId: string; mode: TradingMode }>;
    restingOrders?: Array<{ userId: string; mode: TradingMode }>;
    credential?: typeof DEFAULT_CREDENTIAL_ROW | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryOrderByClientId?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryOrderByBackupId?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tradingConfigById?: any;
  } = {},
) {
  return {
    tradingConfig: {
      findMany: jest.fn().mockResolvedValue(opts.configs ?? []),
      findUnique: jest.fn().mockResolvedValue(opts.tradingConfigById ?? null),
    },
    entryOrder: {
      findMany: jest.fn().mockResolvedValue(opts.restingOrders ?? []),
      findUnique: jest.fn().mockResolvedValue(opts.entryOrderByClientId ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.entryOrderByBackupId ?? null),
    },
    binanceCredential: {
      findUnique: jest.fn().mockResolvedValue(
        opts.credential === undefined ? DEFAULT_CREDENTIAL_ROW : opts.credential,
      ),
    },
  };
}

function buildEntryOrderService(overrides: { settle?: SettleFillOutcome } = {}) {
  return {
    settleFill: jest.fn().mockResolvedValue(overrides.settle ?? 'SETTLED'),
  };
}

function buildFastPath() {
  return {
    invalidateOpenPositions: jest.fn(),
  };
}

function buildService(
  prisma: ReturnType<typeof createFakePrisma>,
  coordination: ReactiveCoordinationPort,
  authCredentials: UserStreamAuthCredentialPort,
  wsApiFactory: jest.Mock,
  instanceId: string,
  deps: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryOrderService?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastPath?: any;
    thresholds?: ReactiveRuntimeThresholds;
  } = {},
) {
  return new UserDataStreamService(
    prisma as never,
    coordination,
    (deps.entryOrderService ?? buildEntryOrderService()) as never,
    (deps.fastPath ?? buildFastPath()) as never,
    authCredentials,
    wsApiFactory as never,
    deps.thresholds ?? DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    instanceId,
  );
}

class ScriptedWsApiClient extends FakeUserStreamWsApiClient {
  alwaysFailConnectWith: Error | null = null;
  private pendingConnectFailure: Error | null = null;
  private pendingTimeFailure: Error | null = null;

  failNextConnectWith(err: Error): void {
    this.pendingConnectFailure = err;
  }

  failNextTimeWith(err: Error): void {
    this.pendingTimeFailure = err;
  }

  override async connect(): Promise<void> {
    if (this.alwaysFailConnectWith || this.pendingConnectFailure) {
      this.connectCallCount += 1;
      const err = this.alwaysFailConnectWith ?? this.pendingConnectFailure;
      this.pendingConnectFailure = null;
      throw err;
    }
    return super.connect();
  }

  override async time(): Promise<number> {
    if (this.pendingTimeFailure) {
      this.timeCallCount += 1;
      const err = this.pendingTimeFailure;
      this.pendingTimeFailure = null;
      throw err;
    }
    return super.time();
  }
}

function buildPipelineFixture(
  prismaOpts: Parameters<typeof createFakePrisma>[0] = {},
  overrides: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryOrderService?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastPath?: any;
    thresholds?: ReactiveRuntimeThresholds;
    authCredentials?: UserStreamAuthCredentialPort;
  } = {},
) {
  const coordination = createSharedFakeCoordination();
  const wsClient = new FakeUserStreamWsApiClient();
  const authCredentials = overrides.authCredentials ?? new FakeUserStreamAuthCredentialResolver();
  const entryOrderService = overrides.entryOrderService ?? buildEntryOrderService();
  const fastPath = overrides.fastPath ?? buildFastPath();
  const prisma = createFakePrisma({
    configs: [{ userId: 'user-1', mode: TradingMode.LIVE }],
    ...prismaOpts,
  });
  const service = new UserDataStreamService(
    prisma as never,
    coordination,
    entryOrderService as never,
    fastPath as never,
    authCredentials,
    jest.fn().mockReturnValue(wsClient) as never,
    overrides.thresholds ?? DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    'instance-a',
  );
  return { service, prisma, coordination, wsClient, authCredentials, entryOrderService, fastPath };
}

function buildRestingOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    userId: 'user-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    asset: 'BTC',
    pair: 'USDT',
    mode: TradingMode.LIVE,
    entryMode: 'LIMIT_MAKER',
    quantity: 1,
    limitPrice: 100,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 100,
    plannedNotionalUsd: 100,
    clientOrderId: 'ent-abc123',
    orderListId: null,
    orderId: 'order-1',
    limitLegOrderId: null,
    stopLegOrderId: null,
    placedAt: new Date(),
    expiresAt: new Date(),
    decisionId: null,
    cancelReason: null,
    status: 'RESTING',
    ...overrides,
  };
}

function buildTradingConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: TradingMode.LIVE,
    isRunning: true,
    nativeProtectionEnabled: false,
    stopLossPct: 0.02,
    takeProfitPct: 0.04,
    ...overrides,
  };
}

const BASE_EXECUTION_REPORT: ExecutionReportEvent = {
  eventTimeMs: 1_700_000_000_000,
  transactionTimeMs: 1_700_000_000_000,
  symbol: 'BTCUSDT',
  clientOrderId: 'ent-abc123',
  originalClientOrderId: null,
  side: 'BUY',
  orderType: 'LIMIT_MAKER',
  executionType: 'TRADE',
  orderStatus: 'FILLED',
  orderId: 'order-1',
  orderListId: null,
  orderQuantity: 1,
  lastExecutedQuantity: 1,
  cumulativeFilledQuantity: 1,
  lastExecutedPrice: 100,
  cumulativeQuoteQuantity: 100,
  tradeId: 'trade-1',
};

function mockRandomForZeroJitter(): jest.SpyInstance<number, []> {
  return jest.spyOn(Math, 'random').mockReturnValue(0.5);
}

async function flushMicrotasks(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('UserDataStreamService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('one session per credential (HU-04 CA-4, T-04d)', () => {
    it('gives exactly one of two replicas the connect/logon calls for the same credential', async () => {
      const coordination = createSharedFakeCoordination();
      const wsA = new FakeUserStreamWsApiClient();
      const wsB = new FakeUserStreamWsApiClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });

      const serviceA = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsA),
        'instance-a',
      );
      const serviceB = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsB),
        'instance-b',
      );

      await serviceA.onModuleInit();
      await serviceB.onModuleInit();

      expect(serviceA.isOwner('user-1', 'live')).not.toBe(serviceB.isOwner('user-1', 'live'));

      const aIsOwner = serviceA.isOwner('user-1', 'live');
      const owner = aIsOwner ? serviceA : serviceB;
      const standby = aIsOwner ? serviceB : serviceA;
      const ownerWs = aIsOwner ? wsA : wsB;
      const standbyWs = aIsOwner ? wsB : wsA;

      expect(ownerWs.connectCallCount).toBe(1);
      expect(standbyWs.connectCallCount).toBe(0);
      expect(standbyWs.logonCallCount).toBe(0);

      ownerWs.emitConnected();
      await flushMicrotasks();
      expect(ownerWs.logonCallCount).toBe(1);
      expect(standbyWs.logonCallCount).toBe(0);

      await owner.onApplicationShutdown();
      await standby.onApplicationShutdown();
    });
  });

  describe('fail-closed when coordination is unavailable', () => {
    it('never resolves the credential nor connects when the coordination port is unhealthy', async () => {
      const coordination = createSharedFakeCoordination();
      coordination.setHealthy(false);
      const wsClient = new FakeUserStreamWsApiClient();
      const authCredentials = new FakeUserStreamAuthCredentialResolver();
      const resolveSpy = jest.spyOn(authCredentials, 'resolve');
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        authCredentials,
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(resolveSpy).not.toHaveBeenCalled();
      expect(wsClient.connectCallCount).toBe(0);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await service.onApplicationShutdown();
    });

    it('never connects, and stays silent, when the coordination driver is deliberately disabled', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const coordination: ReactiveCoordinationPort = {
        ...createSharedFakeCoordination(),
        isHealthy: () => false,
        isEnabled: () => false,
      };
      const wsClient = new FakeUserStreamWsApiClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connectCallCount).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });
  });

  describe('subscription scope', () => {
    it('never subscribes a SANDBOX credential', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeUserStreamWsApiClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.SANDBOX }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connectCallCount).toBe(0);

      await service.onApplicationShutdown();
    });
  });

  describe('credential resolution (D-12, HU-08, T-08a/T-08c/T-08d)', () => {
    it('never acquires the lease nor connects when the Ed25519 credential is ABSENT for every active credential, while the tick probe keeps a working settleFill (T-08a)', async () => {
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeUserStreamWsApiClient();
      const authCredentials = new FakeUserStreamAuthCredentialResolver({ kind: 'ABSENT' });
      const entryOrderService = buildEntryOrderService();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        authCredentials,
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
        { entryOrderService },
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connectCallCount).toBe(0);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await expect(
        entryOrderService.settleFill({} as never),
      ).resolves.toBe('SETTLED');

      await service.onApplicationShutdown();
    });

    it('resolves credentials independently per user: a RESOLVED user-A does not unblock an ABSENT user-B (T-08c)', async () => {
      const coordination = createSharedFakeCoordination();
      const wsA = new FakeUserStreamWsApiClient();
      const authCredentials = new FakeUserStreamAuthCredentialResolver({ kind: 'ABSENT' });
      authCredentials.setResolution('user-A', 'testnet', resolvedResolution('api-key-a'));
      const prisma = createFakePrisma({
        configs: [
          { userId: 'user-A', mode: TradingMode.TESTNET },
          { userId: 'user-B', mode: TradingMode.TESTNET },
        ],
      });
      const wsApiFactory = jest.fn().mockReturnValue(wsA);
      const service = buildService(prisma, coordination, authCredentials, wsApiFactory, 'instance-a');

      await service.onModuleInit();

      expect(wsApiFactory).toHaveBeenCalledTimes(1);
      expect(wsA.connectCallCount).toBe(1);
      expect(coordination.tryAcquire).toHaveBeenCalledTimes(1);

      wsA.emitConnected();
      await flushMicrotasks();

      expect(wsA.logonCallCount).toBe(1);
      expect(wsA.logonApiKeys).toEqual(['api-key-a']);

      await service.onApplicationShutdown();
    });

    it('never acquires nor connects for an INVALID credential, without throwing, health stays non-HEALTHY, and warns once with a cooldown (T-08d)', async () => {
      jest.useFakeTimers();
      const coordination = createSharedFakeCoordination();
      const wsClient = new FakeUserStreamWsApiClient();
      const authCredentials = new FakeUserStreamAuthCredentialResolver();
      authCredentials.setResolution('user-1', 'live', { kind: 'INVALID', reason: 'MALFORMED_PEM' });
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const service = buildService(
        prisma,
        coordination,
        authCredentials,
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(wsClient.connectCallCount).toBe(0);
      expect(service.getHealth('user-1', 'live').state).not.toBe('HEALTHY');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSweepIntervalMs * 10);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
      warnSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('session refresh (HU-04 CA-1, T-04a)', () => {
    it('relogons at least once after userStreamSessionMaxAgeMs elapses, reading the threshold from the thresholds object', async () => {
      jest.useFakeTimers();
      const { service, wsClient } = buildPipelineFixture();

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();
      expect(wsClient.logonCallCount).toBe(1);

      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSessionMaxAgeMs);

      expect(wsClient.logonCallCount).toBeGreaterThan(1);
      expect(wsClient.subscribeUserDataStreamCallCount).toBe(1);

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('reconnection re-authenticates on every cause (HU-04 CA-2, T-04b)', () => {
    const reconnectCauses: Array<[string, (ws: FakeUserStreamWsApiClient) => void]> = [
      ['a clean close followed by a reconnect', (ws) => ws.emitClose(1000)],
      ['a socket error followed by a close', (ws) => {
        ws.emitError(new Error('boom'));
        ws.emitClose();
      }],
      ['an abrupt close with no explicit error', (ws) => ws.emitClose()],
    ];

    it.each(reconnectCauses)(
      're-authenticates and re-subscribes after %s, without any manual intervention',
      async (_label, causeReconnect) => {
        const { service, wsClient } = buildPipelineFixture();

        await service.onModuleInit();
        wsClient.emitConnected();
        await flushMicrotasks();
        expect(wsClient.logonCallCount).toBe(1);
        expect(wsClient.subscribeUserDataStreamCallCount).toBe(1);

        causeReconnect(wsClient);
        await flushMicrotasks();
        wsClient.emitConnected();
        await flushMicrotasks();

        expect(wsClient.logonCallCount).toBe(2);
        expect(wsClient.subscribeUserDataStreamCallCount).toBe(2);

        await service.onApplicationShutdown();
      },
    );
  });

  describe('rejected session never reads as HEALTHY (HU-04 CE-1, T-04g)', () => {
    it.each([
      [-1022, 'invalid signature'],
      [-2015, 'invalid key/IP/permissions'],
      [-1102, 'missing mandatory parameter'],
    ])('code %d on logon leaves health non-HEALTHY', async (code) => {
      const { service, wsClient } = buildPipelineFixture();

      await service.onModuleInit();
      wsClient.failNextLogonWith(400, code);
      wsClient.emitConnected();
      await flushMicrotasks();

      expect(service.getHealth('user-1', 'live').state).not.toBe('HEALTHY');
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await service.onApplicationShutdown();
    });
  });

  describe('ordered shutdown (HU-04 CA-3, T-04c)', () => {
    it('stops the session timers, then unsubscribes, logs out, disconnects and releases the lease, in that order', async () => {
      jest.useFakeTimers();
      const { service, wsClient, coordination } = buildPipelineFixture();

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();

      const unsubscribeSpy = jest.spyOn(wsClient, 'unsubscribeUserDataStream');
      const logoutSpy = jest.spyOn(wsClient, 'logout');
      const disconnectSpy = jest.spyOn(wsClient, 'disconnect');

      await service.onApplicationShutdown();

      const unsubscribeOrder = unsubscribeSpy.mock.invocationCallOrder[0];
      const logoutOrder = logoutSpy.mock.invocationCallOrder[0];
      const disconnectOrder = disconnectSpy.mock.invocationCallOrder[0];
      const releaseOrder = (coordination.release as jest.Mock).mock.invocationCallOrder[0];

      expect(unsubscribeOrder).toBeLessThan(logoutOrder);
      expect(logoutOrder).toBeLessThan(disconnectOrder);
      expect(disconnectOrder).toBeLessThan(releaseOrder);
      expect(coordination.release).toHaveBeenCalledWith(
        userStreamOwnerLeaseKey('user-1', 'live'),
        'instance-a',
      );
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      const logonCallsBefore = wsClient.logonCallCount;
      const pingCallsBefore = wsClient.pingCallCount;
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRelogonIntervalMs * 3);
      expect(wsClient.logonCallCount).toBe(logonCallsBefore);
      expect(wsClient.pingCallCount).toBe(pingCallsBefore);

      jest.useRealTimers();
    });

    it('skips the release when the lease was already lost before shutdown', async () => {
      const { service, coordination } = buildPipelineFixture();

      await service.onModuleInit();
      expect(service.getOwnedCredentialKeys()).toHaveLength(1);

      (coordination.renew as jest.Mock).mockResolvedValueOnce(false);
      await service.runOwnershipCycle();
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      (coordination.release as jest.Mock).mockClear();

      await service.onApplicationShutdown();

      expect(coordination.release).not.toHaveBeenCalled();
    });
  });

  describe('correlation (D-05, HU-01)', () => {
    it('matches by clientOrderId and settles the fill without waiting for any market tick (HU-01 CA-1)', async () => {
      const row = buildRestingOrderRow();
      const { service, prisma, wsClient, entryOrderService, fastPath } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(prisma.entryOrder.findUnique).toHaveBeenCalledWith({
        where: { clientOrderId: 'ent-abc123' },
      });
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);
      expect(entryOrderService.settleFill.mock.calls[0][0]).toMatchObject({
        userId: 'user-1',
        symbol: 'BTCUSDT',
        mode: TradingMode.LIVE,
        order: row,
        status: expect.objectContaining({ state: 'FILLED' }),
      });
      expect(fastPath.invalidateOpenPositions).toHaveBeenCalledWith('config-1');

      await service.onApplicationShutdown();
    });

    it('matches an OCO leg whose report clientOrderId carries the -l suffix while the row holds the unsuffixed id', async () => {
      const row = buildRestingOrderRow({ clientOrderId: 'ent-abc123' });
      const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, clientOrderId: 'ent-abc123-l' });
      await flushMicrotasks();

      expect(prisma.entryOrder.findUnique).toHaveBeenCalledWith({
        where: { clientOrderId: 'ent-abc123' },
      });
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it.each([
      ['orderId', { orderId: 'fallback-id' }, { orderId: 'fallback-id' }],
      ['limitLegOrderId', { limitLegOrderId: 'fallback-id' }, { orderId: 'fallback-id' }],
      ['stopLegOrderId', { stopLegOrderId: 'fallback-id' }, { orderId: 'fallback-id' }],
      [
        'orderListId',
        { orderListId: 'fallback-list-id' },
        { orderId: 'unrelated-order-id', orderListId: 'fallback-list-id' },
      ],
    ])(
      'falls back to matching by %s when clientOrderId does not resolve a RESTING row',
      async (_label, rowOverrides, reportOverrides) => {
        const row = buildRestingOrderRow(rowOverrides);
        const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture({
          entryOrderByClientId: null,
          entryOrderByBackupId: row,
          tradingConfigById: buildTradingConfigRow(),
        });

        await service.onModuleInit();
        wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, ...reportOverrides });
        await flushMicrotasks();

        expect(prisma.entryOrder.findFirst).toHaveBeenCalled();
        expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

        await service.onApplicationShutdown();
      },
    );

    it('produces zero effects and no warn/error log when nothing correlates', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: null,
        entryOrderByBackupId: null,
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('rejects a clientOrderId match whose symbol differs from the report symbol', async () => {
      const row = buildRestingOrderRow({ symbol: 'ETHUSDT' });
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        entryOrderByBackupId: null,
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('ignores a SELL report entirely, without even querying for correlation', async () => {
      const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture();

      await service.onModuleInit();
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, side: 'SELL' });
      await flushMicrotasks();

      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();
      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });
  });

  describe('settle outcome branching (D-06)', () => {
    it('invalidates the fast-path open-positions cache for the order config when settleFill returns SETTLED', async () => {
      const row = buildRestingOrderRow();
      const fastPath = buildFastPath();
      const { service, wsClient } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { entryOrderService: buildEntryOrderService({ settle: 'SETTLED' }), fastPath },
      );

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(fastPath.invalidateOpenPositions).toHaveBeenCalledWith('config-1');

      await service.onApplicationShutdown();
    });

    it('does not invalidate the fast-path cache when settleFill returns ALREADY_SETTLED', async () => {
      const row = buildRestingOrderRow();
      const fastPath = buildFastPath();
      const { service, wsClient } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { entryOrderService: buildEntryOrderService({ settle: 'ALREADY_SETTLED' }), fastPath },
      );

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(fastPath.invalidateOpenPositions).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });
  });

  describe('deduplication of redeliveries (HU-02 CA-2)', () => {
    it('a redelivered identical execution report is a complete no-op: zero Prisma calls on the second delivery', async () => {
      const row = buildRestingOrderRow();
      const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      prisma.entryOrder.findUnique.mockClear();
      prisma.entryOrder.findFirst.mockClear();
      prisma.tradingConfig.findUnique.mockClear();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);
      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();
      expect(prisma.entryOrder.findFirst).not.toHaveBeenCalled();
      expect(prisma.tradingConfig.findUnique).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('does not dedupe two distinct execution reports for the same order (a partial event followed by the final fill)', async () => {
      const row = buildRestingOrderRow();
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();

      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, cumulativeFilledQuantity: 0.5 });
      await flushMicrotasks();
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, cumulativeFilledQuantity: 1 });
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(2);

      await service.onApplicationShutdown();
    });

    it('evicts the oldest identity once the cache exceeds userStreamSeenEventCacheSize (FIFO)', async () => {
      const row = buildRestingOrderRow();
      const smallThresholds: ReactiveRuntimeThresholds = {
        ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        userStreamSeenEventCacheSize: 2,
      };
      const { service, wsClient, entryOrderService } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { thresholds: smallThresholds },
      );

      await service.onModuleInit();

      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, orderId: 'order-A' });
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, orderId: 'order-B' });
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, orderId: 'order-C' });
      await flushMicrotasks();
      entryOrderService.settleFill.mockClear();

      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, orderId: 'order-A' });
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('forgets a seen identity after userStreamSeenEventTtlMs elapses', async () => {
      jest.useFakeTimers();
      const row = buildRestingOrderRow();
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSeenEventTtlMs + 1);

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(2);

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('health model (HU-05, D-15)', () => {
    it('reads HEALTHY with zero fill events but a fresh heartbeat and session authentication', async () => {
      jest.useFakeTimers();
      const { service } = buildPipelineFixture();

      await service.onModuleInit();

      expect(service.getHealth('user-1', 'live')).toEqual({ state: 'HEALTHY', reason: null });

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('reads DEGRADED once the heartbeat goes stale beyond userStreamHeartbeatMaxAgeMs', async () => {
      jest.useFakeTimers();
      const { service } = buildPipelineFixture();

      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHeartbeatMaxAgeMs + 1,
      );

      expect(service.getHealth('user-1', 'live')).toEqual({
        state: 'DEGRADED',
        reason: 'HEARTBEAT_STALE',
      });

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('reads DEGRADED once the session authentication goes stale, even while the heartbeat stays fresh', async () => {
      jest.useFakeTimers();
      const { service, wsClient } = buildPipelineFixture();

      await service.onModuleInit();

      const heartbeatStepMs = Math.floor(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHeartbeatMaxAgeMs / 2,
      );
      const totalMs = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSessionAuthMaxAgeMs + heartbeatStepMs;
      let elapsed = 0;
      while (elapsed < totalMs) {
        await jest.advanceTimersByTimeAsync(heartbeatStepMs);
        elapsed += heartbeatStepMs;
        wsClient.emitHeartbeat();
      }

      expect(service.getHealth('user-1', 'live')).toEqual({
        state: 'DEGRADED',
        reason: 'SESSION_AUTH_STALE',
      });

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('returns to HEALTHY automatically after a fresh heartbeat, with no manual call', async () => {
      jest.useFakeTimers();
      const { service, wsClient } = buildPipelineFixture();

      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHeartbeatMaxAgeMs + 1,
      );
      expect(service.getHealth('user-1', 'live').state).toBe('DEGRADED');

      wsClient.emitHeartbeat();
      expect(service.getHealth('user-1', 'live')).toEqual({ state: 'HEALTHY', reason: null });

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('publishes a health record via coordination.setJson with none of the frozen-list-forbidden fields', async () => {
      jest.useFakeTimers();
      const { service, coordination } = buildPipelineFixture();

      await service.onModuleInit();
      await flushMicrotasks();

      expect(coordination.setJson).toHaveBeenCalled();
      const [key, record, ttl] = (coordination.setJson as jest.Mock).mock.calls[0];
      expect(key).toBe(userStreamHealthKey('user-1', 'live'));
      expect(ttl).toBe(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHealthTtlMs);
      expect(Object.keys(record as object).sort()).toEqual(
        [
          'connectedAt',
          'credentialKey',
          'lastEventAtMs',
          'lastHeartbeatAtMs',
          'lastSessionAuthAtMs',
          'ownerId',
          'publishedAt',
        ].sort(),
      );

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('failSession releases the credit on every session failure (D-16 issue-2, T-04e)', () => {
    async function expectReleasedAndReacquirable(
      prisma: ReturnType<typeof createFakePrisma>,
      coordination: ReactiveCoordinationPort,
      service: UserDataStreamService,
    ): Promise<void> {
      expect(coordination.release).toHaveBeenCalledTimes(1);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      const wsB = new FakeUserStreamWsApiClient();
      const serviceB = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsB),
        'instance-b',
      );
      await serviceB.onModuleInit();
      expect(serviceB.getOwnedCredentialKeys()).toEqual(['user-1:live']);
      await serviceB.onApplicationShutdown();
    }

    it('releases the lease when connect() rejects', async () => {
      const wsClient = new ScriptedWsApiClient();
      wsClient.failNextConnectWith(new Error('connect refused'));
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });

    it('releases the lease when time() rejects', async () => {
      const wsClient = new ScriptedWsApiClient();
      wsClient.failNextTimeWith(new Error('time request timed out'));
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });

    it('releases the lease when logon() rejects with a transient error', async () => {
      const wsClient = new FakeUserStreamWsApiClient();
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.failNextLogonWith(408, -9999, 'request timed out');
      wsClient.emitConnected();
      await flushMicrotasks();

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });

    it('releases the lease when logon() is rejected as AUTH_REJECTED (-1022)', async () => {
      const wsClient = new FakeUserStreamWsApiClient();
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.failNextLogonWith(400, -1022);
      wsClient.emitConnected();
      await flushMicrotasks();

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });

    it('releases the lease when subscribeUserDataStream() rejects', async () => {
      const wsClient = new FakeUserStreamWsApiClient();
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.failNextSubscribeWith(400, -1102);
      wsClient.emitConnected();
      await flushMicrotasks();

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });

    it('releases the lease when a periodic relogon rejects', async () => {
      jest.useFakeTimers();
      const wsClient = new FakeUserStreamWsApiClient();
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();
      expect(service.getOwnedCredentialKeys()).toEqual(['user-1:live']);

      wsClient.failNextLogonWith(400, -1022);
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRelogonIntervalMs);

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('releases the lease when the client reports session-lost', async () => {
      const wsClient = new FakeUserStreamWsApiClient();
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();
      expect(service.getOwnedCredentialKeys()).toEqual(['user-1:live']);

      wsClient.emitSessionLost();
      await flushMicrotasks();

      await expectReleasedAndReacquirable(prisma, coordination, service);
      await service.onApplicationShutdown();
    });
  });

  describe('negotiation backoff on the sweep (D-16 issue-3, T-04f)', () => {
    it('grows the retry delay exponentially, logs one warn per real attempt (not per sweep tick), and resets the delay after a success', async () => {
      jest.useFakeTimers();
      const randomSpy = mockRandomForZeroJitter();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const wsClient = new ScriptedWsApiClient();
      wsClient.alwaysFailConnectWith = new Error('connect refused');
      const thresholds: ReactiveRuntimeThresholds = {
        ...DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        userStreamSweepIntervalMs: 1_000,
        userStreamNegotiateBaseDelayMs: 10_000,
        userStreamNegotiateMaxDelayMs: 300_000,
        userStreamRelogonIntervalMs: 2_000,
      };
      const baseDelayMs = thresholds.userStreamNegotiateBaseDelayMs;
      const secondDelayMs = baseDelayMs * 2;
      const thirdDelayMs = baseDelayMs * 4;
      const coordination = createSharedFakeCoordination();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        new FakeUserStreamAuthCredentialResolver(),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
        { thresholds },
      );

      await service.onModuleInit();
      expect(wsClient.connectCallCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(baseDelayMs - 1);
      expect(wsClient.connectCallCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(wsClient.connectCallCount).toBe(2);
      expect(warnSpy).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(secondDelayMs - 1);
      expect(wsClient.connectCallCount).toBe(2);
      expect(warnSpy).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1);
      expect(wsClient.connectCallCount).toBe(3);
      expect(warnSpy).toHaveBeenCalledTimes(3);

      wsClient.alwaysFailConnectWith = null;
      await jest.advanceTimersByTimeAsync(thirdDelayMs - 1);
      expect(wsClient.connectCallCount).toBe(3);

      await jest.advanceTimersByTimeAsync(1);
      expect(wsClient.connectCallCount).toBe(4);
      wsClient.emitConnected();
      await flushMicrotasks();
      expect(wsClient.logonCallCount).toBe(1);
      expect(service.getOwnedCredentialKeys()).toEqual(['user-1:live']);
      expect(warnSpy).toHaveBeenCalledTimes(3);

      wsClient.failNextLogonWith(400, -9999, 'transient after success');
      await jest.advanceTimersByTimeAsync(thresholds.userStreamRelogonIntervalMs);
      expect(service.getOwnedCredentialKeys()).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(4);
      const connectCallsAfterRelogonFailure = wsClient.connectCallCount;

      await jest.advanceTimersByTimeAsync(baseDelayMs - 1);
      expect(wsClient.connectCallCount).toBe(connectCallsAfterRelogonFailure);

      await jest.advanceTimersByTimeAsync(1);
      expect(wsClient.connectCallCount).toBe(connectCallsAfterRelogonFailure + 1);

      await service.onApplicationShutdown();
      warnSpy.mockRestore();
      randomSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('correlation is scoped to the session owner (D-05 hardened, §4.5, T-01c)', () => {
    it('produces zero settle calls when the clientOrderId-matched row belongs to a different user than the session owner', async () => {
      const row = buildRestingOrderRow({ userId: 'user-2' });
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('still settles when the clientOrderId-matched row belongs to the same user as the session owner', async () => {
      const row = buildRestingOrderRow({ userId: 'user-1' });
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });

    it('also rejects a backup-identifier match whose row belongs to a different user (defense in depth)', async () => {
      const row = buildRestingOrderRow({ userId: 'user-2', orderId: 'fallback-id' });
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: null,
        entryOrderByBackupId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();
      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, orderId: 'fallback-id' });
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });
  });

  describe('the identity is marked seen only after a successful settle (HU-02 CA-3, D-17, issue-6)', () => {
    it('retries on the next delivery when settleFill throws on the first attempt, and settles then', async () => {
      const row = buildRestingOrderRow();
      const entryOrderService = {
        settleFill: jest
          .fn()
          .mockRejectedValueOnce(new Error('transient Prisma failure'))
          .mockResolvedValueOnce('SETTLED' as SettleFillOutcome),
      };
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { service, wsClient } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { entryOrderService },
      );

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(2);

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });

    it('retries on the next delivery when the trading config resolves to null on the first attempt', async () => {
      const row = buildRestingOrderRow();
      const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });
      prisma.tradingConfig.findUnique.mockReset();
      prisma.tradingConfig.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildTradingConfigRow());
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
      warnSpy.mockRestore();
    });

    it('does not query Prisma again once the identity settled as ALREADY_SETTLED', async () => {
      const row = buildRestingOrderRow();
      const { service, prisma, wsClient, entryOrderService } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { entryOrderService: buildEntryOrderService({ settle: 'ALREADY_SETTLED' }) },
      );

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      prisma.entryOrder.findUnique.mockClear();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);
      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('does not query Prisma again once the identity was marked seen because it did not decode as an entry fill', async () => {
      const { service, prisma, entryOrderService, wsClient } = buildPipelineFixture();

      await service.onModuleInit();

      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, side: 'SELL' });
      await flushMicrotasks();
      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();

      wsClient.emit('execution-report', { ...BASE_EXECUTION_REPORT, side: 'SELL' });
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();
      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('does not query Prisma again once the identity was marked seen because it did not correlate to any RESTING order', async () => {
      const { service, prisma, entryOrderService, wsClient } = buildPipelineFixture({
        entryOrderByClientId: null,
        entryOrderByBackupId: null,
      });

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).not.toHaveBeenCalled();

      prisma.entryOrder.findUnique.mockClear();
      prisma.entryOrder.findFirst.mockClear();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).not.toHaveBeenCalled();
      expect(prisma.entryOrder.findUnique).not.toHaveBeenCalled();
      expect(prisma.entryOrder.findFirst).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
    });

    it('settles exactly once when the same execution report is emitted twice within the same event-loop tick (HU-02 CE-1, T-02d)', async () => {
      const row = buildRestingOrderRow();
      const { service, wsClient, entryOrderService } = buildPipelineFixture({
        entryOrderByClientId: row,
        tradingConfigById: buildTradingConfigRow(),
      });

      await service.onModuleInit();

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await service.onApplicationShutdown();
    });
  });

  describe(`the socket 'error' event never crashes the process (D-18, HU-09 CA-1, T-09a)`, () => {
    it('logs err.message once, does not throw, and does not push the health record back to HEALTHY', async () => {
      jest.useFakeTimers();
      const { service, wsClient } = buildPipelineFixture();

      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHeartbeatMaxAgeMs + 1,
      );
      expect(service.getHealth('user-1', 'live').state).toBe('DEGRADED');

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      expect(() => wsClient.emitError(new Error('boom'))).not.toThrow();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('boom');
      expect(service.getHealth('user-1', 'live').state).not.toBe('HEALTHY');
      expect(service.getOwnedCredentialKeys()).toEqual(['user-1:live']);

      warnSpy.mockRestore();
      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('bounded caches never grow past the configured max (D-19, HU-09 CA-3, T-09c)', () => {
    it('evicts the oldest config/credential/executor once resolver traffic exceeds userStreamResolverCacheSize', async () => {
      const maxSize = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamResolverCacheSize;
      const totalUsers = maxSize + 50;
      const users = Array.from({ length: totalUsers }, (_, i) => `user-${i}`);

      const configById = new Map(
        users.map((userId, i) => [`config-${i}`, buildTradingConfigRow({ id: `config-${i}`, userId })]),
      );
      const restingOrderByClientId = new Map(
        users.map((userId, i) => [
          `client-${i}`,
          buildRestingOrderRow({
            id: `entry-${i}`,
            userId,
            configId: `config-${i}`,
            clientOrderId: `client-${i}`,
            orderId: `order-${i}`,
          }),
        ]),
      );

      const prisma = {
        tradingConfig: {
          findMany: jest
            .fn()
            .mockResolvedValue(users.map((userId) => ({ userId, mode: TradingMode.LIVE }))),
          findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(configById.get(id) ?? null),
          ),
        },
        entryOrder: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn(({ where: { clientOrderId } }: { where: { clientOrderId: string } }) =>
            Promise.resolve(restingOrderByClientId.get(clientOrderId) ?? null),
          ),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        binanceCredential: {
          findUnique: jest.fn().mockResolvedValue(DEFAULT_CREDENTIAL_ROW),
        },
      };

      const wsClients: FakeUserStreamWsApiClient[] = [];
      const wsApiFactory = jest.fn(() => {
        const client = new FakeUserStreamWsApiClient();
        wsClients.push(client);
        return client;
      });

      const service = new UserDataStreamService(
        prisma as never,
        createSharedFakeCoordination(),
        buildEntryOrderService() as never,
        buildFastPath() as never,
        new FakeUserStreamAuthCredentialResolver(),
        wsApiFactory as never,
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        'instance-a',
      );

      await service.onModuleInit();
      expect(wsClients).toHaveLength(totalUsers);

      for (let i = 0; i < totalUsers; i += 1) {
        wsClients[i].emitExecutionReport({ clientOrderId: `client-${i}`, orderId: `order-${i}` });
        await flushMicrotasks();
      }

      const configCallsAfterFill = prisma.tradingConfig.findUnique.mock.calls.length;
      const credentialCallsAfterFill = prisma.binanceCredential.findUnique.mock.calls.length;
      expect(configCallsAfterFill).toBe(totalUsers);
      expect(credentialCallsAfterFill).toBe(totalUsers);

      wsClients[0].emitExecutionReport({ clientOrderId: 'client-0', orderId: 'order-0-again' });
      await flushMicrotasks();

      expect(prisma.tradingConfig.findUnique.mock.calls.length).toBe(configCallsAfterFill + 1);
      expect(prisma.binanceCredential.findUnique.mock.calls.length).toBe(credentialCallsAfterFill + 1);

      const configCallsAfterOldestRetry = prisma.tradingConfig.findUnique.mock.calls.length;
      const credentialCallsAfterOldestRetry = prisma.binanceCredential.findUnique.mock.calls.length;

      const newestIndex = totalUsers - 1;
      wsClients[newestIndex].emitExecutionReport({
        clientOrderId: `client-${newestIndex}`,
        orderId: `order-${newestIndex}-again`,
      });
      await flushMicrotasks();

      expect(prisma.tradingConfig.findUnique.mock.calls.length).toBe(configCallsAfterOldestRetry);
      expect(prisma.binanceCredential.findUnique.mock.calls.length).toBe(
        credentialCallsAfterOldestRetry,
      );

      await service.onApplicationShutdown();
    });
  });

  describe('security sentinel — the Ed25519 private key, its signature and the apiKey never leak (HU-06, T-06)', () => {
    const API_KEY_SENTINEL = 'API-KEY-SENTINEL';
    const PRIVATE_KEY_SENTINEL = 'PRIVATE-KEY-SENTINEL';
    const SIGNATURE_SENTINEL = 'SIGNATURE-SENTINEL';
    const SECURITY_SENTINELS = [API_KEY_SENTINEL, PRIVATE_KEY_SENTINEL, SIGNATURE_SENTINEL];

    function buildSentinelSigner(): Ed25519Signer {
      const capturedPrivateKeyPem = PRIVATE_KEY_SENTINEL;
      return {
        sign: jest.fn((params: Record<string, string>) => {
          if (capturedPrivateKeyPem.length === 0 || Object.keys(params).length === 0) {
            throw new Error('a real signer always receives apiKey and timestamp');
          }
          return SIGNATURE_SENTINEL;
        }),
      };
    }

    function serializeForLeakCheck(value: unknown): string {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    }

    function assertNoSentinelLeak(values: readonly unknown[]): void {
      for (const value of values) {
        const serialized = serializeForLeakCheck(value);
        for (const sentinel of SECURITY_SENTINELS) {
          expect(serialized).not.toContain(sentinel);
        }
      }
    }

    function collectAllLoggedArgs(...spies: jest.SpyInstance[]): unknown[] {
      return spies.flatMap((spy) => spy.mock.calls.flat());
    }

    it('never leaks any of the three sentinels across connect, time, logon, subscribe, an execution report, a relogon, a rejected relogon and shutdown', async () => {
      jest.useFakeTimers();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();

      const authCredentials = new FakeUserStreamAuthCredentialResolver({
        kind: 'RESOLVED',
        apiKey: API_KEY_SENTINEL,
        signer: buildSentinelSigner(),
      });
      const row = buildRestingOrderRow();
      const { service, wsClient, entryOrderService } = buildPipelineFixture(
        { entryOrderByClientId: row, tradingConfigById: buildTradingConfigRow() },
        { authCredentials },
      );

      await service.onModuleInit();
      expect(wsClient.connectCallCount).toBe(1);

      wsClient.emitConnected();
      await flushMicrotasks();
      expect(wsClient.timeCallCount).toBe(1);
      expect(wsClient.logonCallCount).toBe(1);
      expect(wsClient.logonApiKeys).toEqual([API_KEY_SENTINEL]);
      expect(wsClient.subscribeUserDataStreamCallCount).toBe(1);

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();
      expect(entryOrderService.settleFill).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRelogonIntervalMs);
      expect(wsClient.logonCallCount).toBe(2);
      expect(service.getOwnedCredentialKeys()).toEqual(['user-1:live']);

      wsClient.failNextLogonWith(400, -1022, 'Signature for this request is not valid.');
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRelogonIntervalMs);
      expect(wsClient.logonCallCount).toBe(3);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await service.onApplicationShutdown();

      const loggedArgs = collectAllLoggedArgs(logSpy, warnSpy, errorSpy, debugSpy);
      expect(loggedArgs.length).toBeGreaterThan(0);
      assertNoSentinelLeak(loggedArgs);
      assertNoSentinelLeak(entryOrderService.settleFill.mock.calls.flat());

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      debugSpy.mockRestore();
      jest.useRealTimers();
    });

    it('the underlying error object may carry the credential in an extra property, but the socket error listener logs only err.message (D-18 complement)', async () => {
      const { service, wsClient } = buildPipelineFixture();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.onModuleInit();
      wsClient.emitConnected();
      await flushMicrotasks();

      const poisonedError = Object.assign(new Error('WebSocket closed unexpectedly'), {
        request: {
          apiKey: API_KEY_SENTINEL,
          signature: SIGNATURE_SENTINEL,
          privateKeyPem: PRIVATE_KEY_SENTINEL,
        },
      });
      expect(JSON.stringify(poisonedError)).toContain(API_KEY_SENTINEL);

      expect(() => wsClient.emitError(poisonedError)).not.toThrow();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('WebSocket closed unexpectedly');
      assertNoSentinelLeak(warnSpy.mock.calls.flat());

      warnSpy.mockRestore();
      await service.onApplicationShutdown();
    });

    it('BinanceWsApiError carries only status/code/method/message — never the request that failed, even though it carried the sentinels (T-06 complement)', async () => {
      const wsClient = new FakeUserStreamWsApiClient();
      const signer = buildSentinelSigner();
      wsClient.failNextLogonWith(400, -1022, 'Signature for this request is not valid.');

      let caught: unknown;
      try {
        await wsClient.logon({ apiKey: API_KEY_SENTINEL, signer });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BinanceWsApiError);
      const err = caught as BinanceWsApiError;
      expect(Object.getOwnPropertyNames(err).sort()).toEqual(
        ['code', 'message', 'method', 'name', 'stack', 'status'].sort(),
      );
      assertNoSentinelLeak([err.message, err.status, err.code, err.method, JSON.stringify(err)]);
    });

    it('the sentinel signer serializes to an empty object, exposing no closed-over key material', () => {
      const signer = buildSentinelSigner();
      expect(JSON.stringify(signer)).toBe('{}');
    });

    describe('redactWsApiRequest masks apiKey and signature, leaves everything else intact (T-06 complement)', () => {
      it.each([
        [
          'a session.logon frame carrying the sentinel apiKey and signature',
          {
            id: 'r1',
            method: 'session.logon',
            params: { apiKey: API_KEY_SENTINEL, timestamp: '123', signature: SIGNATURE_SENTINEL },
          },
          {
            id: 'r1',
            method: 'session.logon',
            params: { apiKey: '***', timestamp: '123', signature: '***' },
          },
        ],
        [
          'a time frame with no sensitive params',
          { id: 'r2', method: 'time', params: {} },
          { id: 'r2', method: 'time', params: {} },
        ],
        [
          'a userDataStream.subscribe frame carrying only the apiKey',
          { id: 'r3', method: 'userDataStream.subscribe', params: { apiKey: API_KEY_SENTINEL } },
          { id: 'r3', method: 'userDataStream.subscribe', params: { apiKey: '***' } },
        ],
      ])('redacts %s', (_label, frame, expected) => {
        expect(redactWsApiRequest(frame)).toEqual(expected);
      });

      it('never leaves any sentinel in the redacted frame', () => {
        const redacted = redactWsApiRequest({
          id: 'r4',
          method: 'session.logon',
          params: { apiKey: API_KEY_SENTINEL, timestamp: '999', signature: SIGNATURE_SENTINEL },
        });
        assertNoSentinelLeak([redacted]);
      });
    });
  });
});
