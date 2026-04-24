import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadGatewayException } from '@nestjs/common';
import { LLMModelsService } from './llm-models.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

jest.mock('@crypto-trader/openrouter', () => ({
  OpenRouterModelsService: jest.fn().mockImplementation(() => ({
    listModels: jest.fn().mockResolvedValue([
      {
        id: 'test/model-1',
        name: 'Test Model 1',
        contextLength: 128000,
        maxCompletionTokens: 8192,
        pricing: { prompt: 3, completion: 15 },
        isFree: false,
        categories: ['programming'],
        supportedParameters: ['temperature'],
        description: 'Test',
      },
      {
        id: 'test/free-model:free',
        name: 'Free Model',
        contextLength: 32000,
        maxCompletionTokens: 4096,
        pricing: { prompt: 0, completion: 0 },
        isFree: true,
        categories: [],
        supportedParameters: [],
        description: '',
      },
    ]),
    invalidateCache: jest.fn(),
  })),
}));

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn(() => 'decrypted-api-key'),
}));

const mockPrisma = {
  lLMCredential: {
    findFirst: jest.fn(),
  },
};

describe('LLMModelsService', () => {
  let service: LLMModelsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMModelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<LLMModelsService>(LLMModelsService);
    (service as any).cache.clear();
  });

  describe('getModels', () => {
    it('should throw NotFoundException when no active API key exists', async () => {
      mockPrisma.lLMCredential.findFirst.mockResolvedValue(null);

      await expect(service.getModels('u1', 'CLAUDE' as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return cached data within TTL', async () => {
      const mockModels = [
        {
          id: 'claude-sonnet-4-6',
          name: 'Claude Sonnet 4.6',
          contextWindow: 200000,
        },
      ];

      mockPrisma.lLMCredential.findFirst.mockResolvedValue({
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
      });
      jest.spyOn(service as any, 'fetchModels').mockResolvedValue(mockModels);

      const result1 = await service.getModels('u1', 'CLAUDE' as any);
      expect(result1.models).toHaveLength(1);
      expect(result1.provider).toBe('CLAUDE');

      const fetchSpy = jest.spyOn(service as any, 'fetchModels');
      fetchSpy.mockClear();
      const result2 = await service.getModels('u1', 'CLAUDE' as any);
      expect(result2.models).toHaveLength(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should throw BadGatewayException when provider API fails', async () => {
      mockPrisma.lLMCredential.findFirst.mockResolvedValue({
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
      });
      jest
        .spyOn(service as any, 'fetchModels')
        .mockRejectedValue(new Error('API unreachable'));

      await expect(service.getModels('u1', 'OPENAI' as any)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should re-throw NotFoundException from fetchModels', async () => {
      mockPrisma.lLMCredential.findFirst.mockResolvedValue({
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
      });
      jest
        .spyOn(service as any, 'fetchModels')
        .mockRejectedValue(new NotFoundException('No key'));

      await expect(service.getModels('u1', 'GROQ' as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('fetchModels routing', () => {
    it('should call correct fetch method per provider', async () => {
      const providers = [
        { provider: 'CLAUDE', method: 'fetchAnthropic' },
        { provider: 'OPENAI', method: 'fetchOpenAI' },
        { provider: 'GROQ', method: 'fetchGroq' },
        { provider: 'GEMINI', method: 'fetchGemini' },
        { provider: 'MISTRAL', method: 'fetchMistral' },
        { provider: 'TOGETHER', method: 'fetchTogether' },
      ];

      for (const { provider, method } of providers) {
        const spy = jest.spyOn(service as any, method).mockResolvedValue([]);

        // Call fetchModels directly to avoid getModels overhead
        await (service as any).fetchModels(provider, 'test-key');
        expect(spy).toHaveBeenCalledWith('test-key');

        spy.mockRestore();
      }
    });

    it('should throw BadGatewayException for unsupported provider', async () => {
      await expect(
        (service as any).fetchModels('UNKNOWN_PROVIDER', 'key'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('enrichModel', () => {
    it('should attach pricing for known models', () => {
      const enriched = (service as any).enrichModel({
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 200000,
      });
      expect(enriched.pricing).toBeDefined();
      expect(enriched.pricing.input).toBe(3.0);
      expect(enriched.pricing.output).toBe(15.0);
    });

    it('should return undefined pricing for unknown models', () => {
      const enriched = (service as any).enrichModel({
        id: 'unknown-model-xyz',
        name: 'Unknown',
        contextWindow: 100000,
      });
      expect(enriched.pricing).toBeUndefined();
    });

    it('should mark deprecated models', () => {
      const enriched = (service as any).enrichModel({
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (legacy)',
        contextWindow: 200000,
      });
      expect(enriched.deprecated).toBe(true);
    });

    it('should attach pricing for Together AI models', () => {
      const enriched = (service as any).enrichModel({
        id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
        name: 'Llama 4 Maverick',
        contextWindow: 131072,
      });
      expect(enriched.pricing).toBeDefined();
      expect(enriched.pricing.input).toBeGreaterThan(0);
    });
  });

  describe('cache behavior', () => {
    it('should expire cache after TTL', async () => {
      mockPrisma.lLMCredential.findFirst.mockResolvedValue({
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
      });
      const fetchSpy = jest
        .spyOn(service as any, 'fetchModels')
        .mockResolvedValue([{ id: 'test', name: 'Test', contextWindow: 1000 }]);

      await service.getModels('u1', 'CLAUDE' as any);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const cacheEntry = (service as any).cache.get('u1:CLAUDE');
      cacheEntry.fetchedAt = Date.now() - 6 * 60 * 1000;

      fetchSpy.mockClear();
      await service.getModels('u1', 'CLAUDE' as any);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should cache per user+provider combination', async () => {
      mockPrisma.lLMCredential.findFirst.mockResolvedValue({
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
      });
      const fetchSpy = jest
        .spyOn(service as any, 'fetchModels')
        .mockResolvedValue([]);

      await service.getModels('u1', 'CLAUDE' as any);
      await service.getModels('u1', 'OPENAI' as any);
      await service.getModels('u2', 'CLAUDE' as any);

      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });
});
