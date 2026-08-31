import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { placeProtectionWithRetry } from './protection-retry';
import { PositionManager, applyPartialExit } from '@crypto-trader/trading-engine';
import type {
  OrderExecutorPort,
  TrailingState,
  PartialTakeProfitResult,
} from '@crypto-trader/trading-engine';
import {
  TradeType,
  TradingMode,
  NotificationType,
  TRADE_FEE_PCT,
} from '@crypto-trader/shared';
import type {
  AegisVerdict,
  ForgeSizingSummary,
} from '../orchestrator/dto/decision-synthesis.dto';

export interface DecisionExecutionContext {
  decisionId: string;
  confidence: number;
  risk?: AegisVerdict;
  sizing?: ForgeSizingSummary;
}

export interface CloseAtMarketContext {
  userId: string;
  config: any;
  symbol: string;
  mode: TradingMode;
  executor: OrderExecutorPort;
  position: any;
  positionData: any;
  exitReason: 'STOP_LOSS' | 'TRAILING_STOP' | 'TAKE_PROFIT' | 'TIME_EXIT';
}

export interface PartialTakeProfitContext {
  userId: string;
  config: any;
  symbol: string;
  mode: TradingMode;
  executor: OrderExecutorPort;
  position: any;
  positionData: any;
  partial: PartialTakeProfitResult;
  trailingState: TrailingState;
  decisionContext?: DecisionExecutionContext;
}

export interface RearmProtectionContext {
  userId: string;
  config: any;
  symbol: string;
  mode: TradingMode;
  executor: OrderExecutorPort;
  position: any;
  levels: { stopPrice: number; takeProfitPrice: number; quantity: number };
}

export interface PlaceInitialProtectionContext {
  userId: string;
  config: any;
  symbol: string;
  mode: TradingMode;
  executor: OrderExecutorPort;
  position: any;
  order: { price: number; quantity: number };
}

