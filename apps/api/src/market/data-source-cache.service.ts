import { Injectable, Logger } from '@nestjs/common';
import type { DataSourcePayload } from '@crypto-trader/providers';

interface CacheEntry {
  payload: DataSourcePayload;
  cachedAt: number;
  ttlMs: number;
}

/**
 * In-memory cache for data source responses.
 * TTL-based: if a provider fails and cache is still valid, returns stale data.
 */
@Injectable()
export class DataSourceCacheService {
  private readonly logger = new Logger(DataSourceCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  set(name: string, payload: DataSourcePayload, ttlMs: number): void {
    this.cache.set(name, { payload, cachedAt: Date.now(), ttlMs });
  }

  get(name: string): DataSourcePayload | null {
    const entry = this.cache.get(name);
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age >= entry.ttlMs) {
      this.cache.delete(name);
      this.logger.debug(`${name}: cache expired (${age}ms > ${entry.ttlMs}ms)`);
      return null;
    }

    this.logger.debug(`${name}: cache hit (age ${age}ms)`);
    return entry.payload;
  }

  has(name: string): boolean {
    const entry = this.cache.get(name);
    if (!entry) return false;
    return Date.now() - entry.cachedAt < entry.ttlMs;
  }

  invalidate(name: string): void {
    this.cache.delete(name);
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { entries: number; sources: string[] } {
    const sources: string[] = [];
    for (const [name, entry] of this.cache) {
      if (Date.now() - entry.cachedAt < entry.ttlMs) {
        sources.push(name);
      }
    }
    return { entries: sources.length, sources };
  }
}
