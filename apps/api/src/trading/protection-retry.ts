import type {
  OrderExecutorPort,
  ProtectionOrderRequest,
  ProtectionOrderResult,
} from '@crypto-trader/trading-engine';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  getBinanceErrorCode,
  isRetryableBinanceErrorCode,
} from '@crypto-trader/data-fetcher';

export const PROTECTION_RETRY_MAX_ATTEMPTS = 3;
export const PROTECTION_RETRY_BACKOFF_MS = [250, 1000, 3000];
const JITTER_RATIO = 0.2;

export interface ProtectionRetrySuccess {
  outcome: 'PLACED';
  result: ProtectionOrderResult;
  attempts: number;
}

export interface ProtectionRetryFailure {
  outcome: 'FAILED';
  attempts: number;
  code: number | null;
  message: string;
}

export type ProtectionRetryOutcome =
  | ProtectionRetrySuccess
  | ProtectionRetryFailure;

export interface PlaceProtectionWithRetryParams {
  executor: OrderExecutorPort;
  request: Omit<ProtectionOrderRequest, 'clientOrderId'>;
  startingFailureCount: number;
  clientOrderIdFor: (attempt: number) => string;
  beforeAttempt: (attempt: number) => Promise<void>;
  maxAttempts?: number;
  backoffMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

function applyJitter(ms: number): number {
  const delta = ms * JITTER_RATIO;
  return ms - delta + Math.random() * delta * 2;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function placeProtectionWithRetry(
  params: PlaceProtectionWithRetryParams,
): Promise<ProtectionRetryOutcome> {
  const maxAttempts = params.maxAttempts ?? PROTECTION_RETRY_MAX_ATTEMPTS;
  const backoffMs = params.backoffMs ?? PROTECTION_RETRY_BACKOFF_MS;
  const sleep = params.sleep ?? defaultSleep;

  let lastCode: number | null = null;
  let lastMessage = '';
  let attemptsMade = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const attempt = params.startingFailureCount + i + 1;
    attemptsMade = i + 1;
    await params.beforeAttempt(attempt);

    try {
      const result = await params.executor.placeProtectionOrder({
        ...params.request,
        clientOrderId: params.clientOrderIdFor(attempt),
      });
      return { outcome: 'PLACED', result, attempts: attemptsMade };
    } catch (error) {
      lastCode = getBinanceErrorCode(error);
      lastMessage = error instanceof Error ? error.message : String(error);
      const retryable = isRetryableBinanceErrorCode(lastCode);
      const hasMoreAttempts = i < maxAttempts - 1;
      if (!retryable || !hasMoreAttempts) break;
      const delay = backoffMs[Math.min(i, backoffMs.length - 1)];
      await sleep(applyJitter(delay));
    }
  }

  return {
    outcome: 'FAILED',
    attempts: attemptsMade,
    code: lastCode,
    message: lastMessage,
  };
}
