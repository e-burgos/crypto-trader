import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { TradingMode } from '@crypto-trader/shared';
import {
  UserDataStreamService,
  userStreamOwnerLeaseKey,
  type UserStreamRestClient,
  type UserStreamWsClient,
} from './user-data-stream.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { createSharedFakeCoordination } from './reactive-coordination.test-double';
import { decrypt } from '../users/utils/encryption.util';

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
  } = {},
) {
  return {
    tradingConfig: { findMany: jest.fn().mockResolvedValue(opts.configs ?? []) },
    entryOrder: { findMany: jest.fn().mockResolvedValue(opts.restingOrders ?? []) },
    binanceCredential: {
      findUnique: jest.fn().mockResolvedValue(
        opts.credential === undefined ? DEFAULT_CREDENTIAL_ROW : opts.credential,
      ),
    },
  };
}

function buildService(
  prisma: ReturnType<typeof createFakePrisma>,
  coordination: ReactiveCoordinationPort,
  restFactory: jest.Mock,
  wsFactory: jest.Mock,
  instanceId: string,
) {
  return new UserDataStreamService(
    prisma as never,
    coordination,
    restFactory as never,
    wsFactory as never,
    DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
    instanceId,
  );
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
});
