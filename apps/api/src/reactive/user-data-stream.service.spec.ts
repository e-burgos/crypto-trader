import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { TradingMode } from '@crypto-trader/shared';
import type { ExecutionReportEvent } from '@crypto-trader/data-fetcher';
import {
  UserDataStreamService,
  userStreamOwnerLeaseKey,
  userStreamHealthKey,
  type UserStreamRestClient,
  type UserStreamWsClient,
} from './user-data-stream.service';
import {
  DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  type ReactiveRuntimeThresholds,
} from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { createSharedFakeCoordination } from './reactive-coordination.test-double';
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

function makeBinanceError(code: number): Error {
  const err = new Error(`Binance error ${code}`) as Error & {
    response: { data: { code: number } };
  };
  err.response = { data: { code } };
  return err;
}

class FakeUserStreamWsClient extends EventEmitter implements UserStreamWsClient {
  connectedFlag = false;
  connectCalls: string[] = [];
  disconnectCalls = 0;
  connect = jest.fn((listenKey: string) => {
    this.connectCalls.push(listenKey);
    this.connectedFlag = true;
  });
  disconnect = jest.fn(() => {
    this.disconnectCalls += 1;
    this.connectedFlag = false;
  });
  isConnected = jest.fn(() => this.connectedFlag);
  getBaseUrl = jest.fn(() => 'wss://fake');

  emitListenKeyExpired(): void {
    this.emit('stream-expired', { at: Date.now(), reason: 'LISTEN_KEY_EXPIRED' });
  }

  emitReconnectExhausted(): void {
    this.emit('stream-expired', { at: Date.now(), reason: 'RECONNECT_EXHAUSTED' });
  }
}

class FakeUserStreamRestClient implements UserStreamRestClient {
  createdKeys: string[] = [];
  keepAliveCalls: string[] = [];
  closeCalls: string[] = [];
  private failNext: { method: 'create' | 'keepAlive' | 'close'; code: number } | null = null;

  failNextWith(method: 'create' | 'keepAlive' | 'close', code: number): void {
    this.failNext = { method, code };
  }

  private consumeFailure(method: 'create' | 'keepAlive' | 'close'): void {
    if (this.failNext?.method === method) {
      const { code } = this.failNext;
      this.failNext = null;
      throw makeBinanceError(code);
    }
  }

  async createListenKey(): Promise<string> {
    this.consumeFailure('create');
    const key = `listen-key-${this.createdKeys.length + 1}`;
    this.createdKeys.push(key);
    return key;
  }

  async keepAliveListenKey(listenKey: string): Promise<void> {
    this.keepAliveCalls.push(listenKey);
    this.consumeFailure('keepAlive');
  }

  async closeListenKey(listenKey: string): Promise<void> {
    this.closeCalls.push(listenKey);
    this.consumeFailure('close');
  }

  getBaseUrl(): string {
    return 'https://fake';
  }
}

class SentinelRestClient implements UserStreamRestClient {
  keepAliveCallCount = 0;

  async createListenKey(): Promise<string> {
    return 'LISTEN-KEY-SENTINEL';
  }

  async keepAliveListenKey(listenKey: string): Promise<void> {
    this.keepAliveCallCount += 1;
    const err = new Error('Request failed with status code 400') as Error & {
      response: { data: { code: number } };
      config: { url: string };
    };
    err.response = { data: { code: -1125 } };
    err.config = { url: `https://api.binance.com/api/v3/userDataStream?listenKey=${listenKey}` };
    throw err;
  }

  async closeListenKey(): Promise<void> {
    return undefined;
  }

  getBaseUrl(): string {
    return 'https://fake';
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
  restFactory: jest.Mock,
  wsFactory: jest.Mock,
  instanceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: { entryOrderService?: any; fastPath?: any } = {},
) {
  return new UserDataStreamService(
    prisma as never,
    coordination,
    (deps.entryOrderService ?? buildEntryOrderService()) as never,
    (deps.fastPath ?? buildFastPath()) as never,
    restFactory as never,
    wsFactory as never,
    DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    instanceId,
  );
}

function buildPipelineFixture(
  prismaOpts: Parameters<typeof createFakePrisma>[0] = {},
  overrides: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryOrderService?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastPath?: any;
    thresholds?: ReactiveRuntimeThresholds;
    rest?: FakeUserStreamRestClient;
  } = {},
) {
  const coordination = createSharedFakeCoordination();
  const restClient = overrides.rest ?? new FakeUserStreamRestClient();
  const wsClient = new FakeUserStreamWsClient();
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
    jest.fn().mockReturnValue(restClient) as never,
    jest.fn().mockReturnValue(wsClient) as never,
    overrides.thresholds ?? DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    'instance-a',
  );
  return { service, prisma, coordination, restClient, wsClient, entryOrderService, fastPath };
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

