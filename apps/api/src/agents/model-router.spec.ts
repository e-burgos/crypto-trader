import {
  ModelRouterService,
  ModelSelectionParams,
} from './model-router.service';
import {
  AgentId,
  LLMProvider,
  TradingMode,
  RiskProfile,
} from '../../generated/prisma/enums';

// ── Prisma mock ─────────────────────────────────────────────

function createMockPrisma() {
  return {
    agentBudgetPolicy: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    agentModelPolicy: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    llmUsageLog: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: 0 } }),
    },
    agentDecisionEvaluation: {
      count: jest.fn().mockResolvedValue(20), // above cold-start by default
    },
  } as any;
}

function baseParams(
  overrides: Partial<ModelSelectionParams> = {},
): ModelSelectionParams {
  return {
    agentId: AgentId.market,
    userId: 'user-1',
    mode: TradingMode.SANDBOX,
    riskProfile: RiskProfile.MODERATE,
    pair: 'BTCUSDT',
    task: 'analyze',
    estimatedInputTokens: 2000,
    estimatedOutputTokens: 500,
    ...overrides,
  };
}

function buildService(prisma?: any) {
  const p = prisma ?? createMockPrisma();
  const service = new ModelRouterService(p);
  return { service, prisma: p };
}

// ── Tests ───────────────────────────────────────────────────

