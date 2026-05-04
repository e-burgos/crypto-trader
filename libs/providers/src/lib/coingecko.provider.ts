import type { GlobalMarketData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { GlobalMarketSchema } from './schemas';

/**
 * CoinGecko — Global Market Data
 * Works without API key (rate limited to ~10 req/min).
 * With free demo key: ~30 req/min.
 * Endpoints:
 *   - GET /global (market cap, dominance)
 *   - GET /search/trending (trending coins)
 *   - GET /coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20
 */
export class CoinGeckoProvider implements IDataSourceProvider {
  readonly name = 'coingecko';
  readonly displayName = 'CoinGecko — Market Data Global';
  readonly category: DataSourceCategoryType = 'MARKET_DATA';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    const base = config.baseUrl;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey;
    }
    // Without API key CoinGecko has ~10 req/min limit — we only make 3 calls
    // so this is usually fine for the 30-min polling interval.

    const [globalRes, trendingRes, marketsRes] = await Promise.all([
      this.fetchJSON<CoinGeckoGlobalResponse>(`${base}/global`, headers),
      this.fetchJSON<CoinGeckoTrendingResponse>(
        `${base}/search/trending`,
        headers,
      ),
      this.fetchJSON<CoinGeckoMarketCoin[]>(
        `${base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=false&price_change_percentage=24h`,
        headers,
      ),
    ]);

    const globalData = globalRes.data;
    const trendingCoins = trendingRes.coins
      .slice(0, 5)
      .map((c) => c.item.symbol.toUpperCase());

    // Sort by 24h change to get gainers and losers
    const sorted = [...marketsRes].sort(
      (a, b) =>
        (b.price_change_percentage_24h ?? 0) -
        (a.price_change_percentage_24h ?? 0),
    );
    const topGainers = sorted.slice(0, 5).map((c) => c.symbol.toUpperCase());
    const topLosers = sorted
      .slice(-5)
      .reverse()
      .map((c) => c.symbol.toUpperCase());

    const data: GlobalMarketData = {
      totalMarketCap: globalData.total_market_cap?.['usd'] ?? 0,
      totalVolume24h: globalData.total_volume?.['usd'] ?? 0,
      btcDominance: globalData.market_cap_percentage?.['btc'] ?? 0,
      ethDominance: globalData.market_cap_percentage?.['eth'] ?? 0,
      activeCryptocurrencies: globalData.active_cryptocurrencies ?? 0,
      trendingCoins,
      topGainers24h: topGainers,
      topLosers24h: topLosers,
    };

    const parsed = GlobalMarketSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `CoinGecko response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'global_market', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${config.baseUrl}/ping`, {
        signal: AbortSignal.timeout(5_000),
      });
      return {
        available: response.ok,
        latencyMs: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        available: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async fetchJSON<T>(
    url: string,
    headers: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status} for ${url}`);
    }
    return response.json() as Promise<T>;
  }
}

// ── CoinGecko response shapes ────────────────────────────────────────────────

interface CoinGeckoGlobalResponse {
  data: {
    active_cryptocurrencies: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
  };
}

interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
      name: string;
    };
  }>;
}

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number | null;
}
