import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';
import { useThemeStore } from '../../store/theme.store';
import { useOhlcv } from '../../hooks/use-market';
import { useMarketStore } from '../../store/market.store';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Interval = (typeof INTERVALS)[number];

export function LiveChartPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
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

  useEffect(() => {
    if (!chartRef.current) return;

    // Cleanup previous chart
    chartInstanceRef.current?.remove();

    const chart = createChart(chartRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? 'hsl(222.2, 84%, 4.9%)' : '#ffffff',
        },
        textColor: isDark ? 'hsl(210, 40%, 80%)' : 'hsl(222.2, 84%, 4.9%)',
      },
      grid: {
        vertLines: {
          color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        },
        horzLines: {
          color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        },
      },
      width: chartRef.current.clientWidth,
      height: 420,
      crosshair: { mode: 1 },
      timeScale: {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      },
    });

    chartInstanceRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    if (candles && candles.length > 0) {
      // Normalize timestamps to UTC seconds, filter invalids, sort ascending
      const mapped = candles
        .map((c) => {
          let t: number =
            typeof c.time === 'string'
              ? Math.floor(new Date(c.time).getTime() / 1000)
              : c.time > 1e12
                ? Math.floor(c.time / 1000)
                : c.time;
          return {
            ...c,
            time: t as import('lightweight-charts').UTCTimestamp,
          };
        })
        .filter((c) => (c.time as number) > 0)
        .sort((a, b) => (a.time as number) - (b.time as number));

      if (mapped.length > 0) {
        candleSeries.setData(mapped);
        chart.timeScale().fitContent();
      }
    }

    const handleResize = () => {
      if (chartRef.current)
        chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
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

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading && (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading candles...
            </div>
          </div>
        )}
        <div ref={chartRef} className={cn('w-full', isLoading && 'hidden')} />
      </div>
    </div>
  );
}
