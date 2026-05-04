import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  IDataSourceProvider,
  DataSourcePayload,
  ProviderConfig,
  HealthCheckResult,
} from '@crypto-trader/providers';
import type { DataSourceCategoryType } from '@crypto-trader/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DataSourceCacheService } from './data-source-cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { DataSourceMetricsService } from './data-source-metrics.service';
import { AppGateway } from '../gateway/app.gateway';

interface RegisteredProvider {
  provider: IDataSourceProvider;
}

@Injectable()
export class DataSourceRegistryService {
  private readonly logger = new Logger(DataSourceRegistryService.name);
  private readonly providers = new Map<string, RegisteredProvider>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly circuitBreaker?: CircuitBreakerService,
    @Optional() private readonly cache?: DataSourceCacheService,
    @Optional() private readonly gateway?: AppGateway,
    @Optional() private readonly rateLimiter?: RateLimiterService,
    @Optional() private readonly metrics?: DataSourceMetricsService,
  ) {}

  // ── Provider registration ──────────────────────────────────────────────────

  registerProvider(provider: IDataSourceProvider): void {
    this.providers.set(provider.name, { provider });
    this.logger.log(`Registered data source provider: ${provider.name}`);
  }

  getProvider(name: string): IDataSourceProvider | undefined {
    return this.providers.get(name)?.provider;
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  async getActiveConfigs(category?: DataSourceCategoryType) {
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    return this.prisma.dataSourceConfig.findMany({
      where,
      orderBy: { priority: 'desc' },
    });
  }

  async getAllConfigs() {
    return this.prisma.dataSourceConfig.findMany({
      orderBy: [{ category: 'asc' }, { priority: 'desc' }],
    });
  }

  async getConfigByName(name: string) {
    return this.prisma.dataSourceConfig.findUnique({ where: { name } });
  }

  async getBestProvider(category: DataSourceCategoryType) {
    const configs = await this.getActiveConfigs(category);
    for (const cfg of configs) {
      const provider = this.providers.get(cfg.name);
      if (provider) return { config: cfg, provider: provider.provider };
    }
    return null;
  }

  // ── Toggle & update ────────────────────────────────────────────────────────

  async toggleSource(id: string, active: boolean) {
    return this.prisma.dataSourceConfig.update({
      where: { id },
      data: { isActive: active },
    });
  }

  async updateConfig(
    id: string,
    data: {
      priority?: number;
      rateLimitPerMin?: number;
      pollingIntervalMs?: number;
    },
  ) {
    return this.prisma.dataSourceConfig.update({ where: { id }, data });
  }

  // ── Health tracking ────────────────────────────────────────────────────────

  async reportSuccess(name: string, latencyMs: number) {
    const current = await this.prisma.dataSourceConfig.findUnique({
      where: { name },
      select: { consecutiveErrors: true, lastErrorAt: true },
    });
    const wasDown = (current?.consecutiveErrors ?? 0) >= 1;
    await this.prisma.dataSourceConfig.update({
      where: { name },
      data: {
        lastSuccessAt: new Date(),
        consecutiveErrors: 0,
        lastErrorMessage: null,
      },
    });
    this.logger.debug(`${name}: success (${latencyMs}ms)`);

    // Emit recovery event if previously degraded/down
    if (wasDown && this.gateway) {
      const downDurationMs = current?.lastErrorAt
        ? Date.now() - current.lastErrorAt.getTime()
        : 0;
      this.gateway.emitDataSourceRecovered({ name, downDurationMs });
    }
  }

  async reportError(name: string, error: string) {
    const current = await this.prisma.dataSourceConfig.findUnique({
      where: { name },
    });
    const consecutiveErrors = (current?.consecutiveErrors ?? 0) + 1;
    await this.prisma.dataSourceConfig.update({
      where: { name },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: error,
        consecutiveErrors,
      },
    });
    this.logger.warn(`${name}: error #${consecutiveErrors} — ${error}`);

    // Emit degraded event for admin dashboard
    if (this.gateway) {
      this.gateway.emitDataSourceDegraded({
        name,
        error,
        consecutiveErrors,
      });
    }
  }

  // ── Fetch data from a provider ─────────────────────────────────────────────

  async fetchFromProvider(
    name: string,
    apiKey?: string,
  ): Promise<DataSourcePayload | null> {
    const config = await this.getConfigByName(name);
    if (!config || !config.isActive) return null;

    const registered = this.providers.get(name);
    if (!registered) {
      this.logger.warn(`No provider registered for: ${name}`);
      return null;
    }

    // Circuit breaker check
    if (this.circuitBreaker && !this.circuitBreaker.canExecute(name)) {
      this.logger.debug(`${name}: circuit OPEN, using cache fallback`);
      return this.cache?.get(name) ?? null;
    }

    // Rate limiter check
    if (
      this.rateLimiter &&
      !this.rateLimiter.tryAcquire(name, config.rateLimitPerMin)
    ) {
      this.logger.debug(`${name}: rate limited, using cache fallback`);
      return this.cache?.get(name) ?? null;
    }

    const providerConfig: ProviderConfig = {
      baseUrl: config.baseUrl,
      rateLimitPerMin: config.rateLimitPerMin,
      pollingIntervalMs: config.pollingIntervalMs,
    };

    const start = Date.now();
    try {
      const payload = await registered.provider.fetchData(
        providerConfig,
        apiKey,
      );
      const latency = Date.now() - start;
      await this.reportSuccess(name, latency);
      this.circuitBreaker?.recordSuccess(name);
      this.metrics?.recordSuccess(name, latency);

      // Cache the successful response (TTL = 2x polling interval)
      if (payload) {
        this.cache?.set(name, payload, config.pollingIntervalMs * 2);
      }

      return payload;
    } catch (err) {
      const latency = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.reportError(name, message);
      this.circuitBreaker?.recordFailure(name);
      this.metrics?.recordFailure(name, latency);
      this.logger.error(
        `${name}: fetch failed after ${latency}ms — ${message}`,
      );

      // Fallback to cached data if available
      const cached = this.cache?.get(name);
      if (cached) {
        this.logger.debug(`${name}: using cached data as fallback`);
        return cached;
      }
      return null;
    }
  }

  // ── Health check ───────────────────────────────────────────────────────────

  async checkHealth(name: string): Promise<HealthCheckResult> {
    const config = await this.getConfigByName(name);
    if (!config)
      return { available: false, latencyMs: 0, error: 'Config not found' };

    const registered = this.providers.get(name);
    if (!registered)
      return {
        available: false,
        latencyMs: 0,
        error: 'Provider not registered',
      };

    const providerConfig: ProviderConfig = {
      baseUrl: config.baseUrl,
      rateLimitPerMin: config.rateLimitPerMin,
      pollingIntervalMs: config.pollingIntervalMs,
    };

    return registered.provider.healthCheck(providerConfig);
  }

  async checkHealthAll(): Promise<Record<string, HealthCheckResult>> {
    const configs = await this.prisma.dataSourceConfig.findMany({
      where: { isActive: true },
    });
    const results: Record<string, HealthCheckResult> = {};
    await Promise.allSettled(
      configs.map(async (cfg) => {
        results[cfg.name] = await this.checkHealth(cfg.name);
      }),
    );
    return results;
  }

  // ── Compute health status from config ──────────────────────────────────────

  computeHealthStatus(config: {
    isActive: boolean;
    consecutiveErrors: number;
    lastSuccessAt: Date | null;
  }): 'healthy' | 'degraded' | 'down' | 'unknown' {
    if (!config.isActive) return 'unknown';
    if (config.consecutiveErrors >= 3) return 'down';
    if (config.consecutiveErrors >= 1) return 'degraded';
    if (!config.lastSuccessAt) return 'unknown';
    return 'healthy';
  }

  getCircuitStates(): Record<string, { state: string; failures: number }> {
    return this.circuitBreaker?.getAll() ?? {};
  }

  getCacheStats(): { entries: number; sources: string[] } {
    return this.cache?.stats() ?? { entries: 0, sources: [] };
  }

  getRateLimiterStats(): Record<string, { remaining: number; limit: number }> {
    return this.rateLimiter?.getAll() ?? {};
  }

  getProviderMetrics() {
    return this.metrics?.getAllMetrics() ?? {};
  }
}
