import { Injectable } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentTool, AgentToolInput, AgentToolOutput } from './agent-tool.interface';

@Injectable()
export class RiskBudgetTool implements AgentTool {
  readonly name = AgentToolName.RISK_BUDGET;

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    // Fetch budget policy (or defaults)
    const policy = await this.prisma.agentBudgetPolicy.findUnique({
      where: { userId: input.userId },
    });

    const maxPositions = 5; // default — can be made configurable via policy
    const dailyLossLimitUsd = policy?.dailyUsdBudget ?? 5;
    const maxDrawdownPct = 0.1; // 10% default

    // Count open positions for this config
    const openPositionCount = await this.prisma.position.count({
      where: {
        userId: input.userId,
        status: 'OPEN',
        ...(input.configId ? { configId: input.configId } : {}),
      },
    });

    // Calculate P&L for last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await this.prisma.trade.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: since },
        ...(input.configId ? { configId: input.configId } : {}),
      },
    });

    let dailyPnlUsd = 0;
    for (const t of recentTrades) {
      const pnl = (t as Record<string, unknown>).pnl;
      if (typeof pnl === 'number') dailyPnlUsd += pnl;
    }

    const drawdownPct =
      dailyPnlUsd < 0 ? Math.abs(dailyPnlUsd) / dailyLossLimitUsd : 0;

    // Evaluate constraints
    let canTrade = true;
    let reason: string | undefined;

    if (openPositionCount >= maxPositions) {
      canTrade = false;
      reason = `Max positions reached (${openPositionCount}/${maxPositions})`;
    } else if (drawdownPct >= maxDrawdownPct) {
      canTrade = false;
      reason = `Drawdown threshold exceeded (${(drawdownPct * 100).toFixed(1)}%)`;
    } else if (dailyPnlUsd <= -dailyLossLimitUsd) {
      canTrade = false;
      reason = `Daily loss limit reached ($${Math.abs(dailyPnlUsd).toFixed(2)})`;
    }

    const maxPositionSizeUsd = policy?.maxCostPerDecisionUsd
      ? policy.maxCostPerDecisionUsd * 100 // rough heuristic
      : 1000;

    const data: Record<string, unknown> = {
      canTrade,
      ...(reason ? { reason } : {}),
      maxPositionSizeUsd,
      drawdownPct: Math.round(drawdownPct * 10000) / 10000,
      dailyPnlUsd: Math.round(dailyPnlUsd * 100) / 100,
      openPositionCount,
    };

    const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

    return { data, tokenEstimate, freshnessMs: 0 };
  }
}
