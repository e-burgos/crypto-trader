import type {
  FearGreedData,
  DerivativesData,
  DefiHealthData,
  NewsWithSentiment,
  GlobalMarketData,
  PredictionData,
  TokenUnlockData,
} from '@crypto-trader/shared';

// ── Provider Interface ───────────────────────────────────────────────────────

/**
 * Every external data source implements this interface.
 * The registry calls `fetchData()` and reports success/error back.
 */
export interface IDataSourceProvider {
  /** Unique slug matching `DataSourceConfig.name` (e.g. "alternative_me") */
  readonly name: string;

  /** Human-readable label */
  readonly displayName: string;

  /** Category of data this provider returns */
  readonly category: DataSourceCategoryType;

  /**
   * Fetch data from the external API.
   * @param config — provider-specific configuration (baseUrl, rate limit, etc.)
   * @param apiKey — decrypted API key (undefined if source doesn't require one)
   * @returns A typed payload wrapper
   */
  fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload>;

  /**
   * Lightweight check to verify the source is reachable.
   */
  healthCheck(config: ProviderConfig): Promise<HealthCheckResult>;
}

// ── Supporting types ─────────────────────────────────────────────────────────

export type DataSourceCategoryType =
  | 'TECHNICAL'
  | 'SENTIMENT'
  | 'DERIVATIVES'
  | 'DEFI_ONCHAIN'
  | 'NEWS'
  | 'MARKET_DATA'
  | 'PREDICTION'
  | 'TOKEN_UNLOCKS';

export interface ProviderConfig {
  baseUrl: string;
  rateLimitPerMin: number;
  pollingIntervalMs: number;
}

export type DataSourcePayload =
  | { type: 'fear_greed'; data: FearGreedData }
  | { type: 'derivatives'; data: DerivativesData }
  | { type: 'defi_health'; data: DefiHealthData }
  | { type: 'news'; data: NewsWithSentiment[] }
  | { type: 'global_market'; data: GlobalMarketData }
  | { type: 'predictions'; data: PredictionData[] }
  | { type: 'token_unlocks'; data: TokenUnlockData[] }
  | { type: 'indicators'; data: unknown };

export interface HealthCheckResult {
  available: boolean;
  latencyMs: number;
  error?: string;
}
