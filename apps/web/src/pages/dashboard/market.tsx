import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOverallSignal,
  MARKET_SYMBOLS,
  type OverallSignal,
} from '../../hooks/use-market';

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

function SnapshotPanel({ symbol }: { symbol: string }) {
  const { t } = useTranslation();
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
      {/* Price header */}
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
            {data.currentPrice.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div
            className={cn(
              'mt-1 text-sm font-medium',
              data.change24h >= 0 ? 'text-emerald-500' : 'text-red-500',
            )}
          >
            {data.change24h >= 0 ? '+' : ''}
            {data.change24h.toFixed(2)}% (24h)
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            RSI (14)
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            MACD (12,26,9)
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('market.emaTrend')}
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('market.bollinger')}
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('market.volume')}
          </h3>
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('market.supportResistance')}
          </h3>
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

      {/* Snapshot panel */}
      <SnapshotPanel symbol={selectedSymbol} />
    </div>
  );
}
