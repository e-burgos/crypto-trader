import {
  QUEUE_BOOTSTRAP_TIMEOUT_MS,
  QUEUE_SETTLE_AFTER_READY_MS,
  QUEUE_UNAVAILABLE_AT_BOOTSTRAP,
  runQueueBootstrapWork,
} from './queue-bootstrap';

function createLogger() {
  return { log: jest.fn(), error: jest.fn() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runQueueBootstrapWork', () => {
  it('defaults the bootstrap budget to 5 seconds and the settle window to 30', () => {
    expect(QUEUE_BOOTSTRAP_TIMEOUT_MS).toBe(5_000);
    expect(QUEUE_SETTLE_AFTER_READY_MS).toBe(30_000);
  });

  it('awaits the work when the queue answers', async () => {
    const logger = createLogger();
    const run = jest.fn().mockResolvedValue(undefined);

    await runQueueBootstrapWork({
      queue: { isReady: jest.fn() },
      logger,
      deferredWork: 'nothing deferred',
      run,
      timeoutMs: 50,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('resolves within the timeout, logs one error and defers the work when the queue never answers', async () => {
    const logger = createLogger();
    const ready = deferred<unknown>();
    let stalled = true;
    const run = jest.fn(() =>
      stalled ? new Promise<void>(() => undefined) : Promise.resolve(),
    );

    const startedAt = Date.now();
    await runQueueBootstrapWork({
      queue: { isReady: () => ready.promise as Promise<never> },
      logger,
      deferredWork: 'the deferred work',
      run,
      timeoutMs: 30,
      settleAfterReadyMs: 30,
    });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `${QUEUE_UNAVAILABLE_AT_BOOTSTRAP} the deferred work`,
      ),
    );
    expect(run).toHaveBeenCalledTimes(1);

    stalled = false;
    ready.resolve(undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(run).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('the deferred work completed'),
    );
  });

  it('does not re-run the work when the first attempt completed while the queue was reconnecting', async () => {
    const logger = createLogger();
    const ready = deferred<unknown>();
    const firstAttempt = deferred<void>();
    const run = jest.fn(() => firstAttempt.promise);

    await runQueueBootstrapWork({
      queue: { isReady: () => ready.promise as Promise<never> },
      logger,
      deferredWork: 'the deferred work',
      run,
      timeoutMs: 30,
      settleAfterReadyMs: 30,
    });

    firstAttempt.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    ready.resolve(undefined);
    await new Promise((resolve) => setImmediate(resolve));

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports and abandons the deferred work when the retry itself fails', async () => {
    const logger = createLogger();
    const ready = deferred<unknown>();
    let stalled = true;
    const run = jest.fn(() =>
      stalled
        ? new Promise<void>(() => undefined)
        : Promise.reject(new Error('still refusing connections')),
    );

    await runQueueBootstrapWork({
      queue: { isReady: () => ready.promise as Promise<never> },
      logger,
      deferredWork: 'the deferred work',
      run,
      timeoutMs: 30,
      settleAfterReadyMs: 30,
    });

    stalled = false;
    ready.resolve(undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('the deferred work abandoned'),
    );
  });
});
