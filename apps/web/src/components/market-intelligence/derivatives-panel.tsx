import { useTranslation } from 'react-i18next';
import { InfoCard } from '@crypto-trader/ui';
import type { InfoCardColumn } from '@crypto-trader/ui';
import { TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import type { DerivativesData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getDerivativesInfo } from './data-source-info-content';

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(3)}%`;
}

export function DerivativesPanel({ data }: { data: DerivativesData | null }) {
  const { t } = useTranslation();

  if (!data) return null;

  const longPct = (data.longShortRatio / (data.longShortRatio + 1)) * 100;
  const shortPct = 100 - longPct;

  // Chart data for liquidations comparison
  const liqData = [
    { name: 'Longs', value: data.liquidationsBuy24h, fill: '#10b981' },
    { name: 'Shorts', value: data.liquidationsSell24h, fill: '#ef4444' },
  ];

  const columns: InfoCardColumn[] = [
    {
      key: 'ratio',
      label: t('marketIntelligence.derivatives.longShort', 'Long / Short'),
      icon: <TrendingUp className="h-3 w-3" />,
      accent: 'bg-emerald-500',
      accentText: 'text-emerald-400',
      items: [
        {
          label: 'Long',
          value: `${longPct.toFixed(1)}%`,
          color: 'text-emerald-400',
        },
        {
          label: 'Short',
          value: `${shortPct.toFixed(1)}%`,
          color: 'text-red-400',
        },
        {
          label: 'Ratio',
          value: `${data.longShortRatio.toFixed(2)}`,
        },
      ],
    },
    {
      key: 'metrics',
      label: t('marketIntelligence.derivatives.metrics', 'Metrics'),
      accent: 'bg-sky-500',
      accentText: 'text-sky-400',
      items: [
        {
          label: t('marketIntelligence.derivatives.openInterest'),
          value: fmt(data.openInterest),
        },
        {
          label: t('marketIntelligence.derivatives.oiChange24h'),
          value: pct(data.openInterestChange24h),
          color:
            data.openInterestChange24h >= 0
              ? 'text-emerald-400'
              : 'text-red-400',
        },
        {
          label: t('marketIntelligence.derivatives.fundingRate'),
          value: pct(data.fundingRate),
          color: data.fundingRate >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: t('marketIntelligence.derivatives.liquidations24h'),
          value: fmt(data.liquidations24h),
        },
      ],
    },
    {
      key: 'liquidations',
      label: t(
        'marketIntelligence.derivatives.liquidationBreakdown',
        'Liquidations',
      ),
      accent: 'bg-rose-500',
      accentText: 'text-rose-400',
      items: [
        {
          label: 'Longs Liq.',
          value: fmt(data.liquidationsBuy24h),
          color: 'text-emerald-400',
        },
        {
          label: 'Shorts Liq.',
          value: fmt(data.liquidationsSell24h),
          color: 'text-red-400',
        },
      ],
    },
  ];

  return (
    <InfoCard
      icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.derivatives.title')}
      subtitle="Coinalyze — Aggregated derivatives"
      headerRight={
        <DataSourceInfoButton
          title="Derivatives"
          tabs={getDerivativesInfo(t)}
        />
      }
      columns={columns}
      gridCols={3}
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="coinalyze" />
        </div>
      }
    >
      {/* Visual charts */}
      <div className="space-y-3 border-t border-border/30 pt-3">
        {/* Long/Short ratio bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-emerald-400 font-semibold">
              Long {longPct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground font-mono text-[10px]">
              L/S {data.longShortRatio.toFixed(2)}
            </span>
            <span className="text-red-400 font-semibold">
              Short {shortPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${shortPct}%` }}
            />
          </div>
        </div>

        {/* Liquidations horizontal bar chart */}
        <div className="h-14">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={liqData} layout="vertical" barSize={12}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={42}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="rounded bg-popover border border-border px-2 py-1 text-xs shadow-md">
                      {payload[0].payload.name}:{' '}
                      {fmt(payload[0].value as number)}
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {liqData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </InfoCard>
  );
}
