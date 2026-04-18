import { cn } from '../utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  isEmpty,
  emptyMessage = 'No data available',
  actions,
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {isEmpty ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export type { ChartCardProps };
