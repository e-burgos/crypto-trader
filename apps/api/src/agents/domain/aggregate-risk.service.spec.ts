import { AggregateRiskService } from './aggregate-risk.service';
import { PortfolioContextService } from './portfolio-context.service';
import { RiskBudgetService } from './risk-budget.service';

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    userRiskPolicy: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    tradingConfig: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as any;
}

function buildService(opts: {
  prisma?: any;
  portfolioContext?: Partial<PortfolioContextService>;
  riskBudget?: Partial<RiskBudgetService>;
  notifications?: any;
}) {
  const prisma = opts.prisma ?? createMockPrisma();
  const portfolioContext = {
    build: jest.fn().mockResolvedValue({
      positions: [],
      exposureAtEntryUsd: 0,
      realizedPnlUsd: 0,
      feesUsd: 0,
      wallets: [],
      recentTrades: [],
    }),
    ...opts.portfolioContext,
  };
  const riskBudget = {
    assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: 0 }),
    ...opts.riskBudget,
  };
  const notifications = opts.notifications ?? {
    create: jest.fn().mockResolvedValue({}),
  };

  const service = new AggregateRiskService(
    prisma,
    portfolioContext as any,
    riskBudget as any,
    notifications as any,
  );

  return { service, prisma, portfolioContext, riskBudget, notifications };
}

