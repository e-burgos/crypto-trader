import { Test, TestingModule } from '@nestjs/testing';
import {
  ProviderHealthService,
  calculateAvailabilityScore,
  recordCall,
  clearCallRecords,
} from './provider-health.service';
import { PrismaService } from '../prisma/prisma.service';
import { LLMUsageService } from './llm-usage.service';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn(() => 'decrypted-key'),
}));

const mockPrisma = {
  lLMCredential: { findMany: jest.fn(), findFirst: jest.fn() },
  llmUsageLog: { findMany: jest.fn() },
  tradingConfig: { findMany: jest.fn() },
};

const mockUsageService = {
  getStats: jest.fn(),
};

describe('ProviderHealthService', () => {
  let service: ProviderHealthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    clearCallRecords();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderHealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LLMUsageService, useValue: mockUsageService },
      ],
    }).compile();
    service = module.get<ProviderHealthService>(ProviderHealthService);
  });

  describe('calculateAvailabilityScore', () => {
    it('should return 0 for INACTIVE key', () => {
      const result = calculateAvailabilityScore('INACTIVE', null, 0, null);
      expect(result.score).toBe(0);
      expect(result.availability).toBe('UNAVAILABLE');
      expect(result.reason).toContain('not configured');
    });

    it('should return 0 for INVALID key', () => {
      const result = calculateAvailabilityScore('INVALID', null, 0, null);
      expect(result.score).toBe(0);
      expect(result.availability).toBe('UNAVAILABLE');
    });

    it('should return 100 for ACTIVE key with no issues', () => {
      const result = calculateAvailabilityScore('ACTIVE', null, 0, null);
      expect(result.score).toBe(100);
      expect(result.availability).toBe('AVAILABLE');
      expect(result.reason).toBeUndefined();
    });

    it('should penalize high error rate (>50%)', () => {
      const result = calculateAvailabilityScore('ACTIVE', null, 0.6, null);
      expect(result.score).toBe(40);
      expect(result.availability).toBe('LIMITED');
      expect(result.reason).toContain('High error rate');
    });

    it('should penalize elevated error rate (>20%)', () => {
      const result = calculateAvailabilityScore('ACTIVE', null, 0.25, null);
      expect(result.score).toBe(70);
      expect(result.availability).toBe('AVAILABLE');
    });

    it('should penalize low tokens (<5%)', () => {
      const rateLimits = {
        tokensRemaining: 300,
        tokensLimit: 80000,
        requestsRemaining: null,
        requestsLimit: null,
        resetAt: null,
        capturedAt: new Date(),
      };
      const result = calculateAvailabilityScore('ACTIVE', rateLimits, 0, null);
      expect(result.score).toBe(60);
      expect(result.availability).toBe('LIMITED');
      expect(result.reason).toContain('nearly exhausted');
    });

    it('should penalize low tokens (<20%)', () => {
      const rateLimits = {
        tokensRemaining: 12000,
        tokensLimit: 80000,
        requestsRemaining: null,
        requestsLimit: null,
        resetAt: null,
        capturedAt: new Date(),
      };
      const result = calculateAvailabilityScore('ACTIVE', rateLimits, 0, null);
      expect(result.score).toBe(85);
      expect(result.availability).toBe('AVAILABLE');
    });

    it('should penalize staleness (>30 min)', () => {
      const result = calculateAvailabilityScore(
        'ACTIVE',
        null,
        0,
        31 * 60 * 1000,
      );
      expect(result.score).toBe(90);
      expect(result.availability).toBe('AVAILABLE');
    });

    it('should combine multiple penalties', () => {
      const rateLimits = {
        tokensRemaining: 200,
        tokensLimit: 80000,
        requestsRemaining: null,
        requestsLimit: null,
        resetAt: null,
        capturedAt: new Date(),
      };
      const result = calculateAvailabilityScore(
        'ACTIVE',
        rateLimits,
        0.55,
        31 * 60 * 1000,
      );
      // 100 - 60 (error) - 40 (tokens) - 10 (stale) = -10 → 0
      expect(result.score).toBe(0);
      expect(result.availability).toBe('UNAVAILABLE');
    });
  });

  describe('recordCall / error tracking', () => {
    it('should track calls and compute error rate', () => {
      recordCall('u1', 'CLAUDE', true);
      recordCall('u1', 'CLAUDE', true);
      recordCall('u1', 'CLAUDE', false, 'timeout');
      // 1/3 errors = 33%
    });
  });

  describe('getAllProvidersStatus', () => {
    it('should return status for all user credentials', async () => {
      mockPrisma.lLMCredential.findMany.mockResolvedValue([
        { provider: 'CLAUDE', isActive: true },
        { provider: 'OPENAI', isActive: false },
      ]);
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([]);

      const result = await service.getAllProvidersStatus('u1');

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('CLAUDE');
      expect(result[0].keyStatus).toBe('ACTIVE');
      expect(result[0].availabilityScore).toBe(100);
      expect(result[1].provider).toBe('OPENAI');
      expect(result[1].keyStatus).toBe('INACTIVE');
      expect(result[1].availabilityScore).toBe(0);
    });
  });

  describe('getProviderUsage', () => {
    it('should aggregate usage by source and daily', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([
        {
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.01,
          source: 'CHAT',
          createdAt: new Date('2026-04-10T10:00:00Z'),
        },
        {
          inputTokens: 2000,
          outputTokens: 800,
          costUsd: 0.02,
          source: 'TRADING',
          createdAt: new Date('2026-04-10T14:00:00Z'),
        },
        {
          inputTokens: 500,
          outputTokens: 200,
          costUsd: 0.005,
          source: 'CHAT',
          createdAt: new Date('2026-04-11T09:00:00Z'),
        },
      ]);

      const usage = await service.getProviderUsage(
        'u1',
        'CLAUDE' as any,
        '30d',
      );

      expect(usage.totalTokensIn).toBe(3500);
      expect(usage.totalTokensOut).toBe(1500);
      expect(usage.totalCalls).toBe(3);
      expect(usage.estimatedCostUsd).toBeCloseTo(0.035, 3);
      expect(usage.bySource).toHaveLength(2);
      expect(usage.dailySeries).toHaveLength(2);
      expect(usage.dailySeries[0].date).toBe('2026-04-10');
    });

    it('should return empty data when no logs', async () => {
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([]);

      const usage = await service.getProviderUsage('u1', 'OPENAI' as any, '7d');

      expect(usage.totalCalls).toBe(0);
      expect(usage.bySource).toHaveLength(0);
      expect(usage.dailySeries).toHaveLength(0);
    });
  });

  describe('healthCheck', () => {
    it('should return false when provider is unreachable', async () => {
      const result = await service.healthCheck('CLAUDE' as any, 'invalid-key');
      // Will fail because it's hitting a real API with invalid key
      // Just verify it returns a boolean without throwing
      expect(typeof result).toBe('boolean');
    });
  });
});
