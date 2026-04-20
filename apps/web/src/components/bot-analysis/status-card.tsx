import { cn } from '../../lib/utils';

export function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  valueColor,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  valueColor: string;
  bg: string;
}) {
  return (
    <div
      className={cn(
        'status-card rounded-xl border p-4 flex items-center gap-4',
        bg,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/50">
        <Icon className={cn('h-5 w-5', valueColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className={cn('text-base font-bold leading-tight', valueColor)}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

export function StateDetailRow({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] font-semibold text-right',
          mono && 'font-mono tabular-nums',
          accent ?? 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StateSectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
    </div>
  );
}
