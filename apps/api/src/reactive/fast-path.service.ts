import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { MarketTick } from '@crypto-trader/shared';
import { TradingMode } from '@crypto-trader/shared';
import {
  LiveOrderExecutor,
  SandboxOrderExecutor,
  planFastPath,
  type BotActionKind,
  type FastPathConfigSnapshot,
  type FastPathPlan,
  type FastPathPositionSnapshot,
  type OrderExecutorPort,
} from '@crypto-trader/trading-engine';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import { ActionGateService, type ActionRequest } from '../trading/action-gate.service';
import { PositionActionService } from '../trading/position-action.service';
import { MarketStreamService } from './market-stream.service';
import {
  DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
  type ReactiveRuntimeThresholds,
} from './reactive-runtime-thresholds';

const FAST_PATH_ACTION_TO_BOT_ACTION: Record<
  Exclude<FastPathPlan['action'], 'NONE'>,
  BotActionKind
> = {
  HARD_STOP_EXIT: 'SELL_FULL',
  TRAILING_EXIT: 'SELL_FULL',
  PARTIAL_TAKE_PROFIT: 'SELL_PARTIAL',
  PROTECTION_REARM: 'PROTECTION_REARM',
};

interface OpenPositionsCacheEntry {
  positions: any[];
  fetchedAt: number;
}

interface CredentialsCacheEntry {
  apiKey: string;
  apiSecret: string;
  fetchedAt: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toPositionSnapshot(position: any): FastPathPositionSnapshot {
  return {
    id: position.id,
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    stopPrice: position.stopPrice ?? null,
    highWaterPrice: position.highWaterPrice ?? null,
    trailingActive: !!position.trailingActive,
    partialExitCount: position.partialExitCount ?? 0,
    protectionStatus: position.protectionStatus ?? 'NONE',
  };
}

function toConfigSnapshot(config: any): FastPathConfigSnapshot {
  return {
    stopLossPct: config.stopLossPct,
    trailingStopEnabled: !!config.trailingStopEnabled,
    trailingStopPct: config.trailingStopPct,
    trailingActivationPct: config.trailingActivationPct,
    partialTpEnabled: !!config.partialTpEnabled,
    partialTpTriggerPct: config.partialTpTriggerPct,
    partialTpSellPct: config.partialTpSellPct,
    moveStopToBreakevenAfterPartial: !!config.moveStopToBreakevenAfterPartial,
    nativeProtectionEnabled: !!config.nativeProtectionEnabled,
    takeProfitPct: config.takeProfitPct,
  };
}

function toPositionData(position: any): any {
  return {
    ...position,
    exitPrice: position.exitPrice ?? undefined,
    exitAt: position.exitAt ?? undefined,
    pnl: position.pnl ?? undefined,
  };
}

@Injectable()
export class FastPathService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(FastPathService.name);
  private readonly tickListener = (tick: MarketTick): void => {
    this.handleTick(tick).catch((err) =>
      this.logger.error(
        `Fast path tick handling failed for ${tick.symbol}: ${errorMessage(err)}`,
      ),
    );
  };

  private activeConfigsCache: { configs: any[]; fetchedAt: number } | null = null;
  private readonly positionsCache = new Map<string, OpenPositionsCacheEntry>();
  private readonly credentialsCache = new Map<string, CredentialsCacheEntry>();
  private readonly lastTrailingPersistAtMs = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketStream: MarketStreamService,
    private readonly actionGate: ActionGateService,
    private readonly positionAction: PositionActionService,
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
          `Fast path failed for config ${config.id} on ${tick.symbol}: ${errorMessage(err)}`,
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

  private async resolveOpenPositions(config: any): Promise<any[]> {
    const now = Date.now();
    const cached = this.positionsCache.get(config.id);
    if (cached && now - cached.fetchedAt < this.thresholds.symbolRefreshIntervalMs) {
      return cached.positions;
    }
    const positions = await this.prisma.position.findMany({
      where: { configId: config.id, status: 'OPEN', mode: config.mode },
    });
    this.positionsCache.set(config.id, { positions, fetchedAt: now });
    return positions;
  }

