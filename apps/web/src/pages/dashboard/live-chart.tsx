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
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Wifi,
  WifiOff,
} from 'lucide-react';

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
function LiveStatsBar({ symbol }: { symbol: string }) {
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
