import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationType } from '@crypto-trader/shared';
import type {
  StreamHealthRecord,
  StreamHealthState,
} from '@crypto-trader/shared';
import {
  resolveStreamHealth,
  type StreamHealthReason,
} from '@crypto-trader/analysis';
import type { PrismaService } from '../prisma/prisma.service';
import type { AppGateway } from '../gateway/app.gateway';
import type { NotificationsService } from '../notifications/notifications.service';
import type { MarketStreamService } from './market-stream.service';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import type { ReactiveRuntimeThresholds } from './reactive-runtime-thresholds';

const HEALTH_KEY_PREFIX = 'rx:v1:health:';

export function streamHealthKey(symbol: string): string {
  return `${HEALTH_KEY_PREFIX}${symbol}`;
}

export interface StreamHealthStatus {
  symbol: string;
  state: StreamHealthState;
  reason: StreamHealthReason;
  record: StreamHealthRecord | null;
}

export interface StreamHealthSymbolEntry {
  symbol: string;
  state: StreamHealthState;
  reason: string | null;
  lastTickAt: string | null;
  ownerId: string | null;
  updatedAt: string | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class StreamHealthService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(StreamHealthService.name);
  private readonly lastKnownState = new Map<string, StreamHealthState>();
  private readonly degradedSinceMs = new Map<string, number>();
  private readonly notifiedDegradations = new Set<string>();
  private publishTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly coordination: ReactiveCoordinationPort,
    private readonly prisma: PrismaService,
    private readonly thresholds: ReactiveRuntimeThresholds,
    private readonly gateway?: AppGateway,
    private readonly marketStream?: MarketStreamService,
    private readonly notifications?: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (!this.marketStream) return;

    this.publishOwnedSymbols().catch((err) =>
      this.logger.error(
        `Failed to publish stream health: ${errorMessage(err)}`,
      ),
    );
    this.publishTimer = setInterval(() => {
      this.publishOwnedSymbols().catch((err) =>
        this.logger.error(
          `Failed to publish stream health: ${errorMessage(err)}`,
        ),
      );
    }, this.thresholds.healthPublishIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.publishTimer) clearInterval(this.publishTimer);
    this.publishTimer = null;
  }

  async publishOwnedSymbols(): Promise<void> {
    const marketStream = this.marketStream;
    if (!marketStream) return;

    await Promise.all(
      marketStream
        .getOwnedSymbols()
        .map((symbol) => this.publishSymbol(symbol)),
    );
  }

  private async publishSymbol(symbol: string): Promise<void> {
    const snapshot = this.marketStream?.getHealthSnapshot(symbol);
    if (!snapshot) return;

    const record: StreamHealthRecord = {
      symbol,
      ownerId: snapshot.ownerId,
      connectedAt: snapshot.connectedAt,
      lastTickAtMs: snapshot.lastTickAtMs ?? snapshot.connectedAt,
      lastHeartbeatAtMs: snapshot.lastHeartbeatAtMs ?? snapshot.connectedAt,
      publishedAt: Date.now(),
    };

    await this.coordination.setJson(
      streamHealthKey(symbol),
      record,
      this.thresholds.streamHealthTtlMs,
    );

    const { state, reason } = this.resolveRecord(record);
    this.checkTransition(symbol, record, state, reason);
    await this.checkSustainedDegradation(symbol, state);
  }

  private checkTransition(
    symbol: string,
    record: StreamHealthRecord,
    state: StreamHealthState,
    reason: StreamHealthReason,
  ): void {
    const previous = this.lastKnownState.get(symbol);
    this.lastKnownState.set(symbol, state);

    if (previous === undefined || previous === state) return;

    const changedAt = Date.now();
    this.logger.log(
      `Stream health transition for ${symbol}: ${previous} -> ${state}${reason ? ` (${reason})` : ''}`,
    );
    this.gateway?.emitToAll('market:stream-health', {
      symbol,
      state,
      reason,
      lastTickAt: new Date(record.lastTickAtMs).toISOString(),
      ownerId: record.ownerId,
      changedAt,
    });
  }

  private async checkSustainedDegradation(
    symbol: string,
    state: StreamHealthState,
  ): Promise<void> {
    if (state === 'HEALTHY') {
      this.degradedSinceMs.delete(symbol);
      this.notifiedDegradations.delete(symbol);
      return;
    }

    const now = Date.now();
    const since = this.degradedSinceMs.get(symbol) ?? now;
    if (!this.degradedSinceMs.has(symbol))
      this.degradedSinceMs.set(symbol, since);

    if (this.notifiedDegradations.has(symbol)) return;
    if (now - since < this.thresholds.degradedNotifyAfterMs) return;

    this.notifiedDegradations.add(symbol);
    try {
      await this.notifyDegradedUsers(symbol);
    } catch (err) {
      this.notifiedDegradations.delete(symbol);
      throw err;
    }
  }

  private async notifyDegradedUsers(symbol: string): Promise<void> {
    if (!this.notifications) return;

    const configs = await this.prisma.tradingConfig.findMany({
      where: { isRunning: true },
      select: { userId: true, asset: true, pair: true },
    });

    const userIds = new Set(
      (configs as Array<{ userId: string; asset: string; pair: string }>)
        .filter((config) => `${config.asset}${config.pair}` === symbol)
        .map((config) => config.userId),
    );

    await Promise.all(
      [...userIds].map((userId) =>
        this.notifications?.create(
          userId,
          NotificationType.AGENT_ERROR,
          JSON.stringify({ key: 'streamDegraded', symbol }),
        ),
      ),
    );
  }

  private resolveRecord(record: StreamHealthRecord | null): {
    state: StreamHealthState;
    reason: StreamHealthReason;
  } {
    return resolveStreamHealth({
      now: Date.now(),
      record,
      thresholds: {
        tickMaxAgeMs: this.thresholds.streamTickMaxAgeMs,
        heartbeatMaxAgeMs: this.thresholds.streamHeartbeatMaxAgeMs,
      },
    });
  }

  async resolve(symbol: string): Promise<StreamHealthStatus> {
    const record = await this.coordination.getJson<StreamHealthRecord>(
      streamHealthKey(symbol),
    );
    const { state, reason } = this.resolveRecord(record);
    return { symbol, state, reason, record };
  }

  async getHealthForUser(
    userId: string,
  ): Promise<{ symbols: StreamHealthSymbolEntry[] }> {
    const configs = await this.prisma.tradingConfig.findMany({
      where: { userId, isRunning: true },
      select: { asset: true, pair: true },
    });

    const symbols = [
      ...new Set(
        (configs as Array<{ asset: string; pair: string }>).map(
          (config) => `${config.asset}${config.pair}`,
        ),
      ),
    ];

    const statuses = await Promise.all(
      symbols.map((symbol) => this.resolve(symbol)),
    );

    return {
      symbols: statuses.map(({ symbol, state, reason, record }) => ({
        symbol,
        state,
        reason,
        lastTickAt: record ? new Date(record.lastTickAtMs).toISOString() : null,
        ownerId: record?.ownerId ?? null,
        updatedAt: record ? new Date(record.publishedAt).toISOString() : null,
      })),
    };
  }
}
