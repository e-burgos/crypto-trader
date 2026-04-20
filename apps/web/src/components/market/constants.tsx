import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react';
import type { OverallSignal } from '../../hooks/use-market';
import type { IndicatorKey } from '@crypto-trader/ui';

export const SIGNAL_CONFIG: Record<
  OverallSignal,
  { label: string; color: string; bg: string; icon: typeof TrendingUp }
> = {
  BUY: {
    label: 'BUY',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: TrendingUp,
  },
  SELL: {
    label: 'SELL',
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/30',
    icon: TrendingDown,
  },
  HOLD: {
    label: 'HOLD',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    icon: Minus,
  },
  NEUTRAL: {
    label: 'NEUTRAL',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: Minus,
  },
};

export function rsiColor(signal: string) {
  if (signal === 'OVERSOLD') return 'text-emerald-500';
  if (signal === 'OVERBOUGHT') return 'text-red-500';
  return 'text-amber-500';
}
export function macdColor(crossover: string) {
  if (crossover === 'BULLISH') return 'text-emerald-500';
  if (crossover === 'BEARISH') return 'text-red-500';
  return 'text-muted-foreground';
}
export function trendColor(trend: string) {
  if (trend === 'BULLISH') return 'text-emerald-500';
  if (trend === 'BEARISH') return 'text-red-500';
  return 'text-amber-500';
}
export function bollingerColor(position: string) {
  if (position === 'BELOW') return 'text-emerald-500';
  if (position === 'ABOVE') return 'text-red-500';
  return 'text-muted-foreground';
}
export function volumeColor(signal: string) {
  if (signal === 'HIGH') return 'text-emerald-500';
  if (signal === 'LOW') return 'text-red-400';
  return 'text-muted-foreground';
}

export const CHART_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type ChartInterval = (typeof CHART_INTERVALS)[number];

export function chartColors(isDark: boolean) {
  return {
    bg: isDark ? '#0a0f1e' : '#ffffff',
    text: isDark ? 'rgba(255,255,255,0.75)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

export const TZ_OFFSET_SECONDS = -new Date().getTimezoneOffset() * 60;

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
        time: (t +
          TZ_OFFSET_SECONDS) as import('lightweight-charts').UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    })
    .filter((c) => (c.time as number) > 0)
    .sort((a, b) => (a.time as number) - (b.time as number));
}

export type OverlayKey = 'ema9' | 'ema21' | 'ema200' | 'bollinger' | 'sr';

export const OVERLAY_CONFIG: Record<
  OverlayKey,
  { label: string; color: string; dotColor: string }
> = {
  ema9: { label: 'EMA 9', color: '#a78bfa', dotColor: 'bg-violet-400' },
  ema21: { label: 'EMA 21', color: '#38bdf8', dotColor: 'bg-sky-400' },
  ema200: { label: 'EMA 200', color: '#f97316', dotColor: 'bg-orange-400' },
  bollinger: { label: 'Bollinger', color: '#f59e0b', dotColor: 'bg-amber-400' },
  sr: { label: 'S/R', color: '#94a3b8', dotColor: 'bg-slate-400' },
};

export function InfoButton({
  indicatorKey,
  onOpen,
}: {
  indicatorKey: IndicatorKey;
  onOpen: (k: IndicatorKey) => void;
}) {
  return (
    <button
      onClick={() => onOpen(indicatorKey)}
      className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
      aria-label={`Información sobre ${indicatorKey}`}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

export function IndicatorRow({
  label,
  value,
  signal,
  signalColor,
}: {
  label: string;
  value: string;
  signal: string;
  signalColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm">{value}</span>
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${signalColor}`}
        >
          {signal}
        </span>
      </div>
    </div>
  );
}

export function SRLevels({
  levels,
  label,
  color,
  currentPrice,
}: {
  levels: number[];
  label: string;
  color: string;
  currentPrice: number;
}) {
  if (!levels.length) return null;
  const top3 = levels.slice(0, 3);
  return (
    <div>
      <div className={`mb-1 text-xs font-semibold uppercase ${color}`}>
        {label}
      </div>
      <div className="space-y-1">
        {top3.map((lvl) => (
          <div key={lvl} className="flex items-center justify-between">
            <span className="font-mono text-sm">
              ${lvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-muted-foreground">
              {(((lvl - currentPrice) / currentPrice) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
