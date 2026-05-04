import { useTranslation } from 'react-i18next';
import { InfoCard, Badge } from '@crypto-trader/ui';
import { Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { TechnicalSignalData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getTechnicalSignalsInfo } from './data-source-info-content';

function directionBadge(direction: string) {
  const d = direction.toUpperCase();
  if (d === 'BUY' || d === 'BULLISH')
    return <Badge variant="success" label={d} />;
  if (d === 'SELL' || d === 'BEARISH')
    return <Badge variant="error" label={d} />;
  return <Badge variant="neutral" label={d} />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function TechnicalSignalsPanel({
  data,
}: {
  data: TechnicalSignalData[] | null;
}) {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const buySignals = data.filter(
    (s) =>
      s.direction.toUpperCase() === 'BUY' ||
      s.direction.toUpperCase() === 'BULLISH',
  ).length;
  const sellSignals = data.filter(
    (s) =>
      s.direction.toUpperCase() === 'SELL' ||
      s.direction.toUpperCase() === 'BEARISH',
  ).length;

  const neutralSignals = data.length - buySignals - sellSignals;

  const donutData = [
    { name: 'Buy', value: buySignals, color: '#10b981' },
    { name: 'Sell', value: sellSignals, color: '#ef4444' },
    ...(neutralSignals > 0
      ? [{ name: 'Neutral', value: neutralSignals, color: '#6b7280' }]
      : []),
  ];

  return (
    <InfoCard
      icon={<Activity className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.signals.title', 'Technical Signals')}
      subtitle="altFINS — Pre-calculated TA signals"
      headerRight={
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-400 font-semibold">
            {buySignals} buy
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-red-400 font-semibold">{sellSignals} sell</span>
          <DataSourceInfoButton
            title="Technical Signals"
            tabs={getTechnicalSignalsInfo(t)}
          />
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="altfins" />
        </div>
      }
    >
      <div className="space-y-3">
        {/* Donut chart: signal distribution */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={36}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{data.length}</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Buy/Bullish</span>
              <span className="font-bold ml-auto">{buySignals}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Sell/Bearish</span>
              <span className="font-bold ml-auto">{sellSignals}</span>
            </span>
            {neutralSignals > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                <span className="text-muted-foreground">Neutral</span>
                <span className="font-bold ml-auto">{neutralSignals}</span>
              </span>
            )}
          </div>
        </div>

        {/* Signal list */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {data.slice(0, 10).map((signal, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border p-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  {directionBadge(signal.direction)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {signal.symbol}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      {signal.symbolName}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {signal.signalName}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-mono font-semibold">
                  ${signal.lastPrice.toLocaleString()}
                </p>
                <p
                  className={`text-[11px] font-mono ${signal.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {signal.priceChange >= 0 ? '+' : ''}
                  {signal.priceChange.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </InfoCard>
  );
}
