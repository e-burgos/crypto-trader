import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  DeepPartial,
  CandlestickSeriesOptions,
  ISeriesApi,
} from 'lightweight-charts';
import { useThemeStore } from '../../store/theme.store';
import { useOhlcv } from '../../hooks/use-market';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';
import { useBinanceKlineStream } from '../../hooks/use-binance-kline';
import {
  chartColors,
  normalizeCandles,
  LiveStatsBar,
  INTERVALS,
  type Interval,
} from '../../components/live-chart';

export function LiveChartPage() {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [interval, setInterval] = useState<Interval>('1h');
  const { data: candles, isLoading, refetch } = useOhlcv(asset, interval, 200);
  const symbol = `${asset}USDT`;
  const { ticker } = useBinanceTicker(symbol);
  const { kline } = useBinanceKlineStream(symbol, interval);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Push live kline updates directly onto the chart series
  useEffect(() => {
    if (!kline || !seriesRef.current) return;
    seriesRef.current.update({
      time: kline.time as import('lightweight-charts').UTCTimestamp,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
    });
    // Refetch full candle history when a candle closes
    if (kline.isClosed) refetch();
  }, [kline, refetch]);

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
    seriesRef.current = series;

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
          <h1 className="text-2xl font-bold">{t('sidebar.liveChart')}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {asset}/USDT
            {ticker && (
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500">
                $
                {ticker.lastPrice.toLocaleString('en-US', {
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

      {/* Live stats strip */}
      <div className="mb-3">
        <LiveStatsBar symbol={symbol} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden relative">
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-card/80 backdrop-blur-sm"
            style={{ height: 420 }}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {t('liveChart.loading')}
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>
    </div>
  );
}
