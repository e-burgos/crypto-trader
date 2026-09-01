import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationType } from '@crypto-trader/shared';
import type {
  EntryOrderRef,
  RestingEntryMode,
  TradingMode,
} from '@crypto-trader/shared';
import type {
  EntryLevelPlan,
  OrderExecutorPort,
} from '@crypto-trader/trading-engine';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { BotActionSource } from './action-gate.service';

export const ENTRY_CLIENT_ORDER_ID_PREFIX = 'ent-';
const LAST_ERROR_MAX_LENGTH = 180;

export type EntryOrderCancelReason =
  | 'TTL_EXPIRED'
  | 'LATER_DECISION'
  | 'DAILY_LOSS_DISCARDED'
  | 'BOT_STOPPED'
  | 'REPLACED_BY_NEW_ENTRY'
  | 'PARTIAL_FILL_REMAINDER'
  | 'ORPHAN_SWEEP'
  | 'VANISHED_ON_EXCHANGE';

export type EntryOrderTerminalStatus = 'CANCELLED' | 'EXPIRED';

export interface RestingEntryOrder {
  id: string;
  userId: string;
  configId: string;
  symbol: string;
  asset: string;
  pair: string;
  mode: string;
  entryMode: RestingEntryMode;
  quantity: number;
  limitPrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  referencePrice: number;
  plannedNotionalUsd: number;
  clientOrderId: string;
  orderListId: string | null;
  orderId: string | null;
  limitLegOrderId: string | null;
  stopLegOrderId: string | null;
  placedAt: Date;
  expiresAt: Date;
  decisionId: string | null;
}

export interface PlaceRestingParams {
  userId: string;
  config: any;
  symbol: string;
  mode: TradingMode;
  executor: OrderExecutorPort;
  plan: EntryLevelPlan;
  stopLimitPrice: number | null;
  quantity: number;
  referencePrice: number;
  plannedNotionalUsd: number;
  decisionId: string | null;
}

export interface RestingScope {
  configId: string;
  asset: string;
  mode: string;
}

export interface RestingNotionalScope {
  userId: string;
  asset: string;
  mode: string;
}

export interface CancelRestingParams {
  userId: string;
  configId: string;
  symbol: string;
  executor: OrderExecutorPort;
  reason: EntryOrderCancelReason;
  rows?: RestingEntryOrder[];
  ids?: string[];
  recordAction: boolean;
  source?: BotActionSource;
  terminalStatus?: EntryOrderTerminalStatus;
  decisionId?: string | null;
}

export interface CancelRestingOutcome {
  cancelled: string[];
  failed: string[];
}

export interface MarkSkippedParams {
  userId: string;
  configId: string;
  symbol: string;
  entryMode: RestingEntryMode;
}

export function createEntryClientOrderId(): string {
  return (
    ENTRY_CLIENT_ORDER_ID_PREFIX + randomUUID().replace(/-/g, '').slice(0, 24)
  );
}

export function entryOrderRefOf(order: {
  orderListId: string | null;
  orderId: string | null;
  limitLegOrderId: string | null;
  stopLegOrderId: string | null;
}): EntryOrderRef {
  return {
    orderListId: order.orderListId,
    orderId: order.orderId,
    limitLegOrderId: order.limitLegOrderId,
    stopLegOrderId: order.stopLegOrderId,
  };
}

@Injectable()
export class EntryOrderService {
  private readonly logger = new Logger(EntryOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: AppGateway,
  ) {}

  async placeResting(params: PlaceRestingParams): Promise<RestingEntryOrder> {
    const clientOrderId = createEntryClientOrderId();
    const trailingDeltaBips =
      params.plan.mode === 'OCO'
        ? (params.config.entryTrailingDeltaBips ?? null)
        : null;

    const result = await params.executor.placeEntryOrder({
      mode: params.plan.mode,
      symbol: params.symbol,
      quantity: params.quantity,
      limitPrice: params.plan.limitPrice,
      referencePrice: params.referencePrice,
      stopPrice: params.plan.stopPrice,
      stopLimitPrice: params.stopLimitPrice,
      trailingDeltaBips,
      clientOrderId,
    });

    const placedAt = result.placedAt ?? new Date();
    const expiresAt = new Date(
      placedAt.getTime() + params.config.entryOrderTtlMinutes * 60_000,
    );

    const created = (await this.prisma.entryOrder.create({
      data: {
        userId: params.userId,
        configId: params.config.id,
        symbol: params.symbol,
        asset: params.config.asset,
        pair: params.config.pair,
        mode: params.mode,
        entryMode: params.plan.mode,
        status: 'RESTING',
        quantity: params.quantity,
        limitPrice: params.plan.limitPrice,
        stopPrice: params.plan.stopPrice,
        stopLimitPrice: params.stopLimitPrice,
        trailingDeltaBips,
        referencePrice: params.referencePrice,
        plannedNotionalUsd: params.plannedNotionalUsd,
        clientOrderId: result.clientOrderId ?? clientOrderId,
        orderListId: result.orderListId,
        orderId: result.orderId,
        limitLegOrderId: result.limitLegOrderId,
        stopLegOrderId: result.stopLegOrderId,
        placedAt,
        expiresAt,
        decisionId: params.decisionId,
      } as any,
    })) as unknown as RestingEntryOrder;

    await this.notificationsService
      .create(
        params.userId,
        NotificationType.TRADE_EXECUTED,
        JSON.stringify({
          key: 'entryOrderPlaced',
          entryMode: params.plan.mode,
          qty: params.quantity.toString(),
          asset: params.config.asset,
          price: params.plan.limitPrice.toFixed(2),
          mode: params.mode,
        }),
      )
      .catch(() => null);

    this.gateway.emitToUser(params.userId, 'entry-order:placed', {
      configId: params.config.id,
      entryOrderId: created.id,
      symbol: params.symbol,
      entryMode: params.plan.mode,
      limitPrice: params.plan.limitPrice,
      stopPrice: params.plan.stopPrice,
      stopLimitPrice: params.stopLimitPrice,
      trailingDeltaBips,
      quantity: params.quantity,
      plannedNotionalUsd: params.plannedNotionalUsd,
      placedAt,
      expiresAt,
    });

    return created;
  }

