import { cn } from '../../lib/utils';
import type { Cpu } from 'lucide-react';

export function DetailRow({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string;
  value: React.ReactNode;
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

export function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Cpu;
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
