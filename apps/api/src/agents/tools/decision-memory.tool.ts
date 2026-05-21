import { Injectable } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentTool,
  AgentToolInput,
  AgentToolOutput,
} from './agent-tool.interface';

@Injectable()
export class DecisionMemoryTool implements AgentTool {
  readonly name = AgentToolName.DECISION_MEMORY;

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    const evaluations = await this.prisma.agentDecisionEvaluation.findMany({
      where: {
        userId: input.userId,
        status: { in: ['WIN', 'LOSS', 'MISSED_OPPORTUNITY', 'AVOIDED_LOSS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const sampleSize = evaluations.length;
    const insufficientData = sampleSize < 10;

    if (insufficientData) {
      const data: Record<string, unknown> = {
        winRate: 0,
        avgPnlUsd: 0,
        bestModel: null,
        worstModel: null,
        sampleSize,
        insufficientData: true,
      };
      return { data, tokenEstimate: 30, freshnessMs: 0 };
    }

    const wins = evaluations.filter((e) => e.status === 'WIN').length;
    const winRate = Math.round((wins / sampleSize) * 10000) / 10000;

    let totalPnl = 0;
    for (const e of evaluations) {
      totalPnl += e.realizedPnlUsd ?? e.hypotheticalPnlUsd ?? 0;
    }
    const avgPnlUsd = Math.round((totalPnl / sampleSize) * 100) / 100;

    // Aggregate by decision to find model performance
    // We get decisionIds and look up their models from AgentDecision
    const decisionIds = [...new Set(evaluations.map((e) => e.decisionId))];
    const decisions = await this.prisma.agentDecision.findMany({
      where: { id: { in: decisionIds } },
      select: { id: true, model: true },
    });

    const modelMap = new Map<string, string>();
    for (const d of decisions) {
      if (d.model) modelMap.set(d.id, d.model);
    }

    // Calculate per-model win rates
    const modelStats = new Map<
      string,
      { wins: number; total: number; pnl: number }
    >();
    for (const e of evaluations) {
      const model = modelMap.get(e.decisionId);
      if (!model) continue;
      const s = modelStats.get(model) ?? { wins: 0, total: 0, pnl: 0 };
      s.total++;
      if (e.status === 'WIN') s.wins++;
      s.pnl += e.realizedPnlUsd ?? e.hypotheticalPnlUsd ?? 0;
      modelStats.set(model, s);
    }

    let bestModel: string | null = null;
    let worstModel: string | null = null;
    let bestWinRate = -1;
    let worstWinRate = 2;

    for (const [model, stats] of modelStats) {
      if (stats.total < 3) continue; // minimum sample
      const wr = stats.wins / stats.total;
      if (wr > bestWinRate) {
        bestWinRate = wr;
        bestModel = model;
      }
      if (wr < worstWinRate) {
        worstWinRate = wr;
        worstModel = model;
      }
    }

    const oldestEval = evaluations[evaluations.length - 1];
    const freshnessMs = oldestEval
      ? Date.now() - new Date(oldestEval.createdAt).getTime()
      : 0;

    const data: Record<string, unknown> = {
      winRate,
      avgPnlUsd,
      bestModel,
      worstModel,
      sampleSize,
      insufficientData: false,
    };

    const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

    return { data, tokenEstimate, freshnessMs };
  }
}
