import type { Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { withTimeout } from './with-timeout';

export const QUEUE_BOOTSTRAP_TIMEOUT_MS = 5_000;

export const QUEUE_SETTLE_AFTER_READY_MS = 30_000;

export const QUEUE_UNAVAILABLE_AT_BOOTSTRAP =
  'Bull queue unavailable at bootstrap: Redis not reachable;';

export function queueUnavailableAtBootstrapMessage(
  deferredWork: string,
): string {
  return `${QUEUE_UNAVAILABLE_AT_BOOTSTRAP} ${deferredWork} deferred until Redis returns`;
}

export interface QueueBootstrapWork {
  queue: Pick<Queue, 'isReady'>;
  logger: Pick<Logger, 'log' | 'error'>;
  deferredWork: string;
  run: () => Promise<void>;
  timeoutMs?: number;
  settleAfterReadyMs?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runQueueBootstrapWork({
  queue,
  logger,
  deferredWork,
  run,
  timeoutMs = QUEUE_BOOTSTRAP_TIMEOUT_MS,
  settleAfterReadyMs = QUEUE_SETTLE_AFTER_READY_MS,
}: QueueBootstrapWork): Promise<void> {
  const attempt = { completed: false };
  const running = runOnce(run, attempt);
  running.catch(() => undefined);

  try {
    await withTimeout(running, timeoutMs);
  } catch (error) {
    logger.error(
      `${queueUnavailableAtBootstrapMessage(deferredWork)} (${errorMessage(error)})`,
    );
    void runWhenQueueBecomesReady({
      queue,
      logger,
      deferredWork,
      run,
      running,
      attempt,
      settleAfterReadyMs,
    });
  }
}

async function runOnce(
  run: () => Promise<void>,
  attempt: { completed: boolean },
): Promise<void> {
  await run();
  attempt.completed = true;
}

async function runWhenQueueBecomesReady({
  queue,
  logger,
  deferredWork,
  run,
  running,
  attempt,
  settleAfterReadyMs,
}: Omit<QueueBootstrapWork, 'timeoutMs' | 'settleAfterReadyMs'> & {
  running: Promise<void>;
  attempt: { completed: boolean };
  settleAfterReadyMs: number;
}): Promise<void> {
  try {
    await queue.isReady();
    await withTimeout(running, settleAfterReadyMs).catch(() => undefined);
    if (attempt.completed) return;
    await runOnce(run, attempt);
    logger.log(`Redis is reachable again; ${deferredWork} completed`);
  } catch (error) {
    logger.error(
      `Redis is still unreachable; ${deferredWork} abandoned (${errorMessage(error)})`,
    );
  }
}
