import { useTranslation } from 'react-i18next';
import { InfoCard, Badge } from '@crypto-trader/ui';
import { Unlock, Clock, AlertTriangle } from 'lucide-react';
import type { TokenUnlockData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getTokenUnlocksInfo } from './data-source-info-content';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function typeBadge(type: string) {
  const map: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
    cliff: 'error',
    linear: 'neutral',
    team: 'warning',
    investor: 'warning',
  };
  return <Badge variant={map[type] ?? 'neutral'} label={type} />;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function urgencyColor(days: number): string {
  if (days <= 3) return 'border-red-500/50 bg-red-500/5';
  if (days <= 7) return 'border-orange-500/50 bg-orange-500/5';
  return 'border-border';
}

export function TokenUnlocksTable({
  data,
}: {
  data: TokenUnlockData[] | null;
}) {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const totalValue = data.reduce((sum, d) => sum + d.unlockAmountUsd, 0);
  const imminent = data.filter((d) => daysUntil(d.unlockDate) <= 7).length;

  return (
    <InfoCard
      icon={<Unlock className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.unlocks.title')}
      subtitle="Token Unlocks — Upcoming vesting events"
      headerRight={
        <div className="flex items-center gap-2">
          {imminent > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <AlertTriangle className="h-3 w-3" />
              {imminent} this week
            </div>
          )}
          <DataSourceInfoButton
            title="Token Unlocks"
            tabs={getTokenUnlocksInfo(t)}
          />
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="token-unlocks" />
        </div>
      }
    >
      {/* Summary stat */}
      <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          Total upcoming unlocks
        </span>
        <span className="text-sm font-bold">{fmtUsd(totalValue)}</span>
      </div>

      {/* Cards list */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {data.slice(0, 8).map((item, i) => {
          const days = daysUntil(item.unlockDate);
          return (
            <div
              key={i}
              className={`rounded-lg border p-3 ${urgencyColor(days)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{item.symbol}</span>
                  {typeBadge(item.type)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span
                    className={days <= 3 ? 'text-red-500 font-semibold' : ''}
                  >
                    {days}d
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-sm font-semibold tabular-nums">
                  {fmtUsd(item.unlockAmountUsd)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.percentOfCirculating.toFixed(1)}% of supply
                </span>
              </div>
              {/* Visual bar for % of circulating */}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{
                    width: `${Math.min(item.percentOfCirculating, 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </InfoCard>
  );
}
