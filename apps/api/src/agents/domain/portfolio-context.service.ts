import { Injectable } from '@nestjs/common';
import {
  Asset,
  QuoteCurrency,
  TradingMode,
  TradeType,
} from '@crypto-trader/shared';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_RECENT_TRADES_LIMIT = 10;

export interface PortfolioContextInput {
  userId: string;
  configId?: string;
  mode?: TradingMode;
  recentTradesLimit?: number;
}

export interface OpenPositionView {
  id: string;
  symbol: string;
  asset: Asset;
  pair: QuoteCurrency;
  mode: TradingMode;
  quantity: number;
  entryPrice: number;
  entryAt: Date;
  notionalAtEntryUsd: number;
}

export interface RecentTradeView {
  id: string;
  type: TradeType;
  symbol: string;
  price: number;
  quantity: number;
  fee: number;
  executedAt: Date;
}

export interface PortfolioContextSnapshot {
  positions: OpenPositionView[];
  exposureAtEntryUsd: number;
  realizedPnlUsd: number;
  feesUsd: number;
  wallets: Array<{ currency: QuoteCurrency; balance: number }>;
  recentTrades: RecentTradeView[];
}

@Injectable()
export class PortfolioContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: PortfolioContextInput): Promise<PortfolioContextSnapshot> {
    const recentTradesLimit =
      input.recentTradesLimit ?? DEFAULT_RECENT_TRADES_LIMIT;

    const [openPositions, closedPositions, rawTrades, wallets] =
      await Promise.all([
        this.findOpenPositions(input),
        this.findRecentClosedPositions(input, recentTradesLimit),
        this.findRecentTrades(input, recentTradesLimit),
        this.prisma.sandboxWallet.findMany({ where: { userId: input.userId } }),
      ]);

    const positions = openPositions.map(toOpenPositionView);
    const exposureAtEntryUsd = round(
      positions.reduce((sum, p) => sum + p.notionalAtEntryUsd, 0),
    );
    const realizedPnlUsd = round(
      closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0),
    );
    const feesUsd = round(rawTrades.reduce((sum, t) => sum + t.fee, 0));
    const recentTrades = rawTrades.map(toRecentTradeView);

    return {
      positions,
      exposureAtEntryUsd,
      realizedPnlUsd,
      feesUsd,
      wallets: wallets.map((w) => ({
        currency: w.currency as QuoteCurrency,
        balance: w.balance,
      })),
      recentTrades,
    };
  }

  private findOpenPositions(input: PortfolioContextInput) {
    return this.prisma.position.findMany({
      where: {
        userId: input.userId,
        status: 'OPEN',
        ...(input.configId ? { configId: input.configId } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
      },
    });
  }

  private findRecentClosedPositions(
    input: PortfolioContextInput,
    limit: number,
  ) {
    return this.prisma.position.findMany({
      where: {
        userId: input.userId,
        status: 'CLOSED',
        ...(input.configId ? { configId: input.configId } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
      },
      orderBy: { exitAt: 'desc' },
      take: limit,
      select: { pnl: true },
    });
  }

  private findRecentTrades(input: PortfolioContextInput, limit: number) {
    return this.prisma.trade.findMany({
      where: {
        userId: input.userId,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.configId
          ? { position: { configId: input.configId } }
          : {}),
      },
      orderBy: { executedAt: 'desc' },
      take: limit,
      include: { position: { select: { asset: true, pair: true } } },
    });
  }
}

function toOpenPositionView(p: {
  id: string;
  asset: string;
  pair: string;
  mode: string;
  quantity: number;
  entryPrice: number;
  entryAt: Date;
}): OpenPositionView {
  return {
    id: p.id,
    symbol: `${p.asset}${p.pair}`,
    asset: p.asset as Asset,
    pair: p.pair as QuoteCurrency,
    mode: p.mode as TradingMode,
    quantity: p.quantity,
    entryPrice: p.entryPrice,
    entryAt: p.entryAt,
    notionalAtEntryUsd: round(p.quantity * p.entryPrice),
  };
}

function toRecentTradeView(t: {
  id: string;
  type: string;
  price: number;
  quantity: number;
  fee: number;
  executedAt: Date;
  position: { asset: string; pair: string };
}): RecentTradeView {
  return {
    id: t.id,
    type: t.type as TradeType,
    symbol: `${t.position.asset}${t.position.pair}`,
    price: t.price,
    quantity: t.quantity,
    fee: t.fee,
    executedAt: t.executedAt,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
