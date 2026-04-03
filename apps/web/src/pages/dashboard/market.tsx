import { useState, useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  Info,
} from 'lucide-react';
import {
  IndicatorInfoModal,
  type IndicatorKey,
} from '../../components/market/indicator-info-modal';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOverallSignal,
  MARKET_SYMBOLS,
  type OverallSignal,
} from '../../hooks/use-market';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';

gsap.registerPlugin(useGSAP);

// ── Signal helpers ─────────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<
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
  NEUTRAL: {
    label: 'NEUTRAL',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: Minus,
  },
};

function rsiColor(signal: string) {
  if (signal === 'OVERSOLD') return 'text-emerald-500';
  if (signal === 'OVERBOUGHT') return 'text-red-500';
  return 'text-amber-500';
}
function macdColor(crossover: string) {
  if (crossover === 'BULLISH') return 'text-emerald-500';
  if (crossover === 'BEARISH') return 'text-red-500';
  return 'text-muted-foreground';
}
function trendColor(trend: string) {
  if (trend === 'BULLISH') return 'text-emerald-500';
  if (trend === 'BEARISH') return 'text-red-500';
  return 'text-amber-500';
}
function bollingerColor(position: string) {
  if (position === 'BELOW') return 'text-emerald-500';
  if (position === 'ABOVE') return 'text-red-500';
  return 'text-muted-foreground';
}
function volumeColor(signal: string) {
  if (signal === 'HIGH') return 'text-emerald-500';
  if (signal === 'LOW') return 'text-red-400';
  return 'text-muted-foreground';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IndicatorRow({
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
          className={cn(
            'text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
            signalColor,
          )}
        >
          {signal}
        </span>
      </div>
    </div>
  );
}

function SRLevels({
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
      <div className={cn('mb-1 text-xs font-semibold uppercase', color)}>
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

// ── Live Ticker Panel ──────────────────────────────────────────────────────────

function LiveTickerPanel({ symbol }: { symbol: string }) {
  const { t } = useTranslation();
  const { ticker, connected } = useBinanceTicker(symbol);
  const priceRef = useRef<HTMLDivElement>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    if (!ticker || !priceRef.current) return;
    if (prevPrice.current !== null && prevPrice.current !== ticker.lastPrice) {
      const up = ticker.lastPrice > prevPrice.current;
      gsap.fromTo(
        priceRef.current,
        {
          backgroundColor: up
            ? 'rgba(52,211,153,0.2)'
            : 'rgba(248,113,113,0.2)',
        },
        { backgroundColor: 'transparent', duration: 0.7, ease: 'power2.out' },
      );
    }
    prevPrice.current = ticker.lastPrice;
  }, [ticker?.lastPrice]);

  const isUp = (ticker?.priceChangePct ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Activity className="h-3.5 w-3.5" />
          {t('market.liveData', { defaultValue: 'Live Market Data' })}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Wifi className="h-3 w-3" />
              {t('market.liveConnected', { defaultValue: 'LIVE' })}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <WifiOff className="h-3 w-3" />
              {t('market.connecting', { defaultValue: 'Connecting…' })}
            </span>
          )}
        </div>
      </div>

      {!ticker ? (
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {/* Last price */}
          <div
            ref={priceRef}
            className="bg-card px-4 py-3 transition-colors col-span-2 sm:col-span-1"
          >
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.lastPrice', { defaultValue: 'Last Price' })}
            </div>
            <div className="text-xl font-bold font-mono">
              $
              {ticker.lastPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-semibold mt-0.5',
                isUp ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {isUp ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
              {isUp ? '+' : ''}
              {ticker.priceChangePct.toFixed(2)}%
              <span className="font-mono text-xs opacity-80">
                ({isUp ? '+' : ''}
                {ticker.priceChange.toFixed(2)})
              </span>
            </div>
          </div>

          {/* 24h High */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.high24h', { defaultValue: '24h High' })}
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">
              $
              {ticker.highPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* 24h Low */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.low24h', { defaultValue: '24h Low' })}
            </div>
            <div className="text-base font-bold font-mono text-red-400">
              $
              {ticker.lowPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* Volume */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.volume24h', { defaultValue: '24h Volume' })}
            </div>
            <div className="text-base font-bold font-mono">
              {ticker.volume.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
              ${(ticker.quoteVolume / 1_000_000).toFixed(2)}M
            </div>
          </div>

          {/* Bid */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.bestBid', { defaultValue: 'Best Bid' })}
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">
              $
              {ticker.bidPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {ticker.bidQty.toFixed(5)}
            </div>
          </div>

          {/* Ask */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.bestAsk', { defaultValue: 'Best Ask' })}
            </div>
            <div className="text-base font-bold font-mono text-red-400">
              $
              {ticker.askPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {ticker.askQty.toFixed(5)}
            </div>
          </div>

          {/* Spread */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.spread', { defaultValue: 'Spread' })}
            </div>
            <div className="text-base font-bold font-mono text-amber-400">
              ${(ticker.askPrice - ticker.bidPrice).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {(
                ((ticker.askPrice - ticker.bidPrice) / ticker.lastPrice) *
                100
              ).toFixed(4)}
              %
            </div>
          </div>

          {/* Trades */}
          <div className="bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">
              {t('market.trades24h', { defaultValue: '24h Trades' })}
            </div>
            <div className="text-base font-bold font-mono">
              {ticker.trades.toLocaleString('en-US')}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('market.avg', { defaultValue: 'Avg' })} $
              {ticker.weightedAvgPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoButton({
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

function SnapshotPanel({ symbol }: { symbol: string }) {
  const { t } = useTranslation();
  const [infoModal, setInfoModal] = useState<IndicatorKey | null>(null);
  const { ticker } = useBinanceTicker(symbol);
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } =
    useMarketSnapshot(symbol);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t('market.loadError')}</p>
      </div>
    );
  }

  const { signal, score, reasons } = deriveOverallSignal(data);
  const signalCfg = SIGNAL_CONFIG[signal];
  const SignalIcon = signalCfg.icon;

  return (
    <div className="market-panel space-y-4">
      {/* Price header — uses live WebSocket price when available */}
      <div
        className={cn(
          'rounded-xl border p-5 flex items-center justify-between',
          signalCfg.bg,
        )}
      >
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            {t('market.currentPrice')}
          </div>
          <div className="text-3xl font-bold font-mono">
            $
            {(ticker?.lastPrice ?? data.currentPrice).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div
            className={cn(
              'mt-1 text-sm font-medium',
              (ticker?.priceChangePct ?? data.change24h) >= 0
                ? 'text-emerald-500'
                : 'text-red-500',
            )}
          >
            {(ticker?.priceChangePct ?? data.change24h) >= 0 ? '+' : ''}
            {(ticker?.priceChangePct ?? data.change24h).toFixed(2)}% (24h)
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2',
              signalCfg.bg,
            )}
          >
            <SignalIcon className={cn('h-5 w-5', signalCfg.color)} />
            <span className={cn('text-lg font-bold', signalCfg.color)}>
              {signalCfg.label}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t('market.score')}: {score > 0 ? '+' : ''}
            {score}
          </div>
          {dataUpdatedAt > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {t('market.updated')}:{' '}
              {new Date(dataUpdatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Indicators grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* RSI */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              RSI (14)
            </h3>
            <InfoButton indicatorKey="rsi" onOpen={setInfoModal} />
          </div>
          <div className="mb-3">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold font-mono">
                {data.rsi.value.toFixed(2)}
              </span>
              <span
                className={cn(
                  'mb-1 text-xs font-semibold uppercase',
                  rsiColor(data.rsi.signal),
                )}
              >
                {data.rsi.signal}
              </span>
            </div>
            {/* RSI bar */}
            <div className="relative mt-2 h-2 rounded-full bg-muted">
              <div
                className={cn(
                  'absolute h-2 w-1 rounded-full',
                  data.rsi.value > 70
                    ? 'bg-red-500'
                    : data.rsi.value < 30
                      ? 'bg-emerald-500'
                      : 'bg-primary',
                )}
                style={{
                  left: `${Math.min(Math.max(data.rsi.value, 0), 100)}%`,
                }}
              />
              <div className="absolute left-[30%] h-2 w-px bg-border/80" />
              <div className="absolute left-[70%] h-2 w-px bg-border/80" />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="text-emerald-500/70">30</span>
              <span className="text-red-500/70">70</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* MACD */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              MACD (12,26,9)
            </h3>
            <InfoButton indicatorKey="macd" onOpen={setInfoModal} />
          </div>
          <div className="space-y-0">
            <IndicatorRow
              label="MACD"
              value={data.macd.macd.toFixed(4)}
              signal={data.macd.crossover}
              signalColor={macdColor(data.macd.crossover)}
            />
            <IndicatorRow
              label={t('market.signal')}
              value={data.macd.signal.toFixed(4)}
              signal={data.macd.histogram >= 0 ? '▲' : '▼'}
              signalColor={
                data.macd.histogram >= 0 ? 'text-emerald-500' : 'text-red-500'
              }
            />
            <IndicatorRow
              label={t('market.histogram')}
              value={data.macd.histogram.toFixed(4)}
              signal={data.macd.histogram >= 0 ? 'POSITIVE' : 'NEGATIVE'}
              signalColor={
                data.macd.histogram >= 0 ? 'text-emerald-500' : 'text-red-500'
              }
            />
          </div>
        </div>

        {/* EMA Cross */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('market.emaTrend')}
            </h3>
            <InfoButton indicatorKey="ema" onOpen={setInfoModal} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-bold uppercase',
                trendColor(data.emaCross.trend),
              )}
            >
              {data.emaCross.trend}
            </span>
          </div>
          <div className="space-y-0">
            <IndicatorRow
              label="EMA 9"
              value={`$${data.emaCross.ema9.toFixed(2)}`}
              signal={
                data.currentPrice > data.emaCross.ema9 ? 'ABOVE' : 'BELOW'
              }
              signalColor={
                data.currentPrice > data.emaCross.ema9
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }
            />
            <IndicatorRow
              label="EMA 21"
              value={`$${data.emaCross.ema21.toFixed(2)}`}
              signal={
                data.currentPrice > data.emaCross.ema21 ? 'ABOVE' : 'BELOW'
              }
              signalColor={
                data.currentPrice > data.emaCross.ema21
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }
            />
            <IndicatorRow
              label="EMA 200"
              value={`$${data.emaCross.ema200.toFixed(2)}`}
              signal={
                data.currentPrice > data.emaCross.ema200 ? 'ABOVE' : 'BELOW'
              }
              signalColor={
                data.currentPrice > data.emaCross.ema200
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }
            />
          </div>
        </div>

        {/* Bollinger Bands */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('market.bollinger')}
            </h3>
            <InfoButton indicatorKey="bollinger" onOpen={setInfoModal} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-bold',
                bollingerColor(data.bollingerBands.position),
              )}
            >
              {data.bollingerBands.position}
            </span>
          </div>
          <div className="space-y-0">
            <IndicatorRow
              label={t('market.upper')}
              value={`$${data.bollingerBands.upper.toFixed(2)}`}
              signal={
                data.currentPrice > data.bollingerBands.upper
                  ? 'ABOVE'
                  : 'BELOW'
              }
              signalColor={
                data.currentPrice > data.bollingerBands.upper
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }
            />
            <IndicatorRow
              label={t('market.middle')}
              value={`$${data.bollingerBands.middle.toFixed(2)}`}
              signal={
                data.currentPrice > data.bollingerBands.middle
                  ? 'ABOVE'
                  : 'BELOW'
              }
              signalColor={
                data.currentPrice > data.bollingerBands.middle
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }
            />
            <IndicatorRow
              label={t('market.lower')}
              value={`$${data.bollingerBands.lower.toFixed(2)}`}
              signal={
                data.currentPrice < data.bollingerBands.lower ? 'NEAR' : 'AWAY'
              }
              signalColor={
                data.currentPrice < data.bollingerBands.lower
                  ? 'text-emerald-500'
                  : 'text-muted-foreground'
              }
            />
            <IndicatorRow
              label={t('market.bandwidth')}
              value={data.bollingerBands.bandwidth.toFixed(4)}
              signal={data.bollingerBands.bandwidth > 0.05 ? 'WIDE' : 'NARROW'}
              signalColor={
                data.bollingerBands.bandwidth > 0.05
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
              }
            />
          </div>
        </div>
      </div>

      {/* Volume + Support/Resistance */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Volume */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('market.volume')}
            </h3>
            <InfoButton indicatorKey="volume" onOpen={setInfoModal} />
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-bold uppercase',
                volumeColor(data.volume.signal),
              )}
            >
              {data.volume.signal}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              {t('market.vsAvg')} {data.volume.ratio.toFixed(2)}x
            </span>
          </div>
          <div className="space-y-0">
            <IndicatorRow
              label={t('market.current')}
              value={`${(data.volume.current / 1_000_000).toFixed(2)}M`}
              signal={data.volume.signal}
              signalColor={volumeColor(data.volume.signal)}
            />
            <IndicatorRow
              label={t('market.average')}
              value={`${(data.volume.average / 1_000_000).toFixed(2)}M`}
              signal="AVG"
              signalColor="text-muted-foreground"
            />
          </div>
        </div>

        {/* Support / Resistance */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('market.supportResistance')}
            </h3>
            <InfoButton indicatorKey="supportResistance" onOpen={setInfoModal} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SRLevels
              levels={data.supportResistance.resistance}
              label={t('market.resistance')}
              color="text-red-500"
              currentPrice={data.currentPrice}
            />
            <SRLevels
              levels={data.supportResistance.support}
              label={t('market.support')}
              color="text-emerald-500"
              currentPrice={data.currentPrice}
            />
          </div>
        </div>
      </div>

      {/* Signal summary */}
      {reasons.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('market.signalReasons')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <span
                key={r}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  signalCfg.bg,
                  signalCfg.color,
                )}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Refresh at bottom */}
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          {t('market.refresh')}
        </button>
      </div>

      {/* Indicator info modal */}
      {infoModal && (
        <IndicatorInfoModal
          indicatorKey={infoModal}
          onClose={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function MarketPage() {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        '.market-panel',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [selectedSymbol] },
  );

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('market.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('market.subtitle')}
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
          {t('market.autoRefresh')}
        </div>
      </div>

      {/* Pair selector */}
      <div className="flex flex-wrap gap-2">
        {MARKET_SYMBOLS.map(({ symbol, label }) => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              selectedSymbol === symbol
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live real-time ticker */}
      <LiveTickerPanel symbol={selectedSymbol} />

      {/* Indicators snapshot (60s refresh) */}
      <SnapshotPanel symbol={selectedSymbol} />
    </div>
  );
}
