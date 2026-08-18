import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { SHARED_CACHE } from './shared-cache.port';
import type { SharedCachePort } from './shared-cache.port';
import { InMemorySharedCache } from './in-memory-shared-cache.service';
import { RedisSharedCache } from './redis-shared-cache.service';
import { SignalCacheService } from './signal-cache.service';

export function resolveSharedCacheDriver(): SharedCachePort {
  if (process.env.SHARED_CACHE_DRIVER === 'redis') {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    return new RedisSharedCache(redis);
  }
  return new InMemorySharedCache();
}

@Module({
  providers: [
    { provide: SHARED_CACHE, useFactory: resolveSharedCacheDriver },
    SignalCacheService,
  ],
  exports: [SHARED_CACHE, SignalCacheService],
})
export class SharedCacheModule {}
