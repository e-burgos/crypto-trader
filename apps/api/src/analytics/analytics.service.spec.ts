import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService, parseAgentCostPeriod } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  position: { findMany: jest.fn() },
  trade: { findMany: jest.fn() },
  tradingConfig: { findMany: jest.fn() },
  agentDecision: { findMany: jest.fn() },
  lLMCredential: { findFirst: jest.fn() },
};

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('getPortfolioSummary() returns open/closed positions and PnL summary', async () => {
    mockPrisma.position.findMany
      .mockResolvedValueOnce([
        {
          asset: 'BTC',
          pair: 'BTCUSDT',
          entryPrice: 50000,
          quantity: 0.5,
          mode: 'LIVE',
        },
      ])
      .mockResolvedValueOnce([{ pnl: 2500, fees: 25, mode: 'LIVE' }]);
    mockPrisma.tradingConfig.findMany.mockResolvedValue([{ isRunning: true }]);

    const result = await service.getPortfolioSummary('user1');
    expect(result.openPositions).toBe(1);
    expect(result.closedPositions).toBe(1);
    expect(result.realizedPnl).toBe(2500);
    expect(result.totalFees).toBe(25);
    expect(result.netPnl).toBe(2475);
    expect(result.activeConfigs).toBe(1);
  });

  it('getTradeHistory() returns trades ordered by executedAt desc', async () => {
    mockPrisma.trade.findMany.mockResolvedValue([
      {
        id: 't1',
        type: 'BUY',
        price: 2000,
        quantity: 1,
        fee: 2,
        executedAt: new Date(),
        mode: 'LIVE',
      },
    ]);

    const result = await service.getTradeHistory('user1', 10);
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        take: 10,
        orderBy: { executedAt: 'desc' },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('getAgentDecisionHistory() returns decisions ordered by createdAt desc', async () => {
    mockPrisma.agentDecision.findMany.mockResolvedValue([]);
    await service.getAgentDecisionHistory('user1', 5);
    expect(mockPrisma.agentDecision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );
  });

  describe('getAgentCostBreakdown() — TASK-008', () => {
    const TODAY = '2026-08-17';

    function decision(overrides: Record<string, unknown> = {}) {
      return {
        userId: 'user-1',
        configId: 'config-1',
        configName: 'BTC agresivo',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'LIVE',
        llmCostUsd: 0.02,
        llmCallCount: 5,
        createdAt: new Date(`${TODAY}T10:00:00.000Z`),
        ...overrides,
      };
    }

    it('CA-055: sums llmCostUsd of every AgentDecision of the day for a bot, without excluding any (LLM or gate)', async () => {
      mockPrisma.agentDecision.findMany.mockResolvedValue([
        decision({ llmCostUsd: 0.02, llmCallCount: 5 }),
        decision({ llmCostUsd: 0, llmCallCount: 0 }),
        decision({ llmCostUsd: 0.015, llmCallCount: 4 }),
      ]);

      const result = await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '30d',
      });

      expect(result.decisions).toBe(3);
      expect(result.costUsd).toBeCloseTo(0.035, 6);
      expect(result.byBot).toHaveLength(1);
      expect(result.byBot[0].decisions).toBe(3);
      expect(result.byBot[0].costUsd).toBeCloseTo(0.035, 6);
    });

    it('CA-056: a bot with real LLM calls in the day cannot report $0 (regression on hallazgo C)', async () => {
      mockPrisma.agentDecision.findMany.mockResolvedValue([
        decision({ llmCostUsd: 0.42, llmCallCount: 6 }),
      ]);

      const result = await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '30d',
      });

      expect(result.costUsd).toBeGreaterThan(0);
      expect(result.byBot[0].costUsd).toBeGreaterThan(0);
    });

    it('CE-07: a decision with unresolved pricing is counted and marked, never a disguised zero', async () => {
      mockPrisma.agentDecision.findMany.mockResolvedValue([
        decision({ llmCostUsd: 0.1, llmCallCount: 3 }),
        decision({ llmCostUsd: null, llmCallCount: 2 }),
      ]);

      const result = await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '30d',
      });

      expect(result.decisions).toBe(2);
      expect(result.unpricedDecisions).toBe(1);
      expect(result.costUsd).toBeCloseTo(0.1, 6);
    });

    it('CA-057: the platform-wide aggregate over a period equals the sum of the per-user individual costs, from the same source', async () => {
      const allDecisions = [
        decision({ userId: 'user-1', llmCostUsd: 0.02, llmCallCount: 5 }),
        decision({ userId: 'user-1', llmCostUsd: 0.03, llmCallCount: 4 }),
        decision({ userId: 'user-2', llmCostUsd: 0.05, llmCallCount: 6 }),
      ];

      mockPrisma.agentDecision.findMany.mockResolvedValueOnce(allDecisions);
      const platform = await service.getAgentCostBreakdown({
        userId: null,
        period: '30d',
      });

      mockPrisma.agentDecision.findMany.mockResolvedValueOnce(
        allDecisions.filter((d) => d.userId === 'user-1'),
      );
      const user1 = await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '30d',
      });

      mockPrisma.agentDecision.findMany.mockResolvedValueOnce(
        allDecisions.filter((d) => d.userId === 'user-2'),
      );
      const user2 = await service.getAgentCostBreakdown({
        userId: 'user-2',
        period: '30d',
      });

      expect(platform.costUsd).toBeCloseTo(user1.costUsd + user2.costUsd, 6);
      expect(platform.decisions).toBe(user1.decisions + user2.decisions);
      expect(platform.byUser).toHaveLength(2);
      const byUserSum = platform.byUser.reduce((sum, u) => sum + u.costUsd, 0);
      expect(byUserSum).toBeCloseTo(platform.costUsd, 6);
    });

    it('CA-058: distinguishes how much of the total corresponds to LLM decisions vs. the deterministic gate', async () => {
      mockPrisma.agentDecision.findMany.mockResolvedValue([
        decision({ llmCostUsd: 0.02, llmCallCount: 5 }),
        decision({ llmCostUsd: 0.03, llmCallCount: 6 }),
        decision({ llmCostUsd: 0, llmCallCount: 0 }),
        decision({ llmCostUsd: 0, llmCallCount: 0 }),
        decision({ llmCostUsd: 0, llmCallCount: 0 }),
      ]);

      const result = await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '30d',
      });

      expect(result.llmDecisions).toBe(2);
      expect(result.gateDecisions).toBe(3);
      expect(result.decisions).toBe(5);
    });

    it('filters by createdAt within the requested calendar-day window and by mode/configId', async () => {
      mockPrisma.agentDecision.findMany.mockResolvedValue([]);

      await service.getAgentCostBreakdown({
        userId: 'user-1',
        period: '7d',
        mode: 'LIVE' as never,
        configId: 'config-1',
      });

      expect(mockPrisma.agentDecision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            mode: 'LIVE',
            configId: 'config-1',
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

  });

  describe('parseAgentCostPeriod()', () => {
    it('defaults to 30d when omitted', () => {
      expect(parseAgentCostPeriod(undefined)).toBe('30d');
    });

    it.each(['7d', '30d', '90d'])('accepts %s', (value) => {
      expect(parseAgentCostPeriod(value)).toBe(value);
    });

    it('rejects a period outside 7d | 30d | 90d (400)', () => {
      expect(() => parseAgentCostPeriod('1y')).toThrow();
    });
  });
});
