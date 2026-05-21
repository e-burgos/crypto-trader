/**
 * Tests for Spec 43 Phase A — Credential cascade resolution
 * Cascade: trader own key → admin shared key → skip
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((enc: string) => `decrypted-${enc}`),
  encrypt: jest.fn(() => ({ encrypted: 'enc', iv: 'iv' })),
}));

describe('MarketService — Credential Cascade Resolution (Spec 43)', () => {
  let service: MarketService;
  let prisma: any;
  let registry: any;

  const DS_CONFIG = {
    id: 'ds-1',
    name: 'premium_source',
    requiresApiKey: true,
    isActive: true,
  };

  beforeEach(async () => {
    registry = {
      getActiveConfigs: jest.fn().mockResolvedValue([DS_CONFIG]),
      fetchFromProvider: jest.fn().mockResolvedValue({
        type: 'fear_greed',
        data: {
          value: 72,
          classification: 'Greed',
          timestamp: '',
          previousClose: 70,
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
      currentPrice: 100000,
      change24h: 1.5,
    });
  });

  it('should use trader own credential when available', async () => {
    // First call: trader's own creds → returns one
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
      {
        dataSourceId: 'ds-1',
        apiKeyEncrypted: 'trader-key',
        apiKeyIv: 'iv1',
        isActive: true,
      },
    ]);

    const result = await service.buildEnrichedSnapshot('trader-1', 'BTCUSDT');

    // Should have used the trader's credential (never needed shared fallback)
    expect(result.activeSources).toContain('premium_source');
    expect(result.failedSources).not.toContain('premium_source');
    // findMany called once for trader creds only (no second call needed)
    expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'trader-1',
        dataSourceId: { in: ['ds-1'] },
        isActive: true,
      },
    });
  });

  it('should fall back to admin shared credential when trader has none', async () => {
    // First call: trader's own creds → empty
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([]);
    // Second call: shared creds → returns one
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
      {
        dataSourceId: 'ds-1',
        apiKeyEncrypted: 'admin-shared-key',
        apiKeyIv: 'iv2',
        isActive: true,
        shared: true,
      },
    ]);

    const result = await service.buildEnrichedSnapshot('trader-1', 'BTCUSDT');

    expect(result.activeSources).toContain('premium_source');
    expect(result.failedSources).not.toContain('premium_source');
    // Second findMany should query for shared creds
    expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.dataSourceCredential.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        dataSourceId: { in: ['ds-1'] },
        isActive: true,
        shared: true,
      },
    });
  });

  it('should skip source when neither trader nor shared credential exists', async () => {
    // First call: trader's own creds → empty
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([]);
    // Second call: shared creds → also empty
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([]);

    const result = await service.buildEnrichedSnapshot('trader-1', 'BTCUSDT');

    expect(result.failedSources).toContain('premium_source');
    expect(result.activeSources).not.toContain('premium_source');
    expect(result.fearGreed).toBeNull();
  });

  it('should prefer trader credential over admin shared credential', async () => {
    // First call: trader has own cred
    prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
      {
        dataSourceId: 'ds-1',
        apiKeyEncrypted: 'trader-own-key',
        apiKeyIv: 'iv-trader',
        isActive: true,
      },
    ]);

    await service.buildEnrichedSnapshot('trader-1', 'BTCUSDT');

    // Should NOT query for shared creds since trader already has one
    expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledTimes(1);
    // fetchFromProvider should be called with the trader's decrypted key
    expect(registry.fetchFromProvider).toHaveBeenCalledWith(
      'premium_source',
      'decrypted-trader-own-key',
    );
  });
});
