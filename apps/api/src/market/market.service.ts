import { Injectable } from '@nestjs/common';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import {
  CoinGeckoNewsFetcher,
  RssFetcher,
  RedditFetcher,
  NewsDataFetcher,
  NewsAggregator,
} from '@crypto-trader/data-fetcher';
import { CandleInterval } from '@crypto-trader/shared';
import { calculateIndicatorSnapshot } from '@crypto-trader/analysis';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import { NewsApiProvider } from '../../generated/prisma/enums';

const VALID_ASSETS = ['BTC', 'ETH'];
const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const FREE_NEWS_SOURCES = [
  {
    id: 'coingecko',
    label: 'CoinGecko News',
    description: 'Free crypto news from CoinGecko API. No API key required.',
    factory: () => new CoinGeckoNewsFetcher(),
  },
  {
    id: 'rss:coindesk',
    label: 'CoinDesk RSS',
    description: 'CoinDesk news via public RSS feed. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          {
            name: 'coindesk',
            url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
          },
        ],
      }),
  },
  {
    id: 'rss:cointelegraph',
    label: 'CoinTelegraph RSS',
    description: 'CoinTelegraph news via public RSS feed. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          { name: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
        ],
      }),
  },
  {
    id: 'rss:bitcoinmagazine',
    label: 'Bitcoin Magazine RSS',
    description:
      'Bitcoin Magazine — in-depth Bitcoin news and analysis. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [
          { name: 'bitcoinmagazine', url: 'https://bitcoinmagazine.com/feed' },
        ],
      }),
  },
  {
    id: 'rss:theblock',
    label: 'The Block RSS',
    description:
      'The Block — institutional crypto and blockchain news. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [{ name: 'theblock', url: 'https://www.theblock.co/rss.xml' }],
      }),
  },
  {
    id: 'rss:beincrypto',
    label: 'BeinCrypto RSS',
    description:
      'BeinCrypto — market news, DeFi, Web3 analysis. No API key required.',
    factory: () =>
      new RssFetcher({
        feeds: [{ name: 'beincrypto', url: 'https://beincrypto.com/feed/' }],
      }),
  },
  {
    id: 'reddit',
    label: 'Reddit',
    description: 'r/CryptoCurrency & r/Bitcoin posts. No API key required.',
    factory: () => new RedditFetcher(),
  },
] as const;

const OPTIONAL_NEWS_SOURCES = [
  {
    id: 'newsdata',
    provider: 'NEWSDATA' as NewsApiProvider,
    label: 'NewsData.io',
    description:
      'REST API with 200 free requests/day. Register at newsdata.io to get your free API key.',
    signupUrl: 'https://newsdata.io',
    factory: (apiKey: string) => new NewsDataFetcher({ apiKey }),
  },
] as const;

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
    const freeSources = FREE_NEWS_SOURCES.map((s) => s.factory());

    const optionalSources = await Promise.all(
      OPTIONAL_NEWS_SOURCES.map(async (s) => {
        const cred = await this.prisma.newsApiCredential.findFirst({
          where: { userId, provider: s.provider, isActive: true },
        });
        if (!cred) return null;
        const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
        return s.factory(apiKey);
      }),
    );

    const sources = [
      ...freeSources,
      ...optionalSources.filter(Boolean),
    ] as ReturnType<(typeof FREE_NEWS_SOURCES)[number]['factory']>[];

    const aggregator = new NewsAggregator(sources, { cacheTtlSeconds: 300 });
    return aggregator.fetchAll(Math.min(limit, 100));
  }

  async getNewsSourcesStatus(userId: string) {
    const freeResults = await Promise.allSettled(
      FREE_NEWS_SOURCES.map(async (s) => {
        const items = await s.factory().fetch(1);
        return items.length > 0;
      }),
    );

    const freeStatuses = FREE_NEWS_SOURCES.map((s, i) => {
      const result = freeResults[i];
      const isReachable =
        result.status === 'fulfilled' && result.value === true;
      const error =
        result.status === 'rejected'
          ? result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
          : undefined;
      return {
        id: s.id,
        label: s.label,
        description: s.description,
        requiresApiKey: false,
        isActive: true,
        isConfigured: true,
        isReachable,
        signupUrl: undefined as string | undefined,
        error,
      };
    });

    const optionalStatuses = await Promise.all(
      OPTIONAL_NEWS_SOURCES.map(async (s) => {
        const cred = await this.prisma.newsApiCredential.findFirst({
          where: { userId, provider: s.provider, isActive: true },
        });
        const isConfigured = !!cred;
        let isReachable = false;
        let error: string | undefined;
        if (cred) {
          try {
            const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv);
            const items = await s.factory(apiKey).fetch(1);
            isReachable = items.length > 0;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
          }
        }
        return {
          id: s.id,
          label: s.label,
          description: s.description,
          requiresApiKey: true,
          isActive: isConfigured,
          isConfigured,
          isReachable,
          signupUrl: s.signupUrl,
          error,
        };
      }),
    );

    return [...freeStatuses, ...optionalStatuses];
  }

  async getSnapshot(symbol: string) {
    const VALID_SYMBOLS = ['BTCUSDT', 'BTCUSDC', 'ETHUSDT', 'ETHUSDC'];
    const sym = symbol.toUpperCase();
    if (!VALID_SYMBOLS.includes(sym)) {
      throw new Error(
        `Invalid symbol: ${symbol}. Must be one of ${VALID_SYMBOLS.join(', ')}`,
      );
    }
    const candles = await this.binance.getKlines(
      sym,
      '1h' as CandleInterval,
      200,
    );
    const currentPrice = candles[candles.length - 1]?.close ?? 0;
    const change24h =
      candles.length >= 24
        ? ((candles[candles.length - 1].close -
            candles[candles.length - 25].close) /
            candles[candles.length - 25].close) *
          100
        : 0;
    const snapshot = calculateIndicatorSnapshot(candles);
    return {
      symbol: sym,
      currentPrice: Math.round(currentPrice * 100) / 100,
      change24h: Math.round(change24h * 100) / 100,
      ...snapshot,
    };
  }
}
