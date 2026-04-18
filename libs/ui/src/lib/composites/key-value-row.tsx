import { cn } from '../utils';

interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
  className?: string;
}

export function KeyValueRow({
  label,
  value,
  mono,
  accent,
  className,
}: KeyValueRowProps) {
  return (
    <div className={cn('flex items-center justify-between py-1.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-xs font-medium',
          mono && 'font-mono tabular-nums',
          accent ? 'text-primary' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export type { KeyValueRowProps };
