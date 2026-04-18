import { cn } from '../../utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
  trend?: { value: string; positive: boolean };
  sub?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  sub,
  onClick,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        onClick && 'cursor-pointer hover:border-primary/30 transition-colors',
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs font-semibold',
              trend.positive ? 'text-emerald-500' : 'text-red-500',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export type { StatCardProps };
