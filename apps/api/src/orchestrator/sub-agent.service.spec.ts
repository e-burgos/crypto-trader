import { Test, TestingModule } from '@nestjs/testing';
import { SubAgentService } from './sub-agent.service';
import { PrismaService } from '../prisma/prisma.service';

const mockLLMProvider = {
  name: 'mock',
  complete: jest.fn(),
};

jest.mock('@crypto-trader/analysis', () => ({
  createLLMProvider: jest.fn(() => mockLLMProvider),
}));

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn(() => 'decrypted-api-key'),
}));

jest.mock('../llm/model-ranking', () => ({
  suggestModel: jest.fn((providers, useCase, preferCheap) => {
    if (providers.includes('GROQ')) {
      return { provider: 'GROQ', model: 'llama-3.3-70b-versatile' };
    }
    if (providers.length > 0) {
      return { provider: providers[0], model: 'some-model' };
    }
    return null;
  }),
}));

const mockCredential = {
  provider: 'GROQ',
  apiKeyEncrypted: 'enc-key',
  apiKeyIv: 'iv',
  selectedModel: 'llama-3.3-70b-versatile',
};

const mockPrismaService = {
  lLMCredential: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('SubAgentService', () => {
  let service: SubAgentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubAgentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SubAgentService>(SubAgentService);
  });

  describe('getProvider', () => {
    it('should prefer Groq when preferCheap=true', async () => {
      mockPrismaService.lLMCredential.findMany.mockResolvedValue([
        mockCredential,
      ]);

      const result = await service.getProvider('user-1', true);

      expect(mockPrismaService.lLMCredential.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isActive: true }),
        }),
      );
      expect(result.client).toBe(mockLLMProvider);
      expect(result.provider).toBe('GROQ');
      expect(result.model).toBe('llama-3.3-70b-versatile');
    });

    it('should fallback to any active credential if Groq not available', async () => {
      const openaiCred = {
        ...mockCredential,
        provider: 'OPENAI',
        selectedModel: 'gpt-4o',
      };
      mockPrismaService.lLMCredential.findMany.mockResolvedValue([openaiCred]);

      const result = await service.getProvider('user-1', true);
      expect(result.client).toBe(mockLLMProvider);
    });

    it('should throw if no active credentials found', async () => {
      mockPrismaService.lLMCredential.findMany.mockResolvedValue([]);

      await expect(service.getProvider('user-1')).rejects.toThrow(
        'No active LLM credentials',
      );
    });
  });

  describe('call', () => {
    beforeEach(() => {
      mockPrismaService.lLMCredential.findMany.mockResolvedValue([
        mockCredential,
      ]);
    });

    it('should call LLM with correct system prompt for market agent', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"signal":"BUY","confidence":0.8,"reasoning":"RSI oversold"}',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await service.call(
        'market',
        'technical_signal',
        { indicators: { rsi: 28 } },
        'user-1',
      );

      expect(result).toContain('BUY');
      expect(mockLLMProvider.complete).toHaveBeenCalledWith(
        expect.stringContaining('SIGMA'),
        expect.stringContaining('indicadores'),
      );
    });

    it('should call LLM with correct system prompt for risk agent', async () => {
      mockLLMProvider.complete.mockResolvedValue({
        text: '{"riskScore":30,"verdict":"PASS","positionSizeMultiplier":1.0,"reason":"ok","alerts":[]}',
        usage: { inputTokens: 200, outputTokens: 80 },
      });

      const result = await service.call(
        'risk',
        'risk_gate',
        { portfolio: [], indicators: { rsi: 45 } },
        'user-1',
      );

      expect(result).toContain('PASS');
      expect(mockLLMProvider.complete).toHaveBeenCalledWith(
        expect.stringContaining('AEGIS'),
        expect.any(String),
      );
    });
  });
});
