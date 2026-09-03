import { Module } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { REACTIVE_COORDINATION } from './reactive-coordination.port';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { RedisReactiveCoordination } from './redis-reactive-coordination.service';
import { DisabledReactiveCoordination } from './disabled-reactive-coordination.service';
import {
  DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  type ReactiveRuntimeThresholds,
} from './reactive-runtime-thresholds';

export function buildCoordinationRedisOptions(
  thresholds: ReactiveRuntimeThresholds = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
): RedisOptions {
  return {
    maxRetriesPerRequest: 1,
    lazyConnect: false,
    // a command queued offline never settles while Redis stays down, so anything awaiting it hangs forever
    enableOfflineQueue: false,
    commandTimeout: thresholds.coordinationCommandTimeoutMs,
    connectTimeout: thresholds.coordinationCommandTimeoutMs,
  };
}

export function resolveReactiveCoordinationDriver(): ReactiveCoordinationPort {
  if (process.env.REACTIVE_COORDINATION_DRIVER === 'redis') {
    const redis = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      buildCoordinationRedisOptions(),
    );
    return new RedisReactiveCoordination(redis);
  }
  return new DisabledReactiveCoordination();
}

@Module({
  providers: [
    { provide: REACTIVE_COORDINATION, useFactory: resolveReactiveCoordinationDriver },
  ],
  exports: [REACTIVE_COORDINATION],
})
export class ReactiveCoordinationModule {}
