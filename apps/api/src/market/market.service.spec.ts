import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Candle } from '@crypto-trader/shared';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceRegistryService } from './data-source-registry.service';
import { DataSourceCredentialResolver } from './data-source-credential-resolver.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { AgentConfigResolverService } from '../agents/agent-config-resolver.service';

function generateCandles(count: number, startPrice = 30000): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const baseTime = Date.now() - count * 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price + (i % 2 === 0 ? 10 : -10);
    candles.push({
      openTime: baseTime + i * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) + 5,
      low: Math.min(open, close) - 5,
      close,
      volume: 100 + i,
      closeTime: baseTime + (i + 1) * 60 * 60 * 1000 - 1,
    });
    price = close;
  }
  return candles;
}

function geoBlockedError(): unknown {
  return {
    isAxiosError: true,
    message: 'Request failed with status code 451',
    response: { status: 451, data: {} },
  };
}

function networkError(): unknown {
  return {
    isAxiosError: true,
    code: 'ENOTFOUND',
    message: 'getaddrinfo ENOTFOUND api.binance.com',
    response: undefined,
  };
}

describe('MarketService — upstream error mapping', () => {
  let service: MarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: {} },
        {
          provide: DataSourceCredentialResolver,
          useValue: {
            resolveForDataSources: jest.fn().mockResolvedValue(new Map()),
            resolveForNewsProviders: jest.fn().mockResolvedValue(new Map()),
          },
        },
        { provide: DataSourceRegistryService, useValue: {} },
        { provide: LLMUsageService, useValue: {} },
        { provide: AgentConfigResolverService, useValue: {} },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  describe('getSnapshot', () => {
    it('rejects with 400 on an invalid symbol', async () => {
      await expect(service.getSnapshot('DOGEUSDT')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects with 503 when Binance is geo-blocked (451)', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockRejectedValue(geoBlockedError());

      const error = await service.getSnapshot('BTCUSDT').catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
      expect(error.message).toContain('Market data upstream unavailable');
      expect(error.message).toContain('HTTP 451');
    });

    it('rejects with 503 on a network error reaching Binance', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockRejectedValue(networkError());

      const error = await service.getSnapshot('BTCUSDT').catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
      expect(error.message).toContain('Market data upstream unavailable');
      expect(error.message).toContain('ENOTFOUND');
    });

    it('returns the indicator snapshot on the happy path', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockResolvedValue(generateCandles(200));

      const result = await service.getSnapshot('btcusdt');

      expect(result.symbol).toBe('BTCUSDT');
      expect(typeof result.currentPrice).toBe('number');
      expect(typeof result.change24h).toBe('number');
    });
  });

  describe('getOhlcv', () => {
    it('rejects with 400 on an invalid asset', async () => {
      await expect(service.getOhlcv('DOGE', '1h')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects with 400 on an invalid interval', async () => {
      await expect(service.getOhlcv('BTC', '3h')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects with 503 when Binance is geo-blocked (451)', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockRejectedValue(geoBlockedError());

      const error = await service.getOhlcv('BTC', '1h').catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
      expect(error.message).toContain('Market data upstream unavailable');
    });

    it('rejects with 503 on a network error reaching Binance', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockRejectedValue(networkError());

      const error = await service.getOhlcv('BTC', '1h').catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
    });

    it('returns candles on the happy path', async () => {
      const candles = generateCandles(200);
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockResolvedValue(candles);

      const result = await service.getOhlcv('BTC', '1h');

      expect(result).toEqual(candles);
    });
  });

  describe('buildEnrichedSnapshot', () => {
    it('propagates a 503 when the base snapshot cannot be built', async () => {
      jest
        .spyOn((service as any).binance, 'getKlines')
        .mockRejectedValue(geoBlockedError());

      const error = await service
        .buildEnrichedSnapshot('user-1', 'BTCUSDT')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
    });

    it('propagates a 400 when the symbol is invalid', async () => {
      await expect(
        service.buildEnrichedSnapshot('user-1', 'DOGEUSDT'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
