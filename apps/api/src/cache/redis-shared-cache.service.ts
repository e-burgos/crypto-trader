import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { SharedCachePort } from './shared-cache.port';
import { InMemorySharedCache } from './in-memory-shared-cache.service';
import { isFresh, STALE_RETENTION_MULTIPLIER } from './cache-record';
import type { CacheRecord } from './cache-record';

@Injectable()
export class RedisSharedCache implements SharedCachePort {
  private readonly logger = new Logger(RedisSharedCache.name);
  private readonly fallback = new InMemorySharedCache();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private degraded = false;

  constructor(private readonly redis: Redis) {
    this.redis.on('error', (err) => this.degrade(err));
  }

  async getOrCompute<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    if (this.degraded) {
      return this.fallback.getOrCompute(key, ttlMs, compute);
    }

    let existing: CacheRecord<T> | undefined;
    try {
      existing = await this.readRecord<T>(key);
    } catch (err) {
      this.degrade(err);
      return this.fallback.getOrCompute(key, ttlMs, compute);
    }

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
    if (this.degraded) {
      return this.fallback.get<T>(key);
    }
    try {
      const record = await this.readRecord<T>(key);
      if (!record || !isFresh(record, Date.now())) return null;
      return record.value;
    } catch (err) {
      this.degrade(err);
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (this.degraded) {
      return this.fallback.set(key, value, ttlMs);
    }
    try {
      await this.writeRecord(key, value, ttlMs);
    } catch (err) {
      this.degrade(err);
      await this.fallback.set(key, value, ttlMs);
    }
  }

  async invalidate(key: string): Promise<void> {
    this.inFlight.delete(key);
    if (this.degraded) {
      return this.fallback.invalidate(key);
    }
    try {
      await this.redis.del(key);
    } catch (err) {
      this.degrade(err);
      await this.fallback.invalidate(key);
    }
  }

  private async computeAndStore<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
    staleEntry: CacheRecord<T> | undefined,
  ): Promise<T> {
    try {
      const value = await compute();
      try {
        await this.writeRecord(key, value, ttlMs);
      } catch (err) {
        this.degrade(err);
      }
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

  private async readRecord<T>(key: string): Promise<CacheRecord<T> | undefined> {
    const raw = await this.redis.get(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as CacheRecord<T>;
  }

  private async writeRecord<T>(
    key: string,
    value: T,
    ttlMs: number,
  ): Promise<void> {
    const record: CacheRecord<T> = { value, cachedAt: Date.now(), ttlMs };
    await this.redis.set(
      key,
      JSON.stringify(record),
      'PX',
      ttlMs * STALE_RETENTION_MULTIPLIER,
    );
  }

  private degrade(err: unknown): void {
    if (this.degraded) return;
    this.degraded = true;
    this.logger.error(
      `Redis shared cache unavailable, degrading to in-memory: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
