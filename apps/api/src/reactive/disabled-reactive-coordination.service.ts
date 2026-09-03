import { Injectable } from '@nestjs/common';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';

@Injectable()
export class DisabledReactiveCoordination implements ReactiveCoordinationPort {
  async tryAcquire(
    _key: string,
    _holderId: string,
    _ttlMs: number,
  ): Promise<boolean> {
    return false;
  }

  async renew(
    _key: string,
    _holderId: string,
    _ttlMs: number,
  ): Promise<boolean> {
    return false;
  }

  async release(_key: string, _holderId: string): Promise<void> {
    return;
  }

  async tryConsumeToken(_key: string, _ttlMs: number): Promise<boolean> {
    return false;
  }

  async setJson<T>(_key: string, _value: T, _ttlMs: number): Promise<void> {
    return;
  }

  async getJson<T>(_key: string): Promise<T | null> {
    return null;
  }

  isHealthy(): boolean {
    return false;
  }

  isEnabled(): boolean {
    return false;
  }
}
