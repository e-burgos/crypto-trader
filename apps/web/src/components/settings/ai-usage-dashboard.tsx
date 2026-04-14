import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, Loader2 } from 'lucide-react';
import {
  useLLMUsageStats,
  type LLMUsageByProvider,
  type LLMUsageByModel,
} from '../../hooks/use-llm';

type Period = '7d' | '30d' | '90d';

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AIUsageDashboard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('30d');
  const { data, isLoading, isError } = useLLMUsageStats(period);

  if (isError) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">
            {t('settings.aiUsage', 'AI Usage & Costs')}
          </h2>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data ||
        (data.totalInputTokens === 0 && data.totalOutputTokens === 0) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t(
            'settings.noUsageData',
            'No usage data yet. Start using AI features to see stats here.',
          )}
        </p>
      ) : (
        <>
          {/* Totals summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {t('settings.totalCost', 'Total Cost')}
              </p>
              <p className="text-lg font-semibold">
                {formatCost(data.totalCostUsd)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {t('settings.requests', 'Requests')}
              </p>
              <p className="text-lg font-semibold">
                {data.byProvider.reduce((a, p) => a + p.callCount, 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {t('settings.inputTokens', 'Input Tokens')}
              </p>
              <p className="text-lg font-semibold">
                {formatTokens(data.totalInputTokens)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {t('settings.outputTokens', 'Output Tokens')}
              </p>
              <p className="text-lg font-semibold">
                {formatTokens(data.totalOutputTokens)}
              </p>
            </div>
          </div>

          {/* Per-provider breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">
                    {t('settings.provider', 'Provider')}
                  </th>
                  <th className="pb-2 font-medium">
                    {t('settings.model', 'Model')}
                  </th>
                  <th className="pb-2 text-right font-medium">
                    {t('settings.requests', 'Requests')}
                  </th>
                  <th className="pb-2 text-right font-medium">
                    {t('settings.tokensLabel', 'Tokens')}
                  </th>
                  <th className="pb-2 text-right font-medium">
                    {t('settings.cost', 'Cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byProvider.flatMap((prov: LLMUsageByProvider) =>
                  prov.byModel.map((model: LLMUsageByModel, i: number) => (
                    <tr
                      key={`${prov.provider}-${model.model}-${i}`}
                      className="border-b border-border/50"
                    >
                      <td className="py-2 font-medium">
                        {i === 0 ? prov.label : ''}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {model.label}
                      </td>
                      <td className="py-2 text-right">{model.callCount}</td>
                      <td className="py-2 text-right">
                        {formatTokens(model.inputTokens + model.outputTokens)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCost(model.costUsd)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          {/* Daily mini-chart (simple bar chart with CSS) */}
          {data.dailySeries.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {t('settings.dailyCosts', 'Daily Costs')}
              </div>
              <div className="flex h-16 items-end gap-px">
                {data.dailySeries.map((d) => {
                  const maxCost = Math.max(
                    ...data.dailySeries.map((dd) => dd.costUsd),
                  );
                  const pct = maxCost > 0 ? (d.costUsd / maxCost) * 100 : 0;
                  return (
                    <div
                      key={d.date}
                      className="group relative flex-1 rounded-t bg-primary/60 transition-colors hover:bg-primary"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={`${d.date}: ${formatCost(d.costUsd)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
