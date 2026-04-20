import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export function ConfidenceBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const { t } = useTranslation();
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {t('botAnalysis.confidence')}
        </span>
        <span className={cn('text-sm font-bold tabular-nums', color)}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 70
              ? 'bg-emerald-500'
              : pct >= 50
                ? 'bg-amber-500'
                : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
