import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';

const RENEW_IF_OWNER_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
else
  return 0
end
`;

const RELEASE_IF_OWNER_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisReactiveCoordination implements ReactiveCoordinationPort {
  private readonly logger = new Logger(RedisReactiveCoordination.name);
  private healthy = true;

  constructor(private readonly redis: Redis) {
    this.redis.on('error', (err) => this.markUnhealthy(err));
    this.redis.on('ready', () => this.markHealthy());
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async tryAcquire(
    key: string,
    holderId: string,
    ttlMs: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.set(key, holderId, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      this.markUnhealthy(err);
      return false;
    }
  }

  async renew(key: string, holderId: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        RENEW_IF_OWNER_SCRIPT,
        1,
        key,
        holderId,
        ttlMs,
      );
      return result === 1;
    } catch (err) {
      this.markUnhealthy(err);
      return false;
    }
  }

  async release(key: string, holderId: string): Promise<void> {
    try {
      await this.redis.eval(RELEASE_IF_OWNER_SCRIPT, 1, key, holderId);
    } catch (err) {
      this.markUnhealthy(err);
    }
  }

  async tryConsumeToken(key: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      this.markUnhealthy(err);
      return false;
    }
  }

  async setJson<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch (err) {
      this.markUnhealthy(err);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.markUnhealthy(err);
      return null;
    }
  }

  private markUnhealthy(err: unknown): void {
    if (!this.healthy) return;
    this.healthy = false;
    this.logger.error(
      `Reactive coordination Redis unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private markHealthy(): void {
    if (this.healthy) return;
    this.healthy = true;
    this.logger.log('Reactive coordination Redis connection restored');
  }
}
