export const SHARED_CACHE = Symbol('SHARED_CACHE');

export interface SharedCachePort {
  getOrCompute<T>(
    key: string,
    ttlMs: number,
    compute: () => Promise<T>,
  ): Promise<T>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}
