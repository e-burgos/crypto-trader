import type { DefiHealthData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { DefiHealthSchema } from './schemas';

/**
 * DefiLlama — TVL, Stablecoins & Fees
 * Free, no API key required.
 * Endpoints:
 *   - GET /v2/historicalChainTvl (global TVL)
 *   - GET /stablecoins (stablecoin mcap)
 */
export class DefiLlamaProvider implements IDataSourceProvider {
  readonly name = 'defillama';
  readonly displayName = 'DefiLlama — TVL + Stablecoins + Fees';
  readonly category: DataSourceCategoryType = 'DEFI_ONCHAIN';

  async fetchData(
    config: ProviderConfig,
    _apiKey?: string,
  ): Promise<DataSourcePayload> {
    const base = config.baseUrl;

    // Stablecoins API lives on a different subdomain than the main API.
    // Derive it from baseUrl: "https://api.llama.fi" → "https://stablecoins.llama.fi"
    const stablecoinsBase = config.baseUrl.replace(
      '://api.llama.fi',
      '://stablecoins.llama.fi',
    );

    const [tvlHistory, stablecoins] = await Promise.all([
      this.fetchJSON<DefiLlamaTVLEntry[]>(`${base}/v2/historicalChainTvl`),
      this.fetchJSON<DefiLlamaStablecoinsResponse>(
        `${stablecoinsBase}/stablecoins?includePrices=true`,
      ),
    ]);

    // Compute TVL data from the last entries
    const latest = tvlHistory[tvlHistory.length - 1];
    const oneDayAgo = tvlHistory[tvlHistory.length - 2];
    const sevenDaysAgo = tvlHistory[tvlHistory.length - 8];

    const totalTvl = latest?.tvl ?? 0;
    const tvlChange24h = oneDayAgo?.tvl
      ? ((totalTvl - oneDayAgo.tvl) / oneDayAgo.tvl) * 100
      : 0;
    const tvlChange7d = sevenDaysAgo?.tvl
      ? ((totalTvl - sevenDaysAgo.tvl) / sevenDaysAgo.tvl) * 100
      : 0;

    // Compute stablecoin mcap from peggedAssets
    const stablecoinMcap = stablecoins.peggedAssets.reduce(
      (sum, s) => sum + (s.circulating?.peggedUSD ?? 0),
      0,
    );

    const data: DefiHealthData = {
      totalTvl,
      tvlChange24h,
      tvlChange7d,
      stablecoinMcap,
      stablecoinChange24h: 0, // Would need historical data — simplified
      stablecoinChange7d: 0,
    };

    const parsed = DefiHealthSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `DefiLlama response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'defi_health', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${config.baseUrl}/v2/historicalChainTvl`, {
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

  private async fetchJSON<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`DefiLlama returned ${response.status} for ${url}`);
    }
    return response.json() as Promise<T>;
  }
}

// ── DefiLlama response shapes ────────────────────────────────────────────────

interface DefiLlamaTVLEntry {
  date: number;
  tvl: number;
}

interface DefiLlamaStablecoinsResponse {
  peggedAssets: Array<{
    name: string;
    symbol: string;
    circulating?: { peggedUSD: number };
  }>;
}
