import { Injectable } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentTool,
  AgentToolInput,
  AgentToolOutput,
} from './agent-tool.interface';

@Injectable()
export class TokenBudgetTool implements AgentTool {
  readonly name = AgentToolName.TOKEN_BUDGET;

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    // Fetch budget policy
    const policy = await this.prisma.agentBudgetPolicy.findUnique({
      where: { userId: input.userId },
    });

    const dailyTokenBudget = policy?.dailyTokenBudget ?? 200_000;
    const dailyUsdBudget = policy?.dailyUsdBudget ?? 5;

    // Calculate today's usage
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const usageToday = await this.prisma.llmUsageLog.findMany({
      where: {
        userId: input.userId,
        createdAt: { gte: todayStart },
      },
      select: {
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
      },
    });

    let tokensUsed = 0;
    let usdUsed = 0;
    for (const u of usageToday) {
      tokensUsed += u.inputTokens + u.outputTokens;
      usdUsed += u.costUsd;
    }

    const tokensRemaining = Math.max(0, dailyTokenBudget - tokensUsed);
    const usdRemaining = Math.max(0, dailyUsdBudget - usdUsed);

    // Estimate max tokens for a single call based on remaining budget
    const maxInputTokens = Math.min(tokensRemaining * 0.7, 8192);
    const maxOutputTokens = Math.min(tokensRemaining * 0.3, 4096);

    // Can scale to premium only if >50% budget remains
    const canScaleToPremium =
      tokensRemaining > dailyTokenBudget * 0.5 &&
      usdRemaining > dailyUsdBudget * 0.5;

    const data: Record<string, unknown> = {
      tokensRemaining,
      usdRemaining: Math.round(usdRemaining * 10000) / 10000,
      maxInputTokens: Math.round(maxInputTokens),
      maxOutputTokens: Math.round(maxOutputTokens),
      canScaleToPremium,
      dailyTokenBudget,
      dailyUsdBudget,
      tokensUsed,
      usdUsed: Math.round(usdUsed * 10000) / 10000,
    };

    const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

    return { data, tokenEstimate, freshnessMs: 60_000 };
  }
}
