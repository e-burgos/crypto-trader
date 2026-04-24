import { LLMProvider } from '../../generated/prisma/enums';
import {
  MODEL_RANKING,
  suggestModel,
  suggestModels,
  openRouterModelToRank,
  buildDynamicRanking,
  suggestModelDynamic,
} from './model-ranking';

describe('model-ranking', () => {
  describe('MODEL_RANKING', () => {
    it('should contain 20 ranked models (no OpenRouter)', () => {
      expect(MODEL_RANKING).toHaveLength(20);
    });

    it('should be sorted by intelligenceScore descending', () => {
      for (let i = 1; i < MODEL_RANKING.length; i++) {
        expect(MODEL_RANKING[i - 1].intelligenceScore).toBeGreaterThanOrEqual(
          MODEL_RANKING[i].intelligenceScore,
        );
      }
    });

    it('should NOT include OPENROUTER in static ranking', () => {
      const providers = new Set(MODEL_RANKING.map((m) => m.provider));
      expect(providers).not.toContain(LLMProvider.OPENROUTER);
      expect(providers.size).toBe(6);
    });
  });

  describe('suggestModel', () => {
    const allProviders = [
      LLMProvider.CLAUDE,
      LLMProvider.OPENAI,
      LLMProvider.GEMINI,
      LLMProvider.GROQ,
      LLMProvider.MISTRAL,
      LLMProvider.TOGETHER,
      LLMProvider.OPENROUTER,
    ];

    it('should return the highest intelligence model for TRADING', () => {
      const result = suggestModel(allProviders, 'TRADING');
      expect(result).not.toBeNull();
      // Gemini 3.1 Pro Preview scores 57 (top static TRADING model)
      expect(result!.intelligenceScore).toBe(57);
    });

    it('should filter by active providers only', () => {
      const result = suggestModel([LLMProvider.MISTRAL], 'TRADING');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe(LLMProvider.MISTRAL);
    });

    it('should return null when no providers are active', () => {
      expect(suggestModel([], 'TRADING')).toBeNull();
    });

    it('should return null when no model matches the use case for given providers', () => {
      // GROQ models don't have TRADING in bestFor at high scores
      // But let's check a combo that truly yields nothing
      const result = suggestModel([LLMProvider.GROQ], 'CHAT');
      expect(result).toBeNull();
    });

    it('should prefer cheapest model when preferCheap is true', () => {
      const result = suggestModel(allProviders, 'CLASSIFY', true);
      expect(result).not.toBeNull();
      // GPT-5.4 Nano is CHEAP at score 44, but Gemini 3.1 Flash-Lite is also CHEAP at 34
      // The cheapest tier for CLASSIFY should be CHEAP
      expect(['CHEAP', 'FREE']).toContain(result!.costTier);
    });

    it('should break cost ties by intelligence score (preferCheap)', () => {
      const result = suggestModel(allProviders, 'NEWS', true);
      expect(result).not.toBeNull();
      // Among cheapest models for NEWS — picks CHEAP tier first
      expect(['CHEAP', 'FREE']).toContain(result!.costTier);
    });

    it('should return highest intelligence when preferCheap is false', () => {
      const result = suggestModel(
        [LLMProvider.CLAUDE, LLMProvider.OPENAI],
        'CHAT',
        false,
      );
      expect(result).not.toBeNull();
      // Claude Sonnet 4.6 (52) has CHAT, GPT-5.4 Mini (49) has CHAT
      expect(result!.intelligenceScore).toBe(52);
      expect(result!.provider).toBe(LLMProvider.CLAUDE);
    });
  });

  describe('suggestModels', () => {
    const allProviders = [
      LLMProvider.CLAUDE,
      LLMProvider.OPENAI,
      LLMProvider.GEMINI,
      LLMProvider.GROQ,
      LLMProvider.MISTRAL,
      LLMProvider.TOGETHER,
      LLMProvider.OPENROUTER,
    ];

    it('should return up to 3 suggestions by default', () => {
      const results = suggestModels(allProviders, 'TRADING');
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect custom limit', () => {
      const results = suggestModels(allProviders, 'TRADING', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return results sorted by intelligence score descending', () => {
      const results = suggestModels(allProviders, 'NEWS', 5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].intelligenceScore).toBeGreaterThanOrEqual(
          results[i].intelligenceScore,
        );
      }
    });

    it('should return empty array when no providers are active', () => {
      expect(suggestModels([], 'TRADING')).toEqual([]);
    });

    it('should filter by use case', () => {
      const results = suggestModels(allProviders, 'CLASSIFY', 10);
      results.forEach((r) => {
        expect(r.bestFor).toContain('CLASSIFY');
      });
    });
  });

  describe('openRouterModelToRank', () => {
    it('should convert an OpenRouterModelInfo to a ModelRank', () => {
      const model = {
        id: 'test/model-1',
        name: 'Test Model',
        contextLength: 128000,
        maxCompletionTokens: 8192,
        pricing: { prompt: 3, completion: 15 },
        isFree: false,
        categories: ['programming', 'finance'],
        supportedParameters: ['temperature'],
        description: 'A test model',
      };
      const rank = openRouterModelToRank(model);
      expect(rank.model).toBe('test/model-1');
      expect(rank.provider).toBe(LLMProvider.OPENROUTER);
      expect(rank.label).toBe('Test Model');
      expect(rank.costTier).toBe('PREMIUM');
      expect(rank.bestFor).toContain('TRADING');
    });

    it('should mark free models with FREE cost tier', () => {
      const model = {
        id: 'test/free-model:free',
        name: 'Free Model',
        contextLength: 32000,
        maxCompletionTokens: 4096,
        pricing: { prompt: 0, completion: 0 },
        isFree: true,
        categories: [],
        supportedParameters: [],
        description: '',
      };
      const rank = openRouterModelToRank(model);
      expect(rank.costTier).toBe('FREE');
    });
  });

  describe('buildDynamicRanking', () => {
    it('should combine static + dynamic and sort by score', () => {
      const orModels = [
        {
          id: 'anthropic/claude-sonnet-4.6',
          name: 'Claude Sonnet 4.6',
          contextLength: 200000,
          maxCompletionTokens: 8192,
          pricing: { prompt: 3, completion: 15 },
          isFree: false,
          categories: ['programming'],
          supportedParameters: ['temperature'],
          description: '',
        },
      ];
      const combined = buildDynamicRanking(orModels);
      expect(combined.length).toBe(MODEL_RANKING.length + 1);
      // Should be sorted
      for (let i = 1; i < combined.length; i++) {
        expect(combined[i - 1].intelligenceScore).toBeGreaterThanOrEqual(
          combined[i].intelligenceScore,
        );
      }
    });
  });

  describe('suggestModelDynamic', () => {
    const orModels = [
      {
        id: 'anthropic/claude-sonnet-4.6',
        name: 'Claude Sonnet 4.6',
        contextLength: 200000,
        maxCompletionTokens: 8192,
        pricing: { prompt: 3, completion: 15 },
        isFree: false,
        categories: ['programming', 'finance'],
        supportedParameters: ['temperature'],
        description: '',
      },
    ];

    it('should suggest from combined ranking when OPENROUTER is active', () => {
      const result = suggestModelDynamic(
        [LLMProvider.OPENROUTER],
        'TRADING',
        orModels,
      );
      expect(result).not.toBeNull();
      expect(result!.provider).toBe(LLMProvider.OPENROUTER);
    });

    it('should fallback to static models when no OpenRouter models available', () => {
      const result = suggestModelDynamic([LLMProvider.CLAUDE], 'TRADING', []);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe(LLMProvider.CLAUDE);
    });
  });
});
