import { OpenRouter } from '@openrouter/sdk';
import type {
  OpenRouterModelInfo,
  OpenRouterModelsFilter,
} from './openrouter.types';
import { OPENROUTER_DEFAULT_CACHE_TTL } from './openrouter.constants';

interface CacheEntry {
  data: OpenRouterModelInfo[];
  fetchedAt: number;
}

export class OpenRouterModelsService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL: number;
  private readonly client: OpenRouter;

  constructor(options?: { cacheTTL?: number }) {
    this.cacheTTL = options?.cacheTTL ?? OPENROUTER_DEFAULT_CACHE_TTL;
    // models.list is a public endpoint — no API key needed for listing
    this.client = new OpenRouter({ apiKey: '' });
  }

  async listModels(
    filter?: OpenRouterModelsFilter,
  ): Promise<OpenRouterModelInfo[]> {
    const cacheKey = this.buildCacheKey(filter);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
      return cached.data;
    }

    const response = await this.client.models.list({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: filter?.category as any,
      outputModalities: filter?.textOnly !== false ? 'text' : undefined,
    });

    let models = (response.data ?? [])
      .filter((m) => {
        // Exclude models with expiration dates (about to be deprecated)
        if ('expirationDate' in m && m.expirationDate) return false;
        return true;
      })
      .map((m): OpenRouterModelInfo => {
        const promptPrice = parseFloat(m.pricing.prompt) * 1_000_000;
        const completionPrice = parseFloat(m.pricing.completion) * 1_000_000;
        const isFree = promptPrice === 0 && completionPrice === 0;

        const supportedParams = m.supportedParameters.map((p) =>
          typeof p === 'string' ? p : String(p),
        );

        const categories: string[] = [];
        if (isFree) categories.push('free');
        if (!isFree) categories.push('paid');
        if (
          supportedParams.includes('reasoning') ||
          supportedParams.includes('include_reasoning')
        ) {
          categories.push('reasoning');
        }
        if (supportedParams.includes('tools')) {
          categories.push('tool-use');
        }
        if ((promptPrice < 1.0 && completionPrice < 5.0) || isFree) {
          categories.push('fast');
        }
        const ctxLen = m.contextLength ?? 128_000;
        if (ctxLen >= 200_000) {
          categories.push('long-context');
        }
        if (!isFree && completionPrice >= 10) {
          categories.push('premium');
        }

        return {
          id: m.id,
          name: m.name,
          contextLength: m.contextLength ?? 128_000,
          maxCompletionTokens: m.topProvider.maxCompletionTokens ?? null,
          pricing: { prompt: promptPrice, completion: completionPrice },
          isFree,
          categories,
          supportedParameters: supportedParams,
          description: m.description,
        };
      });

    if (filter?.freeOnly) {
      models = models.filter((m) => m.isFree);
    }

    this.cache.set(cacheKey, { data: models, fetchedAt: Date.now() });
    return models;
  }

  async getFreeModels(): Promise<OpenRouterModelInfo[]> {
    return this.listModels({ freeOnly: true });
  }

  async getModelById(modelId: string): Promise<OpenRouterModelInfo | null> {
    const allModels = await this.listModels();
    return allModels.find((m) => m.id === modelId) ?? null;
  }

  async isModelAvailable(modelId: string): Promise<boolean> {
    const model = await this.getModelById(modelId);
    return model !== null;
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  private buildCacheKey(filter?: OpenRouterModelsFilter): string {
    if (!filter) return 'all';
    const parts: string[] = [];
    if (filter.category) parts.push(`cat:${filter.category}`);
    if (filter.freeOnly) parts.push('free');
    if (filter.textOnly !== undefined) parts.push(`text:${filter.textOnly}`);
    return parts.length ? parts.join('|') : 'all';
  }
}
