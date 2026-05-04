import { Card, Badge, ProgressBar } from '@crypto-trader/ui';
import { useDataSourceStats } from '../../hooks/use-data-sources';
import { useTranslation } from 'react-i18next';
import { BarChart3, Zap, AlertTriangle, Shield } from 'lucide-react';

export function DataSourceMetrics() {
  const { t } = useTranslation();
  const { data, isLoading } = useDataSourceStats();

  if (isLoading || !data) return null;

  const { sources, circuitBreakers, cache, rateLimiter } = data;
  const sourcesWithMetrics = sources.filter(
    (s) => s.metrics && s.metrics.calls24h > 0,
  );
  const activeSources = sources.filter((s) => s.isActive);

  // Aggregate stats
  const totalCalls = sourcesWithMetrics.reduce(
    (sum, s) => sum + (s.metrics?.calls24h ?? 0),
    0,
  );
  const totalErrors = sourcesWithMetrics.reduce(
    (sum, s) => sum + (s.metrics?.failures24h ?? 0),
    0,
  );
  const avgLatency =
    sourcesWithMetrics.length > 0
      ? sourcesWithMetrics.reduce(
          (sum, s) => sum + (s.metrics?.avgLatencyMs ?? 0),
          0,
        ) / sourcesWithMetrics.length
      : 0;
  const globalErrorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;

  // Circuit breaker summary
  const openCircuits = Object.entries(circuitBreakers ?? {}).filter(
    ([, v]) => v.state === 'OPEN',
  );

  // Cache hit rate — backend returns { entries, sources[] }
  const cacheEntries = cache?.entries ?? 0;
  const cacheHitRate =
    activeSources.length > 0 ? (cacheEntries / activeSources.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            {t('admin.dataSources.metrics.totalCalls')}
          </div>
          <p className="text-lg font-bold tabular-nums">
            {totalCalls.toLocaleString()}
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <Zap className="h-3.5 w-3.5" />
            {t('admin.dataSources.metrics.avgLatency')}
          </div>
          <p className="text-lg font-bold tabular-nums">
            {avgLatency.toFixed(0)}ms
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('admin.dataSources.metrics.errorRate')}
          </div>
          <p
            className={`text-lg font-bold tabular-nums ${globalErrorRate > 10 ? 'text-red-400' : globalErrorRate > 5 ? 'text-yellow-400' : 'text-green-400'}`}
          >
            {globalErrorRate.toFixed(1)}%
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <Shield className="h-3.5 w-3.5" />
            {t('admin.dataSources.metrics.cacheHitRate')}
          </div>
          <p className="text-lg font-bold tabular-nums">
            {cacheHitRate.toFixed(0)}%
          </p>
        </Card>
      </div>

      {/* Per-source metrics table */}
      {activeSources.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            {t('admin.dataSources.metrics.perSource')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-700/50">
                  <th className="text-left py-1.5 font-medium">Source</th>
                  <th className="text-center py-1.5 font-medium">Status</th>
                  <th className="text-right py-1.5 font-medium">Calls</th>
                  <th className="text-right py-1.5 font-medium">Latency</th>
                  <th className="text-right py-1.5 font-medium">Error %</th>
                  <th className="text-left py-1.5 pl-3 font-medium w-28">
                    Uptime
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSources.map((s) => {
                  const m = s.metrics;
                  const errRate = m ? m.errorRate24h * 100 : 0;
                  const latency = m?.avgLatencyMs ?? 0;
                  const uptime =
                    m && m.calls24h > 0 ? m.uptimePercent.toFixed(1) : '—';
                  return (
                    <tr
                      key={s.name}
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      <td className="py-1.5 font-medium">{s.displayName}</td>
                      <td className="py-1.5 text-center">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            s.health === 'healthy'
                              ? 'bg-emerald-500'
                              : s.health === 'degraded'
                                ? 'bg-amber-500'
                                : s.health === 'down'
                                  ? 'bg-red-500'
                                  : 'bg-zinc-500'
                          }`}
                        />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {m ? m.calls24h : '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {m ? `${latency.toFixed(0)}ms` : '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {m ? (
                          <span
                            className={
                              errRate > 10
                                ? 'text-red-400'
                                : errRate > 5
                                  ? 'text-yellow-400'
                                  : 'text-green-400'
                            }
                          >
                            {errRate.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-1.5 pl-3">
                        {m && m.calls24h > 0 ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={parseFloat(uptime) || 0}
                              className="flex-1"
                            />
                            <span className="text-xs tabular-nums w-10 text-right">
                              {uptime}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Circuit breakers */}
      {openCircuits.length > 0 && (
        <Card className="p-4 border-red-500/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
            {t('admin.dataSources.metrics.openCircuits')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {openCircuits.map(([name, state]) => (
              <Badge
                key={name}
                variant="error"
                label={`${name} (${state.failures} failures)`}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
