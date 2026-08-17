import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

const mockSubAgentService = {
  call: jest.fn(),
};

const mockAgentConfigResolver = {
  resolveClient: jest.fn(),
};

const mockPrismaService = {
  tradingConfig: {
    findFirst: jest.fn(),
  },
  position: {
    findMany: jest.fn(),
  },
  sandboxWallet: {
    findMany: jest.fn(),
  },
  newsAnalysis: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  newsConfig: {
    findUnique: jest.fn(),
  },
  agentDecision: {
    findFirst: jest.fn(),
  },
};

const mockConfig = {
  buyThreshold: 65,
  sellThreshold: 60,
  maxTradePct: 0.05,
  maxConcurrentPositions: 3,
  stopLossPct: 0.02,
  takeProfitPct: 0.04,
  asset: 'BTC',
  pair: 'USDT',
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

const mockNews = [
  { headline: 'BTC ETF approved', sentiment: 'POSITIVE', summary: 'Good news' },
];

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: SubAgentService, useValue: mockSubAgentService },
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: AgentConfigResolverService,
          useValue: mockAgentConfigResolver,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);

    mockPrismaService.tradingConfig.findFirst.mockResolvedValue(mockConfig);
    mockPrismaService.position.findMany.mockResolvedValue([]);
    mockPrismaService.sandboxWallet.findMany.mockResolvedValue([]);
    mockPrismaService.newsConfig.findUnique.mockResolvedValue({
      intervalMinutes: 10,
    });
    mockPrismaService.agentDecision.findFirst.mockResolvedValue(null);
    mockAgentConfigResolver.resolveClient.mockResolvedValue({
      provider: 'GROQ',
      model: 'llama-3.3-70b-versatile',
    });
  });

  // ── classifyIntent ─────────────────────────────────────────────────────────

  describe('classifyIntent', () => {
    it('should return valid agent classification', async () => {
      mockSubAgentService.call.mockResolvedValue(
        '{"agentId":"market","confidence":0.97,"reason":"Market query","suggestedGreeting":"Analizando el mercado..."}',
      );

      const result = await service.classifyIntent(
        '¿qué pasará con bitcoin esta semana?',
        'user-1',
      );

      expect(result.agentId).toBe('market');
      expect(result.confidence).toBe(0.97);
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'orchestrator',
        'intent_classification',
        expect.objectContaining({ message: expect.any(String) }),
        'user-1',
        true, // preferCheap
      );
    });

    it('should fallback to "market" agent on invalid agentId', async () => {
      mockSubAgentService.call.mockResolvedValue(
        '{"agentId":"invalid_agent","confidence":0.5,"reason":"Unknown"}',
      );

      const result = await service.classifyIntent('some query', 'user-1');
      expect(result.agentId).toBe('market');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockSubAgentService.call.mockResolvedValue('not valid json at all');

      const result = await service.classifyIntent('some query', 'user-1');
      expect(result.agentId).toBe('market');
      expect(result.confidence).toBe(0.7);
    });
  });

  // ── orchestrateDecision ───────────────────────────────────────────────────

  describe('orchestrateDecision', () => {
    const setupSubAgentMocks = (aegisVerdict = 'PASS') => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'technical_signal') {
            return Promise.resolve(
              '{"signal":"BUY","confidence":0.78,"reasoning":"RSI oversold + MACD cross"}',
            );
          }
          if (agentId === 'market' && task === 'news_sentiment') {
            return Promise.resolve(
              '{"sentiment":0.65,"impact":"positive","reasoning":"ETF news dominates"}',
            );
          }
          if (agentId === 'operations' && task === 'sizing_suggestion') {
            return Promise.resolve(
              '{"recommendation":"proceed","maxTradeSize":0.04,"reasoning":"3 positions open, within limit"}',
            );
          }
          if (agentId === 'risk' && task === 'risk_gate') {
            return Promise.resolve(
              `{"riskScore":42,"verdict":"${aegisVerdict}","positionSizeMultiplier":1.0,"reason":"Portfolio healthy","alerts":[]}`,
            );
          }
          if (agentId === 'orchestrator' && task === 'decision_synthesis') {
            return Promise.resolve(
              '{"decision":"BUY","confidence":0.74,"reasoning":"Strong technical + positive sentiment","waitMinutes":15}',
            );
          }
          return Promise.resolve('{}');
        },
      );
    };

    it('should call 4 sub-agents in parallel and synthesize decision', async () => {
      setupSubAgentMocks('PASS');

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.orchestrated).toBe(true);
      expect(result.decision).toBe('BUY');
      expect(result.confidence).toBeCloseTo(0.74);
      expect(result.subAgentResults).toHaveLength(4);
      expect(mockSubAgentService.call).toHaveBeenCalledTimes(5); // 4 parallel + 1 synthesis
    });

    it('should return HOLD immediately when AEGIS verdict is BLOCK', async () => {
      setupSubAgentMocks('BLOCK');

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.decision).toBe('HOLD');
      expect(result.orchestrated).toBe(true);
      expect(result.reasoning).toContain('AEGIS BLOCK');
      // Synthesis call should NOT be made after BLOCK
      expect(mockSubAgentService.call).not.toHaveBeenCalledWith(
        'orchestrator',
        'decision_synthesis',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should keep the BLOCK when blockReasons has a non-overridable reason, even if reason text mentions concentración (CA-029)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'risk' && task === 'risk_gate') {
            return Promise.resolve(
              '{"riskScore":91,"verdict":"BLOCK","positionSizeMultiplier":0,"blockReasons":["DRAWDOWN"],"reason":"Concentración de riesgo detectada por drawdown","alerts":[]}',
            );
          }
          if (agentId === 'market' && task === 'technical_signal') {
            return Promise.resolve(
              '{"signal":"BUY","confidence":0.78,"reasoning":"RSI oversold"}',
            );
          }
          return Promise.resolve('{}');
        },
      );

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.decision).toBe('HOLD');
      expect(result.reasoning).toContain('AEGIS BLOCK');
      expect(mockSubAgentService.call).not.toHaveBeenCalledWith(
        'orchestrator',
        'decision_synthesis',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should override the BLOCK only when blockReasons is exactly [SINGLE_ASSET_CONCENTRATION], read from the typed field (CA-030)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'technical_signal') {
            return Promise.resolve(
              '{"signal":"BUY","confidence":0.78,"reasoning":"RSI oversold + MACD cross"}',
            );
          }
          if (agentId === 'market' && task === 'news_sentiment') {
            return Promise.resolve(
              '{"sentiment":0.65,"impact":"positive","reasoning":"ETF news dominates"}',
            );
          }
          if (agentId === 'operations' && task === 'sizing_suggestion') {
            return Promise.resolve(
              '{"recommendation":"proceed","maxTradeSize":0.04,"reasoning":"within limit"}',
            );
          }
          if (agentId === 'risk' && task === 'risk_gate') {
            return Promise.resolve(
              '{"riskScore":60,"verdict":"BLOCK","positionSizeMultiplier":1.0,"blockReasons":["SINGLE_ASSET_CONCENTRATION"],"reason":"Portfolio 100% concentrado en BTC","alerts":[]}',
            );
          }
          if (agentId === 'orchestrator' && task === 'decision_synthesis') {
            return Promise.resolve(
              '{"decision":"BUY","confidence":0.74,"reasoning":"Strong technical","waitMinutes":15}',
            );
          }
          return Promise.resolve('{}');
        },
      );

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.decision).toBe('BUY');
      expect(
        mockSubAgentService.call.mock.calls.some(
          (call: unknown[]) =>
            call[0] === 'orchestrator' && call[1] === 'decision_synthesis',
        ),
      ).toBe(true);
    });

    it('should still return a decision when one sub-agent call fails', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'technical_signal') {
            return Promise.reject(new Error('LLM timeout'));
          }
          if (agentId === 'risk' && task === 'risk_gate') {
            return Promise.resolve(
              '{"riskScore":20,"verdict":"PASS","positionSizeMultiplier":1.0,"reason":"ok","alerts":[]}',
            );
          }
          if (agentId === 'orchestrator' && task === 'decision_synthesis') {
            return Promise.resolve(
              '{"decision":"HOLD","confidence":0.5,"reasoning":"Partial data","waitMinutes":20}',
            );
          }
          return Promise.resolve('{}');
        },
      );

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.orchestrated).toBe(true);
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.decision);
    });

    it('should throw if config not found', async () => {
      mockPrismaService.tradingConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.orchestrateDecision(
          'user-1',
          'nonexistent-config',
          mockIndicators as any,
          mockNews,
        ),
      ).rejects.toThrow('Config nonexistent-config not found');
    });

    it('should call 5 sub-agents when enrichedData has macro data (globalMarket)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'technical_signal')
            return Promise.resolve('{"signal":"BUY","confidence":0.8}');
          if (agentId === 'market' && task === 'news_sentiment')
            return Promise.resolve('{"sentiment":0.6}');
          if (agentId === 'operations' && task === 'sizing_suggestion')
            return Promise.resolve('{"recommendation":"proceed"}');
          if (agentId === 'risk' && task === 'risk_gate')
            return Promise.resolve(
              '{"verdict":"PASS","riskScore":30,"alerts":[]}',
            );
          if (agentId === 'blockchain' && task === 'macro_context')
            return Promise.resolve(
              '{"regime":"RISK_ON","bias":"BULLISH","confidence":0.75,"keyFactors":["TVL rising"],"reasoning":"DeFi healthy"}',
            );
          if (agentId === 'orchestrator' && task === 'decision_synthesis')
            return Promise.resolve(
              '{"decision":"BUY","confidence":0.8,"reasoning":"All signals aligned","waitMinutes":10}',
            );
          return Promise.resolve('{}');
        },
      );

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
        undefined,
        { globalMarket: { totalMcap: 2.5e12, btcDominance: 54 } },
      );

      expect(result.orchestrated).toBe(true);
      expect(result.decision).toBe('BUY');
      expect(result.subAgentResults).toHaveLength(5);
      expect(
        result.subAgentResults?.find((r) => r.task === 'macro_context'),
      ).toBeDefined();
      // 5 parallel + 1 synthesis = 6 calls
      expect(mockSubAgentService.call).toHaveBeenCalledTimes(6);
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'blockchain',
        'macro_context',
        expect.objectContaining({ globalMarket: expect.any(Object) }),
        'user-1',
        false,
        undefined,
      );
    });

    it('should call only 4 sub-agents without enrichedData (no CIPHER)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'technical_signal')
            return Promise.resolve('{"signal":"HOLD","confidence":0.5}');
          if (agentId === 'market' && task === 'news_sentiment')
            return Promise.resolve('{"sentiment":0.5}');
          if (agentId === 'operations' && task === 'sizing_suggestion')
            return Promise.resolve('{"recommendation":"wait"}');
          if (agentId === 'risk' && task === 'risk_gate')
            return Promise.resolve(
              '{"verdict":"PASS","riskScore":20,"alerts":[]}',
            );
          if (agentId === 'orchestrator' && task === 'decision_synthesis')
            return Promise.resolve(
              '{"decision":"HOLD","confidence":0.5,"reasoning":"No clear signal","waitMinutes":15}',
            );
          return Promise.resolve('{}');
        },
      );

      const result = await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
      );

      expect(result.subAgentResults).toHaveLength(4);
      expect(
        result.subAgentResults?.find((r) => r.task === 'macro_context'),
      ).toBeUndefined();
      // 4 parallel + 1 synthesis = 5 calls
      expect(mockSubAgentService.call).toHaveBeenCalledTimes(5);
      expect(mockSubAgentService.call).not.toHaveBeenCalledWith(
        'blockchain',
        'macro_context',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should pass enriched data to correct sub-agents (fearGreed → SIGMA sentiment, derivatives → AEGIS)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'risk' && task === 'risk_gate')
            return Promise.resolve(
              '{"verdict":"PASS","riskScore":50,"alerts":[]}',
            );
          if (agentId === 'orchestrator' && task === 'decision_synthesis')
            return Promise.resolve(
              '{"decision":"HOLD","confidence":0.5,"reasoning":"neutral","waitMinutes":15}',
            );
          return Promise.resolve('{}');
        },
      );

      await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
        undefined,
        {
          fearGreed: { value: 25, classification: 'Extreme Fear' },
          derivatives: { fundingRate: 0.01, openInterest: 15e9 },
        },
      );

      // SIGMA sentiment receives fearGreed
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'market',
        'news_sentiment',
        expect.objectContaining({
          fearGreed: { value: 25, classification: 'Extreme Fear' },
        }),
        'user-1',
        false,
        undefined,
      );
      // AEGIS receives derivatives
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'risk',
        'risk_gate',
        expect.objectContaining({
          derivatives: { fundingRate: 0.01, openInterest: 15e9 },
        }),
        'user-1',
        false,
        undefined,
      );
      // No CIPHER call (no macro data)
      expect(mockSubAgentService.call).not.toHaveBeenCalledWith(
        'blockchain',
        'macro_context',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should NOT pass externalDataSources to synthesis (Spec 41)', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'risk' && task === 'risk_gate')
            return Promise.resolve(
              '{"verdict":"PASS","riskScore":20,"alerts":[]}',
            );
          if (agentId === 'orchestrator' && task === 'decision_synthesis')
            return Promise.resolve(
              '{"decision":"HOLD","confidence":0.5,"reasoning":"test","waitMinutes":10}',
            );
          return Promise.resolve('{}');
        },
      );

      await service.orchestrateDecision(
        'user-1',
        'config-1',
        mockIndicators as any,
        mockNews,
        undefined,
        { fearGreed: { value: 50 }, globalMarket: { totalMcap: 2e12 } },
      );

      // Synthesis should receive macroContext (CIPHER output) but NOT externalDataSources
      const synthCall = mockSubAgentService.call.mock.calls.find(
        (c: unknown[]) =>
          c[0] === 'orchestrator' && c[1] === 'decision_synthesis',
      );
      expect(synthCall).toBeDefined();
      const synthContext = synthCall![2];
      expect(synthContext).not.toHaveProperty('externalDataSources');
      expect(synthContext).toHaveProperty('macroContext');
    });
  });

  // ── enrichNews ────────────────────────────────────────────────────────────

  describe('enrichNews', () => {
    it('should call SIGMA and CIPHER in parallel', async () => {
      mockSubAgentService.call.mockImplementation(
        (agentId: string, task: string) => {
          if (agentId === 'market' && task === 'news_technical_relevance') {
            return Promise.resolve(
              '{"relevance":0.8,"affectedIndicators":["volume","RSI"],"timeframe":"short"}',
            );
          }
          if (agentId === 'blockchain' && task === 'ecosystem_impact') {
            return Promise.resolve(
              '{"ecosystemImpact":"high","category":"regulation","chains":["ETH","BTC"],"summary":"Major regulatory shift"}',
            );
          }
          return Promise.resolve('{}');
        },
      );

      const result = await service.enrichNews(
        { id: 'news-1', headline: 'BTC ETF approved', summary: 'Good news' },
        'user-1',
      );

      expect(result.technicalRelevance).toBe(0.8);
      expect(result.ecosystemImpact).toBe('Major regulatory shift');
      expect(result.orchestratedTags).toContain('volume');
      expect(result.orchestratedTags).toContain('RSI');
      expect(result.orchestratedTags).toContain('category:regulation');

      // Verify both were called in parallel (both should have been called)
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'market',
        'news_technical_relevance',
        expect.any(Object),
        'user-1',
        true,
      );
      expect(mockSubAgentService.call).toHaveBeenCalledWith(
        'blockchain',
        'ecosystem_impact',
        expect.any(Object),
        'user-1',
        true,
      );
    });

    it('should return default enrichment when both agents fail', async () => {
      mockSubAgentService.call.mockRejectedValue(new Error('LLM error'));

      const result = await service.enrichNews(
        { id: 'news-1', headline: 'Some news', summary: null },
        'user-1',
      );

      expect(result.technicalRelevance).toBe(0);
      expect(result.ecosystemImpact).toBe('none');
      expect(result.orchestratedTags).toEqual([]);
    });
  });
});
