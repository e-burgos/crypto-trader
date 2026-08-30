import { EventEmitter } from 'events';
import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { MarketCandleTick, MarketTick } from '@crypto-trader/shared';
import type { KlineUpdate, SymbolFilters, TickerUpdate } from '@crypto-trader/data-fetcher';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { ReactiveRuntimeThresholds } from './reactive-runtime-thresholds';

export const MARKET_STREAM_WS_CLIENT = Symbol('MARKET_STREAM_WS_CLIENT');
export const MARKET_STREAM_REST_CLIENT = Symbol('MARKET_STREAM_REST_CLIENT');

export const REACTIVE_KLINE_INTERVAL = '1h';

const OWNER_KEY_PREFIX = 'rx:v1:owner:';

export function ownerLeaseKey(symbol: string): string {
  return `${OWNER_KEY_PREFIX}${symbol}`;
}

export interface MarketStreamWsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  addStreams(streams: string[]): void;
  removeStreams(streams: string[]): void;
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
}

export interface MarketStreamRestClient {
  getSymbolFilters(symbol: string): Promise<SymbolFilters>;
}

export type SymbolReleaseReason =
  | 'INACTIVE'
  | 'LEASE_LOST'
  | 'COORDINATION_UNHEALTHY'
  | 'SHUTDOWN';

export interface SymbolHealthSnapshot {
  symbol: string;
  ownerId: string;
  connectedAt: number;
  lastTickAtMs: number | null;
  lastHeartbeatAtMs: number | null;
}

