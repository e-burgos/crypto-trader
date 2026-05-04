import { useTranslation } from 'react-i18next';
import { InfoCard } from '@crypto-trader/ui';
import { Target, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import type { PredictionData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getPredictionsInfo } from './data-source-info-content';

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function probColor(p: number): string {
  if (p >= 0.75) return '#10b981';
  if (p >= 0.5) return '#eab308';
  if (p >= 0.25) return '#f97316';
  return '#ef4444';
}

function daysUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days}d`;
}

export function PredictionMarketsList({
  data,
}: {
  data: PredictionData[] | null;
}) {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0);

  return (
    <InfoCard
      icon={<Target className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.predictions.title')}
      subtitle="Polymarket — Prediction markets"
      headerRight={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {fmtUsd(totalVolume)} vol
          </span>
          <DataSourceInfoButton
            title="Prediction Markets"
            tabs={getPredictionsInfo(t)}
          />
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="polymarket" />
        </div>
      }
    >
      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
        {data.slice(0, 10).map((item, i) => {
          const pct = item.probability * 100;
          const color = probColor(item.probability);
          const Wrapper = item.url ? 'a' : 'div';
          const wrapperProps = item.url
            ? {
                href: item.url,
                target: '_blank' as const,
                rel: 'noopener noreferrer',
              }
            : {};
          return (
            <Wrapper
              key={i}
              {...wrapperProps}
              className="group relative block rounded-lg border border-border p-3 overflow-hidden hover:border-primary/40 transition-colors"
            >
              {/* Background probability fill */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  background: `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)`,
                }}
              />
              <div className="relative">
                <p className="text-sm font-medium line-clamp-2 pr-12">
                  {item.question}
                </p>
                {/* Probability circle */}
                <div
                  className="absolute top-0 right-0 h-10 w-10 rounded-full flex items-center justify-center border-2"
                  style={{ borderColor: color }}
                >
                  <span className="text-xs font-bold" style={{ color }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {fmtUsd(item.volume)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {daysUntil(item.endDate)}
                  </span>
                  <span className="text-muted-foreground/70">
                    {item.source}
                  </span>
                  {item.url && (
                    <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </InfoCard>
  );
}
