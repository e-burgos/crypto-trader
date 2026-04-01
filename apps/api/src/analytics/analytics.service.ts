import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolioSummary(userId: string) {
    const [openPositions, closedPositions, tradingConfigs] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId, status: 'OPEN' },
        select: {
          asset: true,
          pair: true,
          entryPrice: true,
          quantity: true,
          mode: true,
        },
      }),
      this.prisma.position.findMany({
        where: { userId, status: 'CLOSED' },
        select: { pnl: true, fees: true, mode: true },
      }),
      this.prisma.tradingConfig.findMany({
        where: { userId },
        select: { asset: true, pair: true, mode: true, isRunning: true },
      }),
    ]);

    const realizedPnl = closedPositions
      .filter((p) => p.mode === 'LIVE')
      .reduce((acc, p) => acc + (p.pnl ?? 0), 0);

    const totalFees = closedPositions.reduce(
      (acc, p) => acc + (p.fees ?? 0),
      0,
    );

    return {
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      realizedPnl,
      totalFees,
      netPnl: realizedPnl - totalFees,
      activeConfigs: tradingConfigs.filter((c) => c.isRunning).length,
    };
  }

  async getTradeHistory(userId: string, limit = 50) {
    return this.prisma.trade.findMany({
      where: { userId },
      orderBy: { executedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        price: true,
        quantity: true,
        fee: true,
        executedAt: true,
        mode: true,
        position: { select: { asset: true, pair: true } },
      },
    });
  }

  async getAgentDecisionHistory(userId: string, limit = 20) {
    return this.prisma.agentDecision.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        asset: true,
        pair: true,
        decision: true,
        confidence: true,
        reasoning: true,
        waitMinutes: true,
        createdAt: true,
      },
    });
  }

  async getSummary(userId: string) {
    const closedPositions = await this.prisma.position.findMany({
      where: { userId, status: 'CLOSED', mode: 'LIVE' },
      select: { pnl: true, asset: true, exitAt: true, entryAt: true },
    });

    const totalTrades = closedPositions.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgPnl: 0,
        totalPnl: 0,
        bestTrade: null,
        worstTrade: null,
        currentDrawdown: 0,
        sharpeRatio: 0,
      };
    }

    const pnls = closedPositions.map((p) => p.pnl ?? 0);
    const wins = pnls.filter((p) => p > 0).length;
    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const avgPnl = totalPnl / totalTrades;
    const winRate = (wins / totalTrades) * 100;

    const bestTradePos = closedPositions.reduce((a, b) =>
      (a.pnl ?? 0) > (b.pnl ?? 0) ? a : b,
    );
    const worstTradePos = closedPositions.reduce((a, b) =>
      (a.pnl ?? 0) < (b.pnl ?? 0) ? a : b,
    );

    // Drawdown: peak–trough of cumulative P&L
    let peak = 0;
    let cumulative = 0;
    let maxDrawdown = 0;
    for (const pnl of pnls) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const dd = peak > 0 ? (peak - cumulative) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe ratio: group by day, compute daily returns
    const dailyMap = new Map<string, number>();
    for (const pos of closedPositions) {
      const day = (pos.exitAt ?? pos.entryAt).toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (pos.pnl ?? 0));
    }
    const dailyReturns = Array.from(dailyMap.values());
    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const mean =
        dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
        dailyReturns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(365) : 0;
    }

    return {
      totalTrades,
      winRate: Math.round(winRate * 100) / 100,
      avgPnl: Math.round(avgPnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      bestTrade: {
        pnl: bestTradePos.pnl,
        asset: bestTradePos.asset,
        executedAt: bestTradePos.exitAt,
      },
      worstTrade: {
        pnl: worstTradePos.pnl,
        asset: worstTradePos.asset,
        executedAt: worstTradePos.exitAt,
      },
      currentDrawdown: Math.round(maxDrawdown * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    };
  }

  async getPnlChart(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'CLOSED',
        exitAt: { gte: thirtyDaysAgo },
      },
      select: { pnl: true, exitAt: true },
      orderBy: { exitAt: 'asc' },
    });

    const dailyMap = new Map<string, number>();
    for (const pos of positions) {
      const day = (pos.exitAt ?? new Date()).toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (pos.pnl ?? 0));
    }

    return Array.from(dailyMap.entries()).map(([date, pnl]) => ({
      date,
      pnl: Math.round(pnl * 100) / 100,
    }));
  }

  async getAssetBreakdown(userId: string) {
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'CLOSED' },
      select: { asset: true, pnl: true },
    });

    const assetMap = new Map<
      string,
      { totalPnl: number; trades: number; wins: number }
    >();
    for (const pos of positions) {
      const key = pos.asset;
      const current = assetMap.get(key) ?? { totalPnl: 0, trades: 0, wins: 0 };
      current.totalPnl += pos.pnl ?? 0;
      current.trades += 1;
      if ((pos.pnl ?? 0) > 0) current.wins += 1;
      assetMap.set(key, current);
    }

    return Array.from(assetMap.entries()).map(([asset, data]) => ({
      asset,
      totalPnl: Math.round(data.totalPnl * 100) / 100,
      trades: data.trades,
      winRate:
        data.trades > 0
          ? Math.round((data.wins / data.trades) * 10000) / 100
          : 0,
    }));
  }
}
