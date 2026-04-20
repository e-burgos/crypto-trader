import { useState, useRef, useEffect } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type DeepPartial,
  type CandlestickSeriesOptions,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useThemeStore } from '../../store/theme.store';
import { useBinanceKlineStream } from '../../hooks/use-binance-kline';
import { IndicatorInfoModal } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  MARKET_SYMBOLS,
  useOhlcv,
  type MarketSnapshot,
} from '../../hooks/use-market';
import {
  CHART_INTERVALS,
  type ChartInterval,
  chartColors,
  TZ_OFFSET_SECONDS,
  normalizeCandles,
  type OverlayKey,
  OVERLAY_CONFIG,
  InfoButton,
} from './constants';

export function ChartTab({
  symbol,
  snapshot,
}: {
  symbol: string;
  snapshot: MarketSnapshot | undefined;
}) {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [interval, setChartInterval] = useState<ChartInterval>('1h');
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(
    new Set<OverlayKey>(['sr']),
  );
  const [chartInfoOpen, setChartInfoOpen] = useState(false);

  const assetEntry = MARKET_SYMBOLS.find((s) => s.symbol === symbol);
  const asset = assetEntry?.asset ?? symbol.replace(/USDT|USDC/g, '');
  const { data: candles, isLoading, refetch } = useOhlcv(asset, interval, 200);
  const { kline } = useBinanceKlineStream(symbol, interval);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [chartReady, setChartReady] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleRefresh = () => {
    if (cooldown > 0) return;
    refetch();
    setCooldown(30);
  };

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!kline || !seriesRef.current) return;
    seriesRef.current.update({
      time: ((kline.time as number) +
        TZ_OFFSET_SECONDS) as import('lightweight-charts').UTCTimestamp,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
    });
    if (kline.isClosed) refetch();
  }, [kline, refetch]);

  // Apply/remove price lines whenever overlays or snapshot change
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((pl) => {
      try {
        series.removePriceLine(pl);
      } catch {
        /* already removed */
      }
    });
    priceLinesRef.current = [];

    if (!snapshot) return;

    const addLine = (
      price: number,
      title: string,
      color: string,
      lineStyle = 0,
      lineWidth = 1,
    ) => {
      if (!price || price <= 0) return;
      const pl = series.createPriceLine({
        price,
        color,
        lineWidth: lineWidth as 1 | 2 | 3 | 4,
        lineStyle,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(pl);
    };

    if (activeOverlays.has('ema9'))
      addLine(snapshot.emaCross.ema9, 'EMA 9', OVERLAY_CONFIG.ema9.color, 0, 1);
    if (activeOverlays.has('ema21'))
      addLine(
        snapshot.emaCross.ema21,
        'EMA 21',
        OVERLAY_CONFIG.ema21.color,
        0,
        1,
      );
    if (activeOverlays.has('ema200'))
      addLine(
        snapshot.emaCross.ema200,
        'EMA 200',
        OVERLAY_CONFIG.ema200.color,
        2,
        2,
      );

    if (activeOverlays.has('bollinger')) {
      addLine(
        snapshot.bollingerBands.upper,
        'BB ↑',
        OVERLAY_CONFIG.bollinger.color,
        1,
        1,
      );
      addLine(
        snapshot.bollingerBands.middle,
        'BB mid',
        OVERLAY_CONFIG.bollinger.color,
        3,
        1,
      );
      addLine(
        snapshot.bollingerBands.lower,
        'BB ↓',
        OVERLAY_CONFIG.bollinger.color,
        1,
        1,
      );
    }

    if (activeOverlays.has('sr')) {
      snapshot.supportResistance.resistance
        .slice(0, 3)
        .forEach((r) => addLine(r, 'R', '#ef4444', 1, 1));
      snapshot.supportResistance.support
        .slice(-3)
        .forEach((s) => addLine(s, 'S', '#10b981', 1, 1));
    }
  }, [activeOverlays, snapshot, chartReady]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;

    const colors = chartColors(isDark);
    const chart = createChart(container, {
      width: container.clientWidth || container.offsetWidth || 800,
      height: 520,
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

    setChartReady((n) => n + 1);

    if (candles && candles.length > 0) {
      const mapped = normalizeCandles(candles);
      if (mapped.length > 0) {
        series.setData(mapped);
        chart.timeScale().fitContent();
      }
    }

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      seriesRef.current = null;
      priceLinesRef.current = [];
      ro.disconnect();
      chart.remove();
    };
  }, [isDark, candles]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2.5">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t('market.tabChart')}</h2>
        <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-bold text-primary font-mono">
          {symbol}
        </span>
        <InfoButton
          indicatorKey="chart"
          onOpen={() => setChartInfoOpen(true)}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: overlay pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-0.5">
            Indicadores:
          </span>
          {(
            Object.entries(OVERLAY_CONFIG) as [
              OverlayKey,
              (typeof OVERLAY_CONFIG)[OverlayKey],
            ][]
          ).map(([key, cfg]) => {
            const active = activeOverlays.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleOverlay(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                  active
                    ? 'border-transparent bg-muted text-foreground'
                    : 'border-border/40 bg-transparent text-muted-foreground/50 line-through',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0 transition-opacity',
                    cfg.dotColor,
                    !active && 'opacity-30',
                  )}
                />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Right: interval buttons + refresh */}
        <div className="flex items-center gap-1.5">
          {CHART_INTERVALS.map((tf) => (
            <button
              key={tf}
              onClick={() => setChartInterval(tf)}
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
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={handleRefresh}
            disabled={cooldown > 0}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all',
              cooldown > 0
                ? 'border-border/40 text-muted-foreground/40 cursor-not-allowed'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <RefreshCw
              className={cn('h-3 w-3 shrink-0', isLoading && 'animate-spin')}
            />
            {cooldown > 0 ? `${cooldown}s` : t('market.refresh')}
          </button>
        </div>
      </div>

      {/* Candlestick chart */}
      <div className="rounded-xl overflow-hidden relative -mx-4 -mb-4">
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-card/80 backdrop-blur-sm"
            style={{ height: 520 }}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {t('liveChart.loading')}
          </div>
        )}
        <div ref={chartRef} className="w-full" />
      </div>

      <IndicatorInfoModal
        t={t}
        indicatorKey={chartInfoOpen ? 'chart' : null}
        onClose={() => setChartInfoOpen(false)}
      />
    </div>
  );
}
