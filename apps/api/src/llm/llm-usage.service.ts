import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMProvider, LLMSource } from '../../generated/prisma/enums';
import { MODEL_PRICING } from './model-pricing';

export interface LLMUsageLogParams {
  userId: string;
  provider: LLMProvider;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  source: LLMSource;
}

export interface LLMUsageStats {
  period: string;
  from: string;
  to: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byProvider: Array<{
    provider: string;
    label: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    callCount: number;
    byModel: Array<{
      model: string;
      label: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      callCount: number;
    }>;
  }>;
  dailySeries: Array<{
    date: string;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  CLAUDE: 'Anthropic Claude',
  OPENAI: 'OpenAI',
  GROQ: 'Groq',
  GEMINI: 'Google Gemini',
  MISTRAL: 'Mistral AI',
};

@Injectable()
export class LLMUsageService {
  private readonly logger = new Logger(LLMUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LLMUsageLogParams): Promise<void> {
    const pricing = MODEL_PRICING[params.model];
    const costUsd = pricing
      ? (params.usage.inputTokens * pricing.input +
          params.usage.outputTokens * pricing.output) /
        1_000_000
      : 0;

    try {
      await this.prisma.llmUsageLog.create({
        data: {
          userId: params.userId,
          provider: params.provider,
          model: params.model,
          inputTokens: params.usage.inputTokens,
          outputTokens: params.usage.outputTokens,
          costUsd,
          source: params.source,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to log LLM usage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getStats(
    userId: string,
    period: '7d' | '30d' | '90d' | 'all',
  ): Promise<LLMUsageStats> {
    const now = new Date();
    let from: Date;
    switch (period) {
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        from = new Date(0);
        break;
    }

    const logs = await this.prisma.llmUsageLog.findMany({
      where: {
        userId,
        createdAt: { gte: from, lte: now },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by provider → model
    const providerMap = new Map<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        callCount: number;
        models: Map<
          string,
          {
            inputTokens: number;
            outputTokens: number;
            costUsd: number;
            callCount: number;
          }
        >;
      }
    >();

    // Aggregate daily
    const dailyMap = new Map<
      string,
      { costUsd: number; inputTokens: number; outputTokens: number }
    >();

    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const log of logs) {
      totalCostUsd += log.costUsd;
      totalInputTokens += log.inputTokens;
      totalOutputTokens += log.outputTokens;

      // Provider aggregation
      if (!providerMap.has(log.provider)) {
        providerMap.set(log.provider, {
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          callCount: 0,
          models: new Map(),
        });
      }
      const prov = providerMap.get(log.provider)!;
      prov.inputTokens += log.inputTokens;
      prov.outputTokens += log.outputTokens;
      prov.costUsd += log.costUsd;
      prov.callCount += 1;

      if (!prov.models.has(log.model)) {
        prov.models.set(log.model, {
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          callCount: 0,
        });
      }
      const model = prov.models.get(log.model)!;
      model.inputTokens += log.inputTokens;
      model.outputTokens += log.outputTokens;
      model.costUsd += log.costUsd;
      model.callCount += 1;

      // Daily aggregation
      const dateKey = log.createdAt.toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { costUsd: 0, inputTokens: 0, outputTokens: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      day.costUsd += log.costUsd;
      day.inputTokens += log.inputTokens;
      day.outputTokens += log.outputTokens;
    }

    const byProvider = Array.from(providerMap.entries()).map(
      ([provider, data]) => ({
        provider,
        label: PROVIDER_DISPLAY[provider] ?? provider,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costUsd: data.costUsd,
        callCount: data.callCount,
        byModel: Array.from(data.models.entries()).map(([model, mData]) => ({
          model,
          label: MODEL_PRICING[model]?.label ?? model,
          inputTokens: mData.inputTokens,
          outputTokens: mData.outputTokens,
          costUsd: mData.costUsd,
          callCount: mData.callCount,
        })),
      }),
    );

    const dailySeries = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        costUsd: data.costUsd,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
      }));

    return {
      period,
      from: from.toISOString(),
      to: now.toISOString(),
      totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      byProvider,
      dailySeries,
    };
  }
}
