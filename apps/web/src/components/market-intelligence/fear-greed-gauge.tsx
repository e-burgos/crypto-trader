import { useTranslation } from 'react-i18next';
import { InfoCard, Badge } from '@crypto-trader/ui';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { Gauge } from 'lucide-react';
import type { FearGreedData } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getFearGreedInfo } from './data-source-info-content';

function gaugeColor(value: number): string {
  if (value <= 25) return '#ef4444';
  if (value <= 45) return '#f97316';
  if (value <= 55) return '#eab308';
  if (value <= 75) return '#22c55e';
  return '#10b981';
}

function badgeVariant(
  classification: string,
): 'success' | 'error' | 'warning' | 'neutral' {
  const c = classification.toLowerCase();
  if (c.includes('extreme fear') || c.includes('fear')) return 'error';
  if (c.includes('extreme greed') || c.includes('greed')) return 'success';
  if (c.includes('neutral')) return 'neutral';
  return 'warning';
}

export function FearGreedGauge({ data }: { data: FearGreedData | null }) {
  const { t } = useTranslation();

  if (!data) return null;

  const delta = data.value - data.previousClose;
  const deltaSign = delta > 0 ? '+' : '';
  const color = gaugeColor(data.value);

  return (
    <InfoCard
      icon={<Gauge className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.fearGreed.title')}
      subtitle="Alternative.me — Crypto sentiment"
      headerRight={
        <div className="flex items-center gap-2">
          <Badge
            variant={badgeVariant(data.classification)}
            label={data.classification}
          />
          <DataSourceInfoButton
            title="Fear & Greed Index"
            tabs={getFearGreedInfo(t)}
          />
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <div className="flex items-end justify-between text-xs mb-2 text-muted-foreground">
            <span>
              {t('marketIntelligence.fearGreed.previous')}: {data.previousClose}
            </span>
            <span className={delta >= 0 ? 'text-green-500' : 'text-red-500'}>
              {deltaSign}
              {delta} pts
            </span>
          </div>
          <SourceFooter source="alternative-me" />
        </div>
      }
    >
      {/* Gauge chart */}
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="80%"
            innerRadius="60%"
            outerRadius="90%"
            startAngle={180}
            endAngle={0}
            data={[{ value: data.value, fill: color }]}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: 'hsl(var(--muted))' }}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-3xl font-bold" style={{ color }}>
            {data.value}
          </span>
        </div>
      </div>
    </InfoCard>
  );
}
