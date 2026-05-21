import { EvaluationService, EVALUATION_QUEUE } from './evaluation.service';
import { EvaluationProcessor } from './evaluation.processor';

// ── Mock helpers ────────────────────────────────────────────

function createMockPrisma() {
  return {
    agentDecision: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    agentDecisionEvaluation: {
      create: jest.fn().mockResolvedValue({ id: 'eval-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    trade: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({}),
  } as any;
}

function buildService(prisma?: any, queue?: any) {
  const p = prisma ?? createMockPrisma();
  const q = queue ?? createMockQueue();
  const service = new EvaluationService(p, q);
  return { service, prisma: p, queue: q };
}

function buildProcessor(prisma?: any) {
  const p = prisma ?? createMockPrisma();
  const processor = new EvaluationProcessor(p);
  return { processor, prisma: p };
}

// ── Processor: outcome calculation ──────────────────────────

describe('EvaluationProcessor', () => {
  describe('calculateOutcome', () => {
    it('BUY with positive price change > 0.5% → WIN', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('BUY', 0.02, 50000);
      expect(result.status).toBe('WIN');
      expect(result.realizedPnlUsd).toBeCloseTo(1000);
    });

    it('BUY with negative price change < -0.5% → LOSS', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('BUY', -0.03, 50000);
      expect(result.status).toBe('LOSS');
      expect(result.realizedPnlUsd).toBeCloseTo(-1500);
    });

    it('BUY with small price change → NEUTRAL', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('BUY', 0.002, 50000);
      expect(result.status).toBe('NEUTRAL');
    });

    it('SELL with price drop > 0.5% → WIN (avoided drop)', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('SELL', -0.03, 50000);
      expect(result.status).toBe('WIN');
      expect(result.realizedPnlUsd).toBeCloseTo(1500);
    });

    it('SELL with price rise > 0.5% → LOSS (missed gains)', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('SELL', 0.02, 50000);
      expect(result.status).toBe('LOSS');
      expect(result.realizedPnlUsd).toBeCloseTo(-1000);
    });

    it('HOLD with price rise > 2% → MISSED_OPPORTUNITY', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('HOLD', 0.05, 50000);
      expect(result.status).toBe('MISSED_OPPORTUNITY');
      expect(result.missedOpportunityUsd).toBeCloseTo(2500);
    });

    it('HOLD with price drop > 2% → AVOIDED_LOSS', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('HOLD', -0.05, 50000);
      expect(result.status).toBe('AVOIDED_LOSS');
    });

    it('HOLD with small price change → NEUTRAL', () => {
      const { processor } = buildProcessor();
      const result = processor.calculateOutcome('HOLD', 0.01, 50000);
      expect(result.status).toBe('NEUTRAL');
    });
  });

  describe('calculateMarketRegime', () => {
    it('abs > 3% → HIGH_VOLATILITY', () => {
      const { processor } = buildProcessor();
      expect(processor.calculateMarketRegime(0.05)).toBe('HIGH_VOLATILITY');
      expect(processor.calculateMarketRegime(-0.04)).toBe('HIGH_VOLATILITY');
    });

    it('change > 2% but < 3% → TRENDING_UP', () => {
      const { processor } = buildProcessor();
      expect(processor.calculateMarketRegime(0.025)).toBe('TRENDING_UP');
    });

    it('change < -2% but > -3% → TRENDING_DOWN', () => {
      const { processor } = buildProcessor();
      expect(processor.calculateMarketRegime(-0.025)).toBe('TRENDING_DOWN');
    });

    it('small change → RANGING', () => {
      const { processor } = buildProcessor();
      expect(processor.calculateMarketRegime(0.005)).toBe('RANGING');
    });
  });

  describe('evaluate job', () => {
    it('creates evaluation record for a BUY decision', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecision.findUnique.mockResolvedValue({
        id: 'dec-1',
        userId: 'user-1',
        decision: 'BUY',
        indicators: { currentPrice: 50000 },
      });
      prisma.trade.findFirst.mockResolvedValue({ price: 51000 });

      const { processor } = buildProcessor(prisma);
      const job = { data: { decisionId: 'dec-1', horizonMinutes: 60 } } as any;

      await processor.evaluate(job);

      expect(prisma.agentDecisionEvaluation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decisionId: 'dec-1',
          userId: 'user-1',
          horizonMinutes: 60,
          status: 'WIN',
          priceAtDecision: 50000,
          priceAtEvaluation: 51000,
        }),
      });
    });

    it('skips when decision not found', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecision.findUnique.mockResolvedValue(null);

      const { processor } = buildProcessor(prisma);
      const job = { data: { decisionId: 'dec-x', horizonMinutes: 15 } } as any;

      await processor.evaluate(job);

      expect(prisma.agentDecisionEvaluation.create).not.toHaveBeenCalled();
    });
  });
});

