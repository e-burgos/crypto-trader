import { LLMProvider } from '../../generated/prisma/enums';
import { MODEL_RANKING, suggestModel, suggestModels } from './model-ranking';

describe('model-ranking', () => {
  describe('MODEL_RANKING', () => {
    it('should contain 28 ranked models', () => {
      expect(MODEL_RANKING).toHaveLength(28);
    });

    it('should be sorted by intelligenceScore descending', () => {
      for (let i = 1; i < MODEL_RANKING.length; i++) {
        expect(MODEL_RANKING[i - 1].intelligenceScore).toBeGreaterThanOrEqual(
          MODEL_RANKING[i].intelligenceScore,
        );
      }
    });

    it('should include all 7 providers', () => {
      const providers = new Set(MODEL_RANKING.map((m) => m.provider));
      expect(providers).toContain(LLMProvider.CLAUDE);
      expect(providers).toContain(LLMProvider.OPENAI);
      expect(providers).toContain(LLMProvider.OPENROUTER);
      expect(providers).toBeInstanceOf(Set);
      expect(providers.size).toBe(7);
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
      // Claude Opus 4.6 (OpenRouter) scores 58
      expect(result!.intelligenceScore).toBe(58);
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
      // Among FREE models for NEWS: Elephant Alpha (30), Nemotron 3 Super (28)
      // Highest intelligence among cheapest (FREE) = Elephant Alpha (30)
      expect(result!.model).toBe('openrouter/elephant-alpha');
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
});
