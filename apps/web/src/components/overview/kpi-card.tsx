import { Link } from 'react-router-dom';
import { InfoTooltip } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';

export function KpiCard({
  label,
  value,
  sub,
  positive,
  icon,
  tooltip,
  className,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  positive?: boolean;
  icon: React.ReactNode;
  tooltip?: string;
  className?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'stat-card h-full rounded-xl border border-border bg-card p-5',
        href &&
          'cursor-pointer transition-colors hover:border-primary/40 hover:bg-card/80',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
      </div>
      <div
        className={cn(
          'text-2xl font-bold',
          positive === true
            ? 'text-emerald-500'
            : positive === false
              ? 'text-red-500'
              : '',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? (
    <Link to={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
