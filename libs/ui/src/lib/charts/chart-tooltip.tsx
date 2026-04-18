import { cn } from '../utils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  formatter?: (value: number | string, name: string) => string;
  className?: string;
}

/**
 * Themed tooltip component for Recharts.
 * Use as: <Tooltip content={<ChartTooltip />} />
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2 shadow-xl',
        className,
      )}
    >
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? 'var(--color-primary)' }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export type { ChartTooltipProps };
