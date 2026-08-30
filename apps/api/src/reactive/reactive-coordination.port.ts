export const REACTIVE_COORDINATION = Symbol('REACTIVE_COORDINATION');

export interface ReactiveCoordinationPort {
  tryAcquire(key: string, holderId: string, ttlMs: number): Promise<boolean>;
  renew(key: string, holderId: string, ttlMs: number): Promise<boolean>;
  release(key: string, holderId: string): Promise<void>;
  tryConsumeToken(key: string, ttlMs: number): Promise<boolean>;
  setJson<T>(key: string, value: T, ttlMs: number): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  isHealthy(): boolean;
}
