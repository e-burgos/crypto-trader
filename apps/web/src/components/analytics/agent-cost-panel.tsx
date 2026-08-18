import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState, Spinner } from '@crypto-trader/ui';
import {
  useAgentCosts,
  type AgentCostPeriod,
} from '../../hooks/use-agent-costs';

const PERIODS: AgentCostPeriod[] = ['7d', '30d', '90d'];

const BOT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#facc15',
];

const UNASSIGNED_KEY = '__unassigned__';

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(4)}`;
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: AgentCostPeriod;
  onChange: (p: AgentCostPeriod) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
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
  );
}

function TotalsStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AgentCostPanel() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<AgentCostPeriod>('30d');
  const { data, isLoading, isError } = useAgentCosts({ period });

  const botLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const bot of data?.byBot ?? []) {
      const key = bot.configId ?? UNASSIGNED_KEY;
      map.set(key, bot.configName ?? `${bot.asset}/${bot.pair}`);
    }
    return map;
  }, [data]);

  const botKeys = useMemo(
    () => (data?.byBot ?? []).map((bot) => bot.configId ?? UNASSIGNED_KEY),
    [data],
  );

  const chartData = useMemo(() => {
    return (data?.dailySeries ?? []).map((day) => {
      const row: Record<string, string | number> = { date: day.date };
      for (const bucket of day.byBot) {
        const key = bucket.configId ?? UNASSIGNED_KEY;
        row[key] = bucket.costUsd;
      }
      return row;
    });
  }, [data]);

  const hasData = !!data && data.decisions > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('analytics.agentCost.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('analytics.agentCost.subtitle')}
          </p>
        </div>
        <PeriodToggle period={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
          {t('analytics.agentCost.error')}
        </div>
      ) : !hasData ? (
        <EmptyState
          title={t('analytics.agentCost.noDataTitle')}
          description={t('analytics.agentCost.noDataDescription')}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TotalsStat
              label={t('analytics.agentCost.totalCost')}
              value={formatCost(data.costUsd)}
            />
            <TotalsStat
              label={t('analytics.agentCost.llmDecisions')}
              value={data.llmDecisions.toString()}
              sub={t('analytics.agentCost.llmDecisionsSub')}
            />
            <TotalsStat
              label={t('analytics.agentCost.gateDecisions')}
              value={data.gateDecisions.toString()}
              sub={t('analytics.agentCost.gateDecisionsSub')}
            />
            <TotalsStat
              label={t('analytics.agentCost.totalDecisions')}
              value={data.decisions.toString()}
            />
          </div>

          {data.unpricedDecisions > 0 && (
            <p className="mb-4 text-xs text-amber-500">
              {t('analytics.agentCost.unpricedNote', {
                count: data.unpricedDecisions,
              })}
            </p>
          )}

          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {t('analytics.agentCost.dailyChartTitle')}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 16, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(value, name) => [
                  formatCost(Number(value)),
                  botLabelByKey.get(String(name)) ?? String(name),
                ]}
              />
              {botKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="cost"
                  fill={BOT_COLORS[i % BOT_COLORS.length]}
                  radius={i === botKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableBot')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableMode')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableCost')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableDecisions')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableLlm')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t('analytics.agentCost.tableGate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byBot.map((bot) => (
                  <tr
                    key={bot.configId ?? `${bot.asset}-${bot.pair}-${bot.mode}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {bot.configName ?? `${bot.asset}/${bot.pair}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bot.mode}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCost(bot.costUsd)}
                    </td>
                    <td className="px-4 py-3 text-right">{bot.decisions}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {bot.llmDecisions}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {bot.gateDecisions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