  markSkipped(params: MarkSkippedParams): void {
    this.gateway.emitToUser(params.userId, 'entry-order:skipped', {
      configId: params.configId,
      symbol: params.symbol,
      entryMode: params.entryMode,
      reason: 'NO_USABLE_LEVEL',
    });
  }

  async findResting(
    configId: string,
    symbol: string,
  ): Promise<RestingEntryOrder[]> {
    return (await this.prisma.entryOrder.findMany({
      where: { configId, symbol, status: 'RESTING' },
    })) as unknown as RestingEntryOrder[];
  }

  async countResting(scope: RestingScope): Promise<number> {
    return this.prisma.entryOrder.count({
      where: {
        configId: scope.configId,
        asset: scope.asset as any,
        mode: scope.mode as any,
        status: 'RESTING',
      },
    });
  }

  async sumRestingPlannedNotionalUsd(
    scope: RestingNotionalScope,
  ): Promise<number> {
    const aggregate = await this.prisma.entryOrder.aggregate({
      where: {
        userId: scope.userId,
        asset: scope.asset as any,
        mode: scope.mode as any,
        status: 'RESTING',
      },
      _sum: { plannedNotionalUsd: true },
    });
    return aggregate._sum.plannedNotionalUsd ?? 0;
  }

  reaffirms(
    order: RestingEntryOrder,
    plan: EntryLevelPlan,
    now: Date,
  ): boolean {
    return (
      order.entryMode === plan.mode &&
      order.limitPrice === plan.limitPrice &&
      (order.stopPrice ?? null) === (plan.stopPrice ?? null) &&
      order.expiresAt.getTime() > now.getTime()
    );
  }

  async cancelResting(
    params: CancelRestingParams,
  ): Promise<CancelRestingOutcome> {
    const rows = params.rows ?? (await this.resolveCancelTargets(params));
    const outcome: CancelRestingOutcome = { cancelled: [], failed: [] };
    const terminalStatus = params.terminalStatus ?? 'CANCELLED';

    for (const row of rows) {
      const cancelled = await this.cancelOnExchange(params.executor, row);
      if (!cancelled) {
        outcome.failed.push(row.id);
        continue;
      }
      await this.applyTerminalStatus(row, terminalStatus, params.reason);
      outcome.cancelled.push(row.id);
    }

    if (params.recordAction && outcome.cancelled.length > 0) {
      await this.recordEntryCancelAction(params);
    }

    return outcome;
  }

  async recordEntryCancelAction(params: {
    userId: string;
    configId: string;
    reason: EntryOrderCancelReason;
    source?: BotActionSource;
    decisionId?: string | null;
  }): Promise<void> {
    await this.prisma.botAction
      .create({
        data: {
          userId: params.userId,
          configId: params.configId,
          kind: 'ENTRY_CANCEL',
          source: params.source ?? 'LLM_CYCLE',
          outcome: 'EXECUTED',
          blockedBy: null,
          positionId: null,
          decisionId: params.decisionId ?? null,
          detail: params.reason,
        } as any,
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to record ENTRY_CANCEL action for config ${params.configId}: ${errorMessage(err)}`,
        );
        return null;
      });
  }

  async cancelOnExchange(
    executor: OrderExecutorPort,
    order: RestingEntryOrder,
  ): Promise<boolean> {
    try {
      await executor.cancelEntryOrder(order.symbol, entryOrderRefOf(order));
      return true;
    } catch (err) {
      const lastError = errorMessage(err).slice(0, LAST_ERROR_MAX_LENGTH);
      this.logger.warn(
        `Failed to cancel entry order ${order.id} on ${order.symbol}: ${lastError}`,
      );
      await this.prisma.entryOrder
        .update({ where: { id: order.id }, data: { lastError } })
        .catch(() => null);
      return false;
    }
  }

  async applyTerminalStatus(
    order: RestingEntryOrder,
    status: EntryOrderTerminalStatus,
    reason: EntryOrderCancelReason,
  ): Promise<void> {
    await this.prisma.entryOrder.update({
      where: { id: order.id },
      data: {
        status,
        cancelReason: reason,
        settledAt: new Date(),
        lastError: null,
      } as any,
    });

    if (status === 'EXPIRED') {
      this.gateway.emitToUser(order.userId, 'entry-order:expired', {
        configId: order.configId,
        entryOrderId: order.id,
        symbol: order.symbol,
        placedAt: order.placedAt,
        expiresAt: order.expiresAt,
      });
      return;
    }

    this.gateway.emitToUser(order.userId, 'entry-order:cancelled', {
      configId: order.configId,
      entryOrderId: order.id,
      symbol: order.symbol,
      cancelReason: reason,
    });
  }

  private async resolveCancelTargets(
    params: CancelRestingParams,
  ): Promise<RestingEntryOrder[]> {
    return (await this.prisma.entryOrder.findMany({
      where: {
        configId: params.configId,
        status: 'RESTING',
        ...(params.ids ? { id: { in: params.ids } } : { symbol: params.symbol }),
      },
    })) as unknown as RestingEntryOrder[];
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
