import { useRef, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';
import gsap from 'gsap';

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Interval = (typeof INTERVALS)[number];

export function chartColors(isDark: boolean) {
  return {
    bg: isDark ? '#0a0f1e' : '#ffffff',
    text: isDark ? 'rgba(255,255,255,0.75)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

export function normalizeCandles(
  raw: {
    time?: number | string;
    openTime?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
) {
  return raw
    .map((c) => {
      const rawTime = (c as { openTime?: number }).openTime ?? c.time;
      const t: number =
        typeof rawTime === 'string'
          ? Math.floor(new Date(rawTime).getTime() / 1000)
          : (rawTime as number) > 1e12
            ? Math.floor((rawTime as number) / 1000)
            : (rawTime as number);
      return {
        time: t as import('lightweight-charts').UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    })
    .filter((c) => (c.time as number) > 0)
    .sort((a, b) => (a.time as number) - (b.time as number));
}

// ── Live stats bar ────────────────────────────────────────────────────────────
export function LiveStatsBar({ symbol }: { symbol: string }) {
  const { t } = useTranslation();
  const { ticker, connected } = useBinanceTicker(symbol);
  const priceRef = useRef<HTMLSpanElement>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    if (!ticker || !priceRef.current) return;
    if (prevPrice.current !== null && prevPrice.current !== ticker.lastPrice) {
      const up = ticker.lastPrice > prevPrice.current;
      gsap.fromTo(
        priceRef.current,
        { color: up ? '#10b981' : '#ef4444' },
        { color: '', duration: 1.2, ease: 'power2.out' },
      );
    }
    prevPrice.current = ticker.lastPrice;
  }, [ticker?.lastPrice]);

  const isUp = (ticker?.priceChangePct ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5 text-xs">
        {connected ? (
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Wifi className="h-3 w-3" />
            LIVE
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-400">
            <WifiOff className="h-3 w-3 animate-pulse" />
            {t('market.connecting', { defaultValue: 'Connecting…' })}
          </span>
        )}
      </div>

      {ticker ? (
        <>
          {/* Price */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t('market.lastPrice', { defaultValue: 'Price' })}
            </span>
            <span ref={priceRef} className="font-mono font-bold text-base">
              $
              {ticker.lastPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-semibold',
                isUp ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {isUp ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {isUp ? '+' : ''}
              {ticker.priceChangePct.toFixed(2)}%
            </span>
          </div>

          {/* High */}
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span className="text-muted-foreground">
              {t('market.high24h', { defaultValue: 'H' })}
            </span>
            <span className="font-mono text-emerald-400">
              $
              {ticker.highPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Low */}
          <div className="flex items-center gap-1 text-xs">
            <TrendingDown className="h-3 w-3 text-red-400" />
            <span className="text-muted-foreground">
              {t('market.low24h', { defaultValue: 'L' })}
            </span>
            <span className="font-mono text-red-400">
              $
              {ticker.lowPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">
              {t('market.volume24h', { defaultValue: 'Vol' })}
            </span>
            <span className="font-mono">
              {ticker.volume.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground font-mono">
              (${(ticker.quoteVolume / 1_000_000).toFixed(1)}M)
            </span>
          </div>

          {/* Bid / Ask */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">
              {t('market.bestBid', { defaultValue: 'Bid' })}
            </span>
            <span className="font-mono text-emerald-400">
              $
              {ticker.bidPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">
              {t('market.bestAsk', { defaultValue: 'Ask' })}
            </span>
            <span className="font-mono text-red-400">
              $
              {ticker.askPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-24 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )}
    </div>
  );
}
