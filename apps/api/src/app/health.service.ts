import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma';

export type DependencyState = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: DependencyState;
  redis: DependencyState;
  checkedAt: string;
}

const CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(HealthService.name);
  private redis?: Redis;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Dedicated connection instead of borrowing a Bull queue: registering a
    // queue here would add a third Bull.Queue for trading-agent, the debt
    // spec-e-burgos-005 already flagged. lazyConnect keeps a Redis outage from
    // blocking application startup — the check reports it instead.
    this.redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: CHECK_TIMEOUT_MS,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`redis health connection error: ${error.message}`);
    });
    this.redis.connect().catch(() => undefined);
  }

  async onApplicationShutdown() {
    await this.redis?.quit().catch(() => undefined);
  }

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      database,
      redis,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencyState> {
    return this.probe('database', () => this.prisma.$queryRaw`SELECT 1`);
  }

  private async checkRedis(): Promise<DependencyState> {
    return this.probe('redis', async () => {
      if (!this.redis) throw new Error('redis client not initialised');
      return this.redis.ping();
    });
  }

  // A hung dependency must not hang the health check: an orchestrator waiting
  // forever for an answer never restarts the container.
  private async probe(
    name: string,
    run: () => Promise<unknown>,
  ): Promise<DependencyState> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        run(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${name} check timed out`)),
            CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      return 'up';
    } catch (error) {
      this.logger.warn(
        `${name} health check failed: ${(error as Error).message}`,
      );
      return 'down';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
