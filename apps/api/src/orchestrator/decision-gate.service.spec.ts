import { Test, TestingModule } from '@nestjs/testing';
import { DecisionGateService } from './decision-gate.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorSnapshot, fingerprint } from '@crypto-trader/shared';

const EMPTY_NEWS_FINGERPRINT = fingerprint([]);
const EMPTY_MACRO_FINGERPRINT = fingerprint({
  globalMarket: null,
  defiHealth: null,
  tokenUnlocks: null,
  fearGreed: null,
});
const EMPTY_POSITIONS_FINGERPRINT = fingerprint([]);

const mockPrisma = {
  position: {
    findMany: jest.fn(),
  },
};

const T0 = 1_700_000_000_000;

const indicators: IndicatorSnapshot = {
  rsi: { value: 52, signal: 'NEUTRAL' as never },
  macd: { macd: 1, signal: 1, histogram: 0, crossover: 'NONE' as never },
  bollingerBands: {
    upper: 0,
    middle: 0,
    lower: 0,
    bandwidth: 0,
    position: 'INSIDE' as never,
  },
  emaCross: { ema9: 101, ema21: 90, ema50: 80, ema200: 70, trend: 'NEUTRAL' as never },
  volume: { current: 0, average: 0, ratio: 0, signal: 'NORMAL' as never },
  supportResistance: { support: [], resistance: [] },
  timestamp: T0,
};

const previousGateSnapshot = {
  close: 60_000,
  rsi: 50,
  ema9: 100,
  ema21: 90,
  emaTrend: 'NEUTRAL',
  macdCrossover: 'NONE',
  newsFingerprint: EMPTY_NEWS_FINGERPRINT,
  macroFingerprint: EMPTY_MACRO_FINGERPRINT,
  positionsFingerprint: EMPTY_POSITIONS_FINGERPRINT,
  takenAt: T0 - 60_000,
};

describe('DecisionGateService', () => {
  let service: DecisionGateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.position.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionGateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DecisionGateService>(DecisionGateService);
  });

  function baseParams(overrides: Partial<Parameters<DecisionGateService['evaluate']>[0]> = {}) {
    return {
      userId: 'user-1',
      configId: 'config-1',
      deterministicGateEnabled: true,
      gatePriceChangePct: 0.005,
      minIntervalMinutes: 15,
      close: 60_100,
      indicators,
      newsItems: [],
      reconciliationConfirmed: true,
      previousDecision: { metadata: { gate: { snapshot: previousGateSnapshot } } },
      now: T0,
      ...overrides,
    };
  }

  it('resolves a HOLD payload reusing the same shape the LLM path persists, with llmCostUsd=0 and llmCallCount=0 (CA-040)', async () => {
    const result = await service.evaluate(baseParams());

    expect(result.applied).toBe(true);
    expect(result.payload).toMatchObject({
      decision: 'HOLD',
      confidence: 1.0,
      orchestrated: false,
      subAgentResults: [],
      llmCostUsd: 0,
      llmCallCount: 0,
      waitMinutes: 15,
    });
    expect(result.payload?.reasoning).toContain('HOLD determinista');
    expect(result.payload?.reasoning).toContain('Sin llamada a LLM.');
    expect(result.payload?.gate?.applied).toBe(true);
  });

  it('waitMinutes always equals config.minIntervalMinutes — the gate never lengthens the cadence', async () => {
    const result = await service.evaluate(baseParams({ minIntervalMinutes: 5 }));

    expect(result.payload?.waitMinutes).toBe(5);
  });

  it('does not apply when disabled by config (CE-03)', async () => {
    const result = await service.evaluate(
      baseParams({ deterministicGateEnabled: false }),
    );

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('DISABLED');
    expect(result.payload).toBeUndefined();
  });

  it('does not apply when there is no previous decision (CA-042)', async () => {
    const result = await service.evaluate(baseParams({ previousDecision: null }));

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('NO_PREVIOUS_DECISION');
  });

  it('does not apply when the previous decision has no gate snapshot in its metadata (pre-cycle row)', async () => {
    const result = await service.evaluate(
      baseParams({ previousDecision: { metadata: { orchestrated: true } } }),
    );

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('NO_PREVIOUS_DECISION');
  });

  it('does not apply when reconciliation is unconfirmed (CE-01)', async () => {
    const result = await service.evaluate(
      baseParams({ reconciliationConfirmed: false }),
    );

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('RECONCILIATION_UNCONFIRMED');
  });

  it('still returns the current snapshot when not applied, for continuity into the next cycle', async () => {
    const result = await service.evaluate(
      baseParams({ reconciliationConfirmed: false }),
    );

    expect(result.gate.snapshot).not.toBeNull();
    expect(result.gate.snapshot?.close).toBe(60_100);
  });

  it('builds the open-positions fingerprint from its own prisma query, ordered by id', async () => {
    mockPrisma.position.findMany.mockResolvedValue([
      { id: 'p1', quantity: 1, status: 'OPEN', protectionStatus: 'NONE', stopPrice: null, trailingActive: false, partialExitCount: 0 },
    ]);

    await service.evaluate(baseParams());

    expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', configId: 'config-1', status: 'OPEN' },
        orderBy: { id: 'asc' },
      }),
    );
  });

  it('does not apply when open positions changed since the previous snapshot', async () => {
    mockPrisma.position.findMany.mockResolvedValue([
      { id: 'p1', quantity: 1, status: 'OPEN', protectionStatus: 'NONE', stopPrice: null, trailingActive: false, partialExitCount: 0 },
    ]);

    const result = await service.evaluate(
      baseParams({
        previousDecision: {
          metadata: {
            gate: { snapshot: { ...previousGateSnapshot, positionsFingerprint: 'different' } },
          },
        },
      }),
    );

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('POSITIONS_CHANGED');
  });

  it('does not apply with fail-closed indicators (missing values never retain)', async () => {
    const result = await service.evaluate(
      baseParams({
        indicators: {
          ...indicators,
          rsi: { value: NaN, signal: 'NEUTRAL' as never },
        },
      }),
    );

    expect(result.applied).toBe(false);
    expect(result.gate.reason).toBe('INDICATORS_INCOMPLETE');
  });
});
