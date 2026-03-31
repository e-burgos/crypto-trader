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
}
