/**
 * Regression tests for Phase A — Agent Profit Optimizer
 * Bug #4: orchestrateDecision position scoping
 * Bug #8: SIGMA sentiment cache isolation by asset
 */
import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { PrismaService } from '../prisma/prisma.service';

const mockSubAgentService = {
  call: jest.fn(),
  getProvider: jest.fn(),
};

describe('OrchestratorService — Isolation (Phase A Regression)', () => {
  let service: OrchestratorService;
  let mockPrisma: any;

  const mockConfig = {
    buyThreshold: 65,
    sellThreshold: 60,
    maxTradePct: 0.05,
    maxConcurrentPositions: 3,
    stopLossPct: 0.02,
    takeProfitPct: 0.04,
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
  };

  const mockIndicators = {
    rsi: { value: 28, signal: 'OVERSOLD' },
    macd: {},
    bollingerBands: {},
    emaCross: {},
    volume: {},
    supportResistance: {},
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    mockPrisma = {
      tradingConfig: { findFirst: jest.fn().mockResolvedValue(mockConfig) },
      position: { findMany: jest.fn().mockResolvedValue([]) },
      sandboxWallet: { findMany: jest.fn().mockResolvedValue([]) },
      newsConfig: {
        findUnique: jest.fn().mockResolvedValue({ intervalMinutes: 10 }),
      },
      agentDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: SubAgentService, useValue: mockSubAgentService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);

    // Default sub-agent responses
    mockSubAgentService.call.mockResolvedValue(
      JSON.stringify({
        decision: 'HOLD',
        confidence: 50,
        reasoning: 'test',
        factors: [],
      }),
    );
  });

  // ── Bug #4: openPositions must be filtered by configId ────────────────

  describe('Bug #4 — openPositions scoped by configId', () => {
    it('should query positions with configId filter', async () => {
      try {
        await service.orchestrateDecision(
          'user-1',
          'config-A',
          mockIndicators as any,
          [],
        );
      } catch {
        // May fail on sub-agent calls — that's ok, we just want to check the query
      }

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', configId: 'config-A', status: 'OPEN' },
        select: {
          asset: true,
          pair: true,
          entryPrice: true,
          quantity: true,
          pnl: true,
        },
      });
    });
  });

  // ── Bug #8: sentiment cache must filter by asset ──────────────────────

  describe('Bug #8 — sentiment cache scoped by asset', () => {
    it('should filter agentDecision by asset when looking for cached sentiment', async () => {
      try {
        await service.orchestrateDecision(
          'user-1',
          'config-A',
          mockIndicators as any,
          [],
        );
      } catch {
        // May fail downstream — we check the query
      }

      expect(mockPrisma.agentDecision.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            asset: 'BTC',
          }),
        }),
      );
    });

    it('should NOT reuse BTC sentiment for ETH config', async () => {
      const ethConfig = { ...mockConfig, asset: 'ETH', pair: 'USDT' };
      mockPrisma.tradingConfig.findFirst.mockResolvedValue(ethConfig);

      try {
        await service.orchestrateDecision(
          'user-1',
          'config-B',
          mockIndicators as any,
          [],
        );
      } catch {
        // May fail downstream
      }

      expect(mockPrisma.agentDecision.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            asset: 'ETH',
          }),
        }),
      );
    });
  });
});
