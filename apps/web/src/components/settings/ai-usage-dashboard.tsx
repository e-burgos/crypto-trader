import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  Loader2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  useLLMUsageStats,
  type LLMUsageByProvider,
  type LLMUsageByModel,
} from '../../hooks/use-llm';

type Period = '7d' | '30d' | '90d';

/* ── Palette per provider (hex for recharts) ── */
const PROVIDER_HEX: Record<string, string> = {
  CLAUDE: '#fb923c',
  OPENAI: '#34d399',
  GROQ: '#a78bfa',
  GEMINI: '#60a5fa',
  MISTRAL: '#f97316',
  TOGETHER: '#22d3ee',
};

const FALLBACK_COLORS = [
  '#fb923c',
  '#34d399',
  '#a78bfa',
  '#60a5fa',
  '#f97316',
  '#22d3ee',
  '#f472b6',
  '#facc15',
];

function getProviderColor(provider: string, idx: number): string {
  return (
    PROVIDER_HEX[provider] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
  );
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/* ── Custom recharts tooltips ── */
function DailyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        Cost:{' '}
        <span className="font-semibold text-primary">
          {formatCost(payload[0].value)}
        </span>
      </p>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
  isCost,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { fill: string; percent: number };
  }>;
  isCost?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = ((item.payload.percent ?? 0) * 100).toFixed(1);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="text-xs font-medium text-foreground">{item.name}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {isCost ? formatCost(item.value) : formatTokens(item.value)} ({pct}%)
      </p>
    </div>
  );
}

function PieLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Period selector ── */
function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border p-0.5">
      {(['7d', '30d', '90d'] as Period[]).map((p) => (
        <button
          key={p}
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

/* ════════════════════════════════════════════════════════
   Main component — 3 cards
   ════════════════════════════════════════════════════════ */
export function AIUsageDashboard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('30d');
  const { data, isLoading, isError } = useLLMUsageStats(period);

  const pieData = useMemo(() => {
    if (!data?.byProvider.length) return { tokens: [], cost: [] };
    return {
      tokens: data.byProvider
        .filter((p) => p.inputTokens + p.outputTokens > 0)
        .map((p, i) => ({
          name: p.label,
          value: p.inputTokens + p.outputTokens,
          fill: getProviderColor(p.provider, i),
        })),
      cost: data.byProvider
        .filter((p) => p.costUsd > 0)
        .map((p, i) => ({
          name: p.label,
          value: p.costUsd,
          fill: getProviderColor(p.provider, i),
        })),
    };
  }, [data]);

  const dailyData = useMemo(() => {
    if (!data?.dailySeries.length) return [];
    return data.dailySeries.map((d) => ({
      date: formatDate(d.date),
      fullDate: d.date,
      cost: d.costUsd,
    }));
  }, [data]);

  if (isError) return null;

  const hasData =
    data && (data.totalInputTokens > 0 || data.totalOutputTokens > 0);

  return (
    <div className="space-y-4">
      {/* ════ Card 1: Summary + Provider Table ════ */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">
              {t('settings.aiUsage', 'AI Usage & Costs')}
            </h2>
          </div>
          <PeriodSelector period={period} onChange={setPeriod} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t(
              'settings.noUsageData',
              'No usage data yet. Start using AI features to see stats here.',
            )}
          </p>
        ) : (
          <>
            {/* Totals */}
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
                  {data.byProvider.reduce(
                    (a: number, p: LLMUsageByProvider) => a + p.callCount,
                    0,
                  )}
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

            {/* Provider table */}
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
                          {i === 0 ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor: getProviderColor(
                                    prov.provider,
                                    data.byProvider.indexOf(prov),
                                  ),
                                }}
                              />
                              {prov.label}
                            </div>
                          ) : (
                            ''
                          )}
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
          </>
        )}
      </div>

      {/* ════ Card 2: Daily Costs Bar Chart ════ */}
      {hasData && dailyData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">
              {t('settings.dailyCosts', 'Daily Costs')}
            </h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyData}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) => formatCost(v)}
                  width={52}
                />
                <Tooltip
                  content={<DailyTooltip />}
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                />
                <Bar
                  dataKey="cost"
                  radius={[4, 4, 0, 0]}
                  fill="hsl(var(--primary))"
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ════ Card 3: Provider Distribution (Pie Charts) ════ */}
      {hasData && (pieData.tokens.length > 0 || pieData.cost.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">
              {t('settings.providerDistribution', 'Provider Distribution')}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Tokens pie */}
            {pieData.tokens.length > 0 && (
              <div>
                <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                  {t('settings.tokensByProvider', 'Tokens by Provider')}
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData.tokens}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {pieData.tokens.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend content={<PieLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Cost pie */}
            {pieData.cost.length > 0 && (
              <div>
                <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
                  {t('settings.costByProvider', 'Cost by Provider')}
                </p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData.cost}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {pieData.cost.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip isCost />} />
                      <Legend content={<PieLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
