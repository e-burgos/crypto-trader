import { NewsItem } from '@crypto-trader/shared';
import { NewsSource, NewsAggregatorConfig } from './news-source.interface';

/**
 * Aggregates news from multiple sources with deduplication and in-memory caching.
 * Redis caching can be added later as an enhancement.
 */
export class NewsAggregator {
  private readonly sources: NewsSource[];
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private cache: Map<string, NewsItem> = new Map();
  private lastFetchAt = 0;

  constructor(sources: NewsSource[], config: NewsAggregatorConfig = {}) {
    this.sources = sources;
    this.cacheTtlMs = (config.cacheTtlSeconds ?? 300) * 1000;
    this.maxCacheSize = config.maxCacheSize ?? 500;
  }

  /**
   * Fetch news from all sources, deduplicate, and return sorted by date.
   * Uses in-memory cache to avoid hammering APIs.
   */
  async fetchAll(limit = 50): Promise<NewsItem[]> {
    const now = Date.now();

    if (now - this.lastFetchAt < this.cacheTtlMs && this.cache.size > 0) {
      return this.getCachedItems(limit);
    }

    const results = await Promise.allSettled(
      this.sources.map((s) => s.fetch(limit)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          this.cache.set(item.id, item);
        }
      }
    }

    // Evict oldest entries if cache exceeds max size
    this.evictOldEntries();
    this.lastFetchAt = now;

    return this.getCachedItems(limit);
  }

  /**
   * Force refresh, bypassing cache.
   */
  async refresh(limit = 50): Promise<NewsItem[]> {
    this.lastFetchAt = 0;
    return this.fetchAll(limit);
  }

  /**
   * Get cached items sorted by date, newest first.
   */
  getCachedItems(limit = 50): NewsItem[] {
    return Array.from(this.cache.values())
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Clear cache entirely.
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetchAt = 0;
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  private evictOldEntries(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    const sorted = Array.from(this.cache.entries()).sort(
      (a, b) =>
        new Date(a[1].publishedAt).getTime() -
        new Date(b[1].publishedAt).getTime(),
    );

    const toRemove = sorted.slice(0, this.cache.size - this.maxCacheSize);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }
}