interface OwnedSymbolState {
  connectedAt: number;
  tickCount: number;
  lastTickAtMs: number | null;
  lastHeartbeatAtMs: number | null;
  symbolFilters: SymbolFilters | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class MarketStreamService
  extends EventEmitter
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(MarketStreamService.name);
  private readonly ownedSymbols = new Map<string, OwnedSymbolState>();
  private activeSymbols = new Set<string>();
  private symbolRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private ownershipTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: ReactiveCoordinationPort,
    private readonly wsClient: MarketStreamWsClient,
    private readonly restClient: MarketStreamRestClient,
    private readonly thresholds: ReactiveRuntimeThresholds,
    private readonly instanceId: string,
  ) {
    super();
    this.wsClient.on('ticker', (update: TickerUpdate) => this.handleTicker(update));
    this.wsClient.on('kline', (update: KlineUpdate) => this.handleKline(update));
    this.wsClient.on('heartbeat', (payload: { at: number }) => this.handleHeartbeat(payload));
  }

  async onModuleInit(): Promise<void> {
    await this.refreshActiveSymbols();
    await this.runOwnershipCycle();

    this.symbolRefreshTimer = setInterval(() => {
      this.refreshActiveSymbols().catch((err) =>
        this.logger.error(`Failed to refresh active symbols: ${errorMessage(err)}`),
      );
    }, this.thresholds.symbolRefreshIntervalMs);

    this.ownershipTimer = setInterval(() => {
      this.runOwnershipCycle().catch((err) =>
        this.logger.error(`Ownership cycle failed: ${errorMessage(err)}`),
      );
    }, this.thresholds.ownerSweepIntervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.symbolRefreshTimer) clearInterval(this.symbolRefreshTimer);
    if (this.ownershipTimer) clearInterval(this.ownershipTimer);
    this.symbolRefreshTimer = null;
    this.ownershipTimer = null;

    await this.releaseAllOwned('SHUTDOWN');

    if (this.wsClient.isConnected()) this.wsClient.disconnect();
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getOwnedSymbols(): string[] {
    return [...this.ownedSymbols.keys()];
  }

  isOwner(symbol: string): boolean {
    return this.ownedSymbols.has(symbol);
  }

  isWarmupComplete(symbol: string): boolean {
    const state = this.ownedSymbols.get(symbol);
    return !!state && state.tickCount >= this.thresholds.streamWarmupTicks;
  }

  getSymbolFilters(symbol: string): SymbolFilters | undefined {
    return this.ownedSymbols.get(symbol)?.symbolFilters ?? undefined;
  }

  getHealthSnapshot(symbol: string): SymbolHealthSnapshot | null {
    const state = this.ownedSymbols.get(symbol);
    if (!state) return null;
    return {
      symbol,
      ownerId: this.instanceId,
      connectedAt: state.connectedAt,
      lastTickAtMs: state.lastTickAtMs,
      lastHeartbeatAtMs: state.lastHeartbeatAtMs,
    };
  }

  async refreshActiveSymbols(): Promise<void> {
    const configs = await this.prisma.tradingConfig.findMany({
      where: { isRunning: true, reactiveLoopEnabled: true },
      select: { asset: true, pair: true },
    });

    const nextActive = new Set<string>(
      (configs as Array<{ asset: string; pair: string }>).map(
        (config) => `${config.asset}${config.pair}`,
      ),
    );

    const noLongerActive = [...this.ownedSymbols.keys()].filter(
      (symbol) => !nextActive.has(symbol),
    );
    await Promise.all(
      noLongerActive.map((symbol) => this.releaseOwnership(symbol, 'INACTIVE')),
    );

    this.activeSymbols = nextActive;
  }

  async runOwnershipCycle(): Promise<void> {
    if (!this.coordination.isHealthy()) {
      await this.releaseAllOwned('COORDINATION_UNHEALTHY');
      return;
    }

    await this.renewOwnedLeases();
    await this.acquireActiveSymbols();
  }

  private async renewOwnedLeases(): Promise<void> {
    for (const symbol of [...this.ownedSymbols.keys()]) {
      const renewed = await this.coordination.renew(
        ownerLeaseKey(symbol),
        this.instanceId,
        this.thresholds.ownerLeaseTtlMs,
      );
      if (!renewed) this.forgetSymbol(symbol, 'LEASE_LOST');
    }
  }

  private async acquireActiveSymbols(): Promise<void> {
    for (const symbol of this.activeSymbols) {
      if (this.ownedSymbols.has(symbol)) continue;
      const acquired = await this.coordination.tryAcquire(
        ownerLeaseKey(symbol),
        this.instanceId,
        this.thresholds.ownerLeaseTtlMs,
      );
      if (acquired) this.acquireOwnership(symbol);
    }
  }

  private async releaseAllOwned(reason: SymbolReleaseReason): Promise<void> {
    const owned = [...this.ownedSymbols.keys()];
    await Promise.all(owned.map((symbol) => this.releaseOwnership(symbol, reason)));
  }

  private acquireOwnership(symbol: string): void {
    this.ownedSymbols.set(symbol, {
      connectedAt: Date.now(),
      tickCount: 0,
      lastTickAtMs: null,
      lastHeartbeatAtMs: null,
      symbolFilters: null,
    });

    this.wsClient.addStreams(this.streamNamesFor(symbol));
    if (!this.wsClient.isConnected()) this.wsClient.connect();

    this.resolveSymbolFilters(symbol);
    this.emit('symbol-owned', { symbol, instanceId: this.instanceId });
    this.logger.log(`Acquired ownership of ${symbol}`);
  }

  private async releaseOwnership(
    symbol: string,
    reason: SymbolReleaseReason,
  ): Promise<void> {
    if (!this.ownedSymbols.has(symbol)) return;
    try {
      await this.coordination.release(ownerLeaseKey(symbol), this.instanceId);
    } catch (err) {
      this.logger.warn(`Failed to release lease for ${symbol}: ${errorMessage(err)}`);
    }
    this.forgetSymbol(symbol, reason);
  }

  private forgetSymbol(symbol: string, reason: SymbolReleaseReason): void {
    if (!this.ownedSymbols.delete(symbol)) return;
    this.wsClient.removeStreams(this.streamNamesFor(symbol));
    if (this.ownedSymbols.size === 0 && this.wsClient.isConnected()) {
      this.wsClient.disconnect();
    }
    this.emit('symbol-released', { symbol, reason });
    this.logger.log(`Released ownership of ${symbol} (${reason})`);
  }

  private streamNamesFor(symbol: string): string[] {
    const lower = symbol.toLowerCase();
    return [`${lower}@miniTicker`, `${lower}@kline_${REACTIVE_KLINE_INTERVAL}`];
  }

  private resolveSymbolFilters(symbol: string): void {
    this.restClient
      .getSymbolFilters(symbol)
      .then((filters) => {
        const state = this.ownedSymbols.get(symbol);
        if (state) state.symbolFilters = filters;
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to resolve symbol filters for ${symbol}: ${errorMessage(err)}`,
        );
      });
  }

  private handleTicker(update: TickerUpdate): void {
    const state = this.ownedSymbols.get(update.symbol);
    if (!state) return;

    state.tickCount += 1;
    state.lastTickAtMs = update.timestamp;

    const tick: MarketTick = {
      symbol: update.symbol,
      price: update.price,
      timestamp: update.timestamp,
    };
    this.emit('tick', tick);
  }

  private handleKline(update: KlineUpdate): void {
    if (!this.ownedSymbols.has(update.symbol)) return;

    const candle: MarketCandleTick = {
      symbol: update.symbol,
      interval: update.interval,
      openTime: update.openTime,
      closeTime: update.closeTime,
      close: update.close,
      volume: update.volume,
      isClosed: update.isClosed,
    };
    this.emit('candle', candle);
  }

  private handleHeartbeat(payload: { at: number }): void {
    const at = payload?.at ?? Date.now();
    for (const state of this.ownedSymbols.values()) {
      state.lastHeartbeatAtMs = at;
    }
  }
}
