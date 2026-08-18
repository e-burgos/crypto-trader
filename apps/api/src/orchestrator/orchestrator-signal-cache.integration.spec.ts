import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import { SignalCacheService } from '../cache/signal-cache.service';
import { InMemorySharedCache } from '../cache/in-memory-shared-cache.service';
import { SHARED_CACHE } from '../cache/shared-cache.port';

const mockSubAgentService = {
  call: jest.fn(),
};

const mockAgentConfigResolver = {
  resolveClient: jest
    .fn()
    .mockResolvedValue({ provider: 'anthropic', model: 'claude' }),
};

const baseConfig = {
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
  rsi: { value: 50, signal: 'NEUTRAL' },
  macd: {},
  bollingerBands: {},
  emaCross: {},
  volume: {},
  supportResistance: {},
  timestamp: Date.now(),
};

function subAgentResponseFor(task: string): string {
  switch (task) {
    case 'technical_signal':
      return JSON.stringify({ signal: 'NEUTRAL' });
    case 'news_sentiment':
      return JSON.stringify({ sentiment: 0 });
    case 'sizing_suggestion':
      return JSON.stringify({ sizeFactor: 1 });
    case 'risk_gate':
      return JSON.stringify({ verdict: 'ALLOW' });
    case 'decision_synthesis':
      return JSON.stringify({
        decision: 'HOLD',
        confidence: 0.5,
        reasoning: 'test',
        waitMinutes: 15,
      });
    default:
      return '{}';
  }
}

describe('OrchestratorService — shared signal cache integration', () => {
  let service: OrchestratorService;
  const originalFlag = process.env.SHARED_SIGNAL_CACHE_ENABLED;

  beforeAll(() => {
    process.env.SHARED_SIGNAL_CACHE_ENABLED = 'true';
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.SHARED_SIGNAL_CACHE_ENABLED;
    } else {
      process.env.SHARED_SIGNAL_CACHE_ENABLED = originalFlag;
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAgentConfigResolver.resolveClient.mockResolvedValue({
      provider: 'anthropic',
      model: 'claude',
    });
    mockSubAgentService.call.mockImplementation(
      async (_agentId: string, task: string) => subAgentResponseFor(task),
    );

    const mockPrisma = {
      tradingConfig: { findFirst: jest.fn().mockResolvedValue(baseConfig) },
      position: { findMany: jest.fn().mockResolvedValue([]) },
      sandboxWallet: { findMany: jest.fn().mockResolvedValue([]) },
      newsConfig: {
        findUnique: jest.fn().mockResolvedValue({ intervalMinutes: 10 }),
      },
      agentDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      newsAnalysis: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: SubAgentService, useValue: mockSubAgentService },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AgentConfigResolverService,
          useValue: mockAgentConfigResolver,
        },
        SignalCacheService,
        { provide: SHARED_CACHE, useClass: InMemorySharedCache },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
  });

  it('collapses concurrent technical_signal calls for two simulated users on the same (asset, pair) into a single sub-agent invocation', async () => {
    await Promise.all([
      service.orchestrateDecision(
        'user-a',
        'config-a',
        mockIndicators as any,
        [],
      ),
      service.orchestrateDecision(
        'user-b',
        'config-b',
        mockIndicators as any,
        [],
      ),
    ]);

    const technicalCalls = mockSubAgentService.call.mock.calls.filter(
      ([, task]) => task === 'technical_signal',
    );
    expect(technicalCalls).toHaveLength(1);
  });
});
