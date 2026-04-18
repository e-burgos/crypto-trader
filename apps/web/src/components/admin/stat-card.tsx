import { InfoTooltip } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  tooltip,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="stat-card rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className={cn('h-4 w-4', color ?? 'text-primary')} />
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
