import { RiskBudgetService } from './risk-budget.service';

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    agentBudgetPolicy: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    position: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    tradingConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

function buildService(prisma?: any) {
  const p = prisma ?? createMockPrisma();
  return { service: new RiskBudgetService(p), prisma: p };
}

describe('RiskBudgetService', () => {
  describe('assess', () => {
    it('allows trading when under every limit', async () => {
      const prisma = createMockPrisma({
        position: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([{ pnl: 20 }]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 5 }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({
        userId: 'user-1',
        configId: 'cfg-1',
      });

      expect(result.canTrade).toBe(true);
      expect(result.blockedBy).toBeNull();
      expect(result.reason).toBeNull();
      expect(result.maxConcurrentPositions).toBe(5);
      expect(result.realizedPnlUsd).toBe(20);
      expect(result.drawdownPct).toBe(0);
      expect(result.maxDrawdownPct).toBe(0.1);
    });

    it('reads maxConcurrentPositions from TradingConfig, not a hardcoded value', async () => {
      const prisma = createMockPrisma({
        position: {
          count: jest.fn().mockResolvedValue(2),
          findMany: jest.fn().mockResolvedValue([]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 2 }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({
        userId: 'user-1',
        configId: 'cfg-1',
      });

      expect(result.blockedBy).toBe('MAX_POSITIONS');
      expect(result.canTrade).toBe(false);
      expect(result.reason).toContain('2/2');
    });

    it('uses the max maxConcurrentPositions across configs when no configId is given', async () => {
      const prisma = createMockPrisma({
        position: {
          count: jest.fn().mockResolvedValue(3),
          findMany: jest.fn().mockResolvedValue([]),
        },
        tradingConfig: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { maxConcurrentPositions: 2 },
              { maxConcurrentPositions: 4 },
            ]),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({ userId: 'user-1' });

      expect(result.maxConcurrentPositions).toBe(4);
      expect(result.canTrade).toBe(true);
    });

    it('blocks on drawdown threshold using Position.pnl, not Trade', async () => {
      const prisma = createMockPrisma({
        agentBudgetPolicy: {
          findUnique: jest.fn().mockResolvedValue({ dailyUsdBudget: 5 }),
        },
        position: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([{ pnl: -0.6 }]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 5 }),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({
        userId: 'user-1',
        configId: 'cfg-1',
      });

      expect(result.realizedPnlUsd).toBe(-0.6);
      expect(result.drawdownPct).toBeCloseTo(0.12, 4);
      expect(result.blockedBy).toBe('DRAWDOWN');
      expect(result.canTrade).toBe(false);
    });

    it('reports dailyLossLimitUsd from AgentBudgetPolicy, defaulting to 5 without a policy', async () => {
      const prisma = createMockPrisma({
        position: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 5 }),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({
        userId: 'user-1',
        configId: 'cfg-1',
      });

      expect(result.dailyLossLimitUsd).toBe(5);
    });

    it('ignores Position rows without a closed pnl (still open or non-numeric)', async () => {
      const prisma = createMockPrisma({
        position: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([{ pnl: null }, { pnl: 10 }]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 5 }),
        },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({
        userId: 'user-1',
        configId: 'cfg-1',
      });

      expect(result.realizedPnlUsd).toBe(10);
    });

    it('defaults maxConcurrentPositions to 0 when the user has no TradingConfig', async () => {
      const prisma = createMockPrisma({
        position: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        tradingConfig: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const { service } = buildService(prisma);

      const result = await service.assess({ userId: 'user-1' });

      expect(result.maxConcurrentPositions).toBe(0);
      expect(result.blockedBy).toBe('MAX_POSITIONS');
    });
  });

  describe('assessAggregate', () => {
    it('sums Position.pnl across all configs of the user since the given date, without a configId filter', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([{ pnl: -20 }, { pnl: 5 }, { pnl: null }]);
      const prisma = createMockPrisma({
        position: { count: jest.fn().mockResolvedValue(0), findMany },
      });
      const { service } = buildService(prisma);
      const since = new Date('2026-08-17T00:00:00.000Z');

      const result = await service.assessAggregate({ userId: 'user-1', since });

      expect(result.realizedPnlUsd).toBe(-15);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: 'CLOSED',
            exitAt: { gte: since },
          }),
        }),
      );
      const whereArg = findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('configId');
    });

    it('does not touch RiskBudgetService.assess — assess() keeps its own AgentBudgetPolicy-based semantics untouched', async () => {
      const prisma = createMockPrisma({
        agentBudgetPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
        position: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        tradingConfig: {
          findUnique: jest.fn().mockResolvedValue({ maxConcurrentPositions: 5 }),
        },
      });
      const { service } = buildService(prisma);

      const assessed = await service.assess({ userId: 'user-1', configId: 'cfg-1' });

      expect(prisma.agentBudgetPolicy.findUnique).toHaveBeenCalled();
      expect(assessed.dailyLossLimitUsd).toBe(5);
    });
  });
});
