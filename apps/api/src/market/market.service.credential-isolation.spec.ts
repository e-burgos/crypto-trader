/**
 * Regression tests for Phase A — Agent Profit Optimizer
 * Bug #1: buildEnrichedSnapshot credential isolation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn(() => 'decrypted-key'),
  encrypt: jest.fn(() => ({ encrypted: 'enc', iv: 'iv' })),
}));

describe('MarketService — Credential Isolation (Bug #1 Regression)', () => {
  let service: MarketService;
  let prisma: any;
  let registry: any;

  beforeEach(async () => {
    registry = {
      getActiveConfigs: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'ds-1',
            name: 'alternative_me',
            requiresApiKey: true,
            isActive: true,
          },
        ]),
      fetchFromProvider: jest.fn().mockResolvedValue({
        type: 'fear_greed',
        data: {
          value: 50,
          classification: 'Neutral',
          timestamp: '',
          previousClose: 48,
        },
      }),
    };

    prisma = {
      dataSourceCredential: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: prisma },
        { provide: DataSourceRegistryService, useValue: registry },
        { provide: LLMUsageService, useValue: {} },
        { provide: AgentConfigResolverService, useValue: {} },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({
      symbol: 'BTCUSDT',
      currentPrice: 95000,
      change24h: 2.1,
    });
  });

  it('should pass userId to dataSourceCredential.findMany', async () => {
    prisma.dataSourceCredential.findMany.mockResolvedValue([
      {
        dataSourceId: 'ds-1',
        apiKeyEncrypted: 'enc',
        apiKeyIv: 'iv',
        isActive: true,
      },
    ]);

    await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-A',
        dataSourceId: { in: ['ds-1'] },
        isActive: true,
      },
    });
  });

  it('should NOT return credentials from another user', async () => {
    // Simulate: user-B has credentials, user-A does not
    prisma.dataSourceCredential.findMany.mockResolvedValue([]);

    const result = await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    // Source requires API key but user-A has none → should be in failedSources
    expect(result.failedSources).toContain('alternative_me');
    expect(result.fearGreed).toBeNull();
  });
});
