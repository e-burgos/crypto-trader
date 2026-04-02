import { Injectable } from '@nestjs/common';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import {
  CryptoPanicFetcher,
  NewsAggregator,
} from '@crypto-trader/data-fetcher';
import { CandleInterval } from '@crypto-trader/shared';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';

const VALID_ASSETS = ['BTC', 'ETH'];
const VALID_PAIRS = ['USDT', 'USDC'];
const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

@Injectable()
export class MarketService {
  private readonly binance = new BinanceRestClient();

  constructor(private readonly prisma: PrismaService) {}

  async getOhlcv(asset: string, interval: string, limit = 200) {
    const assetUpper = asset.toUpperCase();
    const intervalClean = interval.toLowerCase();

    if (!VALID_ASSETS.includes(assetUpper)) {
      throw new Error(`Invalid asset: ${asset}. Must be BTC or ETH`);
    }
    if (!VALID_INTERVALS.includes(intervalClean)) {
      throw new Error(
        `Invalid interval: ${interval}. Must be one of ${VALID_INTERVALS.join(', ')}`,
      );
    }

    const symbol = `${assetUpper}USDT`;
    return this.binance.getKlines(
      symbol,
      intervalClean as CandleInterval,
      Math.min(limit, 500),
    );
  }

  async getNews(userId: string, limit = 20) {
    const sources: CryptoPanicFetcher[] = [];
    const newsCred = await this.prisma.newsApiCredential.findFirst({
      where: { userId, provider: 'CRYPTOPANIC', isActive: true },
    });
    if (newsCred) {
      sources.push(
        new CryptoPanicFetcher({
          authToken: decrypt(newsCred.apiKeyEncrypted, newsCred.apiKeyIv),
        }),
      );
    } else if (process.env.CRYPTOPANIC_API_KEY) {
      sources.push(
        new CryptoPanicFetcher({
          authToken: process.env.CRYPTOPANIC_API_KEY,
        }),
      );
    }
    const aggregator = new NewsAggregator(sources, { cacheTtlSeconds: 300 });
    return aggregator.fetchAll(Math.min(limit, 100));
  }
}
