import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { TradingMode } from '@crypto-trader/shared';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { TRADING_QUEUE } from '../trading/trading.service';
import { EVALUATION_QUEUE } from '../agents/evaluation/evaluation.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../orchestrator/document-processor.service';
import { MarketStreamService } from './market-stream.service';
import { StreamHealthService } from './stream-health.service';
import { StreamHealthController } from './stream-health.controller';
import { FastPathService } from './fast-path.service';
import { EntryFillWatchService } from './entry-fill-watch.service';
import { MaterialEventService } from './material-event.service';
import { EntryOrderService } from '../trading/entry-order.service';
import { UserDataStreamService, type CredentialEnv } from './user-data-stream.service';
import {
  USER_STREAM_AUTH_CREDENTIAL,
  type UserStreamAuthCredentialPort,
  type UserStreamAuthResolution,
} from './user-stream-auth-credential.port';
import { USER_STREAM_WS_API_FACTORY, FakeUserStreamWsApiClient } from './user-stream-ws-api.test-double';
import { REACTIVE_COORDINATION } from './reactive-coordination.port';
import { createSharedFakeCoordination } from './reactive-coordination.test-double';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

const ED25519_ENV_KEYS = [
  'BINANCE_API_TESTNET_ED25519_KEY',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE',
  'BINANCE_API_ED25519_KEY',
  'BINANCE_API_ED25519_PRIVATE_KEY',
  'BINANCE_API_ED25519_PRIVATE_KEY_PATH',
  'BINANCE_API_ED25519_PRIVATE_KEY_PASSPHRASE',
  'USER_DATA_STREAM_ED25519_USER_IDS',
] as const;

function mockQueue() {
  return {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
}

class CountingUserStreamAuthCredentialResolver implements UserStreamAuthCredentialPort {
  resolveCallCount = 0;

  async resolve(_userId: string, _env: CredentialEnv): Promise<UserStreamAuthResolution> {
    this.resolveCallCount += 1;
    return { kind: 'ABSENT' };
  }
}

async function compileAppModuleWithCountingUserStreamDoubles(
  authDouble: UserStreamAuthCredentialPort,
  wsDouble: FakeUserStreamWsApiClient,
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(getQueueToken(TRADING_QUEUE))
    .useValue(mockQueue())
    .overrideProvider(getQueueToken(EVALUATION_QUEUE))
    .useValue(mockQueue())
    .overrideProvider(getQueueToken(DOCUMENT_PROCESSING_QUEUE))
    .useValue(mockQueue())
    .overrideProvider(USER_STREAM_AUTH_CREDENTIAL)
    .useValue(authDouble)
    .overrideProvider(USER_STREAM_WS_API_FACTORY)
    .useValue(() => wsDouble)
    .compile();
}

describe('ReactiveModule wiring in AppModule', () => {
  it('resolves the reactive services and the stream-health controller through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(getQueueToken(TRADING_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(EVALUATION_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(DOCUMENT_PROCESSING_QUEUE))
      .useValue(mockQueue())
      .compile();

    expect(moduleRef.get(MarketStreamService)).toBeInstanceOf(MarketStreamService);
    expect(moduleRef.get(StreamHealthService)).toBeInstanceOf(StreamHealthService);
    expect(moduleRef.get(FastPathService)).toBeInstanceOf(FastPathService);
    expect(moduleRef.get(EntryFillWatchService)).toBeInstanceOf(EntryFillWatchService);
    expect(moduleRef.get(EntryOrderService)).toBeInstanceOf(EntryOrderService);
    expect(moduleRef.get(MaterialEventService)).toBeInstanceOf(MaterialEventService);

    const controller = moduleRef.get(StreamHealthController);
    expect(controller).toBeInstanceOf(StreamHealthController);
    expect(
      (controller as unknown as { streamHealth: StreamHealthService })
        .streamHealth,
    ).toBe(moduleRef.get(StreamHealthService));

    await moduleRef.close();
  });
});

describe('UserDataStreamService platform off-switch (HU-03 CA-1)', () => {
  const originalFlag = process.env.USER_DATA_STREAM_FILLS_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.USER_DATA_STREAM_FILLS_ENABLED;
    } else {
      process.env.USER_DATA_STREAM_FILLS_ENABLED = originalFlag;
    }
    jest.useRealTimers();
  });

  it('never instantiates the service and its transport doubles record zero calls, past every userStream interval', async () => {
    delete process.env.USER_DATA_STREAM_FILLS_ENABLED;
    const authDouble = new CountingUserStreamAuthCredentialResolver();
    const wsDouble = new FakeUserStreamWsApiClient();

    const moduleRef = await compileAppModuleWithCountingUserStreamDoubles(authDouble, wsDouble);

    expect(moduleRef.get(UserDataStreamService)).toBeNull();

    jest.useFakeTimers();
    jest.advanceTimersByTime(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSweepIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSubscriptionRefreshIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHealthPublishIntervalMs +
        1,
    );

    expect(authDouble.resolveCallCount).toBe(0);
    expect(wsDouble.connectCallCount).toBe(0);

    await moduleRef.close();
  });

  it('instantiates the service when the flag is on, without opening any real connection', async () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'true';
    const authDouble = new CountingUserStreamAuthCredentialResolver();
    const wsDouble = new FakeUserStreamWsApiClient();

    const moduleRef = await compileAppModuleWithCountingUserStreamDoubles(authDouble, wsDouble);

    expect(moduleRef.get(UserDataStreamService)).toBeInstanceOf(UserDataStreamService);
    expect(authDouble.resolveCallCount).toBe(0);
    expect(wsDouble.connectCallCount).toBe(0);

    await moduleRef.close();
  });
});

describe('UserDataStreamService boot with the flag on and no Ed25519 credential (HU-08)', () => {
  const originalFlag = process.env.USER_DATA_STREAM_FILLS_ENABLED;
  const originalEd25519Env: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ED25519_ENV_KEYS) {
      originalEd25519Env[key] = process.env[key];
      delete process.env[key];
    }
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'true';
  });

  afterEach(() => {
    for (const key of ED25519_ENV_KEYS) {
      if (originalEd25519Env[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEd25519Env[key];
      }
    }
    if (originalFlag === undefined) {
      delete process.env.USER_DATA_STREAM_FILLS_ENABLED;
    } else {
      process.env.USER_DATA_STREAM_FILLS_ENABLED = originalFlag;
    }
    jest.useRealTimers();
  });

  it('boots the real EnvUserStreamAuthCredentialResolver without taking a lease, opening a socket, or logging more than once a minute', async () => {
    const fakeCoordination = createSharedFakeCoordination();
    const wsDouble = new FakeUserStreamWsApiClient();
    const prismaStub = {
      tradingConfig: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'user-1', mode: TradingMode.TESTNET }]),
      },
      entryOrder: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideProvider(getQueueToken(TRADING_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(EVALUATION_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(getQueueToken(DOCUMENT_PROCESSING_QUEUE))
      .useValue(mockQueue())
      .overrideProvider(REACTIVE_COORDINATION)
      .useValue(fakeCoordination)
      .overrideProvider(USER_STREAM_WS_API_FACTORY)
      .useValue(() => wsDouble)
      .compile();

    const service = moduleRef.get(UserDataStreamService);
    expect(service).toBeInstanceOf(UserDataStreamService);

    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    jest.useFakeTimers();
    await service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(fakeCoordination.tryAcquire).not.toHaveBeenCalled();
    expect(wsDouble.connectCallCount).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    await service.onApplicationShutdown();
    await moduleRef.close();
  });
});
