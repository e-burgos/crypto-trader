// ── Spec 40 — Market Data Sources Types ──────────────────────────────────────

/**
 * Enriched market snapshot built from multiple external data sources.
 * Fields are nullable — if a source is down or disabled, the snapshot
 * is still valid with the available data.
 */
export interface EnrichedMarketSnapshot {
  // Core (already exists in the trading pipeline)
  symbol: string;
  currentPrice: number;
  change24h: number;

  // External data sources (nullable — graceful degradation)
  fearGreed: FearGreedData | null;
  derivatives: DerivativesData | null;
  defiHealth: DefiHealthData | null;
  news: NewsWithSentiment[] | null;
  globalMarket: GlobalMarketData | null;
  predictions: PredictionData[] | null;
  tokenUnlocks: TokenUnlockData[] | null;
  technicalSignals: TechnicalSignalData[] | null;

  // Metadata
  activeSources: string[];
  failedSources: string[];
  snapshotBuildTimeMs: number;
  builtAt: string; // ISO timestamp
}

export interface FearGreedData {
  value: number; // 0-100
  classification: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: string;
  previousClose: number; // previous day value for trend detection
}

export interface DerivativesData {
  openInterest: number; // USD
  openInterestChange24h: number; // percentage
  fundingRate: number; // average across exchanges
  longShortRatio: number;
  liquidations24h: number; // USD
  liquidationsBuy24h: number;
  liquidationsSell24h: number;
  cvd: number; // Cumulative Volume Delta
}

export interface DefiHealthData {
  totalTvl: number; // Global DeFi TVL in USD
  tvlChange24h: number;
  tvlChange7d: number;
  stablecoinMcap: number;
  stablecoinChange24h: number;
  stablecoinChange7d: number;
  dominantChain?: string; // e.g. "ethereum" — derived from TVL data
}

export interface NewsWithSentiment {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: number; // -1 to 1 (negative to positive)
  sentimentLabel: string; // "positive" | "negative" | "neutral"
  relatedSymbols: string[]; // ["BTC", "ETH"]
  relevanceScore?: number; // 0-1, how relevant to the queried symbol
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  marketCapChange24h?: number;
  trendingCoins: string[];
  topGainers24h: string[];
  topLosers24h: string[];
}

export interface PredictionData {
  question: string; // "Will BTC reach $100k by June?"
  probability: number; // 0-1
  volume: number; // USD traded
  source: string; // "polymarket"
  endDate: string;
  url?: string; // link to the prediction market
}

export interface TokenUnlockData {
  symbol: string;
  unlockDate: string;
  unlockAmountUsd: number;
  percentOfCirculating: number;
  type: string; // "cliff" | "linear" | "team" | "investor"
}

export interface TechnicalSignalData {
  symbol: string;
  symbolName: string;
  signalName: string;
  direction: string; // "BUY" | "SELL" | "NEUTRAL"
  lastPrice: number;
  priceChange: number;
  timestamp: string;
}

// ── Data Source Config types (shared between API and frontend) ────────────────

export type DataSourceCategoryType =
  | 'TECHNICAL'
  | 'SENTIMENT'
  | 'DERIVATIVES'
  | 'DEFI_ONCHAIN'
  | 'NEWS'
  | 'MARKET_DATA'
  | 'PREDICTION'
  | 'TOKEN_UNLOCKS';

export interface DataSourceStatus {
  id: string;
  name: string;
  displayName: string;
  category: DataSourceCategoryType;
  isActive: boolean;
  priority: number;
  targetAgents: string[];
  requiresApiKey: boolean;
  baseUrl: string;
  rateLimitPerMin: number;
  pollingIntervalMs: number;
  monthlyCostUsd: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveErrors: number;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  hasUserCredential?: boolean;
}

export interface DataSourceHealthResult {
  name: string;
  available: boolean;
  latencyMs: number;
  error?: string;
}

export interface DataSourceToggleResult {
  id: string;
  name: string;
  isActive: boolean;
  toggledAt: string;
  toggledBy: string;
}
