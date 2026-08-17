import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

describe('MarketService.getPriceAt', () => {
  let service: MarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: {} },
        { provide: DataSourceRegistryService, useValue: {} },
        { provide: LLMUsageService, useValue: {} },
        { provide: AgentConfigResolverService, useValue: {} },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  it('uses the ticker price when the target minute has not closed yet', async () => {
    const getTickerPrice = jest
      .spyOn((service as any).binance, 'getTickerPrice')
      .mockResolvedValue(51000);
    const getKlines = jest.spyOn((service as any).binance, 'getKlines');

    const result = await service.getPriceAt('BTCUSDT', new Date());

    expect(result).toBe(51000);
    expect(getTickerPrice).toHaveBeenCalledWith('BTCUSDT');
    expect(getKlines).not.toHaveBeenCalled();
  });

  it('uses the containing 1m kline close price when the target minute already closed', async () => {
    const at = new Date(Date.now() - 5 * 60_000);
    const atMs = at.getTime();

    jest.spyOn((service as any).binance, 'getKlines').mockResolvedValue([
      { openTime: atMs - 60_000, closeTime: atMs - 1, close: 100 },
      { openTime: atMs - 30_000, closeTime: atMs + 30_000, close: 200 },
      { openTime: atMs + 30_001, closeTime: atMs + 90_000, close: 300 },
    ]);

    const result = await service.getPriceAt('BTCUSDT', at);

    expect(result).toBe(200);
  });

  it('returns null when no kline contains the target instant', async () => {
    const at = new Date(Date.now() - 5 * 60_000);
    jest.spyOn((service as any).binance, 'getKlines').mockResolvedValue([]);

    const result = await service.getPriceAt('BTCUSDT', at);

    expect(result).toBeNull();
  });

  it('returns null when the provider call fails', async () => {
    const at = new Date(Date.now() - 5 * 60_000);
    jest
      .spyOn((service as any).binance, 'getKlines')
      .mockRejectedValue(new Error('network error'));

    const result = await service.getPriceAt('BTCUSDT', at);

    expect(result).toBeNull();
  });
});
