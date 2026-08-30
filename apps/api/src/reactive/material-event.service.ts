import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';
import type { MarketCandleTick, MarketTick } from '@crypto-trader/shared';
import {
  detectMaterialEvent,
  DEFAULT_MATERIAL_EVENT_THRESHOLDS,
  DEFAULT_GATE_THRESHOLDS,
  type MaterialEventReference,
  type MaterialEventState,
  type MaterialEventThresholds,
  type MaterialEventType,
} from '@crypto-trader/analysis';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppGateway } from '../gateway/app.gateway';
import type { MarketStreamService } from './market-stream.service';
import type { StreamHealthService } from './stream-health.service';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { ReactiveRuntimeThresholds } from './reactive-runtime-thresholds';

function windowKey(configId: string): string {
  return `rx:v1:window:${configId}`;
}

function advanceTokenKey(configId: string, windowEndMs: number): string {
  return `rx:v1:advance:${configId}:${windowEndMs}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface ReactiveWindow {
  windowEndMs: number;
}

function isValidReferenceMetadata(
  value: unknown,
): value is { gate: { snapshot: { close: number; takenAt: number } } } {
  if (!value || typeof value !== 'object') return false;
  const gate = (value as Record<string, unknown>).gate;
  if (!gate || typeof gate !== 'object') return false;
  const snapshot = (gate as Record<string, unknown>).snapshot;
  if (!snapshot || typeof snapshot !== 'object') return false;
  const s = snapshot as Record<string, unknown>;
  return typeof s.close === 'number' && typeof s.takenAt === 'number';
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function isValidReferenceIndicators(value: unknown): value is {
  supportResistance: { support: number[]; resistance: number[] };
  volume: { average: number };
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const supportResistance = v.supportResistance as Record<string, unknown> | undefined;
  const volume = v.volume as Record<string, unknown> | undefined;
  return (
    !!supportResistance &&
    isNumberArray(supportResistance.support) &&
    isNumberArray(supportResistance.resistance) &&
    !!volume &&
    typeof volume.average === 'number'
  );
}

function buildReferenceFromDecision(
  decision: { metadata: unknown; indicators: unknown } | null,
): MaterialEventReference | null {
  if (!decision) return null;
  if (!isValidReferenceMetadata(decision.metadata)) return null;
  if (!isValidReferenceIndicators(decision.indicators)) return null;

  return {
    close: decision.metadata.gate.snapshot.close,
    takenAt: decision.metadata.gate.snapshot.takenAt,
    supportResistance: decision.indicators.supportResistance,
    volumeAverage: decision.indicators.volume.average,
  };
}

function initialDetectorState(): MaterialEventState {
  return {
    confirmedSideByLevel: {},
    lastVolumeEventCandleOpenTime: null,
    lastEvaluatedAtMs: null,
  };
}

@Injectable()
export class MaterialEventService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MaterialEventService.name);
  private readonly tickListener = (tick: MarketTick): void => {
    this.handleTick(tick).catch((err) =>
      this.logger.error(
        `Material event evaluation failed for ${tick.symbol}: ${errorMessage(err)}`,
      ),
    );
  };
  private readonly candleListener = (candle: MarketCandleTick): void => {
    this.latestCandleBySymbol.set(candle.symbol, candle);
  };

  private activeConfigsCache: { configs: any[]; fetchedAt: number } | null = null;
  private readonly latestCandleBySymbol = new Map<string, MarketCandleTick>();
  private readonly referenceCache = new Map<
    string,
    { reference: MaterialEventReference | null; fetchedAt: number }
  >();
  private readonly detectorStateByConfigId = new Map<string, MaterialEventState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketStream: MarketStreamService,
    private readonly streamHealth: StreamHealthService,
    private readonly coordination: ReactiveCoordinationPort,
    private readonly tradingQueue: Queue,
    private readonly thresholds: ReactiveRuntimeThresholds,
    private readonly gateway?: AppGateway,
    private readonly referenceMaxAgeMs: number = DEFAULT_GATE_THRESHOLDS.previousDecisionMaxAgeMs,
  ) {}

  onModuleInit(): void {
    this.marketStream.on('tick', this.tickListener);
    this.marketStream.on('candle', this.candleListener);
  }

  onApplicationShutdown(): void {
    this.marketStream.off('tick', this.tickListener);
    this.marketStream.off('candle', this.candleListener);
  }

  async handleTick(tick: MarketTick): Promise<void> {
    if (!this.marketStream.isWarmupComplete(tick.symbol)) return;

    const configs = await this.resolveActiveConfigs(tick.symbol);
    for (const config of configs) {
      try {
        await this.evaluateConfigTick(config, tick);
      } catch (err) {
        this.logger.error(
          `Material event handling failed for config ${config.id} on ${tick.symbol}: ${errorMessage(err)}`,
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

  private async resolveReference(configId: string): Promise<MaterialEventReference | null> {
    const now = Date.now();
    const cached = this.referenceCache.get(configId);
    if (cached && now - cached.fetchedAt < this.thresholds.symbolRefreshIntervalMs) {
      return cached.reference;
    }

    const decision = await this.prisma.agentDecision.findFirst({
      where: { configId },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, indicators: true },
    });
    const reference = buildReferenceFromDecision(decision);
    this.referenceCache.set(configId, { reference, fetchedAt: now });
    return reference;
  }

  private resolveDetectorState(configId: string): MaterialEventState {
    const existing = this.detectorStateByConfigId.get(configId);
    if (existing) return existing;
    const initial = initialDetectorState();
    this.detectorStateByConfigId.set(configId, initial);
    return initial;
  }

  private async evaluateConfigTick(config: any, tick: MarketTick): Promise<void> {
    const reference = await this.resolveReference(config.id);
    const state = this.resolveDetectorState(config.id);
    const candle = this.latestCandleBySymbol.get(tick.symbol) ?? null;
    const thresholds: MaterialEventThresholds = {
      ...DEFAULT_MATERIAL_EVENT_THRESHOLDS,
      priceChangePct: config.gatePriceChangePct,
    };

    const result = detectMaterialEvent({
      now: tick.timestamp,
      tick: { price: tick.price, timestamp: tick.timestamp },
      candle: candle
        ? { volume: candle.volume, openTime: candle.openTime, closeTime: candle.closeTime }
        : null,
      reference,
      state,
      thresholds,
      referenceMaxAgeMs: this.referenceMaxAgeMs,
    });
    this.detectorStateByConfigId.set(config.id, result.state);

    if (!result.event) return;
    await this.advanceCycle(config, tick.symbol, result.event);
  }

  private async advanceCycle(
    config: any,
    symbol: string,
    eventType: MaterialEventType,
  ): Promise<void> {
    if (!config.reactiveLoopEnabled || !config.isRunning) return;

    const health = await this.streamHealth.resolve(symbol);
    if (health.state !== 'HEALTHY') return;

    const window = await this.coordination.getJson<ReactiveWindow>(windowKey(config.id));
    if (!window) return;

    const remaining = window.windowEndMs - Date.now();
    if (remaining <= 0) return;

    const consumed = await this.coordination.tryConsumeToken(
      advanceTokenKey(config.id, window.windowEndMs),
      remaining,
    );
    if (!consumed) return;

    const delayed = await this.tradingQueue.getDelayed();
    const job = delayed.find((candidate) => candidate.data?.configId === config.id);
    if (!job) return;

    try {
      await job.promote();
    } catch {
      // promote() rejects only once the job already left `delayed` — the state we wanted (architect D2)
    }

    this.logger.log(
      `Cycle advanced for config ${config.id} on ${symbol} by ${eventType} (advancedByMs=${remaining})`,
    );
    this.gateway?.emitToAll('agent:cycle-advanced', {
      configId: config.id,
      symbol,
      eventType,
      advancedByMs: remaining,
    });
  }
}