describe('ModelRouterService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('SANDBOX mode', () => {
    it('selects default model when no policies exist', async () => {
      const { service } = buildService();
      const result = await service.selectModel(baseParams());

      expect(result.model).toBe('gpt-4o-mini');
      expect(result.provider).toBe(LLMProvider.OPENAI);
      expect(result.reason).toBe('DEFAULT');
      expect(result.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    });

    it('selects policy model when policy matches', async () => {
      const prisma = createMockPrisma();
      prisma.agentModelPolicy.findMany.mockResolvedValue([
        {
          agentId: AgentId.market,
          userId: 'user-1',
          mode: TradingMode.SANDBOX,
          riskProfile: RiskProfile.MODERATE,
          provider: LLMProvider.GEMINI,
          model: 'gemini-2.5-flash',
          isPremium: false,
          createdAt: new Date(),
        },
      ]);
      const { service } = buildService(prisma);
      const result = await service.selectModel(baseParams());

      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.provider).toBe(LLMProvider.GEMINI);
      expect(result.reason).toBe('POLICY_MATCH');
    });
  });

  describe('LIVE mode blocks free models', () => {
    it('skips free-tier models in LIVE mode', async () => {
      const prisma = createMockPrisma();
      // Provide a policy with a model that has $0 pricing (not in MODEL_PRICING → treated as free)
      prisma.agentModelPolicy.findMany.mockResolvedValue([
        {
          agentId: AgentId.market,
          userId: 'user-1',
          mode: TradingMode.LIVE,
          riskProfile: null,
          provider: LLMProvider.OPENROUTER,
          model: 'unknown-free-model',
          isPremium: false,
          createdAt: new Date(),
        },
        {
          agentId: AgentId.market,
          userId: 'user-1',
          mode: TradingMode.LIVE,
          riskProfile: null,
          provider: LLMProvider.OPENAI,
          model: 'gpt-4o-mini',
          isPremium: false,
          createdAt: new Date(),
        },
      ]);
      const { service } = buildService(prisma);
      const result = await service.selectModel(
        baseParams({ mode: TradingMode.LIVE }),
      );

      // Should skip the free model and select gpt-4o-mini (has pricing)
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.reason).toBe('POLICY_MATCH');
    });
  });

  describe('budget circuit breaker', () => {
    it('returns BUDGET_EXHAUSTED when daily spend exceeds limit', async () => {
      const prisma = createMockPrisma();
      prisma.agentBudgetPolicy.findUnique.mockResolvedValue({
        dailyUsdBudget: 2,
        maxCostPerDecisionUsd: 0.15,
        livePremiumOnly: false,
      });
      prisma.llmUsageLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 2.5 },
      });
      const { service } = buildService(prisma);
      const result = await service.selectModel(baseParams());

      expect(result.reason).toBe('BUDGET_EXHAUSTED');
      expect(result.model).toBe('none');
      expect(result.estimatedCostUsd).toBe(0);
    });

    it('caches daily spend with TTL', async () => {
      const prisma = createMockPrisma();
      prisma.llmUsageLog.aggregate.mockResolvedValue({
        _sum: { costUsd: 0.5 },
      });
      const { service } = buildService(prisma);

      // First call — hits DB
      await service.selectModel(baseParams());
      // Second call — should use cache
      await service.selectModel(baseParams());

      // aggregate should only be called once (cached)
      expect(prisma.llmUsageLog.aggregate).toHaveBeenCalledTimes(1);
    });
  });

  describe('cold-start mode', () => {
    it('uses default model when outcome count < 10', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.count.mockResolvedValue(5);
      const { service } = buildService(prisma);
      const result = await service.selectModel(baseParams());

      expect(result.reason).toBe('COLD_START');
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('synthesis agent uses gpt-4o in cold-start', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.count.mockResolvedValue(3);
      const { service } = buildService(prisma);
      const result = await service.selectModel(
        baseParams({ agentId: AgentId.synthesis }),
      );

      expect(result.reason).toBe('COLD_START');
      expect(result.model).toBe('gpt-4o');
    });
  });

  describe('premium escalation on divergence', () => {
    it('escalates to premium model when divergence detected', async () => {
      const { service } = buildService();
      const result = await service.selectModel(
        baseParams({ divergenceDetected: true }),
      );

      expect(result.reason).toBe('DIVERGENCE_ESCALATION');
      expect([
        'gpt-4o',
        'claude-sonnet-4-20250514',
        'gemini-2.5-pro',
      ]).toContain(result.model);
    });
  });

  describe('cost estimation', () => {
    it('calculates cost correctly for gpt-4o-mini', () => {
      const { service } = buildService();
      // gpt-4o-mini: input=0.15$/1M, output=0.6$/1M
      const cost = service.estimateCost('gpt-4o-mini', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(0.75, 2); // 0.15 + 0.6
    });

    it('returns 0 for unknown models', () => {
      const { service } = buildService();
      const cost = service.estimateCost('unknown-model', 1000, 500);
      expect(cost).toBe(0);
    });

    it('calculates cost correctly for gpt-4o', () => {
      const { service } = buildService();
      // gpt-4o: input=2.5$/1M, output=10$/1M
      const cost = service.estimateCost('gpt-4o', 2000, 500);
      // (2000/1M * 2.5) + (500/1M * 10) = 0.005 + 0.005 = 0.01
      expect(cost).toBeCloseTo(0.01, 4);
    });
  });

  describe('maxCostPerDecisionUsd triggers downgrade', () => {
    it('downgrades to cheaper model when default exceeds per-decision limit', async () => {
      const prisma = createMockPrisma();
      prisma.agentBudgetPolicy.findUnique.mockResolvedValue({
        dailyUsdBudget: 5,
        maxCostPerDecisionUsd: 0.0001, // very tight limit
        livePremiumOnly: false,
      });
      const { service } = buildService(prisma);
      const result = await service.selectModel(
        baseParams({
          estimatedInputTokens: 100_000,
          estimatedOutputTokens: 50_000,
        }),
      );

      // Should either downgrade or reject
      expect(['COST_DOWNGRADE', 'BUDGET_EXHAUSTED']).toContain(result.reason);
    });

    it('rejects when no model fits within budget', async () => {
      const prisma = createMockPrisma();
      prisma.agentBudgetPolicy.findUnique.mockResolvedValue({
        dailyUsdBudget: 5,
        maxCostPerDecisionUsd: 0.0000001, // impossibly tight
        livePremiumOnly: false,
      });
      const { service } = buildService(prisma);
      const result = await service.selectModel(
        baseParams({
          estimatedInputTokens: 100_000,
          estimatedOutputTokens: 50_000,
        }),
      );

      expect(result.reason).toBe('BUDGET_EXHAUSTED');
      expect(result.model).toBe('none');
    });
  });

  describe('blockFreeModels policy', () => {
    it('blocks free models in any mode when policy flag is set', async () => {
      const prisma = createMockPrisma();
      prisma.agentBudgetPolicy.findUnique.mockResolvedValue({
        dailyUsdBudget: 5,
        maxCostPerDecisionUsd: 0.15,
        livePremiumOnly: true,
      });
      prisma.agentModelPolicy.findMany.mockResolvedValue([
        {
          agentId: AgentId.market,
          userId: 'user-1',
          mode: null,
          riskProfile: null,
          provider: LLMProvider.OPENROUTER,
          model: 'no-pricing-model',
          isPremium: false,
          createdAt: new Date(),
        },
      ]);
      const { service } = buildService(prisma);
      const result = await service.selectModel(baseParams());

      // The free policy model is skipped, falls back to default
      expect(result.model).not.toBe('no-pricing-model');
    });
  });
});
