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
 * Messari — Token Unlocks
 * Uses the new Messari API (2025+): https://api.messari.io/token-unlocks/v1/...
 * Free tier: list of assets with upcoming unlocks (no API key needed).
 * Paid tier (x402): detailed events/unlocks per asset.
 *
 * NOTE: If an API key is provided but invalid, Messari returns 403.
 * Free endpoints work WITHOUT a key — we always call without key first,
 * and only use the key for paid endpoints if available.
 */
export class MessariProvider implements IDataSourceProvider {
  readonly name = 'messari';
  readonly displayName = 'Messari — Token Unlocks';
  readonly category: DataSourceCategoryType = 'TOKEN_UNLOCKS';

  async fetchData(
    config: ProviderConfig,
    apiKey?: string,
  ): Promise<DataSourcePayload> {
    const base = config.baseUrl;

    // Free endpoint: list assets with upcoming token unlocks (no key needed)
    const response = await fetch(
      `${base}/token-unlocks/v1/assets?hasUpcomingEvent=true&limit=30`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!response.ok) {
      throw new Error(`Messari token-unlocks API returned ${response.status}`);
    }

    const json = (await response.json()) as MessariTokenUnlocksListResponse;
    if (!json.data || json.data.length === 0) {
      throw new Error('Messari returned empty token unlocks list');
    }

    // If API key is provided, attempt to fetch detailed events for top assets
    // (paid endpoint — $0.15/req). If key is invalid we log a warning and
    // fall back to the free data only.
    let detailedUnlocks: TokenUnlockData[] = [];
    if (apiKey) {
      detailedUnlocks = await this.fetchDetailedEvents(
        base,
        json.data.slice(0, 5),
        apiKey,
      );
    }

    // If we got detailed data, use it; otherwise build from free metadata
    const data: TokenUnlockData[] =
      detailedUnlocks.length > 0
        ? detailedUnlocks
        : this.buildFromFreeData(json.data);

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
      // Health check uses free endpoint (no key needed)
      const response = await fetch(
        `${config.baseUrl}/token-unlocks/v1/assets?limit=1`,
        { signal: AbortSignal.timeout(5_000) },
      );
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

  /**
   * Attempt to fetch detailed unlock events using paid endpoint.
   * If the key is invalid (403), logs a warning and returns empty
   * so we gracefully fall back to free data.
   */
  private async fetchDetailedEvents(
    base: string,
    assets: MessariTokenUnlockAsset[],
    apiKey: string,
  ): Promise<TokenUnlockData[]> {
    const unlocks: TokenUnlockData[] = [];

    const results = await Promise.allSettled(
      assets.map(async (asset) => {
        const resp = await fetch(
          `${base}/token-unlocks/v1/assets/${asset.id}/events`,
          {
            headers: { 'x-messari-api-key': apiKey },
            signal: AbortSignal.timeout(8_000),
          },
        );

        if (resp.status === 403) {
          // Invalid or insufficient key — don't retry others
          throw new Error(
            'API key invalid or lacks permissions — using free data only',
          );
        }
        if (resp.status === 402) {
          // Payment required (x402) — key doesn't cover this
          throw new Error('Paid endpoint requires x402 payment');
        }
        if (!resp.ok) return null;

        const json = (await resp.json()) as { data?: MessariUnlockEvent[] };
        return { asset, events: json.data ?? [] };
      }),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { asset, events } = result.value;
      for (const evt of events.slice(0, 3)) {
        unlocks.push({
          symbol: asset.symbol.toUpperCase(),
          unlockDate: evt.date,
          unlockAmountUsd: evt.amountUsd ?? 0,
          percentOfCirculating: evt.percentOfCirculating ?? 0,
          type: evt.type ?? 'linear',
        });
      }
    }

    return unlocks;
  }

  /**
   * Build token unlock entries from free metadata (no detailed amounts,
   * but shows which assets have active vesting schedules).
   */
  private buildFromFreeData(
    assets: MessariTokenUnlockAsset[],
  ): TokenUnlockData[] {
    const now = new Date();
    return assets
      .filter((a) => {
        // Only include assets whose vesting hasn't ended
        if (!a.projectedEndDate) return false;
        return new Date(a.projectedEndDate) > now;
      })
      .slice(0, 20)
      .map((a) => ({
        symbol: a.symbol.toUpperCase(),
        unlockDate: a.projectedEndDate!,
        unlockAmountUsd: 0, // Not available in free tier
        percentOfCirculating: 0, // Not available in free tier
        type: 'linear',
      }));
  }
}

// ── Messari response shapes (new API 2025+) ─────────────────────────────────

interface MessariTokenUnlockAsset {
  id: string;
  symbol: string;
  name: string;
  genesisDate: string | null;
  projectedEndDate: string | null;
  slug: string;
  category: string;
  sector: string;
  tags: string[] | null;
}

interface MessariTokenUnlocksListResponse {
  data: MessariTokenUnlockAsset[] | null;
  error: string | null;
}

interface MessariUnlockEvent {
  date: string;
  amountUsd?: number;
  percentOfCirculating?: number;
  type?: string;
}
