import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import type { DataSourcePayload } from '@crypto-trader/providers';
import type { EnrichedMarketSnapshot } from '@crypto-trader/shared';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn(() => 'decrypted-key'),
  encrypt: jest.fn(() => ({ encrypted: 'enc', iv: 'iv' })),
}));

describe('MarketService.buildEnrichedSnapshot (integration)', () => {
  let service: MarketService;
  let registry: any;
  let prisma: any;

  const mockFearGreed: DataSourcePayload = {
    type: 'fear_greed',
    data: {
      value: 72,
      classification: 'Greed',
      timestamp: '2026-01-01T00:00:00Z',
      previousClose: 68,
    },
  };

  const mockDerivatives: DataSourcePayload = {
    type: 'derivatives',
    data: {
      openInterest: 15_000_000_000,
      openInterestChange24h: 2.5,
      fundingRate: 0.015,
      longShortRatio: 1.3,
      liquidations24h: 120_000_000,
      liquidationsBuy24h: 60_000_000,
      liquidationsSell24h: 60_000_000,
      cvd: 0,
    },
  };

  const mockDefiHealth: DataSourcePayload = {
    type: 'defi_health',
    data: {
      totalTvl: 80_000_000_000,
      tvlChange24h: 1.2,
      tvlChange7d: -0.5,
      stablecoinMcap: 130_000_000_000,
      stablecoinChange24h: 0.1,
      stablecoinChange7d: 0.3,
    },
  };

  beforeEach(async () => {
    registry = {
      getActiveConfigs: jest.fn(),
      fetchFromProvider: jest.fn(),
    };

    prisma = {
      dataSourceCredential: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
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

    // Mock internal getSnapshot
    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({
      symbol: 'BTCUSDT',
      currentPrice: 95000,
      change24h: 2.1,
    });
  });

  it('should return complete snapshot when all sources succeed', async () => {
    registry.getActiveConfigs!.mockResolvedValue([
      {
        id: '1',
        name: 'alternative_me',
        requiresApiKey: false,
        isActive: true,
      },
      { id: '2', name: 'coinalyze', requiresApiKey: false, isActive: true },
      { id: '3', name: 'defillama', requiresApiKey: false, isActive: true },
    ] as any);

    registry
      .fetchFromProvider!.mockResolvedValueOnce(mockFearGreed)
      .mockResolvedValueOnce(mockDerivatives)
      .mockResolvedValueOnce(mockDefiHealth);

    const result: EnrichedMarketSnapshot =
      await service.buildEnrichedSnapshot('BTCUSDT');

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.currentPrice).toBe(95000);
    expect(result.fearGreed).toEqual(mockFearGreed.data);
    expect(result.derivatives).toEqual(mockDerivatives.data);
    expect(result.defiHealth).toEqual(mockDefiHealth.data);
    expect(result.activeSources).toEqual([
      'alternative_me',
      'coinalyze',
      'defillama',
    ]);
    expect(result.failedSources).toEqual([]);
  });

  it('should return nulls for inactive/unavailable sources', async () => {
    registry.getActiveConfigs!.mockResolvedValue([
      {
        id: '1',
        name: 'alternative_me',
        requiresApiKey: false,
        isActive: true,
      },
    ] as any);

    registry.fetchFromProvider!.mockResolvedValueOnce(mockFearGreed);

    const result = await service.buildEnrichedSnapshot('BTCUSDT');

    expect(result.fearGreed).toEqual(mockFearGreed.data);
    expect(result.derivatives).toBeNull();
    expect(result.defiHealth).toBeNull();
    expect(result.news).toBeNull();
    expect(result.globalMarket).toBeNull();
    expect(result.predictions).toBeNull();
    expect(result.tokenUnlocks).toBeNull();
  });

  it('should handle provider returning null (failed fetch)', async () => {
    registry.getActiveConfigs!.mockResolvedValue([
      {
        id: '1',
        name: 'alternative_me',
        requiresApiKey: false,
        isActive: true,
      },
      { id: '2', name: 'coinalyze', requiresApiKey: false, isActive: true },
    ] as any);

    registry
      .fetchFromProvider!.mockResolvedValueOnce(mockFearGreed)
      .mockResolvedValueOnce(null); // coinalyze failed

    const result = await service.buildEnrichedSnapshot('BTCUSDT');

    expect(result.fearGreed).toEqual(mockFearGreed.data);
    expect(result.derivatives).toBeNull();
    expect(result.activeSources).toContain('alternative_me');
    expect(result.failedSources).toContain('coinalyze');
  });

  it('should handle all providers failing gracefully', async () => {
    registry.getActiveConfigs!.mockResolvedValue([
      {
        id: '1',
        name: 'alternative_me',
        requiresApiKey: false,
        isActive: true,
      },
      { id: '2', name: 'coinalyze', requiresApiKey: false, isActive: true },
    ] as any);

    registry
      .fetchFromProvider!.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await service.buildEnrichedSnapshot('BTCUSDT');

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.currentPrice).toBe(95000);
    expect(result.fearGreed).toBeNull();
    expect(result.derivatives).toBeNull();
    expect(result.failedSources).toEqual(['alternative_me', 'coinalyze']);
    expect(result.snapshotBuildTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should report snapshotBuildTimeMs and builtAt', async () => {
    registry.getActiveConfigs!.mockResolvedValue([]);

    const result = await service.buildEnrichedSnapshot('BTCUSDT');

    expect(result.snapshotBuildTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.builtAt).toBeDefined();
    expect(() => new Date(result.builtAt)).not.toThrow();
  });
});
