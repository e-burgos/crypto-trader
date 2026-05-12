import { Injectable } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentTool,
  AgentToolInput,
  AgentToolOutput,
} from './agent-tool.interface';

@Injectable()
export class PortfolioContextTool implements AgentTool {
  readonly name = AgentToolName.PORTFOLIO_CONTEXT;

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    const where: Record<string, unknown> = {
      userId: input.userId,
      status: 'OPEN',
    };
    if (input.configId) where.configId = input.configId;
    if (input.pair) where.pair = input.pair;
    if (input.mode) where.mode = input.mode;

    const positions = await this.prisma.position.findMany({ where });

    const wallets = await this.prisma.sandboxWallet.findMany({
      where: { userId: input.userId },
    });

    const recentTrades = await this.prisma.trade.findMany({
      where: { userId: input.userId },
      orderBy: { executedAt: 'desc' },
      take: 10,
    });

    let openPnl = 0;
    let closedPnl = 0;
    let totalFees = 0;
    let exposure = 0;

    for (const p of positions) {
      const pnl = (p as Record<string, unknown>).unrealizedPnl;
      if (typeof pnl === 'number') openPnl += pnl;
      const qty = (p as Record<string, unknown>).quantity;
      const price = (p as Record<string, unknown>).entryPrice;
      if (typeof qty === 'number' && typeof price === 'number') {
        exposure += qty * price;
      }
    }

    for (const t of recentTrades) {
      const pnl = (t as Record<string, unknown>).pnl;
      if (typeof pnl === 'number') closedPnl += pnl;
      const fee = (t as Record<string, unknown>).fee;
      if (typeof fee === 'number') totalFees += fee;
    }

    const data = {
      positions: positions.map((p) => ({
        id: p.id,
        pair: (p as Record<string, unknown>).pair,
        side: (p as Record<string, unknown>).side,
        quantity: (p as Record<string, unknown>).quantity,
        entryPrice: (p as Record<string, unknown>).entryPrice,
      })),
      wallets: wallets.map((w) => ({
        id: w.id,
        asset:
          (w as Record<string, unknown>).asset ??
          (w as Record<string, unknown>).currency,
        balance: (w as Record<string, unknown>).balance,
      })),
      recentPnl: closedPnl,
      totalFees,
      exposure,
      openPnl,
    };

    const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

    return { data, tokenEstimate, freshnessMs: 0 };
  }
}