describe('AggregateRiskService', () => {
  describe('assertBuyAllowed', () => {
    it('allows without consulting anything when the user has no policy row (CA-025)', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      const { service, portfolioContext } = buildService({ prisma });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 1_000_000,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.blockedBy).toBeNull();
      expect(portfolioContext.build).not.toHaveBeenCalled();
    });

    it('allows without consulting anything when the policy exists but is disabled (CA-025)', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({ enabled: false, maxDailyLossUsd: 1 }),
        },
      });
      const { service, portfolioContext } = buildService({ prisma });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 1_000_000,
      });

      expect(decision.allowed).toBe(true);
      expect(portfolioContext.build).not.toHaveBeenCalled();
    });

    it('blocks when combined exposure across configs for the same asset exceeds the max (CA-022)', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: 1000,
            maxAssetExposurePct: null,
            maxDailyLossUsd: null,
            maxDrawdownPct: null,
            pauseAgentsOnDrawdown: true,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        portfolioContext: {
          build: jest.fn().mockResolvedValue({
            positions: [
              { asset: 'BTC', notionalAtEntryUsd: 600 },
              { asset: 'BTC', notionalAtEntryUsd: 300 },
              { asset: 'ETH', notionalAtEntryUsd: 5000 },
            ],
            exposureAtEntryUsd: 5900,
            realizedPnlUsd: 0,
            feesUsd: 0,
            wallets: [{ currency: 'USDT', balance: 100 }],
            recentTrades: [],
          }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 200,
      });

      // exposure across the two BTC configs = 900; + 200 planned = 1100 > 1000
      expect(decision.allowed).toBe(false);
      expect(decision.blockedBy).toBe('ASSET_EXPOSURE');
      expect(decision.assetExposureUsd).toBe(900);
    });

    it('does not count another asset toward the exposure limit', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: 1000,
            maxAssetExposurePct: null,
            maxDailyLossUsd: null,
            maxDrawdownPct: null,
            pauseAgentsOnDrawdown: true,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        portfolioContext: {
          build: jest.fn().mockResolvedValue({
            positions: [{ asset: 'ETH', notionalAtEntryUsd: 5000 }],
            exposureAtEntryUsd: 5000,
            realizedPnlUsd: 0,
            feesUsd: 0,
            wallets: [],
            recentTrades: [],
          }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 200,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.assetExposureUsd).toBe(0);
    });

    it('blocks new buys for the rest of the day once realized daily loss reaches the max (CA-023)', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: null,
            maxAssetExposurePct: null,
            maxDailyLossUsd: 50,
            maxDrawdownPct: null,
            pauseAgentsOnDrawdown: true,
          }),
        },
      });
      const { service, riskBudget } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -50 }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 100,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.blockedBy).toBe('DAILY_LOSS');
      expect(riskBudget.assessAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('does not block on daily loss when under the max', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: null,
            maxAssetExposurePct: null,
            maxDailyLossUsd: 50,
            maxDrawdownPct: null,
            pauseAgentsOnDrawdown: true,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -10 }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 100,
      });

      expect(decision.allowed).toBe(true);
    });

    it('pauses every running config for the user and notifies once drawdown crosses the threshold (CA-024)', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: null,
            maxAssetExposurePct: null,
            maxDailyLossUsd: null,
            maxDrawdownPct: 0.1,
            pauseAgentsOnDrawdown: true,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      const { service, notifications } = buildService({
        prisma,
        portfolioContext: {
          build: jest.fn().mockResolvedValue({
            positions: [],
            exposureAtEntryUsd: 0,
            realizedPnlUsd: 0,
            feesUsd: 0,
            wallets: [{ currency: 'USDT', balance: 900 }],
            recentTrades: [],
          }),
        },
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -100 }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 100,
      });

      // equity = 900; equityAtDayStart = 900 + 100 = 1000; drawdown = 100/1000 = 0.1 >= 0.1
      expect(decision.allowed).toBe(false);
      expect(decision.blockedBy).toBe('DRAWDOWN');
      expect(decision.agentsPaused).toBe(true);
      expect(prisma.tradingConfig.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRunning: true },
        data: { isRunning: false },
      });
      expect(prisma.userRiskPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({ pausedReason: 'DRAWDOWN' }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        'AGENT_STOPPED',
        expect.stringContaining('agentsPausedDrawdown'),
      );
    });

    it('blocks on drawdown without pausing agents when pauseAgentsOnDrawdown is false', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: null,
            maxAssetExposurePct: null,
            maxDailyLossUsd: null,
            maxDrawdownPct: 0.1,
            pauseAgentsOnDrawdown: false,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        portfolioContext: {
          build: jest.fn().mockResolvedValue({
            positions: [],
            exposureAtEntryUsd: 0,
            realizedPnlUsd: 0,
            feesUsd: 0,
            wallets: [{ currency: 'USDT', balance: 900 }],
            recentTrades: [],
          }),
        },
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -100 }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 100,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.blockedBy).toBe('DRAWDOWN');
      expect(decision.agentsPaused).toBe(false);
      expect(prisma.tradingConfig.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('evaluateDailyLoss', () => {
    it('reports not reached without consulting the ledger when the user has no policy row', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      const { service, riskBudget } = buildService({ prisma });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(evaluation).toEqual({
        reached: false,
        realizedPnlTodayUsd: 0,
        maxDailyLossUsd: null,
      });
      expect(riskBudget.assessAggregate).not.toHaveBeenCalled();
    });

    it('reports not reached without consulting the ledger when the policy is disabled', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ enabled: false, maxDailyLossUsd: 1 }),
        },
      });
      const { service, riskBudget } = buildService({ prisma });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(evaluation.reached).toBe(false);
      expect(riskBudget.assessAggregate).not.toHaveBeenCalled();
    });

    it('reports reached when realized daily loss reaches the configured max', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxDailyLossUsd: 50,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -50 }),
        },
      });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(evaluation).toEqual({
        reached: true,
        realizedPnlTodayUsd: -50,
        maxDailyLossUsd: 50,
      });
    });

    it('reports not reached when realized daily loss is under the configured max', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxDailyLossUsd: 50,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -10 }),
        },
      });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(evaluation.reached).toBe(false);
      expect(evaluation.realizedPnlTodayUsd).toBe(-10);
    });

    it('reports not reached when the policy has no configured max', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxDailyLossUsd: null,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -1000 }),
        },
      });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(evaluation).toEqual({
        reached: false,
        realizedPnlTodayUsd: -1000,
        maxDailyLossUsd: null,
      });
    });

    it('never mutates state: no updateMany, no policy update, no notification', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxDailyLossUsd: 50,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      const { service, notifications } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -50 }),
        },
      });

      await service.evaluateDailyLoss({ userId: 'user-1', mode: 'SANDBOX' as any });

      expect(prisma.tradingConfig.updateMany).not.toHaveBeenCalled();
      expect(prisma.userRiskPolicy.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('assertBuyAllowed reuses evaluateDailyLoss arithmetic', () => {
    it('blocks with the same DAILY_LOSS outcome assertBuyAllowed produced before the refactor', async () => {
      const prisma = createMockPrisma({
        userRiskPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            enabled: true,
            maxAssetExposureUsd: null,
            maxAssetExposurePct: null,
            maxDailyLossUsd: 50,
            maxDrawdownPct: null,
            pauseAgentsOnDrawdown: true,
          }),
        },
      });
      const { service } = buildService({
        prisma,
        riskBudget: {
          assessAggregate: jest.fn().mockResolvedValue({ realizedPnlUsd: -50 }),
        },
      });

      const decision = await service.assertBuyAllowed({
        userId: 'user-1',
        asset: 'BTC' as any,
        mode: 'SANDBOX' as any,
        plannedNotionalUsd: 100,
      });

      const evaluation = await service.evaluateDailyLoss({
        userId: 'user-1',
        mode: 'SANDBOX' as any,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.blockedBy).toBe('DAILY_LOSS');
      expect(decision.realizedPnlTodayUsd).toBe(evaluation.realizedPnlTodayUsd);
      expect(evaluation.reached).toBe(true);
    });
  });
});
