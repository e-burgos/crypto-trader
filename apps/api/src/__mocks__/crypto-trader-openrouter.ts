/**
 * Mock for @crypto-trader/openrouter
 * Avoids importing the ESM @openrouter/sdk in Jest.
 */

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens: number | null;
  pricing: { prompt: number; completion: number };
  isFree: boolean;
  categories: string[];
  supportedParameters: string[];
  description?: string;
}

export interface OpenRouterModelsFilter {
  category?: string;
  freeOnly?: boolean;
  textOnly?: boolean;
}

export class OpenRouterModelsService {
  async listModels(
    _filter?: OpenRouterModelsFilter,
  ): Promise<OpenRouterModelInfo[]> {
    return [];
  }
  async getFreeModels(): Promise<OpenRouterModelInfo[]> {
    return [];
  }
  async getModelById(_id: string): Promise<OpenRouterModelInfo | null> {
    return null;
  }
  async isModelAvailable(_id: string): Promise<boolean> {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  invalidateCache(): void {}
}

export const OPENROUTER_DEFAULT_CACHE_TTL = 15 * 60 * 1000;
