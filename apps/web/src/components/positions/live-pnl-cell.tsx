import { useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wifi } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { TradingPosition } from '../../hooks/use-trading';
import { calcUnrealizedPnl } from '../../hooks/use-live-prices';
import { useMarketStore } from '../../store/market.store';
import gsap from 'gsap';

export function LivePnlCell({ pos }: { pos: TradingPosition }) {
  const { t } = useTranslation();
  const prices = useMarketStore((s) => s.prices);
  const symbol = `${pos.asset}${pos.pair}`;
  const currentPrice = prices[symbol]?.price;
  const pnl = calcUnrealizedPnl(
    pos.entryPrice,
    pos.quantity,
    pos.fees,
    currentPrice,
  );
  const cellRef = useRef<HTMLSpanElement>(null);
  const prevPnl = useRef<number | null>(null);

  useEffect(() => {
    if (pnl == null || cellRef.current == null) return;
    if (prevPnl.current != null && prevPnl.current !== pnl) {
      const up = pnl > prevPnl.current;
      gsap.fromTo(
        cellRef.current,
        {
          backgroundColor: up
            ? 'rgba(52,211,153,0.25)'
            : 'rgba(248,113,113,0.25)',
        },
        { backgroundColor: 'transparent', duration: 0.8, ease: 'power2.out' },
      );
    }
    prevPnl.current = pnl;
  }, [pnl]);

  if (pnl == null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
        <Wifi className="h-3 w-3 animate-pulse" />
        {t('positions.loadingPrice', { defaultValue: 'Loading…' })}
      </span>
    );
  }

  const isProfit = pnl >= 0;
  const pct = (pnl / (pos.entryPrice * pos.quantity)) * 100;

  return (
    <span
      ref={cellRef}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors',
        isProfit ? 'text-emerald-400' : 'text-red-400',
      )}
    >
      {isProfit ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isProfit ? '+' : ''}
      {pnl.toFixed(2)} {pos.pair}
      <span
        className={cn(
          'opacity-70',
          isProfit ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        ({isProfit ? '+' : ''}
        {pct.toFixed(2)}%)
      </span>
    </span>
  );
}
