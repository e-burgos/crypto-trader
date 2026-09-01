import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { EntryOrderLeg, MarketTick } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import { LiveOrderExecutor, type OrderExecutorPort } from '@crypto-trader/trading-engine';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import {
  EntryOrderService,
  entryOrderRefOf,
  type RestingEntryOrder,
} from '../trading/entry-order.service';
import { FastPathService } from './fast-path.service';
import { MarketStreamService } from './market-stream.service';
import {
  DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  type ReactiveRuntimeThresholds,
} from './reactive-runtime-thresholds';

interface ActiveConfigsCacheEntry {
  configs: any[];
  fetchedAt: number;
}

interface RestingEntriesCacheEntry {
  orders: RestingEntryOrder[];
  fetchedAt: number;
}

interface CredentialsCacheEntry {
  apiKey: string;
  apiSecret: string;
  fetchedAt: number;
}

interface EligibleProbe {
  order: RestingEntryOrder;
  leg: EntryOrderLeg;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function resolveLeg(tick: MarketTick, order: RestingEntryOrder): EntryOrderLeg | null {
  if (tick.price <= order.limitPrice) return 'LIMIT';
  if (order.stopPrice != null && tick.price >= order.stopPrice) return 'STOP';
  return null;
}

function probeKey(entryOrderId: string, leg: EntryOrderLeg): string {
  return `${entryOrderId}:${leg}`;
}

@Injectable()
export class EntryFillWatchService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EntryFillWatchService.name);
  private readonly tickListener = (tick: MarketTick): void => {
    this.handleTick(tick).catch((err) =>
      this.logger.error(
        `Entry fill watch tick handling failed for ${tick.symbol}: ${errorMessage(err)}`,
      ),
    );
  };

  private activeConfigsCache: ActiveConfigsCacheEntry | null = null;
  private readonly restingEntriesCache = new Map<string, RestingEntriesCacheEntry>();
  private readonly credentialsCache = new Map<string, CredentialsCacheEntry>();
  private readonly lastProbeAtMs = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketStream: MarketStreamService,
    private readonly entryOrderService: EntryOrderService,
    private readonly fastPath: FastPathService,
    private readonly thresholds: ReactiveRuntimeThresholds = DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  ) {}

  onModuleInit(): void {
    this.marketStream.on('tick', this.tickListener);
  }

  onApplicationShutdown(): void {
    this.marketStream.off('tick', this.tickListener);
  }

  async handleTick(tick: MarketTick): Promise<void> {
    if (!this.marketStream.isWarmupComplete(tick.symbol)) return;

    const configs = await this.resolveActiveConfigs(tick.symbol);
    for (const config of configs) {
      try {
        await this.handleConfigTick(config, tick);
      } catch (err) {
        this.logger.error(
          `Entry fill watch failed for config ${config.id} on ${tick.symbol}: ${errorMessage(err)}`,
        );
      }
    }
  }

  private async resolveActiveConfigs(symbol: string): Promise<any[]> {
    const now = Date.now();
    if (
      !this.activeConfigsCache ||
      now - this.activeConfigsCache.fetchedAt >= this.thresholds.symbolRefreshIntervalMs
    ) {
      const configs = await this.prisma.tradingConfig.findMany({
        where: { isRunning: true, reactiveLoopEnabled: true },
      });
      this.activeConfigsCache = { configs, fetchedAt: now };
    }
    return this.activeConfigsCache.configs.filter(
      (config) => `${config.asset}${config.pair}` === symbol,
    );
  }

  private async resolveRestingEntries(
    config: any,
    symbol: string,
  ): Promise<RestingEntryOrder[]> {
    const now = Date.now();
    const cached = this.restingEntriesCache.get(config.id);
    if (cached && now - cached.fetchedAt < this.thresholds.symbolRefreshIntervalMs) {
      return cached.orders;
    }
    const orders = await this.entryOrderService.findResting(config.id, symbol);
    this.restingEntriesCache.set(config.id, { orders, fetchedAt: now });
    return orders;
  }

  private invalidateRestingEntries(configId: string): void {
    this.restingEntriesCache.delete(configId);
  }

  private resolveEligibleProbes(orders: RestingEntryOrder[], tick: MarketTick): EligibleProbe[] {
    const now = Date.now();
    const eligible: EligibleProbe[] = [];
    for (const order of orders) {
      const leg = resolveLeg(tick, order);
      if (!leg) continue;
      const lastProbeAt = this.lastProbeAtMs.get(probeKey(order.id, leg)) ?? 0;
      if (now - lastProbeAt < this.thresholds.entryFillProbeDebounceMs) continue;
      eligible.push({ order, leg });
    }
    return eligible;
  }

  private async resolveCredentials(
    userId: string,
    isTestnet: boolean,
  ): Promise<{ apiKey: string; apiSecret: string } | null> {
    const now = Date.now();
    const cacheKey = `${userId}:${isTestnet}`;
    const cached = this.credentialsCache.get(cacheKey);
    if (cached && now - cached.fetchedAt < this.thresholds.symbolRefreshIntervalMs) {
      return { apiKey: cached.apiKey, apiSecret: cached.apiSecret };
    }

    const record = await this.prisma.binanceCredential.findUnique({
      where: { userId_isTestnet: { userId, isTestnet } },
    });
    if (!record) return null;

    const apiKey = decrypt(record.apiKeyEncrypted, record.apiKeyIv);
    const apiSecret = decrypt(record.secretEncrypted, record.secretIv);
    this.credentialsCache.set(cacheKey, { apiKey, apiSecret, fetchedAt: now });
    return { apiKey, apiSecret };
  }

  private async resolveExecutor(config: any): Promise<OrderExecutorPort | null> {
    const credentials = await this.resolveCredentials(
      config.userId,
      config.mode === TradingMode.TESTNET,
    );
    if (!credentials) {
      this.logger.warn(
        `No ${config.mode} credentials for config ${config.id} — skipping entry fill probe`,
      );
      return null;
    }

    return new LiveOrderExecutor(
      new BinanceRestClient({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        testnet: config.mode === TradingMode.TESTNET,
      }),
    );
  }

  private async handleConfigTick(config: any, tick: MarketTick): Promise<void> {
    const orders = await this.resolveRestingEntries(config, tick.symbol);
    if (!orders.length) return;

    const eligible = this.resolveEligibleProbes(orders, tick);
    if (!eligible.length) return;

    const executor = await this.resolveExecutor(config);
    if (!executor) return;

    for (const { order, leg } of eligible) {
      await this.probeEntry(config, order, leg, tick, executor);
    }
  }

  private async probeEntry(
    config: any,
    order: RestingEntryOrder,
    leg: EntryOrderLeg,
    tick: MarketTick,
    executor: OrderExecutorPort,
  ): Promise<void> {
    this.lastProbeAtMs.set(probeKey(order.id, leg), Date.now());

    const status = await executor.getEntryOrderStatus(tick.symbol, entryOrderRefOf(order), {
      leg,
    });
    if (status.state !== 'FILLED') return;

    const settled = await this.entryOrderService.settleFill({
      userId: order.userId,
      config,
      symbol: tick.symbol,
      mode: config.mode,
      executor,
      order,
      status,
    });

    if (settled === 'REMAINDER_CANCEL_FAILED') return;

    this.invalidateRestingEntries(order.configId);
    this.fastPath.invalidateOpenPositions(order.configId);
  }
}
