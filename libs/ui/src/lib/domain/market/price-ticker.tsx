import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils';

export interface TickerItem {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

interface PriceTickerProps {
  tickers: TickerItem[];
  className?: string;
}

export function PriceTicker({ tickers, className }: PriceTickerProps) {
  const items = tickers.length > 0 ? [...tickers, ...tickers] : [];

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'border-b border-border/40 bg-muted/30 overflow-hidden py-2',
        className,
      )}
    >
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((ticker, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-6 text-sm"
          >
            <span className="font-mono font-semibold text-foreground">
              {ticker.symbol}
            </span>
            <span className="font-mono text-muted-foreground">
              ${ticker.price}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                ticker.up ? 'text-emerald-500' : 'text-red-500',
              )}
            >
              {ticker.up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {ticker.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export type { PriceTickerProps };
