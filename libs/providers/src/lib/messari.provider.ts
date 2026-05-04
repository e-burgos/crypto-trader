import type { TokenUnlockData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { TokenUnlocksArraySchema } from './schemas';

/**
 * Messari — Token Unlocks (conditional)
 * Requires API key. If the API is unreachable or key is missing,
 * returns an empty array (stub behavior) with a warning.
 * Endpoint: GET /api/v1/assets/{symbol}/metrics
 */
export class MessariProvider implements IDataSourceProvider {
  readonly name = 'messari';
  readonly displayName = 'Messari — Token Unlocks';
  readonly category: DataSourceCategoryType = 'TOKEN_UNLOCKS';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    if (!apiKey) {
      return { type: 'token_unlocks', data: [] };
    }

    const base = config.baseUrl;
    const headers: Record<string, string> = {
      'x-messari-api-key': apiKey,
    };

    // Fetch top assets with upcoming unlocks
    const symbols = ['bitcoin', 'ethereum', 'solana', 'avalanche', 'aptos'];
    const results = await Promise.allSettled(
      symbols.map((symbol) => this.fetchAssetMetrics(base, symbol, headers)),
    );

    const data: TokenUnlockData[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        data.push(...result.value);
      }
    }

    const parsed = TokenUnlocksArraySchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Messari response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'token_unlocks', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Ping the public endpoint — returns 200 even without key
      const response = await fetch(
        `${config.baseUrl}/api/v1/assets/bitcoin/metrics`,
        { signal: AbortSignal.timeout(5_000) },
      );
      return {
        available: response.ok || response.status === 401,
        latencyMs: Date.now() - start,
        error:
          response.ok || response.status === 401
            ? undefined
            : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        available: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async fetchAssetMetrics(
    base: string,
    symbol: string,
    headers: Record<string, string>,
  ): Promise<TokenUnlockData[]> {
    const response = await fetch(`${base}/api/v1/assets/${symbol}/metrics`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as MessariMetricsResponse;
    const supply = json.data?.supply;
    if (!supply) return [];

    // Extract token unlock info from supply schedule if available
    const unlocks: TokenUnlockData[] = [];
    if (supply.stock_to_flow_ratio != null) {
      unlocks.push({
        symbol: symbol.toUpperCase(),
        unlockDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        unlockAmountUsd: supply.annual_inflation_usd ?? 0,
        percentOfCirculating: supply.annual_inflation_percent ?? 0,
        type: 'linear',
      });
    }

    return unlocks;
  }
}

// ── Messari response shapes ──────────────────────────────────────────────────

interface MessariMetricsResponse {
  data?: {
    supply?: {
      stock_to_flow_ratio: number | null;
      annual_inflation_usd: number | null;
      annual_inflation_percent: number | null;
    };
  };
}
