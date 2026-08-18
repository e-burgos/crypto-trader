import { Test, TestingModule } from '@nestjs/testing';
import { ModelPricingService } from './model-pricing.service';
import { OpenRouterModelsApiService } from '../openrouter/openrouter-models-api.service';

const mockOpenRouterModels = {
  getModelById: jest.fn(),
};

describe('ModelPricingService', () => {
  let service: ModelPricingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelPricingService,
        { provide: OpenRouterModelsApiService, useValue: mockOpenRouterModels },
      ],
    }).compile();
    service = module.get<ModelPricingService>(ModelPricingService);
  });

  describe('resolve — live OpenRouter catalog', () => {
    it('resolves from the live catalog when the model is found', async () => {
      mockOpenRouterModels.getModelById.mockResolvedValue({
        id: 'anthropic/claude-sonnet-4',
        pricing: { prompt: 3.0, completion: 15.0 },
      });

      const pricing = await service.resolve('OPENROUTER' as any, 'anthropic/claude-sonnet-4');

      expect(pricing).toEqual({
        inputPerMTok: 3.0,
        outputPerMTok: 15.0,
        source: 'LIVE_OPENROUTER',
      });
      expect(mockOpenRouterModels.getModelById).toHaveBeenCalledWith(
        'anthropic/claude-sonnet-4',
      );
    });

    it('does not call the OpenRouter catalog for non-OpenRouter providers', async () => {
      const pricing = await service.resolve('CLAUDE' as any, 'claude-sonnet-4-6');

      expect(mockOpenRouterModels.getModelById).not.toHaveBeenCalled();
      expect(pricing.source).toBe('STATIC_TABLE');
    });
  });

  describe('resolve — stale cache fallback', () => {
    it('falls back to the last-good price when the catalog stops finding the model', async () => {
      mockOpenRouterModels.getModelById.mockResolvedValueOnce({
        id: 'meta-llama/llama-4-scout',
        pricing: { prompt: 0.18, completion: 0.59 },
      });
      await service.resolve('OPENROUTER' as any, 'meta-llama/llama-4-scout');

      mockOpenRouterModels.getModelById.mockResolvedValueOnce(null);
      const pricing = await service.resolve(
        'OPENROUTER' as any,
        'meta-llama/llama-4-scout',
      );

      expect(pricing).toEqual({
        inputPerMTok: 0.18,
        outputPerMTok: 0.59,
        source: 'STALE_CACHE',
      });
    });

    it('falls back to the last-good price when the catalog lookup throws', async () => {
      mockOpenRouterModels.getModelById.mockResolvedValueOnce({
        id: 'qwen/qwen3-235b',
        pricing: { prompt: 0.5, completion: 0.5 },
      });
      await service.resolve('OPENROUTER' as any, 'qwen/qwen3-235b');

      mockOpenRouterModels.getModelById.mockRejectedValueOnce(
        new Error('catalog timeout'),
      );
      const pricing = await service.resolve('OPENROUTER' as any, 'qwen/qwen3-235b');

      expect(pricing).toEqual({
        inputPerMTok: 0.5,
        outputPerMTok: 0.5,
        source: 'STALE_CACHE',
      });
    });
  });

  describe('resolve — static table fallback', () => {
    it('resolves direct providers straight from MODEL_PRICING', async () => {
      const pricing = await service.resolve('MISTRAL' as any, 'mistral-large-latest');

      expect(pricing).toEqual({
        inputPerMTok: 2.0,
        outputPerMTok: 6.0,
        source: 'STATIC_TABLE',
      });
    });

    it('resolves TOGETHER traffic from MODEL_PRICING', async () => {
      const pricing = await service.resolve(
        'TOGETHER' as any,
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      );

      expect(pricing.source).toBe('STATIC_TABLE');
      expect(pricing.inputPerMTok).toBeCloseTo(0.59, 6);
    });

    it('falls back to STATIC_TABLE for OpenRouter traffic with no live match and no cache', async () => {
      mockOpenRouterModels.getModelById.mockResolvedValue(null);

      const pricing = await service.resolve('OPENROUTER' as any, 'claude-sonnet-4-6');

      expect(pricing).toEqual({
        inputPerMTok: 3.0,
        outputPerMTok: 15.0,
        source: 'STATIC_TABLE',
      });
    });
  });

  describe('resolve — unpriced', () => {
    it('returns UNPRICED when nothing in the cascade resolves', async () => {
      mockOpenRouterModels.getModelById.mockResolvedValue(null);

      const pricing = await service.resolve('OPENROUTER' as any, 'unknown/model-xyz');

      expect(pricing).toEqual({
        inputPerMTok: 0,
        outputPerMTok: 0,
        source: 'UNPRICED',
      });
    });

    it('never throws even when the catalog lookup fails and there is nothing to fall back to', async () => {
      mockOpenRouterModels.getModelById.mockRejectedValue(new Error('network down'));

      await expect(
        service.resolve('OPENROUTER' as any, 'unknown/model-xyz'),
      ).resolves.toEqual({ inputPerMTok: 0, outputPerMTok: 0, source: 'UNPRICED' });
    });
  });

  describe('computeCostUsd', () => {
    it('computes cost from per-million-token pricing', () => {
      const cost = service.computeCostUsd(
        { inputPerMTok: 3.0, outputPerMTok: 15.0, source: 'STATIC_TABLE' },
        { inputTokens: 1000, outputTokens: 500 },
      );

      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('computes zero cost for UNPRICED pricing', () => {
      const cost = service.computeCostUsd(
        { inputPerMTok: 0, outputPerMTok: 0, source: 'UNPRICED' },
        { inputTokens: 1000, outputTokens: 500 },
      );

      expect(cost).toBe(0);
    });
  });
});
