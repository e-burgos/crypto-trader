import { TradingProcessor } from './trading.processor';

const mockGetKlines = jest.fn();

jest.mock('@crypto-trader/data-fetcher', () => ({
  BinanceRestClient: jest.fn().mockImplementation(() => ({
    getKlines: (...args: unknown[]) => mockGetKlines(...args),
  })),
}));

describe('TradingProcessor — deterministic gate wiring (TASK-002, TASK-003)', () => {
  const gatewayMock = { emitToUser: jest.fn() };
  const notificationsMock = { create: jest.fn().mockResolvedValue({}) };
  const evaluationServiceMock = {
    scheduleEvaluation: jest.fn().mockResolvedValue(undefined),
  };

  const marketServiceMock = {
    getNewsConfig: jest.fn().mockResolvedValue({ botEnabled: false, intervalMinutes: 10 }),
    getLatestAnalysis: jest.fn(),
    runKeywordAnalysis: jest.fn(),
    buildEnrichedSnapshot: jest.fn().mockResolvedValue(null),
  };

  const agentConfigResolverMock = {
    checkHealth: jest.fn().mockResolvedValue({ healthy: true, agents: [] }),
  };

  const baseConfig = {
    id: 'config-1',
    userId: 'user-1',
    asset: 'BTC',
    pair: 'USDT',
    mode: 'SANDBOX',
    isRunning: true,
    intervalMode: 'AGENT',
    minIntervalMinutes: 15,
    deterministicGateEnabled: true,
    gatePriceChangePct: 0.005,
    buyThreshold: 65,
    sellThreshold: 65,
    name: 'BTC bot',
  };

  function buildCandles() {
    const candles = [];
    for (let i = 0; i < 60; i++) {
      candles.push({
        openTime: i,
        open: 60_000,
        high: 60_100,
        low: 59_900,
        close: 60_000 + i,
        volume: 10,
        closeTime: i + 1,
      });
    }
    return candles;
  }

  function buildPrismaMock(savedDecision: Record<string, unknown>) {
    return {
      tradingConfig: {
        findFirst: jest.fn().mockResolvedValue(baseConfig),
        findUnique: jest.fn().mockResolvedValue({ isRunning: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      binanceCredential: { findUnique: jest.fn() },
      trade: { findMany: jest.fn().mockResolvedValue([]) },
      agentDecision: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(savedDecision),
      },
      position: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }

  function buildProcessor(prisma: any, orchestratorService: any, decisionGateService: any) {
    return new TradingProcessor(
      prisma,
      gatewayMock as any,
      notificationsMock as any,
      {} as any,
      marketServiceMock as any,
      orchestratorService,
      decisionGateService,
      agentConfigResolverMock as any,
      evaluationServiceMock as any,
      {} as any,
      {} as any,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKlines.mockResolvedValue(buildCandles());
    agentConfigResolverMock.checkHealth.mockResolvedValue({ healthy: true, agents: [] });
  });

  it('CA-038: when the gate applies, orchestratorService.orchestrateDecision is never invoked', async () => {
    const gatePayload = {
      decision: 'HOLD' as const,
      confidence: 1.0,
      reasoning: 'HOLD determinista: sin cruce de EMA... Sin llamada a LLM.',
      waitMinutes: 15,
      orchestrated: false,
      subAgentResults: [],
      llmCostUsd: 0,
      llmCallCount: 0,
      gate: { applied: true, conditions: {}, snapshot: null },
    };
    const decisionGateService = {
      evaluate: jest.fn().mockResolvedValue({
        applied: true,
        gate: gatePayload.gate,
        payload: gatePayload,
      }),
    };
    const orchestratorService = { orchestrateDecision: jest.fn() };
    const prisma = buildPrismaMock({ id: 'dec-1', ...gatePayload });
    const processor = buildProcessor(prisma, orchestratorService, decisionGateService);

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(decisionGateService.evaluate).toHaveBeenCalledTimes(1);
    expect(orchestratorService.orchestrateDecision).not.toHaveBeenCalled();
  });

  it('CA-040/CA-041: the gate HOLD persists via the same agentDecision.create + emitToUser as an LLM decision', async () => {
    const gatePayload = {
      decision: 'HOLD' as const,
      confidence: 1.0,
      reasoning: 'HOLD determinista: sin cruce de EMA, RSI 52.0 en banda 40-60. Sin llamada a LLM.',
      waitMinutes: 15,
      orchestrated: false,
      subAgentResults: [],
      llmCostUsd: 0,
      llmCallCount: 0,
      gate: { applied: true, conditions: {}, snapshot: { close: 60_100, takenAt: 1 } },
    };
    const decisionGateService = {
      evaluate: jest.fn().mockResolvedValue({
        applied: true,
        gate: gatePayload.gate,
        payload: gatePayload,
      }),
    };
    const orchestratorService = { orchestrateDecision: jest.fn() };
    const savedDecision = { id: 'dec-1', decision: 'HOLD', llmCostUsd: 0, llmCallCount: 0 };
    const prisma = buildPrismaMock(savedDecision);
    const processor = buildProcessor(prisma, orchestratorService, decisionGateService);

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(prisma.agentDecision.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.agentDecision.create.mock.calls[0][0];
    expect(createArgs.data.decision).toBe('HOLD');
    expect(createArgs.data.llmCostUsd).toBe(0);
    expect(createArgs.data.llmCallCount).toBe(0);
    expect(createArgs.data.reasoning).toContain('Sin llamada a LLM.');
    expect(createArgs.data.metadata.gate).toEqual(gatePayload.gate);
    expect(createArgs.data.metadata.cost).toEqual({
      llmCallCount: 0,
      pricedCallCount: 0,
      unpricedCallCount: 0,
      complete: true,
    });

    // Same code path as an LLM decision: exactly one emit, with the row create() returned.
    expect(gatewayMock.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'agent:decision',
      savedDecision,
    );
    expect(evaluationServiceMock.scheduleEvaluation).toHaveBeenCalledWith('dec-1');
  });

  it('waitMinutes always equals config.minIntervalMinutes for a gate HOLD, even in CUSTOM interval mode', async () => {
    const gatePayload = {
      decision: 'HOLD' as const,
      confidence: 1.0,
      reasoning: 'HOLD determinista. Sin llamada a LLM.',
      waitMinutes: 15,
      orchestrated: false,
      subAgentResults: [],
      llmCostUsd: 0,
      llmCallCount: 0,
      gate: { applied: true, conditions: {}, snapshot: null },
    };
    const decisionGateService = {
      evaluate: jest.fn().mockResolvedValue({
        applied: true,
        gate: gatePayload.gate,
        payload: gatePayload,
      }),
    };
    const orchestratorService = { orchestrateDecision: jest.fn() };
    const prisma = buildPrismaMock({ id: 'dec-1' });
    prisma.tradingConfig.findFirst.mockResolvedValue({
      ...baseConfig,
      intervalMode: 'CUSTOM',
      minIntervalMinutes: 20,
    });
    const processor = buildProcessor(prisma, orchestratorService, decisionGateService);

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-1' },
      queue: { add: jest.fn() },
    } as any);

    const createArgs = prisma.agentDecision.create.mock.calls[0][0];
    expect(createArgs.data.waitMinutes).toBe(20);
  });

  it('when the gate does not apply, orchestrateDecision runs and its cost/gate metadata is what gets persisted (flag off = current behavior)', async () => {
    const currentSnapshot = { close: 60_100, takenAt: 42 };
    const decisionGateService = {
      evaluate: jest.fn().mockResolvedValue({
        applied: false,
        gate: { applied: false, reason: 'DISABLED', snapshot: currentSnapshot },
      }),
    };
    const llmDecision = {
      decision: 'BUY',
      confidence: 0.8,
      reasoning: 'LLM says BUY',
      waitMinutes: 10,
      orchestrated: true,
      subAgentResults: [],
      llmCostUsd: 0.02,
      llmCallCount: 5,
      pricedCallCount: 4,
      unpricedCallCount: 1,
    };
    const orchestratorService = {
      orchestrateDecision: jest.fn().mockResolvedValue(llmDecision),
    };
    const savedDecision = { id: 'dec-2', decision: 'BUY' };
    const prisma = buildPrismaMock(savedDecision);
    const processor = buildProcessor(prisma, orchestratorService, decisionGateService);

    await processor.runCycle({
      data: { userId: 'user-1', configId: 'config-1' },
      queue: { add: jest.fn() },
    } as any);

    expect(orchestratorService.orchestrateDecision).toHaveBeenCalledTimes(1);
    const createArgs = prisma.agentDecision.create.mock.calls[0][0];
    expect(createArgs.data.llmCostUsd).toBeCloseTo(0.02, 6);
    expect(createArgs.data.llmCallCount).toBe(5);
    // The gate's current snapshot is still attached for the next cycle's comparison
    expect(createArgs.data.metadata.gate).toEqual({
      applied: false,
      reason: 'DISABLED',
      snapshot: currentSnapshot,
    });
    // CE-07: a partial cascade (4 priced, 1 unpriced) is marked incomplete, never a silent zero
    expect(createArgs.data.metadata.cost).toEqual({
      llmCallCount: 5,
      pricedCallCount: 4,
      unpricedCallCount: 1,
      complete: false,
    });
  });
});
