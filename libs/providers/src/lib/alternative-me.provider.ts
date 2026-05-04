import type { FearGreedData } from '@crypto-trader/shared';
import type {
  IDataSourceProvider,
  ProviderConfig,
  DataSourcePayload,
  HealthCheckResult,
  DataSourceCategoryType,
} from './data-source.interface';
import { FearGreedSchema } from './schemas';

/**
 * Alternative.me — Fear & Greed Index
 * Free, no API key required.
 * Endpoint: GET https://api.alternative.me/fng/?limit=2
 */
export class AlternativeMeProvider implements IDataSourceProvider {
  readonly name = 'alternative_me';
  readonly displayName = 'Alternative.me — Fear & Greed Index';
  readonly category: DataSourceCategoryType = 'SENTIMENT';

  async fetchData(config: ProviderConfig): Promise<DataSourcePayload> {
    const url = `${config.baseUrl}/fng/?limit=2`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Alternative.me returned ${response.status}`);
    }

    const json = (await response.json()) as {
      data: Array<{
        value: string;
        value_classification: string;
        timestamp: string;
      }>;
    };

    if (!json.data || json.data.length === 0) {
      throw new Error('Alternative.me returned empty data array');
    }

    const [current, previous] = json.data;

    const data: FearGreedData = {
      value: Number(current.value),
      classification: current.value_classification,
      timestamp: current.timestamp,
      previousClose: previous ? Number(previous.value) : Number(current.value),
    };

    const parsed = FearGreedSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Alternative.me response validation failed: ${parsed.error.message}`,
      );
    }

    return { type: 'fear_greed', data: parsed.data };
  }

  async healthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${config.baseUrl}/fng/?limit=1`, {
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
}
