import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REACTIVE_COORDINATION } from './reactive-coordination.port';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { RedisReactiveCoordination } from './redis-reactive-coordination.service';
import { DisabledReactiveCoordination } from './disabled-reactive-coordination.service';

export function resolveReactiveCoordinationDriver(): ReactiveCoordinationPort {
  if (process.env.REACTIVE_COORDINATION_DRIVER === 'redis') {
    const redis = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      { maxRetriesPerRequest: 1, lazyConnect: false },
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
