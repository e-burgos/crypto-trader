import { EventEmitter } from 'events';
import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
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
import {
  USER_STREAM_REST_FACTORY,
  USER_STREAM_WS_FACTORY,
  UserDataStreamService,
  type UserStreamRestClient,
  type UserStreamWsClient,
} from './user-data-stream.service';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';

function mockQueue() {
  return {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
}

class CountingUserStreamRestClient implements UserStreamRestClient {
  createListenKeyCalls = 0;
  keepAliveListenKeyCalls: string[] = [];
  closeListenKeyCalls: string[] = [];

  async createListenKey(): Promise<string> {
    this.createListenKeyCalls += 1;
    return 'counting-rest-client-listen-key';
  }

  async keepAliveListenKey(listenKey: string): Promise<void> {
    this.keepAliveListenKeyCalls.push(listenKey);
  }

  async closeListenKey(listenKey: string): Promise<void> {
    this.closeListenKeyCalls.push(listenKey);
  }

  getBaseUrl(): string {
    return 'https://counting-rest-client';
  }
}

class CountingUserStreamWsClient extends EventEmitter implements UserStreamWsClient {
  connectCalls = 0;
  disconnectCalls = 0;
  connectedFlag = false;

  connect(): void {
    this.connectCalls += 1;
    this.connectedFlag = true;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.connectedFlag = false;
  }

  isConnected(): boolean {
    return this.connectedFlag;
  }

  getBaseUrl(): string {
    return 'wss://counting-ws-client';
  }
}

async function compileAppModuleWithCountingUserStreamFactories(
  restDouble: CountingUserStreamRestClient,
  wsDouble: CountingUserStreamWsClient,
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
    .overrideProvider(USER_STREAM_REST_FACTORY)
    .useValue(() => restDouble)
    .overrideProvider(USER_STREAM_WS_FACTORY)
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
    const restDouble = new CountingUserStreamRestClient();
    const wsDouble = new CountingUserStreamWsClient();

    const moduleRef = await compileAppModuleWithCountingUserStreamFactories(restDouble, wsDouble);

    expect(moduleRef.get(UserDataStreamService)).toBeNull();

    jest.useFakeTimers();
    jest.advanceTimersByTime(
      DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSweepIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamSubscriptionRefreshIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamKeepaliveIntervalMs +
        DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamHealthPublishIntervalMs +
        1,
    );

    expect(restDouble.createListenKeyCalls).toBe(0);
    expect(wsDouble.connectCalls).toBe(0);

    await moduleRef.close();
  });

  it('instantiates the service when the flag is on, without opening any real connection', async () => {
    process.env.USER_DATA_STREAM_FILLS_ENABLED = 'true';
    const restDouble = new CountingUserStreamRestClient();
    const wsDouble = new CountingUserStreamWsClient();

    const moduleRef = await compileAppModuleWithCountingUserStreamFactories(restDouble, wsDouble);

    expect(moduleRef.get(UserDataStreamService)).toBeInstanceOf(UserDataStreamService);
    expect(restDouble.createListenKeyCalls).toBe(0);
    expect(wsDouble.connectCalls).toBe(0);

    await moduleRef.close();
  });
});
