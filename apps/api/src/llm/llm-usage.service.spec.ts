import { Test, TestingModule } from '@nestjs/testing';
import { LLMUsageService } from './llm-usage.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  llmUsageLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

describe('LLMUsageService', () => {
  let service: LLMUsageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMUsageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<LLMUsageService>(LLMUsageService);
  });

  describe('log', () => {
    it('should persist a usage log with calculated cost', async () => {
      mockPrisma.llmUsageLog.create.mockResolvedValue({});

      await service.log({
        userId: 'u1',
        provider: 'CLAUDE' as any,
        model: 'claude-sonnet-4-6',
        usage: { inputTokens: 1000, outputTokens: 500 },
        source: 'CHAT' as any,
      });

      expect(mockPrisma.llmUsageLog.create).toHaveBeenCalledTimes(1);
      const call = mockPrisma.llmUsageLog.create.mock.calls[0][0];
      expect(call.data.userId).toBe('u1');
      expect(call.data.provider).toBe('CLAUDE');
      expect(call.data.model).toBe('claude-sonnet-4-6');
      expect(call.data.inputTokens).toBe(1000);
      expect(call.data.outputTokens).toBe(500);
      // cost = (1000 * 3.0 + 500 * 15.0) / 1_000_000 = 0.0105
      expect(call.data.costUsd).toBeCloseTo(0.0105, 6);
      expect(call.data.source).toBe('CHAT');
    });

    it('should set costUsd to 0 for unknown models', async () => {
      mockPrisma.llmUsageLog.create.mockResolvedValue({});

      await service.log({
        userId: 'u1',
        provider: 'OPENAI' as any,
        model: 'unknown-model-xyz',
        usage: { inputTokens: 500, outputTokens: 200 },
        source: 'TRADING' as any,
      });

      const call = mockPrisma.llmUsageLog.create.mock.calls[0][0];
      expect(call.data.costUsd).toBe(0);
    });

    it('should not throw when prisma create fails', async () => {
      mockPrisma.llmUsageLog.create.mockRejectedValue(new Error('DB down'));

      await expect(
        service.log({
          userId: 'u1',
          provider: 'GROQ' as any,
          model: 'llama-3.3-70b-versatile',
          usage: { inputTokens: 100, outputTokens: 50 },
          source: 'ANALYSIS' as any,
        }),
      ).resolves.toBeUndefined();
    });

    it('should calculate cost correctly for Together AI models', async () => {
      mockPrisma.llmUsageLog.create.mockResolvedValue({});

      await service.log({
        userId: 'u1',
        provider: 'TOGETHER' as any,
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        usage: { inputTokens: 2000, outputTokens: 1000 },
        source: 'CHAT' as any,
      });

      const call = mockPrisma.llmUsageLog.create.mock.calls[0][0];
      // cost = (2000 * 0.59 + 1000 * 0.79) / 1_000_000 = 0.00197
      expect(call.data.costUsd).toBeCloseTo(0.00197, 6);
    });
  });

  describe('getStats', () => {
    const baseLogs = [
      {
        provider: 'CLAUDE',
        model: 'claude-sonnet-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0105,
        createdAt: new Date('2026-04-10T10:00:00Z'),
      },
      {
        provider: 'CLAUDE',
        model: 'claude-sonnet-4-6',
        inputTokens: 2000,
        outputTokens: 800,
        costUsd: 0.018,
        createdAt: new Date('2026-04-10T14:00:00Z'),
      },
      {
        provider: 'OPENAI',
        model: 'gpt-5.4',
        inputTokens: 500,
        outputTokens: 300,
        costUsd: 0.006,
        createdAt: new Date('2026-04-11T09:00:00Z'),
      },
    ];

    it('should return aggregated stats for 7d period', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue(baseLogs);

      const stats = await service.getStats('u1', '7d');

      expect(stats.period).toBe('7d');
      expect(stats.totalInputTokens).toBe(3500);
      expect(stats.totalOutputTokens).toBe(1600);
      expect(stats.totalCostUsd).toBeCloseTo(0.0345, 4);
      expect(stats.byProvider).toHaveLength(2);
    });

    it('should aggregate by provider and model correctly', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue(baseLogs);

      const stats = await service.getStats('u1', '30d');

      const claude = stats.byProvider.find((p) => p.provider === 'CLAUDE');
      expect(claude).toBeDefined();
      expect(claude!.callCount).toBe(2);
      expect(claude!.inputTokens).toBe(3000);
      expect(claude!.byModel).toHaveLength(1);
      expect(claude!.byModel[0].model).toBe('claude-sonnet-4-6');
      expect(claude!.byModel[0].callCount).toBe(2);

      const openai = stats.byProvider.find((p) => p.provider === 'OPENAI');
      expect(openai).toBeDefined();
      expect(openai!.callCount).toBe(1);
    });

    it('should generate daily series sorted by date', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue(baseLogs);

      const stats = await service.getStats('u1', '30d');

      expect(stats.dailySeries).toHaveLength(2);
      expect(stats.dailySeries[0].date).toBe('2026-04-10');
      expect(stats.dailySeries[1].date).toBe('2026-04-11');
      // 2 logs on Apr 10
      expect(stats.dailySeries[0].inputTokens).toBe(3000);
    });

    it('should return empty arrays when no logs exist', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([]);

      const stats = await service.getStats('u1', 'all');

      expect(stats.totalCostUsd).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.byProvider).toHaveLength(0);
      expect(stats.dailySeries).toHaveLength(0);
    });

    it('should use correct date range for each period', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([]);

      await service.getStats('u1', '7d');
      const call7d = mockPrisma.llmUsageLog.findMany.mock.calls[0][0];
      const from7d = new Date(call7d.where.createdAt.gte);
      const diff7d = Date.now() - from7d.getTime();
      // Should be approximately 7 days (within 1 second tolerance)
      expect(diff7d).toBeGreaterThan(6.99 * 24 * 60 * 60 * 1000);
      expect(diff7d).toBeLessThan(7.01 * 24 * 60 * 60 * 1000);

      await service.getStats('u1', '90d');
      const call90d = mockPrisma.llmUsageLog.findMany.mock.calls[1][0];
      const from90d = new Date(call90d.where.createdAt.gte);
      const diff90d = Date.now() - from90d.getTime();
      expect(diff90d).toBeGreaterThan(89.99 * 24 * 60 * 60 * 1000);
      expect(diff90d).toBeLessThan(90.01 * 24 * 60 * 60 * 1000);
    });
  });
});
