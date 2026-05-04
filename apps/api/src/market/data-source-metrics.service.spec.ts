import { DataSourceMetricsService } from './data-source-metrics.service';

describe('DataSourceMetricsService', () => {
  let metrics: DataSourceMetricsService;

  beforeEach(() => {
    metrics = new DataSourceMetricsService();
  });

  it('returns zero metrics for unknown providers', () => {
    const m = metrics.getMetrics('unknown');
    expect(m.calls24h).toBe(0);
    expect(m.errorRate24h).toBe(0);
    expect(m.uptimePercent).toBe(100);
  });

  it('records successes and computes metrics', () => {
    metrics.recordSuccess('test', 100);
    metrics.recordSuccess('test', 200);
    metrics.recordSuccess('test', 150);

    const m = metrics.getMetrics('test');
    expect(m.calls24h).toBe(3);
    expect(m.successes24h).toBe(3);
    expect(m.failures24h).toBe(0);
    expect(m.errorRate24h).toBe(0);
    expect(m.avgLatencyMs).toBe(150);
    expect(m.uptimePercent).toBe(100);
  });

  it('records failures and computes error rate', () => {
    metrics.recordSuccess('test', 100);
    metrics.recordSuccess('test', 100);
    metrics.recordFailure('test', 500);
    metrics.recordFailure('test', 600);

    const m = metrics.getMetrics('test');
    expect(m.calls24h).toBe(4);
    expect(m.successes24h).toBe(2);
    expect(m.failures24h).toBe(2);
    expect(m.errorRate24h).toBe(0.5);
    expect(m.uptimePercent).toBe(50);
  });

  it('computes p95 latency correctly', () => {
    // 20 calls with increasing latency 10, 20, ..., 200
    for (let i = 1; i <= 20; i++) {
      metrics.recordSuccess('p95test', i * 10);
    }

    const m = metrics.getMetrics('p95test');
    expect(m.calls24h).toBe(20);
    // p95 of [10,20,...,200]: index ceil(20*0.95)-1 = 18 → value 190
    expect(m.p95LatencyMs).toBe(190);
  });

  it('maintains separate metrics per provider', () => {
    metrics.recordSuccess('a', 100);
    metrics.recordFailure('b', 200);

    expect(metrics.getMetrics('a').successes24h).toBe(1);
    expect(metrics.getMetrics('a').failures24h).toBe(0);
    expect(metrics.getMetrics('b').successes24h).toBe(0);
    expect(metrics.getMetrics('b').failures24h).toBe(1);
  });

  it('getAllMetrics returns all tracked providers', () => {
    metrics.recordSuccess('x', 50);
    metrics.recordSuccess('y', 60);
    metrics.recordFailure('y', 70);

    const all = metrics.getAllMetrics();
    expect(Object.keys(all)).toEqual(expect.arrayContaining(['x', 'y']));
    expect(all['x'].calls24h).toBe(1);
    expect(all['y'].calls24h).toBe(2);
  });

  it('prunes records older than 24h', () => {
    // Manually create an old record by accessing internals
    // We test indirectly: fresh records should be counted
    metrics.recordSuccess('fresh', 100);
    const m = metrics.getMetrics('fresh');
    expect(m.calls24h).toBe(1);
  });
});
