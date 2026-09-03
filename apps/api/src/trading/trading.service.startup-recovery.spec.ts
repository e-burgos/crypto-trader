import { Logger } from '@nestjs/common';
import { TradingService } from './trading.service';
import {
  QUEUE_BOOTSTRAP_TIMEOUT_MS,
  QUEUE_SETTLE_AFTER_READY_MS,
  QUEUE_UNAVAILABLE_AT_BOOTSTRAP,
} from '../common/queue-bootstrap';

function createPrismaWithRunningConfig() {
  return {
    tradingConfig: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'config-1', userId: 'user-1' }]),
    },
  } as never;
}

function createStalledQueue() {
  const stall = <T>(): Promise<T> => new Promise<T>(() => undefined);
  let ready: (value: unknown) => void = () => undefined;
  let stalled = true;
  return {
    add: jest.fn(() => (stalled ? stall<object>() : Promise.resolve({}))),
    getWaiting: jest.fn(() =>
      stalled ? stall<unknown[]>() : Promise.resolve([]),
    ),
    getDelayed: jest.fn(() =>
      stalled ? stall<unknown[]>() : Promise.resolve([]),
    ),
    getActive: jest.fn(() =>
      stalled ? stall<unknown[]>() : Promise.resolve([]),
    ),
    isReady: jest.fn(() => new Promise((resolve) => (ready = resolve))),
    stopStalling() {
      stalled = false;
    },
    becomeReady() {
      stalled = false;
      ready({});
    },
  };
}

function buildService(queue: ReturnType<typeof createStalledQueue>) {
  return new TradingService(
    createPrismaWithRunningConfig(),
    queue as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
}

describe('TradingService startup recovery', () => {
  it('does not block the bootstrap when the queue never answers, and recovers once Redis returns', async () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const queue = createStalledQueue();
    const service = buildService(queue);

    const bootstrap = service.onModuleInit();
    await jest.advanceTimersByTimeAsync(QUEUE_BOOTSTRAP_TIMEOUT_MS);
    await bootstrap;

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(QUEUE_UNAVAILABLE_AT_BOOTSTRAP),
    );
    expect(queue.add).not.toHaveBeenCalled();

    queue.becomeReady();
    await jest.advanceTimersByTimeAsync(QUEUE_SETTLE_AFTER_READY_MS);

    expect(queue.add).toHaveBeenCalledWith(
      'run-cycle',
      { userId: 'user-1', configId: 'config-1' },
      { jobId: 'agent-user-1-config-1', removeOnComplete: true },
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Redis is reachable again'),
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
    jest.useRealTimers();
  });

  it('recovers running agents inline when the queue answers', async () => {
    const queue = createStalledQueue();
    queue.stopStalling();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = buildService(queue);

    await service.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      'run-cycle',
      { userId: 'user-1', configId: 'config-1' },
      { jobId: 'agent-user-1-config-1', removeOnComplete: true },
    );

    logSpy.mockRestore();
  });
});
