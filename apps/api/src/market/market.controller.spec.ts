import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import type { EnrichedMarketSnapshot } from '@crypto-trader/shared';

describe('MarketController — GET /market/enriched-snapshot/:symbol', () => {
  let controller: MarketController;
  let marketService: { buildEnrichedSnapshot: jest.Mock };

  const mockSnapshot: EnrichedMarketSnapshot = {
    symbol: 'BTCUSDT',
    currentPrice: 95000,
    change24h: 2.1,
    fearGreed: {
      value: 72,
      classification: 'Greed',
      timestamp: '2026-01-01T00:00:00Z',
      previousClose: 68,
    },
    derivatives: null,
    defiHealth: null,
    news: null,
    globalMarket: null,
    predictions: null,
    tokenUnlocks: null,
    activeSources: ['alternative_me'],
    failedSources: [],
    snapshotBuildTimeMs: 150,
    builtAt: '2026-01-01T12:00:00Z',
  };

  beforeEach(async () => {
    marketService = {
      buildEnrichedSnapshot: jest.fn().mockResolvedValue(mockSnapshot),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [{ provide: MarketService, useValue: marketService }],
    }).compile();

    controller = module.get<MarketController>(MarketController);
  });

  it('should return 200 with EnrichedMarketSnapshot', async () => {
    const result = await controller.getEnrichedSnapshot('BTCUSDT');

    expect(result).toEqual(mockSnapshot);
    expect(marketService.buildEnrichedSnapshot).toHaveBeenCalledWith('BTCUSDT');
  });

  it('should return null fields when sources are disabled', async () => {
    const emptySnapshot: EnrichedMarketSnapshot = {
      ...mockSnapshot,
      fearGreed: null,
      activeSources: [],
      failedSources: ['alternative_me'],
    };
    marketService.buildEnrichedSnapshot.mockResolvedValueOnce(emptySnapshot);

    const result = await controller.getEnrichedSnapshot('ETHUSDT');

    expect(result.fearGreed).toBeNull();
    expect(result.failedSources).toContain('alternative_me');
  });

  it('should always include metadata fields', async () => {
    const result = await controller.getEnrichedSnapshot('BTCUSDT');

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.snapshotBuildTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.builtAt).toBeDefined();
    expect(Array.isArray(result.activeSources)).toBe(true);
    expect(Array.isArray(result.failedSources)).toBe(true);
  });
});
