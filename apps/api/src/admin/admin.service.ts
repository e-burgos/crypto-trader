import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { TradingService } from '../trading/trading.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
    @Inject(forwardRef(() => TradingService))
    private readonly tradingService: TradingService,
  ) {}

  async getStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalUsers, totalTrades, openPositions, tradesToday, sellsToday] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.trade.count(),
        this.prisma.position.count({ where: { status: 'OPEN' } }),
        this.prisma.trade.count({
          where: { executedAt: { gte: startOfDay } },
        }),
        this.prisma.trade.findMany({
          where: { executedAt: { gte: startOfDay }, type: 'SELL' },
          select: { price: true, quantity: true },
        }),
      ]);

    const profitToday = sellsToday.reduce(
      (sum, t) => sum + t.price * t.quantity,
      0,
    );

    return {
      totalUsers,
      totalTrades,
      openPositions,
      tradesToday,
      profitToday,
      systemStatus: 'ok',
    };
  }

  async killSwitch(adminId: string) {
    // Cancel all Bull jobs + update DB via TradingService
    const { stopped } = await this.tradingService.stopAllAgents();

    await this.prisma.adminAction.create({
      data: {
        adminId,
        action: 'KILL_SWITCH',
        details: { stoppedConfigs: stopped },
      },
    });

    // Broadcast to all connected WebSocket clients
    this.gateway.server.emit('agent:killed', { stoppedConfigs: stopped });

    return { stopped };
  }

  async getAllAgentsStatus() {
    return this.tradingService.getAllAgentsStatus();
  }

  async getAuditLog() {
    return this.prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        adminId: true,
        details: true,
        createdAt: true,
        admin: { select: { email: true } },
        target: { select: { email: true } },
      },
    });
  }
}
