import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterModelsApiService } from '../openrouter/openrouter-models-api.service';
import { LLMProvider } from '../../generated/prisma/enums';
import { MODEL_PRICING } from './model-pricing';

export type PricingSourceValue =
  | 'LIVE_OPENROUTER'
  | 'STALE_CACHE'
  | 'STATIC_TABLE'
  | 'UNPRICED';

export interface ResolvedPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  source: PricingSourceValue;
}

interface LastGoodPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

@Injectable()
export class ModelPricingService {
  private readonly logger = new Logger(ModelPricingService.name);
  private readonly lastGoodPricing = new Map<string, LastGoodPricing>();

  constructor(private readonly openRouterModels: OpenRouterModelsApiService) {}

  async resolve(provider: LLMProvider, model: string): Promise<ResolvedPricing> {
    if (provider === 'OPENROUTER') {
      const live = await this.resolveLiveOpenRouter(model);
      if (live) {
        return live;
      }

      const stale = this.lastGoodPricing.get(model);
      if (stale) {
        return { ...stale, source: 'STALE_CACHE' };
      }
    }

    const staticEntry = MODEL_PRICING[model];
    if (staticEntry) {
      return {
        inputPerMTok: staticEntry.input,
        outputPerMTok: staticEntry.output,
        source: 'STATIC_TABLE',
      };
    }

    return { inputPerMTok: 0, outputPerMTok: 0, source: 'UNPRICED' };
  }

  computeCostUsd(
    pricing: ResolvedPricing,
    usage: { inputTokens: number; outputTokens: number },
  ): number {
    return (
      (usage.inputTokens * pricing.inputPerMTok +
        usage.outputTokens * pricing.outputPerMTok) /
      1_000_000
    );
  }

  private async resolveLiveOpenRouter(
    model: string,
  ): Promise<ResolvedPricing | null> {
    try {
      const info = await this.openRouterModels.getModelById(model);
      if (!info) {
        return null;
      }

      const entry: LastGoodPricing = {
        inputPerMTok: info.pricing.prompt,
        outputPerMTok: info.pricing.completion,
      };
      this.lastGoodPricing.set(model, entry);
      return { ...entry, source: 'LIVE_OPENROUTER' };
    } catch (err) {
      this.logger.warn(
        `OpenRouter live pricing lookup failed for ${model}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
