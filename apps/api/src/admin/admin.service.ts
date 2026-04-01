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
    const [totalUsers, activeUsers, totalTrades, openPositions, totalVolume] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.trade.count(),
        this.prisma.position.count({ where: { status: 'OPEN' } }),
        this.prisma.trade.aggregate({ _sum: { quantity: true } }),
      ]);

    const recentTrades = await this.prisma.trade.findMany({
      take: 10,
      orderBy: { executedAt: 'desc' },
      select: {
        id: true,
        type: true,
        price: true,
        quantity: true,
        executedAt: true,
        mode: true,
      },
    });

    return {
      users: { total: totalUsers, active: activeUsers },
      trades: { total: totalTrades, recentTrades },
      positions: { open: openPositions },
      volume: { total: totalVolume._sum.quantity ?? 0 },
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
        details: true,
        createdAt: true,
        admin: { select: { email: true } },
        target: { select: { email: true } },
      },
    });
  }
}