@Injectable()
export class PositionActionService {
  private readonly logger = new Logger(PositionActionService.name);
  private readonly positionManager = new PositionManager();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async closeAtMarket(
    ctx: CloseAtMarketContext,
  ): Promise<{ tradeId: string; exitPrice: number }> {
    const { userId, config, symbol, mode, executor, position, positionData, exitReason } = ctx;
    await this.releaseProtectionIfNeeded(symbol, executor, position);

    const order = await executor.placeMarketOrder(
      symbol,
      TradeType.SELL,
      position.quantity,
    );
    const { position: closedPosition, pnl } = this.positionManager.closePosition(
      positionData,
      order.price,
    );

    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        exitPrice: closedPosition.exitPrice,
        exitAt: closedPosition.exitAt,
        status: 'CLOSED',
        pnl: closedPosition.pnl,
        fees: closedPosition.fees,
        exitReason,
      },
    });

    const trade = await this.prisma.trade.create({
      data: {
        userId,
        positionId: position.id,
        type: TradeType.SELL,
        price: order.price,
        quantity: order.quantity,
        fee: order.price * order.quantity * TRADE_FEE_PCT,
        mode,
        binanceOrderId: order.orderId,
      },
    });

    if (mode === TradingMode.SANDBOX) {
      const proceeds = order.price * order.quantity;
      const fee = proceeds * TRADE_FEE_PCT;
      await this.creditSandboxWallet(userId, position.pair, proceeds, fee);
    }

    const notifType =
      exitReason === 'TAKE_PROFIT'
        ? NotificationType.TAKE_PROFIT_HIT
        : NotificationType.STOP_LOSS_TRIGGERED;
    const notifKey: Record<typeof exitReason, string> = {
      STOP_LOSS: 'stopLoss',
      TRAILING_STOP: 'trailingStop',
      TIME_EXIT: 'timeExit',
      TAKE_PROFIT: 'takeProfit',
    };

    await this.notificationsService.create(
      userId,
      notifType,
      JSON.stringify({
        key: notifKey[exitReason],
        qty: position.quantity.toString(),
        asset: config.asset,
        price: order.price.toFixed(2),
        pnl: pnl.toFixed(2),
      }),
    );
    this.gateway.emitToUser(userId, 'trade:executed', {
      position: closedPosition,
    });
    this.gateway.emitToUser(userId, 'position:updated', {
      position: closedPosition,
    });

    return { tradeId: trade.id, exitPrice: order.price };
  }

  async executePartialTakeProfit(
    ctx: PartialTakeProfitContext,
  ): Promise<{ tradeId: string }> {
    const {
      userId,
      config,
      symbol,
      mode,
      executor,
      position,
      positionData,
      partial,
      trailingState,
      decisionContext,
    } = ctx;
    await this.releaseProtectionIfNeeded(symbol, executor, position);

    const order = await executor.placeMarketOrder(
      symbol,
      TradeType.SELL,
      partial.sellQuantity,
    );
    const applied = applyPartialExit(positionData, order.price, partial.sellQuantity);

    const currentStop =
      trailingState.stopPrice ?? position.entryPrice * (1 - config.stopLossPct);
    const newStopPrice =
      partial.newStopPrice != null
        ? Math.max(currentStop, partial.newStopPrice)
        : trailingState.stopPrice;

    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        quantity: applied.quantity,
        realizedPnl: (position.realizedPnl ?? 0) + applied.realizedPnlDelta,
        fees: (position.fees ?? 0) + applied.fees,
        partialExitCount: (position.partialExitCount ?? 0) + 1,
        stopPrice: newStopPrice,
        highWaterPrice: trailingState.highWaterPrice,
        trailingActive: trailingState.trailingActive,
      },
    });

    const trade = await this.prisma.trade.create({
      data: {
        userId,
        positionId: position.id,
        type: TradeType.SELL,
        price: order.price,
        quantity: order.quantity,
        fee: order.price * order.quantity * TRADE_FEE_PCT,
        mode,
        binanceOrderId: order.orderId,
        decisionId: decisionContext?.decisionId ?? null,
      },
    });

    if (mode === TradingMode.SANDBOX) {
      const proceeds = order.price * order.quantity;
      const fee = proceeds * TRADE_FEE_PCT;
      await this.creditSandboxWallet(userId, position.pair, proceeds, fee);
    }

    if (
      config.nativeProtectionEnabled &&
      mode !== TradingMode.SANDBOX &&
      applied.quantity > 0 &&
      newStopPrice != null
    ) {
      const outcome = await this.attemptProtectionPlacement(position, {
        executor,
        symbol,
        quantity: applied.quantity,
        stopPrice: newStopPrice,
        takeProfitPrice:
          position.takeProfitPrice ?? position.entryPrice * (1 + config.takeProfitPct),
        referencePrice: order.price,
        stopLimitOffsetPct: config.stopLimitOffsetPct,
      });
      await this.applyProtectionOutcome(
        userId,
        config,
        symbol,
        mode,
        executor,
        position,
        outcome,
      );
    }

    await this.notificationsService.create(
      userId,
      NotificationType.TAKE_PROFIT_HIT,
      JSON.stringify({
        key: 'partialTakeProfit',
        qty: partial.sellQuantity.toString(),
        asset: config.asset,
        price: order.price.toFixed(2),
        pnl: applied.realizedPnlDelta.toFixed(2),
      }),
    );
    this.gateway.emitToUser(userId, 'position:updated', {
      position: {
        ...position,
        quantity: applied.quantity,
        realizedPnl: (position.realizedPnl ?? 0) + applied.realizedPnlDelta,
      },
    });

    return { tradeId: trade.id };
  }

  async rearmProtection(
    ctx: RearmProtectionContext,
  ): Promise<{ protectionStatus: string }> {
    const { userId, config, symbol, mode, executor, position, levels } = ctx;
    try {
      await executor.cancelProtectionOrder(symbol, {
        orderListId: position.protectionOrderListId,
        stopOrderId: position.protectionStopOrderId,
      });
    } catch (err) {
      const lastError = (
        err instanceof Error ? err.message : String(err)
      ).slice(0, 180);
      await this.prisma.position.update({
        where: { id: position.id },
        data: { protectionStatus: 'UNPROTECTED', protectionLastError: lastError },
      });
      await this.notificationsService
        .create(
          userId,
          NotificationType.AGENT_ERROR,
          JSON.stringify({ key: 'positionUnprotected', positionId: position.id }),
        )
        .catch(() => null);
      this.gateway.emitToUser(userId, 'position:unprotected', {
        positionId: position.id,
        error: lastError,
      });
      return { protectionStatus: 'UNPROTECTED' };
    }

    await this.prisma.position.update({
      where: { id: position.id },
      data: { protectionStatus: 'RELEASED' },
    });

    const referencePrice = await executor
      .getPrice(symbol)
      .catch(() => position.entryPrice);

    const outcome = await this.attemptProtectionPlacement(position, {
      executor,
      symbol,
      quantity: levels.quantity,
      stopPrice: levels.stopPrice,
      takeProfitPrice: levels.takeProfitPrice,
      referencePrice,
      stopLimitOffsetPct: config.stopLimitOffsetPct,
    });

    await this.applyProtectionOutcome(
      userId,
      config,
      symbol,
      mode,
      executor,
      position,
      outcome,
    );

    return {
      protectionStatus: outcome.outcome === 'PLACED' ? 'PROTECTED' : 'UNPROTECTED',
    };
  }

  async placeInitialProtection(ctx: PlaceInitialProtectionContext): Promise<void> {
    const { userId, config, symbol, mode, executor, position, order } = ctx;
    const referencePrice = order.price;
    const stopPrice = position.stopPrice ?? referencePrice * (1 - config.stopLossPct);
    const takeProfitPrice =
      position.takeProfitPrice ?? referencePrice * (1 + config.takeProfitPct);

    const outcome = await this.attemptProtectionPlacement(position, {
      executor,
      symbol,
      quantity: order.quantity,
      stopPrice,
      takeProfitPrice,
      referencePrice,
      stopLimitOffsetPct: config.stopLimitOffsetPct,
    });

    await this.applyProtectionOutcome(
      userId,
      config,
      symbol,
      mode,
      executor,
      position,
      outcome,
    );
  }

  async releaseProtectionIfNeeded(
    symbol: string,
    executor: OrderExecutorPort,
    position: {
      id: string;
      protectionStatus?: string;
      protectionOrderListId?: string | null;
      protectionStopOrderId?: string | null;
    },
  ): Promise<void> {
    if (position.protectionStatus !== 'PROTECTED') return;
    try {
      await executor.cancelProtectionOrder(symbol, {
        orderListId: position.protectionOrderListId,
        stopOrderId: position.protectionStopOrderId,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to release native protection for position ${position.id} before selling: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await this.prisma.position
      .update({
        where: { id: position.id },
        data: { protectionStatus: 'RELEASED' },
      })
      .catch(() => null);
  }

  private async attemptProtectionPlacement(
    position: { id: string; protectionFailureCount?: number },
    params: {
      executor: OrderExecutorPort;
      symbol: string;
      quantity: number;
      stopPrice: number;
      takeProfitPrice: number;
      referencePrice: number;
      stopLimitOffsetPct?: number;
    },
  ) {
    const stopLimitPrice =
      params.stopPrice * (1 - (params.stopLimitOffsetPct ?? 0.002));
    return placeProtectionWithRetry({
      executor: params.executor,
      request: {
        symbol: params.symbol,
        quantity: params.quantity,
        stopPrice: params.stopPrice,
        stopLimitPrice,
        takeProfitPrice: params.takeProfitPrice,
        referencePrice: params.referencePrice,
      },
      startingFailureCount: position.protectionFailureCount ?? 0,
      clientOrderIdFor: (attempt) => `prot-${position.id}-${attempt}`,
      beforeAttempt: async (attempt) => {
        await this.prisma.position.update({
          where: { id: position.id },
          data: { protectionFailureCount: attempt },
        });
      },
    });
  }

  private async applyProtectionOutcome(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    executor: OrderExecutorPort,
    position: any,
    outcome: Awaited<ReturnType<typeof placeProtectionWithRetry>>,
  ): Promise<void> {
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
      return;
    }

    const lastError = `${outcome.code}:${outcome.message}`.slice(0, 180);
    await this.prisma.position.update({
      where: { id: position.id },
      data: { protectionStatus: 'UNPROTECTED', protectionLastError: lastError },
    });
    await this.notificationsService
      .create(
        userId,
        NotificationType.AGENT_ERROR,
        JSON.stringify({ key: 'positionUnprotected', positionId: position.id }),
      )
      .catch(() => null);
    this.gateway.emitToUser(userId, 'position:unprotected', {
      positionId: position.id,
      error: lastError,
    });

    if (config.closeOnProtectionFailure) {
      await this.closePositionAfterProtectionFailure(
        userId,
        config,
        symbol,
        mode,
        executor,
        position,
      );
    }
  }

  private async closePositionAfterProtectionFailure(
    userId: string,
    config: any,
    symbol: string,
    mode: TradingMode,
    executor: OrderExecutorPort,
    position: any,
  ) {
    const closeOrder = await executor.placeMarketOrder(
      symbol,
      TradeType.SELL,
      position.quantity,
    );
    const posData = {
      ...position,
      asset: position.asset as any,
      pair: position.pair as any,
      mode: position.mode as any,
      status: position.status as any,
      exitPrice: position.exitPrice ?? undefined,
      exitAt: position.exitAt ?? undefined,
      pnl: position.pnl ?? undefined,
    };
    const { position: closedPosition, pnl } = this.positionManager.closePosition(
      posData,
      closeOrder.price,
    );

    const claimed = await this.prisma.position.updateMany({
      where: { id: position.id, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        exitPrice: closedPosition.exitPrice,
        exitAt: closedPosition.exitAt,
        pnl: closedPosition.pnl,
        fees: closedPosition.fees,
        exitReason: 'PROTECTION_FAILURE',
      },
    });
    if (claimed.count === 0) return;

    await this.prisma.trade.create({
      data: {
        userId,
        positionId: position.id,
        type: TradeType.SELL,
        price: closeOrder.price,
        quantity: closeOrder.quantity,
        fee: closeOrder.price * closeOrder.quantity * TRADE_FEE_PCT,
        mode,
        binanceOrderId: closeOrder.orderId,
      },
    });

    await this.notificationsService
      .create(
        userId,
        NotificationType.STOP_LOSS_TRIGGERED,
        JSON.stringify({
          key: 'stopLoss',
          qty: closeOrder.quantity.toString(),
          asset: config.asset,
          price: closeOrder.price.toFixed(2),
          pnl: pnl.toFixed(2),
        }),
      )
      .catch(() => null);
    this.gateway.emitToUser(userId, 'position:updated', {
      position: closedPosition,
    });
  }

  async creditSandboxWallet(
    userId: string,
    currency: string,
    proceeds: number,
    fee: number,
  ): Promise<void> {
    const updatedWallet = await this.prisma.$transaction(async (tx) => {
      await tx.sandboxWallet.upsert({
        where: { userId_currency: { userId, currency: currency as any } },
        create: {
          userId,
          currency: currency as any,
          balance: 10_000 + proceeds - fee,
        },
        update: { balance: { increment: proceeds - fee } },
      });
      return tx.sandboxWallet.findUnique({
        where: { userId_currency: { userId, currency: currency as any } },
      });
    });
    this.gateway.emitToUser(userId, 'wallet:updated', {
      currency,
      balance: updatedWallet?.balance,
    });
  }
}
