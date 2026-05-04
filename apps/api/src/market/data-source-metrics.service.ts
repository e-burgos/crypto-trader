import { Injectable } from '@nestjs/common';

interface CallRecord {
  timestamp: number;
  latencyMs: number;
  success: boolean;
}

export interface ProviderMetrics {
  calls24h: number;
  successes24h: number;
  failures24h: number;
  errorRate24h: number; // 0-1
  avgLatencyMs: number;
  p95LatencyMs: number;
  uptimePercent: number; // 0-100
}

const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * In-memory metrics collector for data source providers.
 * Tracks calls, latency, and error rates over a rolling 24h window.
 * Records are pruned on each read to avoid unbounded memory growth.
 */
@Injectable()
export class DataSourceMetricsService {
  private readonly records = new Map<string, CallRecord[]>();

  /**
   * Record a successful call.
   */
  recordSuccess(name: string, latencyMs: number): void {
    this.push(name, { timestamp: Date.now(), latencyMs, success: true });
  }

  /**
   * Record a failed call.
   */
  recordFailure(name: string, latencyMs: number): void {
    this.push(name, { timestamp: Date.now(), latencyMs, success: false });
  }

  /**
   * Get metrics for a specific provider over the last 24h.
   */
  getMetrics(name: string): ProviderMetrics {
    const records = this.prune(name);
    if (records.length === 0) {
      return {
        calls24h: 0,
        successes24h: 0,
        failures24h: 0,
        errorRate24h: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        uptimePercent: 100,
      };
    }

    const successes = records.filter((r) => r.success);
    const failures = records.filter((r) => !r.success);

    const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgLatency =
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Index = Math.min(
      Math.ceil(latencies.length * 0.95) - 1,
      latencies.length - 1,
    );

    // Uptime: percentage of time the provider was "available"
    // = success calls / total calls (simplified — real uptime would need heartbeats)
    const uptimePercent =
      records.length > 0 ? (successes.length / records.length) * 100 : 100;

    return {
      calls24h: records.length,
      successes24h: successes.length,
      failures24h: failures.length,
      errorRate24h: records.length > 0 ? failures.length / records.length : 0,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: latencies[p95Index] ?? 0,
      uptimePercent: Math.round(uptimePercent * 10) / 10,
    };
  }

  /**
   * Get metrics for all tracked providers.
   */
  getAllMetrics(): Record<string, ProviderMetrics> {
    const result: Record<string, ProviderMetrics> = {};
    for (const name of this.records.keys()) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }

  private push(name: string, record: CallRecord): void {
    let list = this.records.get(name);
    if (!list) {
      list = [];
      this.records.set(name, list);
    }
    list.push(record);
  }

  /**
   * Remove records older than 24h and return the remaining ones.
   */
  private prune(name: string): CallRecord[] {
    const list = this.records.get(name);
    if (!list) return [];

    const cutoff = Date.now() - RETENTION_MS;
    const pruned = list.filter((r) => r.timestamp >= cutoff);
    this.records.set(name, pruned);
    return pruned;
  }
}
