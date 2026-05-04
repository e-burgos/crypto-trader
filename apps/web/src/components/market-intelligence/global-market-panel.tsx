import { useTranslation } from 'react-i18next';
import { InfoCard, Badge } from '@crypto-trader/ui';
import type { InfoCardColumn } from '@crypto-trader/ui';
import { BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { GlobalMarketData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getGlobalMarketInfo } from './data-source-info-content';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000_000_000)
    return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  return `$${n.toLocaleString()}`;
}

export function GlobalMarketPanel({ data }: { data: GlobalMarketData | null }) {
  const { t } = useTranslation();

  if (!data) return null;

  const otherDominance = Math.max(
    0,
    100 - data.btcDominance - data.ethDominance,
  );

  const dominanceData = [
    { name: 'BTC', value: data.btcDominance, color: '#f7931a' },
    { name: 'ETH', value: data.ethDominance, color: '#627eea' },
    { name: 'Alts', value: otherDominance, color: '#8b5cf6' },
  ];

  const columns: InfoCardColumn[] = [
    {
      key: 'overview',
      label: t('marketIntelligence.global.overview', 'Overview'),
      icon: <BarChart3 className="h-3 w-3" />,
      accent: 'bg-amber-500',
      accentText: 'text-amber-400',
      items: [
        { label: 'Market Cap', value: fmtUsd(data.totalMarketCap) },
        { label: 'Volume 24h', value: fmtUsd(data.totalVolume24h) },
        ...(data.marketCapChange24h != null
          ? [
              {
                label: 'Mcap Change 24h',
                value: `${data.marketCapChange24h >= 0 ? '+' : ''}${data.marketCapChange24h.toFixed(2)}%`,
                color:
                  data.marketCapChange24h >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400',
              },
            ]
          : []),
      ],
    },
    {
      key: 'dominance',
      label: t('marketIntelligence.global.dominance', 'Dominance'),
      accent: 'bg-orange-500',
      accentText: 'text-orange-400',
      items: [
        {
          label: 'BTC',
          value: `${data.btcDominance.toFixed(1)}%`,
          color: 'text-[#f7931a]',
        },
        {
          label: 'ETH',
          value: `${data.ethDominance.toFixed(1)}%`,
          color: 'text-[#627eea]',
        },
        {
          label: 'Alts',
          value: `${otherDominance.toFixed(1)}%`,
          color: 'text-violet-400',
        },
      ],
    },
    {
      key: 'movers',
      label: t('marketIntelligence.global.movers', 'Top Movers'),
      accent: 'bg-emerald-500',
      accentText: 'text-emerald-400',
      items: [
        ...data.topGainers24h.slice(0, 3).map((s) => ({
          label: '↑',
          value: s,
          color: 'text-emerald-400',
        })),
        ...data.topLosers24h.slice(0, 3).map((s) => ({
          label: '↓',
          value: s,
          color: 'text-red-400',
        })),
      ],
    },
  ];

  return (
    <InfoCard
      icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.global.title')}
      subtitle="CoinGecko — Global market data"
      headerRight={
        data.trendingCoins.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">🔥</span>
            {data.trendingCoins.slice(0, 3).map((coin) => (
              <Badge key={coin} variant="neutral" label={coin} />
            ))}
            <DataSourceInfoButton
              title="Global Market"
              tabs={getGlobalMarketInfo(t)}
            />
          </div>
        ) : (
          <DataSourceInfoButton
            title="Global Market"
            tabs={getGlobalMarketInfo(t)}
          />
        )
      }
      columns={columns}
      gridCols={3}
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="coingecko" />
        </div>
      }
    >
      {/* Dominance donut chart */}
      <div className="flex items-center gap-4 border-t border-border/30 pt-3">
        <div className="relative h-20 w-20 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dominanceData}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={36}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {dominanceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground">
              DOM
            </span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-1.5 text-xs">
          {dominanceData.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-bold font-mono tabular-nums ml-auto">
                {d.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </InfoCard>
  );
}