async function flushMicrotasks(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('UserDataStreamService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('one owner per credential (HU-04 CA-4)', () => {
    it('gives exactly one of two replicas the createListenKey/connect calls for the same credential', async () => {
      const coordination = createSharedFakeCoordination();
      const restA = new FakeUserStreamRestClient();
      const restB = new FakeUserStreamRestClient();
      const wsA = new FakeUserStreamWsClient();
      const wsB = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });

      const serviceA = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restA),
        jest.fn().mockReturnValue(wsA),
        'instance-a',
      );
      const serviceB = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restB),
        jest.fn().mockReturnValue(wsB),
        'instance-b',
      );

      await serviceA.onModuleInit();
      await serviceB.onModuleInit();

      expect(serviceA.isOwner('user-1', 'live')).not.toBe(serviceB.isOwner('user-1', 'live'));

      const aIsOwner = serviceA.isOwner('user-1', 'live');
      const owner = aIsOwner ? serviceA : serviceB;
      const standby = aIsOwner ? serviceB : serviceA;
      const ownerRest = aIsOwner ? restA : restB;
      const ownerWs = aIsOwner ? wsA : wsB;
      const standbyRest = aIsOwner ? restB : restA;
      const standbyWs = aIsOwner ? wsB : wsA;

      expect(ownerRest.createdKeys).toHaveLength(1);
      expect(ownerWs.connectCalls).toHaveLength(1);
      expect(standbyRest.createdKeys).toHaveLength(0);
      expect(standbyWs.connectCalls).toHaveLength(0);

      await owner.onApplicationShutdown();
      await standby.onApplicationShutdown();
    });
  });

  describe('fail-closed when coordination is unavailable', () => {
    it('never calls tryAcquire, createListenKey nor connect when the coordination port is unhealthy', async () => {
      const coordination = createSharedFakeCoordination();
      coordination.setHealthy(false);
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(restClient.createdKeys).toEqual([]);
      expect(wsClient.connectCalls).toEqual([]);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await service.onApplicationShutdown();
    });

    it('never calls tryAcquire nor connects, and stays silent, when the coordination driver is deliberately disabled', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const coordination: ReactiveCoordinationPort = {
        ...createSharedFakeCoordination(),
        isHealthy: () => false,
        isEnabled: () => false,
      };
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(restClient.createdKeys).toEqual([]);
      expect(wsClient.connectCalls).toEqual([]);
      expect(errorSpy).not.toHaveBeenCalled();

      await service.onApplicationShutdown();
      errorSpy.mockRestore();
    });
  });

  describe('subscription scope', () => {
    it('never subscribes a SANDBOX credential', async () => {
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.SANDBOX }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).not.toHaveBeenCalled();
      expect(restClient.createdKeys).toEqual([]);

      await service.onApplicationShutdown();
    });

    it('releases the lease immediately when no BinanceCredential row exists for the acquired credential', async () => {
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({
        configs: [{ userId: 'user-1', mode: TradingMode.LIVE }],
        credential: null,
      });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();

      expect(coordination.tryAcquire).toHaveBeenCalled();
      expect(coordination.release).toHaveBeenCalledWith(
        userStreamOwnerLeaseKey('user-1', 'live'),
        'instance-a',
      );
      expect(restClient.createdKeys).toEqual([]);
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      await service.onApplicationShutdown();
    });
  });

  describe('keepalive (HU-04 CA-1)', () => {
    it('keeps renewing the listenKey with a PUT well before the 60 minute expiry window elapses', async () => {
      jest.useFakeTimers();
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeyExpiryMs);

      expect(restClient.keepAliveCalls.length).toBeGreaterThanOrEqual(1);

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });

  describe('renegotiation (HU-04 CA-2)', () => {
    async function setupOwnedCredential() {
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );
      await service.onModuleInit();
      return { service, coordination, restClient, wsClient };
    }

    it('renegotiates on a listenKeyExpired signal, connecting a new listenKey even when closing the stale one fails', async () => {
      const { service, restClient, wsClient } = await setupOwnedCredential();
      restClient.failNextWith('close', -2011);

      wsClient.emitListenKeyExpired();
      await flushMicrotasks();

      expect(restClient.closeCalls).toEqual([restClient.createdKeys[0]]);
      expect(restClient.createdKeys).toHaveLength(2);
      expect(wsClient.connectCalls).toEqual(restClient.createdKeys);

      await service.onApplicationShutdown();
    });

    it('renegotiates when keepAliveListenKey fails with -1125 (listenKey does not exist)', async () => {
      jest.useFakeTimers();
      const { service, restClient, wsClient } = await setupOwnedCredential();
      restClient.failNextWith('keepAlive', -1125);

      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveIntervalMs);

      expect(restClient.createdKeys).toHaveLength(2);
      expect(wsClient.connectCalls).toEqual(restClient.createdKeys);

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });

    it('renegotiates when the WS client reports RECONNECT_EXHAUSTED', async () => {
      const { service, restClient, wsClient } = await setupOwnedCredential();

      wsClient.emitReconnectExhausted();
      await flushMicrotasks();

      expect(restClient.createdKeys).toHaveLength(2);
      expect(wsClient.connectCalls).toEqual(restClient.createdKeys);

      await service.onApplicationShutdown();
    });
  });

  describe('ordered shutdown (HU-04 CA-3)', () => {
    it('stops timers, disconnects the ws client, closes the listenKey and releases the lease', async () => {
      jest.useFakeTimers();
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      const [listenKey] = restClient.createdKeys;

      await service.onApplicationShutdown();

      expect(wsClient.disconnectCalls).toBe(1);
      expect(restClient.closeCalls).toEqual([listenKey]);
      expect(coordination.release).toHaveBeenCalledWith(
        userStreamOwnerLeaseKey('user-1', 'live'),
        'instance-a',
      );
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      const tryAcquireCallsBefore = (coordination.tryAcquire as jest.Mock).mock.calls.length;
      const renewCallsBefore = (coordination.renew as jest.Mock).mock.calls.length;
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSweepIntervalMs * 5);
      expect((coordination.tryAcquire as jest.Mock).mock.calls.length).toBe(tryAcquireCallsBefore);
      expect((coordination.renew as jest.Mock).mock.calls.length).toBe(renewCallsBefore);

      jest.useRealTimers();
    });

    it('skips the DELETE and the release when the lease was already lost before shutdown', async () => {
      const coordination = createSharedFakeCoordination();
      const restClient = new FakeUserStreamRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      expect(service.getOwnedCredentialKeys()).toHaveLength(1);

      (coordination.renew as jest.Mock).mockResolvedValueOnce(false);
      await service.runOwnershipCycle();
      expect(service.getOwnedCredentialKeys()).toEqual([]);

      restClient.closeCalls = [];
      (coordination.release as jest.Mock).mockClear();

      await service.onApplicationShutdown();

      expect(restClient.closeCalls).toEqual([]);
      expect(coordination.release).not.toHaveBeenCalled();
    });
  });

  describe('security sentinel (HU-06 CA-1/CA-2)', () => {
    it('never lets the listenKey or the API key leak into any Logger call, including the keepAliveListenKey error path', async () => {
      jest.useFakeTimers();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();

      (decrypt as jest.Mock).mockImplementation((value: string) =>
        value === 'enc-key' ? 'API-KEY-SENTINEL' : 'irrelevant-secret-value',
      );

      const coordination = createSharedFakeCoordination();
      const restClient = new SentinelRestClient();
      const wsClient = new FakeUserStreamWsClient();
      const prisma = createFakePrisma({ configs: [{ userId: 'user-1', mode: TradingMode.LIVE }] });
      const service = buildService(
        prisma,
        coordination,
        jest.fn().mockReturnValue(restClient),
        jest.fn().mockReturnValue(wsClient),
        'instance-a',
      );

      await service.onModuleInit();
      await jest.advanceTimersByTimeAsync(DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveIntervalMs);

      wsClient.emit('execution-report', BASE_EXECUTION_REPORT);
      await flushMicrotasks();

      expect(restClient.keepAliveCallCount).toBeGreaterThan(0);
      expect(wsClient.connectCalls).toContain('LISTEN-KEY-SENTINEL');

      const allCalls = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...debugSpy.mock.calls,
      ];
      expect(allCalls.length).toBeGreaterThan(0);
      for (const call of allCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain('LISTEN-KEY-SENTINEL');
        expect(serialized).not.toContain('API-KEY-SENTINEL');
      }

      await service.onApplicationShutdown();
      jest.useRealTimers();
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe('correlation (D-05, TASK-010)', () => {
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

  describe('settle outcome branching (D-06/§2.4)', () => {
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

  describe('deduplication of redeliveries (HU-02 CA-2, TASK-011)', () => {
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

  describe('health model (HU-05, TASK-008)', () => {
    it('reads HEALTHY with zero fill events but a fresh heartbeat and keepalive', async () => {
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

    it('reads DEGRADED once the keepalive goes stale, even while the heartbeat stays fresh', async () => {
      jest.useFakeTimers();
      class AlwaysFailingKeepaliveRestClient extends FakeUserStreamRestClient {
        async keepAliveListenKey(): Promise<void> {
          throw new Error('network blip');
        }
      }
      const { service, wsClient } = buildPipelineFixture(
        {},
        { rest: new AlwaysFailingKeepaliveRestClient() },
      );

      await service.onModuleInit();

      const heartbeatStepMs = Math.floor(
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHeartbeatMaxAgeMs / 2,
      );
      const totalMs = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveMaxAgeMs + heartbeatStepMs;
      let elapsed = 0;
      while (elapsed < totalMs) {
        await jest.advanceTimersByTimeAsync(heartbeatStepMs);
        elapsed += heartbeatStepMs;
        wsClient.emit('heartbeat', { at: Date.now() });
      }

      expect(service.getHealth('user-1', 'live')).toEqual({
        state: 'DEGRADED',
        reason: 'KEEPALIVE_STALE',
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

      wsClient.emit('heartbeat', { at: Date.now() });
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
          'lastKeepaliveAtMs',
          'ownerId',
          'publishedAt',
        ].sort(),
      );

      await service.onApplicationShutdown();
      jest.useRealTimers();
    });
  });
});
