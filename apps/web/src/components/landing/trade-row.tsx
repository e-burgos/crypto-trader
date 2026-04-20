import { cn } from '../../lib/utils';

export function TradeRow({
  symbol,
  action,
  amount,
  change,
  positive,
}: {
  symbol: string;
  action: 'BUY' | 'SELL';
  amount: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-4 w-8 items-center justify-center rounded text-[9px] font-bold',
            positive
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {action}
        </span>
        <span className="font-mono text-xs font-semibold">{symbol}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          {amount}
        </span>
        <span
          className={cn(
            'font-mono text-xs font-bold',
            positive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {positive ? '+' : ''}
          {change}
        </span>
      </div>
    </div>
  );
}