// ── Service ─────────────────────────────────────────────────

describe('EvaluationService', () => {
  describe('scheduleEvaluation', () => {
    it('adds 4 jobs for different horizons', async () => {
      const { service, queue } = buildService();

      await service.scheduleEvaluation('dec-1');

      expect(queue.add).toHaveBeenCalledTimes(4);
      const delays = queue.add.mock.calls.map((c: any[]) => c[2].delay / 60000);
      expect(delays).toEqual([15, 60, 240, 1440]);
    });
  });

  describe('getScorecard', () => {
    it('returns correct structure with evaluations', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.findMany.mockResolvedValue([
        {
          status: 'WIN',
          realizedPnlUsd: 100,
          hypotheticalPnlUsd: null,
          marketRegime: 'TRENDING_UP',
          decisionId: 'dec-1',
        },
        {
          status: 'LOSS',
          realizedPnlUsd: -50,
          hypotheticalPnlUsd: null,
          marketRegime: 'RANGING',
          decisionId: 'dec-2',
        },
        {
          status: 'WIN',
          realizedPnlUsd: 80,
          hypotheticalPnlUsd: null,
          marketRegime: 'TRENDING_UP',
          decisionId: 'dec-3',
        },
      ]);
      prisma.agentDecision.findMany.mockResolvedValue([
        { id: 'dec-1', llmCostUsd: 0.01, dataCostUsd: 0.005 },
        { id: 'dec-2', llmCostUsd: 0.02, dataCostUsd: 0.003 },
        { id: 'dec-3', llmCostUsd: 0.015, dataCostUsd: 0.004 },
      ]);

      const { service } = buildService(prisma);
      const result = await service.getScorecard({});

      expect(result.totalDecisions).toBe(3);
      expect(result.winRate).toBeCloseTo(2 / 3);
      expect(result.avgPnlUsd).toBeCloseTo((100 - 50 + 80) / 3);
      expect(result.byMarketRegime).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ regime: 'TRENDING_UP', count: 2 }),
          expect.objectContaining({ regime: 'RANGING', count: 1 }),
        ]),
      );
    });

    it('returns zeros when no evaluations', async () => {
      const { service } = buildService();
      const result = await service.getScorecard({});
      expect(result.totalDecisions).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.avgPnlUsd).toBe(0);
      expect(result.netValueUsd).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('returns correct summary with ROI', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.findMany.mockResolvedValue([
        {
          status: 'WIN',
          realizedPnlUsd: 200,
          hypotheticalPnlUsd: null,
          decisionId: 'dec-1',
        },
        {
          status: 'LOSS',
          realizedPnlUsd: -50,
          hypotheticalPnlUsd: null,
          decisionId: 'dec-2',
        },
      ]);
      prisma.agentDecision.findMany.mockResolvedValue([
        { llmCostUsd: 0.05, dataCostUsd: 0.01 },
        { llmCostUsd: 0.03, dataCostUsd: 0.02 },
      ]);

      const { service } = buildService(prisma);
      const result = await service.getSummary({});

      expect(result.totalEvaluated).toBe(2);
      expect(result.winRate).toBe(0.5);
      expect(result.lossRate).toBe(0.5);
      expect(result.totalCostUsd).toBeCloseTo(0.11);
      expect(result.roi).toBeCloseTo(150 / 0.11);
    });
  });

  describe('cleanup', () => {
    it('updates PENDING evaluations older than 48h to NEUTRAL', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.updateMany.mockResolvedValue({
        count: 5,
      });
      prisma.agentDecisionEvaluation.deleteMany.mockResolvedValue({
        count: 2,
      });

      const { service } = buildService(prisma);
      const result = await service.cleanup();

      expect(result.pendingToNeutral).toBe(5);
      expect(result.neutralDeleted).toBe(2);

      const updateCall =
        prisma.agentDecisionEvaluation.updateMany.mock.calls[0][0];
      expect(updateCall.where.status).toBe('PENDING');
      expect(updateCall.data.status).toBe('NEUTRAL');
    });

    it('deletes short-horizon NEUTRAL evaluations older than 7 days', async () => {
      const prisma = createMockPrisma();
      prisma.agentDecisionEvaluation.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.agentDecisionEvaluation.deleteMany.mockResolvedValue({
        count: 3,
      });

      const { service } = buildService(prisma);
      const result = await service.cleanup();

      expect(result.neutralDeleted).toBe(3);

      const deleteCall =
        prisma.agentDecisionEvaluation.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.status).toBe('NEUTRAL');
      expect(deleteCall.where.horizonMinutes).toEqual({ lt: 60 });
    });
  });
});
