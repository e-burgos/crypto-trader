import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickSeriesOptions,
  DeepPartial,
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
    text: isDark ? 'rgba(255,255,255,0.7)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

function normalizeCandles(
  raw: { time: number | string; open: number; high: number; low: number; close: number; volume: number }[],
) {
  return raw
    .map((c) => {
      const t: number =
        typeof c.time === 'string'
          ? Math.floor(new Date(c.time).getTime() / 1000)
          : c.time > 1e12
            ? Math.floor(c.time / 1000)
            : c.time;
      return { ...c, time: t } as { time: number; open: number; high: number; low: number; close: number; volume: number };
    })
    .filter((c) => c.time > 0)
    .sort((a, b) => a.time - b.time);
}

export function LiveChartPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const seriesApi = useRef<ISeriesApi<'Candlestick'> | null>(null);

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

  // ── 1. Create chart once on mount ────────────────────────────────────────
  useLayoutEffect(() => {
    if (!chartRef.current) return;
    const colors = chartColors(isDark);

    const chart = createChart(chartRef.current, {
      autoSize: true,
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

    chartApi.current = chart;
    seriesApi.current = series;

    return () => {
      chart.remove();
      chartApi.current = null;
      seriesApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount/unmount

  // ── 2. Update theme colors without recreating ────────────────────────────
  useEffect(() => {
    if (!chartApi.current) return;
    const colors = chartColors(isDark);
    chartApi.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.gridLine },
        horzLines: { color: colors.gridLine },
      },
      timeScale: { borderColor: colors.border },
      rightPriceScale: { borderColor: colors.border },
    });
  }, [isDark]);

  // ── 3. Push new data when candles change ─────────────────────────────────
  useEffect(() => {
    if (!seriesApi.current || !candles?.length) return;
    const mapped = normalizeCandles(candles);
    if (mapped.length === 0) return;
    // Cast to satisfy strict UTCTimestamp type
    seriesApi.current.setData(
      mapped as unknown as Parameters<typeof seriesApi.current.setData>[0],
    );
    chartApi.current?.timeScale().fitContent();
  }, [candles]);

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

      <div className="relative rounded-xl border border-border bg-card overflow-hidden h-[420px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-card/80 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading candles...
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  );
}
