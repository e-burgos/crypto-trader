import { Injectable, Logger } from '@nestjs/common';
import type { SharedCachePort } from './shared-cache.port';
import { isFresh, isWithinStaleRetention } from './cache-record';
import type { CacheRecord } from './cache-record';

@Injectable()
export class InMemorySharedCache implements SharedCachePort {
  private readonly logger = new Logger(InMemorySharedCache.name);
  private readonly store = new Map<string, CacheRecord<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  async getOrCompute<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    const existing = this.readRecord<T>(key);
    if (existing && isFresh(existing, Date.now())) {
      return existing.value;
    }

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const computation = this.computeAndStore(key, ttlMs, compute, existing);
    this.inFlight.set(key, computation);
    try {
      return await computation;
    } finally {
      this.inFlight.delete(key);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const record = this.readRecord<T>(key);
    if (!record || !isFresh(record, Date.now())) {
      return null;
    }
    return record.value;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, cachedAt: Date.now(), ttlMs });
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
    this.inFlight.delete(key);
  }

  private async computeAndStore<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
    staleEntry: CacheRecord<T> | undefined,
  ): Promise<T> {
    try {
      const value = await compute();
      this.store.set(key, { value, cachedAt: Date.now(), ttlMs });
      return value;
    } catch (err) {
      if (staleEntry) {
        this.logger.warn(
          `${key}: compute failed, serving stale value (${err instanceof Error ? err.message : String(err)})`,
        );
        return staleEntry.value;
      }
      throw err;
    }
  }

  private readRecord<T>(key: string): CacheRecord<T> | undefined {
    const record = this.store.get(key) as CacheRecord<T> | undefined;
    if (!record) return undefined;
    if (!isWithinStaleRetention(record, Date.now())) {
      this.store.delete(key);
      return undefined;
    }
    return record;
  }
}
