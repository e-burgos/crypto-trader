import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, TRADE_FEE_PCT } from '@crypto-trader/shared';
import type { OrderExecutorPort } from '@crypto-trader/trading-engine';
import { placeProtectionWithRetry } from './protection-retry';

export interface ReconciliationOutcome {
  checked: number;
  closedByExchange: number;
  reprotected: number;
  stillUnprotected: number;
  orphanOrdersCancelled: number;
}

interface ReconciliationConfig {
  id: string;
  asset: string;
  pair: string;
  mode: string;
  stopLossPct: number;
  takeProfitPct: number;
  stopLimitOffsetPct: number;
}

interface ReconciliationInput {
  userId: string;
  config: ReconciliationConfig;
  symbol: string;
  executor: OrderExecutorPort;
}

interface ReconciledPosition {
  id: string;
  configId: string;
  asset: string;
  pair: string;
  mode: string;
  entryPrice: number;
  quantity: number;
  fees: number;
  stopPrice: number | null;
  takeProfitPrice: number | null;
  protectionStatus: string;
  protectionOrderListId: string | null;
  protectionStopOrderId: string | null;
  protectionFailureCount: number;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: AppGateway,
  ) {}

  async reconcile(input: ReconciliationInput): Promise<ReconciliationOutcome> {
    const outcome: ReconciliationOutcome = {
      checked: 0,
      closedByExchange: 0,
      reprotected: 0,
      stillUnprotected: 0,
      orphanOrdersCancelled: 0,
    };

    const openPositions = (await this.prisma.position.findMany({
      where: { userId: input.userId, configId: input.config.id, status: 'OPEN' },
    })) as unknown as ReconciledPosition[];
    outcome.checked = openPositions.length;

    const liveOrderListIds = new Set<string>();

    for (const position of openPositions) {
      if (position.protectionStatus === 'PROTECTED') {
        await this.reconcileProtected(
          input,
          position,
          outcome,
          liveOrderListIds,
        );
        continue;
      }

      if (
        position.protectionStatus === 'PENDING' ||
        position.protectionStatus === 'UNPROTECTED'
      ) {
        const attempted = await this.attemptProtection(input, position);
        if (attempted.outcome === 'PLACED') {
          outcome.reprotected++;
          liveOrderListIds.add(attempted.result.orderListId as string);
        } else {
          outcome.stillUnprotected++;
        }
        continue;
      }
      // NONE — bot without native protection, unaffected by this cycle.
    }

    await this.addExternalLiveOrderIds(input, liveOrderListIds);
    outcome.orphanOrdersCancelled = await this.sweepOrphanOrders(
      input,
      liveOrderListIds,
    );

    return outcome;
  }

  private async reconcileProtected(
    input: ReconciliationInput,
    position: ReconciledPosition,
    outcome: ReconciliationOutcome,
    liveOrderListIds: Set<string>,
  ): Promise<void> {
    if (!position.protectionOrderListId) return;

    const status = await input.executor.getProtectionOrderStatus(
      input.symbol,
      {
        orderListId: position.protectionOrderListId,
        stopOrderId: position.protectionStopOrderId,
      },
    );

    if (status.state === 'ACTIVE') {
      liveOrderListIds.add(position.protectionOrderListId);
      return;
    }

    if (status.state === 'FILLED') {
      const closed = await this.closeFilledByExchange(
        input.userId,
        position,
        status,
      );
      if (closed) outcome.closedByExchange++;
      return;
    }

    // CANCELLED or MISSING — the protection no longer exists on the exchange.
    await this.prisma.position.update({
      where: { id: position.id },
      data: { protectionStatus: 'UNPROTECTED' },
    });
    const reprotected = await this.attemptProtection(input, {
      ...position,
      protectionStatus: 'UNPROTECTED',
    });
    if (reprotected.outcome === 'PLACED') {
      outcome.reprotected++;
      liveOrderListIds.add(reprotected.result.orderListId as string);
    } else {
      outcome.stillUnprotected++;
    }
  }

  private async closeFilledByExchange(
    userId: string,
    position: ReconciledPosition,
    status: { executedPrice: number | null; executedQuantity: number | null; filledLeg: 'STOP' | 'TAKE_PROFIT' | null; orderId: string | null },
  ): Promise<boolean> {
    const exitPrice = status.executedPrice ?? position.entryPrice;
    const exitQuantity = status.executedQuantity ?? position.quantity;
    const exitFee = exitPrice * exitQuantity * TRADE_FEE_PCT;
    const totalFees = Math.round((position.fees + exitFee) * 100) / 100;
    const grossPnl = (exitPrice - position.entryPrice) * exitQuantity;
    const pnl = Math.round((grossPnl - totalFees) * 100) / 100;
    const exitReason =
      status.filledLeg === 'STOP' ? 'EXCHANGE_STOP' : 'EXCHANGE_TAKE_PROFIT';

    const claimed = await this.prisma.position.updateMany({
      where: { id: position.id, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        exitPrice,
        exitAt: new Date(),
        pnl,
        fees: totalFees,
        exitReason,
        protectionStatus: 'RELEASED',
      },
    });
    if (claimed.count === 0) return false;

    await this.prisma.trade.create({
      data: {
        userId,
        positionId: position.id,
        type: 'SELL',
        price: exitPrice,
        quantity: exitQuantity,
        fee: exitFee,
        mode: position.mode as any,
        binanceOrderId: status.orderId ?? undefined,
        decisionId: null,
      },
    });

    const notifType =
      status.filledLeg === 'STOP'
        ? NotificationType.STOP_LOSS_TRIGGERED
        : NotificationType.TAKE_PROFIT_HIT;
    await this.notificationsService
      .create(
        userId,
        notifType,
        JSON.stringify({
          key: status.filledLeg === 'STOP' ? 'stopLoss' : 'takeProfit',
          qty: exitQuantity.toString(),
          asset: position.asset,
          price: exitPrice.toFixed(2),
          pnl: pnl.toFixed(2),
        }),
      )
      .catch(() => null);
    this.gateway.emitToUser(userId, 'position:updated', {
      position: { ...position, status: 'CLOSED', exitPrice, pnl },
    });

    return true;
  }

  private async attemptProtection(
    input: ReconciliationInput,
    position: ReconciledPosition,
  ) {
    const stopPrice =
      position.stopPrice ?? position.entryPrice * (1 - input.config.stopLossPct);
    const takeProfitPrice =
      position.takeProfitPrice ??
      position.entryPrice * (1 + input.config.takeProfitPct);
    const stopLimitPrice =
      stopPrice * (1 - (input.config.stopLimitOffsetPct ?? 0.002));
    const referencePrice = await input.executor
      .getPrice(input.symbol)
      .catch(() => position.entryPrice);

    const outcome = await placeProtectionWithRetry({
      executor: input.executor,
      request: {
        symbol: input.symbol,
        quantity: position.quantity,
        stopPrice,
        stopLimitPrice,
        takeProfitPrice,
        referencePrice,
      },
      startingFailureCount: position.protectionFailureCount,
      clientOrderIdFor: (attempt) => `prot-${position.id}-${attempt}`,
      beforeAttempt: async (attempt) => {
        await this.prisma.position.update({
          where: { id: position.id },
          data: { protectionFailureCount: attempt },
        });
      },
    });

    if (outcome.outcome === 'PLACED') {
      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          protectionStatus: 'PROTECTED',
          protectionOrderListId: outcome.result.orderListId,
          protectionStopOrderId: outcome.result.stopOrderId,
          protectionLimitOrderId: outcome.result.limitOrderId,
          protectionPlacedAt: outcome.result.placedAt,
          protectionLastError: null,
        },
      });
      return outcome;
    }

    const lastError = `${outcome.code}:${outcome.message}`.slice(0, 180);
    await this.prisma.position.update({
      where: { id: position.id },
      data: { protectionStatus: 'UNPROTECTED', protectionLastError: lastError },
    });
    await this.notificationsService
      .create(
        input.userId,
        NotificationType.AGENT_ERROR,
        JSON.stringify({ key: 'positionUnprotected', positionId: position.id }),
      )
      .catch(() => null);
    this.gateway.emitToUser(input.userId, 'position:unprotected', {
      positionId: position.id,
      error: lastError,
    });
    this.logger.warn(
      `Reconciliation could not protect position ${position.id}: ${lastError}`,
    );
    return outcome;
  }

  private async addExternalLiveOrderIds(
    input: ReconciliationInput,
    liveOrderListIds: Set<string>,
  ): Promise<void> {
    const outsideProtected = await this.prisma.position.findMany({
      where: {
        userId: input.userId,
        asset: input.config.asset as any,
        pair: input.config.pair as any,
        mode: input.config.mode as any,
        status: 'OPEN',
        protectionStatus: 'PROTECTED',
        configId: { not: input.config.id },
      },
      select: { protectionOrderListId: true },
    });
    for (const p of outsideProtected) {
      if (p.protectionOrderListId) liveOrderListIds.add(p.protectionOrderListId);
    }
  }

  private async sweepOrphanOrders(
    input: ReconciliationInput,
    liveOrderListIds: Set<string>,
  ): Promise<number> {
    const openOrders = await input.executor
      .getOpenOrders(input.symbol)
      .catch(() => []);
    let cancelled = 0;
    for (const order of openOrders) {
      if (!order.clientOrderId.startsWith('prot-')) continue;
      if (order.orderListId && liveOrderListIds.has(order.orderListId)) continue;
      try {
        await input.executor.cancelProtectionOrder(input.symbol, {
          orderListId: order.orderListId,
        });
        cancelled++;
      } catch (err) {
        this.logger.warn(
          `Failed to cancel orphan protection order ${order.orderListId} for ${input.symbol}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return cancelled;
  }
}
