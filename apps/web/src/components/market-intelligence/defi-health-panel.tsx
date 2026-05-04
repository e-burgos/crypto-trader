import { useTranslation } from 'react-i18next';
import { InfoCard } from '@crypto-trader/ui';
import type { InfoCardColumn } from '@crypto-trader/ui';
import { Shield } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import type { DefiHealthData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getDefiHealthInfo } from './data-source-info-content';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000_000_000)
    return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function pctStr(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function changeColor(n: number): string {
  if (n > 0) return '#10b981';
  if (n < 0) return '#ef4444';
  return '#6b7280';
}

export function DefiHealthPanel({ data }: { data: DefiHealthData | null }) {
  const { t } = useTranslation();

  if (!data) return null;

  // Bar chart data: changes comparison
  const changesData = [
    {
      name: 'TVL 24h',
      value: data.tvlChange24h,
      fill: changeColor(data.tvlChange24h),
    },
    {
      name: 'TVL 7d',
      value: data.tvlChange7d,
      fill: changeColor(data.tvlChange7d),
    },
    {
      name: 'Stable 24h',
      value: data.stablecoinChange24h,
      fill: changeColor(data.stablecoinChange24h),
    },
    {
      name: 'Stable 7d',
      value: data.stablecoinChange7d,
      fill: changeColor(data.stablecoinChange7d),
    },
  ];

  const columns: InfoCardColumn[] = [
    {
      key: 'tvl',
      label: 'TVL',
      icon: <Shield className="h-3 w-3" />,
      accent: 'bg-violet-500',
      accentText: 'text-violet-400',
      items: [
        {
          label: t('marketIntelligence.defi.totalTvl'),
          value: fmtUsd(data.totalTvl),
        },
        {
          label: '24h Change',
          value: pctStr(data.tvlChange24h),
          color: data.tvlChange24h >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: '7d Change',
          value: pctStr(data.tvlChange7d),
          color: data.tvlChange7d >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
      ],
    },
    {
      key: 'stablecoins',
      label: 'Stablecoins',
      accent: 'bg-sky-500',
      accentText: 'text-sky-400',
      items: [
        {
          label: t('marketIntelligence.defi.stablecoinMcap'),
          value: fmtUsd(data.stablecoinMcap),
        },
        {
          label: '24h Change',
          value: pctStr(data.stablecoinChange24h),
          color:
            data.stablecoinChange24h >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: '7d Change',
          value: pctStr(data.stablecoinChange7d),
          color:
            data.stablecoinChange7d >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        ...(data.dominantChain
          ? [
              {
                label: t('marketIntelligence.defi.dominantChain', 'Top Chain'),
                value: data.dominantChain,
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <InfoCard
      icon={<Shield className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.defi.title')}
      subtitle="DeFiLlama — TVL & stablecoins"
      headerRight={
        <DataSourceInfoButton title="DeFi Health" tabs={getDefiHealthInfo(t)} />
      }
      columns={columns}
      gridCols={2}
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="defillama" />
        </div>
      }
    >
      {/* % Changes bar chart */}
      <div className="border-t border-border/30 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          % Changes Overview
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={changesData} barSize={16}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const val = payload[0].value as number;
                  return (
                    <div className="rounded bg-popover border border-border px-2 py-1 text-xs shadow-md">
                      {payload[0].payload.name}: {val > 0 ? '+' : ''}
                      {val.toFixed(2)}%
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {changesData.map((entry, i) => (
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
