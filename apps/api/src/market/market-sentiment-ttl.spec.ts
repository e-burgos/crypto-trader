jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../generated/prisma/enums', () => ({
  LLMProvider: {
    CLAUDE: 'CLAUDE',
    OPENAI: 'OPENAI',
    GROQ: 'GROQ',
    GEMINI: 'GEMINI',
    MISTRAL: 'MISTRAL',
    TOGETHER: 'TOGETHER',
    OPENROUTER: 'OPENROUTER',
  },
  NewsApiProvider: {
    NEWSAPI: 'NEWSAPI',
    NEWSDATA: 'NEWSDATA',
    GNEWS: 'GNEWS',
  },
  AgentId: {
    platform: 'platform',
    operations: 'operations',
    market: 'market',
    blockchain: 'blockchain',
    risk: 'risk',
    orchestrator: 'orchestrator',
    routing: 'routing',
    synthesis: 'synthesis',
  },
  LLMSource: { ORCHESTRATOR: 'ORCHESTRATOR', CHAT: 'CHAT', MANUAL: 'MANUAL' },
}));

import { MarketService } from './market.service';

const mockPrisma = {
  newsConfig: { findUnique: jest.fn() },
  newsAnalysis: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  lLMCredential: { findUnique: jest.fn() },
};

const mockAgentConfigResolver = {
  resolveConfig: jest.fn(),
};

describe('MarketService.analyzeSentiment — TTL check (Spec 38, B.5)', () => {
  let service: MarketService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketService(
      mockPrisma as any,
      mockAgentConfigResolver as any,
    );
  });

  it('should return existing analysis when aiAnalyzedAt is within TTL', async () => {
    const recentAnalysis = {
      id: 'analysis-1',
      userId: 'user1',
      newsCount: 5,
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 2,
      score: 60,
      overallSentiment: 'positive',
      summary: 'Test',
      headlines: [],
      aiAnalyzedAt: new Date(Date.now() - 2 * 60_000), // 2 min ago
      aiScore: 70,
      aiOverallSentiment: 'positive',
      aiSummary: 'AI test',
      aiHeadlines: [],
    };

    mockPrisma.newsConfig.findUnique.mockResolvedValue({
      intervalMinutes: 10,
    });
    mockPrisma.newsAnalysis.findFirst.mockResolvedValue(recentAnalysis);

    const result = await service.analyzeSentiment('user1');

    expect(result).toBe(recentAnalysis);
    // Should NOT call resolveConfig (LLM call skipped)
    expect(mockAgentConfigResolver.resolveConfig).not.toHaveBeenCalled();
  });

  it('should proceed to LLM call when aiAnalyzedAt is older than TTL', async () => {
    const oldAnalysis = {
      id: 'analysis-1',
      userId: 'user1',
      newsCount: 5,
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 2,
      score: 60,
      overallSentiment: 'positive',
      summary: 'Test',
      headlines: [{ id: '1', headline: 'Test news', sentiment: 'positive' }],
      aiAnalyzedAt: new Date(Date.now() - 20 * 60_000), // 20 min ago
      aiScore: 70,
    };

    mockPrisma.newsConfig.findUnique.mockResolvedValue({
      intervalMinutes: 10,
    });
    mockPrisma.newsAnalysis.findFirst.mockResolvedValue(oldAnalysis);
    mockAgentConfigResolver.resolveConfig.mockResolvedValue({
      provider: 'CLAUDE',
      model: 'claude-sonnet-4',
    });
    // Will fail at credential lookup — that's fine, we just check it proceeds past TTL
    mockPrisma.lLMCredential.findUnique.mockResolvedValue(null);

    await expect(service.analyzeSentiment('user1')).rejects.toThrow();

    // Should call resolveConfig (proceeded past TTL)
    expect(mockAgentConfigResolver.resolveConfig).toHaveBeenCalled();
  });

  it('should proceed when aiAnalyzedAt is null (never analyzed)', async () => {
    const analysis = {
      id: 'analysis-1',
      userId: 'user1',
      newsCount: 5,
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 2,
      score: 60,
      overallSentiment: 'neutral',
      summary: 'Test',
      headlines: [{ id: '1', headline: 'Test', sentiment: 'neutral' }],
      aiAnalyzedAt: null,
    };

    mockPrisma.newsConfig.findUnique.mockResolvedValue({
      intervalMinutes: 10,
    });
    mockPrisma.newsAnalysis.findFirst.mockResolvedValue(analysis);
    mockAgentConfigResolver.resolveConfig.mockResolvedValue({
      provider: 'CLAUDE',
      model: 'claude-sonnet-4',
    });
    mockPrisma.lLMCredential.findUnique.mockResolvedValue(null);

    await expect(service.analyzeSentiment('user1')).rejects.toThrow();

    expect(mockAgentConfigResolver.resolveConfig).toHaveBeenCalled();
  });
});
