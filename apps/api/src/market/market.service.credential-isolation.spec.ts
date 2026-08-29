import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';
import {
  DataSourceCredentialResolver,
  SHARED_PUBLIC_OWNER,
} from './data-source-credential-resolver.service';

const KEYED_SOURCE = {
  id: 'ds-1',
  name: 'coinalyze',
  requiresApiKey: true,
  isActive: true,
};

const FREE_SOURCE = {
  id: 'ds-2',
  name: 'alternative_me',
  requiresApiKey: false,
  isActive: true,
};

describe('MarketService — credential resolution is delegated', () => {
  let service: MarketService;
  let registry: any;
  let credentialResolver: any;

  beforeEach(async () => {
    registry = {
      getActiveConfigs: jest.fn().mockResolvedValue([KEYED_SOURCE]),
      fetchFromProvider: jest.fn().mockResolvedValue({
        type: 'derivatives',
        data: { openInterest: 1, fundingRate: 0 },
      }),
    };

    credentialResolver = {
      resolveForDataSources: jest.fn().mockResolvedValue(new Map()),
      resolveForNewsProviders: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: {} },
        { provide: DataSourceRegistryService, useValue: registry },
        { provide: LLMUsageService, useValue: {} },
        { provide: AgentConfigResolverService, useValue: {} },
        { provide: DataSourceCredentialResolver, useValue: credentialResolver },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);

    jest.spyOn(service as any, 'getSnapshot').mockResolvedValue({
      symbol: 'BTCUSDT',
      currentPrice: 95000,
      change24h: 2.1,
    });
  });

  it('resolves credentials for the requesting user and for every active source', async () => {
    registry.getActiveConfigs.mockResolvedValue([KEYED_SOURCE, FREE_SOURCE]);

    await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(credentialResolver.resolveForDataSources).toHaveBeenCalledWith(
      'user-A',
      ['ds-1', 'ds-2'],
    );
  });

  it('does not query credential tables directly', async () => {
    const prisma = (service as any).prisma;

    await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(prisma.dataSourceCredential).toBeUndefined();
  });

  it('CA-003: omits a source that requires a key when nothing resolves for it', async () => {
    const result = await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(result.failedSources).toContain('coinalyze');
    expect(result.derivatives).toBeNull();
    expect(registry.fetchFromProvider).not.toHaveBeenCalled();
  });

  it('CA-001: fetches with the resolved key and its owner when a shared credential applies', async () => {
    credentialResolver.resolveForDataSources.mockResolvedValue(
      new Map([
        [
          'ds-1',
          {
            apiKey: 'admin-key',
            ownerUserId: 'admin-1',
            origin: 'admin-shared',
          },
        ],
      ]),
    );

    const result = await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(registry.fetchFromProvider).toHaveBeenCalledWith(
      'coinalyze',
      'admin-key',
      'admin-1',
    );
    expect(result.activeSources).toContain('coinalyze');
    expect(result.derivatives).not.toBeNull();
  });

  it('CA-005: fetches with the trader own key and the trader as owner', async () => {
    credentialResolver.resolveForDataSources.mockResolvedValue(
      new Map([
        ['ds-1', { apiKey: 'own-key', ownerUserId: 'user-A', origin: 'user' }],
      ]),
    );

    await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(registry.fetchFromProvider).toHaveBeenCalledWith(
      'coinalyze',
      'own-key',
      'user-A',
    );
  });

  it('uses the shared public owner for sources that need no credential', async () => {
    registry.getActiveConfigs.mockResolvedValue([FREE_SOURCE]);
    registry.fetchFromProvider.mockResolvedValue({
      type: 'fear_greed',
      data: {
        value: 50,
        classification: 'Neutral',
        timestamp: '',
        previousClose: 48,
      },
    });

    await service.buildEnrichedSnapshot('user-A', 'BTCUSDT');

    expect(registry.fetchFromProvider).toHaveBeenCalledWith(
      'alternative_me',
      undefined,
      SHARED_PUBLIC_OWNER,
    );
  });
});
