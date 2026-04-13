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

const mockCredential = {
  provider: 'GROQ',
  apiKeyEncrypted: 'enc-key',
  apiKeyIv: 'iv',
  selectedModel: 'llama-3.3-70b-versatile',
};

const mockPrismaService = {
  lLMCredential: {
    findFirst: jest.fn(),
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
      mockPrismaService.lLMCredential.findFirst.mockResolvedValue(
        mockCredential,
      );

      const provider = await service.getProvider('user-1', true);

      expect(mockPrismaService.lLMCredential.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ provider: 'GROQ' }),
        }),
      );
      expect(provider).toBe(mockLLMProvider);
    });

    it('should fallback to any active credential if Groq not available', async () => {
      mockPrismaService.lLMCredential.findFirst
        .mockResolvedValueOnce(null) // no GROQ
        .mockResolvedValueOnce(null) // no OPENAI
        .mockResolvedValueOnce(mockCredential); // fallback to latest

      const provider = await service.getProvider('user-1', true);
      expect(provider).toBe(mockLLMProvider);
    });

    it('should throw if no active credentials found', async () => {
      mockPrismaService.lLMCredential.findFirst.mockResolvedValue(null);

      await expect(service.getProvider('user-1')).rejects.toThrow(
        'No active LLM credentials',
      );
    });
  });

  describe('call', () => {
    beforeEach(() => {
      mockPrismaService.lLMCredential.findFirst.mockResolvedValue(
        mockCredential,
      );
    });

    it('should call LLM with correct system prompt for market agent', async () => {
      mockLLMProvider.complete.mockResolvedValue(
        '{"signal":"BUY","confidence":0.8,"reasoning":"RSI oversold"}',
      );

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
      mockLLMProvider.complete.mockResolvedValue(
        '{"riskScore":30,"verdict":"PASS","positionSizeMultiplier":1.0,"reason":"ok","alerts":[]}',
      );

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
