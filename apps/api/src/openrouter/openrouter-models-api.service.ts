import { Injectable, Logger } from '@nestjs/common';
import {
  OpenRouterModelsService,
  OpenRouterModelInfo,
  OpenRouterModelsFilter,
} from '@crypto-trader/openrouter';

@Injectable()
export class OpenRouterModelsApiService {
  private readonly logger = new Logger(OpenRouterModelsApiService.name);
  private readonly modelsService: OpenRouterModelsService;

  constructor() {
    this.modelsService = new OpenRouterModelsService();
  }

  async getModels(
    filter?: OpenRouterModelsFilter,
  ): Promise<OpenRouterModelInfo[]> {
    try {
      return await this.modelsService.listModels(filter);
    } catch (err) {
      this.logger.warn(
        `Failed to fetch OpenRouter models: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  async getFreeModels(): Promise<OpenRouterModelInfo[]> {
    return this.modelsService.getFreeModels();
  }

  async isModelAvailable(modelId: string): Promise<boolean> {
    return this.modelsService.isModelAvailable(modelId);
  }

  invalidateCache(): void {
    this.modelsService.invalidateCache();
  }
}
