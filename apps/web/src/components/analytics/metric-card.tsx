import { InfoTooltip } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';

export function MetricCard({
  label,
  value,
  sub,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="metric-card rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
