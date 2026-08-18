export const STALE_RETENTION_MULTIPLIER = 6;

export interface CacheRecord<T> {
  value: T;
  cachedAt: number;
  ttlMs: number;
}

export function isFresh(record: CacheRecord<unknown>, now: number): boolean {
  return now - record.cachedAt < record.ttlMs;
}

export function isWithinStaleRetention(
  record: CacheRecord<unknown>,
  now: number,
): boolean {
  return now - record.cachedAt < record.ttlMs * STALE_RETENTION_MULTIPLIER;
}
