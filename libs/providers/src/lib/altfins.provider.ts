import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';

/**
 * altFINS — Pre-calculated Technical Analysis + Signals
 * Requires API key. If key not available, returns indicators stub
 * so the snapshot falls back to the internal calculateIndicatorSnapshot().
 * Endpoint: POST /api/v2/public/signals-feed/search-requests
 * Auth: X-API-KEY header
 */
export class AltFinsProvider implements IDataSourceProvider {
  readonly name = 'altfins';
  readonly displayName = 'altFINS — TA Pre-calculado + Señales';
  readonly category: DataSourceCategoryType = 'TECHNICAL';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    if (!apiKey) {
      // Without API key, return empty indicators so the system
      // falls back to the internal calculation pipeline
      return { type: 'indicators', data: null };
    }

    const base = config.baseUrl;
    const headers: Record<string, string> = {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(
      `${base}/api/v2/public/signals-feed/search-requests?page=0&size=20`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`altFINS returned ${response.status}`);
    }

    const json = (await response.json()) as AltFinsSignalsResponse;

    return {
      type: 'indicators',
      data: {
        signals: json.content ?? [],
        source: 'altfins',
      },
    };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(
        `${config.baseUrl}/api/v2/public/signals-feed/search-requests?page=0&size=1`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5_000),
        },
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
}

// ── altFINS response shapes ──────────────────────────────────────────────────

interface AltFinsSignalItem {
  timestamp: string;
  direction: string;
  signalKey: string;
  signalName: string;
  symbol: string;
  lastPrice: string;
  marketCap: string;
  priceChange: string;
  symbolName: string;
}

interface AltFinsSignalsResponse {
  content?: AltFinsSignalItem[];
  totalElements?: number;
  totalPages?: number;
}
