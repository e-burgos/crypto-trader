import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  DeepPartial,
  CandlestickSeriesOptions,
} from 'lightweight-charts';
import { useThemeStore } from '../../store/theme.store';
import { useOhlcv } from '../../hooks/use-market';
import { useMarketStore } from '../../store/market.store';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = (typeof INTERVALS)[number];

function chartColors(isDark: boolean) {
  return {
    bg: isDark ? '#0a0f1e' : '#ffffff',
    text: isDark ? 'rgba(255,255,255,0.75)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

function normalizeCandles(
  raw: {
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
) {
  return raw
    .map((c) => {
      const t: number =
        typeof c.time === 'string'
          ? Math.floor(new Date(c.time).getTime() / 1000)
          : c.time > 1e12
            ? Math.floor(c.time / 1000)
            : c.time;
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

export function LiveChartPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [interval, setInterval] = useState<Interval>('1h');
  const { data: candles, isLoading } = useOhlcv(asset, interval, 200);
  const prices = useMarketStore((s) => s.prices);
  const currentPrice = prices[`${asset}USDT`]?.price;

  useGSAP(
    () => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  // Single effect: create chart + load data together.
  // - DO NOT use autoSize:true — ResizeObserver fires asynchronously, so the
  //   chart starts at 0×0 and setData is called before the first resize fires.
  // - Read clientWidth/Height explicitly so the chart is correctly sized on creation.
  // - Manual ResizeObserver updates width on container resize.
  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    const colors = chartColors(isDark);
    const h = 420;

    const chart = createChart(container, {
      width: container.clientWidth || container.offsetWidth || 800,
      height: h,
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors.gridLine },
        horzLines: { color: colors.gridLine },
      },
      crosshair: { mode: 1 },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: colors.border },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    } as DeepPartial<CandlestickSeriesOptions>);

    if (candles && candles.length > 0) {
      const mapped = normalizeCandles(candles);
      if (mapped.length > 0) {
        series.setData(mapped);
        chart.timeScale().fitContent();
      }
    }

    // Keep chart width in sync with container after creation
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  // Recreate when theme or data changes — explicit width avoids async resize race.
  }, [isDark, candles]);

  return (
    <div ref={containerRef} className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Chart</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {asset}/USDT
            {currentPrice && (
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500">
                $
                {currentPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Asset toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['BTC', 'ETH'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium transition-colors',
                  asset === a
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Interval buttons */}
          <div className="flex flex-wrap gap-1">
            {INTERVALS.map((tf) => (
              <button
                key={tf}
                onClick={() => setInterval(tf)}
                className={cn(
                  'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                  interval === tf
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-card/80 backdrop-blur-sm" style={{ height: 420 }}>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading candles...
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}