  invalidateOpenPositions(configId: string): void {
    this.positionsCache.delete(configId);
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

  private async resolveExecutor(
    config: any,
    tick: MarketTick,
    positions: any[],
  ): Promise<OrderExecutorPort | null> {
    if (config.mode === TradingMode.SANDBOX) {
      const executor = new SandboxOrderExecutor();
      executor.setPrice(tick.symbol, tick.price);
      const quantity = positions.reduce((sum, position) => sum + position.quantity, 0);
      executor.setBalance(config.asset, quantity);
      return executor;
    }

    const credentials = await this.resolveCredentials(
      config.userId,
      config.mode === TradingMode.TESTNET,
    );
    if (!credentials) {
      this.logger.warn(
        `No ${config.mode} credentials for config ${config.id} — skipping fast path tick`,
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
    const positions = await this.resolveOpenPositions(config);
    if (!positions.length) return;

    const executor = await this.resolveExecutor(config, tick, positions);
    if (!executor) return;

    const filters = this.marketStream.getSymbolFilters(tick.symbol);
    const lotStep = filters?.lotSize.stepSize ?? 1e-8;
    const minNotional = filters?.notional.minNotional ?? 0;
    const isSandbox = config.mode === TradingMode.SANDBOX;

    for (const position of positions) {
      await this.handlePositionTick({
        config,
        position,
        tick,
        lotStep,
        minNotional,
        isSandbox,
        executor,
      });
    }
  }

  private async handlePositionTick(params: {
    config: any;
    position: any;
    tick: MarketTick;
    lotStep: number;
    minNotional: number;
    isSandbox: boolean;
    executor: OrderExecutorPort;
  }): Promise<void> {
    const { config, position, tick, lotStep, minNotional, isSandbox, executor } = params;

    const plan = planFastPath({
      now: tick.timestamp,
      currentPrice: tick.price,
      position: toPositionSnapshot(position),
      config: toConfigSnapshot(config),
      isSandbox,
      lotStep,
      minNotional,
    });

    if (plan.action === 'NONE') {
      await this.persistTrailingIfNeeded(position, plan);
      return;
    }

    const request: ActionRequest = {
      userId: config.userId,
      configId: config.id,
      symbol: tick.symbol,
      mode: config.mode,
      kind: FAST_PATH_ACTION_TO_BOT_ACTION[plan.action],
      source: 'FAST_PATH',
      positionId: position.id,
      decisionId: null,
      expected: {
        positionStatus: 'OPEN',
        quantity: position.quantity,
        partialExitCount: position.partialExitCount ?? 0,
      },
      detail: plan.action,
    };

    const result = await this.actionGate.authorizeAndRun(request, () =>
      this.executePlan(plan, config, position, tick, executor),
    );

    if (result.outcome === 'EXECUTED') {
      this.invalidateOpenPositions(config.id);
      this.lastTrailingPersistAtMs.delete(position.id);
    }
  }

  private executePlan(
    plan: Exclude<FastPathPlan, { action: 'NONE' }>,
    config: any,
    position: any,
    tick: MarketTick,
    executor: OrderExecutorPort,
  ): Promise<unknown> {
    const positionData = toPositionData(position);

    switch (plan.action) {
      case 'HARD_STOP_EXIT':
      case 'TRAILING_EXIT':
        return this.positionAction.closeAtMarket({
          userId: config.userId,
          config,
          symbol: tick.symbol,
          mode: config.mode,
          executor,
          position,
          positionData,
          exitReason: plan.action === 'TRAILING_EXIT' ? 'TRAILING_STOP' : 'STOP_LOSS',
        });
      case 'PARTIAL_TAKE_PROFIT':
        return this.positionAction.executePartialTakeProfit({
          userId: config.userId,
          config,
          symbol: tick.symbol,
          mode: config.mode,
          executor,
          position,
          positionData,
          partial: plan.partial,
          trailingState: plan.trailing,
        });
      case 'PROTECTION_REARM':
        return this.positionAction.rearmProtection({
          userId: config.userId,
          config,
          symbol: tick.symbol,
          mode: config.mode,
          executor,
          position,
          levels: {
            stopPrice: plan.desiredStopPrice,
            takeProfitPrice:
              position.takeProfitPrice ?? position.entryPrice * (1 + config.takeProfitPct),
            quantity: position.quantity,
          },
        });
    }
  }

  private async persistTrailingIfNeeded(
    position: any,
    plan: Extract<FastPathPlan, { action: 'NONE' }>,
  ): Promise<void> {
    const trailing = plan.trailing;
    const stopChanged = trailing.stopPrice !== (position.stopPrice ?? null);
    const highWaterChanged = trailing.highWaterPrice !== (position.highWaterPrice ?? null);
    const trailingActiveChanged = trailing.trailingActive !== !!position.trailingActive;
    if (!stopChanged && !highWaterChanged && !trailingActiveChanged) return;

    if (!stopChanged) {
      const lastPersistedAt = this.lastTrailingPersistAtMs.get(position.id) ?? 0;
      if (Date.now() - lastPersistedAt < this.thresholds.trailingPersistIntervalMs) return;
    }

    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        stopPrice: trailing.stopPrice,
        highWaterPrice: trailing.highWaterPrice,
        trailingActive: trailing.trailingActive,
      },
    });
    this.lastTrailingPersistAtMs.set(position.id, Date.now());

    const cached = this.positionsCache.get(position.configId);
    if (cached) {
      cached.positions = cached.positions.map((cachedPosition) =>
        cachedPosition.id === position.id
          ? {
              ...cachedPosition,
              stopPrice: trailing.stopPrice,
              highWaterPrice: trailing.highWaterPrice,
              trailingActive: trailing.trailingActive,
            }
          : cachedPosition,
      );
    }
  }
}
