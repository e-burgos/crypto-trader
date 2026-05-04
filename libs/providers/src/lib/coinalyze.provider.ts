import type { DerivativesData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { DerivativesSchema } from './schemas';

/**
 * Coinalyze — Aggregated Derivatives Data
 * Free tier, no API key required.
 * Endpoints:
 *   - GET /v1/open-interest?symbols=BTCUSD_PERP.A
 *   - GET /v1/funding-rate?symbols=BTCUSD_PERP.A
 *   - GET /v1/liquidation?symbols=BTCUSD_PERP.A
 *   - GET /v1/long-short-ratio?symbols=BTCUSD_PERP.A
 */
export class CoinalyzeProvider implements IDataSourceProvider {
  readonly name = 'coinalyze';
  readonly displayName = 'Coinalyze — Derivados Agregados';
  readonly category: DataSourceCategoryType = 'DERIVATIVES';

  // TODO: Make symbol configurable via ProviderConfig or fetchData param
  // so derivatives data matches the asset the bot is trading (ETH, SOL, etc.)
  private static readonly SYMBOL = 'BTCUSD_PERP.A';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    if (!apiKey) {
      throw new Error('Coinalyze requires an API key');
    }

    const base = config.baseUrl;
    const sym = CoinalyzeProvider.SYMBOL;
    const headers: Record<string, string> = { api_key: apiKey };

    // History endpoints require from/to timestamps (unix seconds)
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86_400;
    const historyParams = `interval=daily&from=${oneDayAgo}&to=${now}`;

    const [oiRes, frRes, liqRes, lsRes] = await Promise.all([
      this.fetchJSON<CoinalyzeOI[]>(
        `${base}/v1/open-interest?symbols=${sym}`,
        headers,
      ),
      this.fetchJSON<CoinalyzeFR[]>(
        `${base}/v1/funding-rate?symbols=${sym}`,
        headers,
      ),
      this.fetchJSON<CoinalyzeLiqHistory[]>(
        `${base}/v1/liquidation-history?symbols=${sym}&${historyParams}`,
        headers,
      ),
      this.fetchJSON<CoinalyzeLSHistory[]>(
        `${base}/v1/long-short-ratio-history?symbols=${sym}&${historyParams}`,
        headers,
      ),
    ]);

    const oi = oiRes[0];
    const fr = frRes[0];
    const liqHistory = liqRes[0]?.history?.[0];
    const lsHistory = lsRes[0]?.history?.[0];

    const data: DerivativesData = {
      openInterest: oi?.value ?? 0,
      openInterestChange24h: oi?.change24h ?? 0,
      fundingRate: fr?.value ?? 0,
      longShortRatio: lsHistory?.r ?? 1,
      liquidations24h: (liqHistory?.l ?? 0) + (liqHistory?.s ?? 0),
      liquidationsBuy24h: liqHistory?.l ?? 0,
      liquidationsSell24h: liqHistory?.s ?? 0,
      cvd: 0, // CVD not directly exposed in free tier
    };

    const parsed = DerivativesSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Coinalyze response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'derivatives', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(
        `${config.baseUrl}/v1/open-interest?symbols=${CoinalyzeProvider.SYMBOL}`,
        { signal: AbortSignal.timeout(5_000) },
      );
      // 401 means the server is reachable but requires API key — still "available"
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

  private async fetchJSON<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Coinalyze returned ${response.status} for ${url}`);
    }
    return response.json() as Promise<T>;
  }
}

// ── Coinalyze response shapes ────────────────────────────────────────────────

interface CoinalyzeOI {
  symbol: string;
  value: number;
  change24h: number;
}

interface CoinalyzeFR {
  symbol: string;
  value: number;
}

interface CoinalyzeLiqHistory {
  symbol: string;
  history: Array<{ t: number; l: number; s: number }>;
}

interface CoinalyzeLSHistory {
  symbol: string;
  history: Array<{ t: number; r: number; l: number; s: number }>;
}
