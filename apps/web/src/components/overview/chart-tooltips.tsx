import type { TooltipContentProps } from 'recharts';
import { cn } from '../../lib/utils';

export function PnlTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const isPos = val >= 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          'font-bold text-sm',
          isPos ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {isPos ? '+' : ''}${val.toFixed(2)}
      </p>
    </div>
  );
}

export function AssetTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const isPos = val >= 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p
        className={cn(
          'font-bold text-sm',
          isPos ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {isPos ? '+' : ''}${val.toFixed(2)} P&L
      </p>
    </div>
  );
}
