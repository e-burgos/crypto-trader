import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type DeepPartial,
  type CandlestickSeriesOptions,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts';
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
  ShoppingCart,
  ShieldAlert,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useThemeStore } from '../../store/theme.store';
import { useBinanceKlineStream } from '../../hooks/use-binance-kline';
import {
  IndicatorInfoModal,
  type IndicatorKey,
} from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOverallSignal,
  deriveOpportunity,
  MARKET_SYMBOLS,
  useOhlcv,
  type OverallSignal,
  type OpportunityAnalysis,
  type MarketSnapshot,
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

// ── Opportunity Panel ─────────────────────────────────────────────────────────

function OpportunityPanel({
  opp,
  onOpenInfo,
}: {
  opp: OpportunityAnalysis;
  onOpenInfo?: (k: IndicatorKey) => void;
}) {
  const actionConfig = {
    BUY: {
      label: 'COMPRAR AHORA',
      sublabel: 'Oportunidad de entrada detectada',
      icon: ShoppingCart,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/15 to-emerald-500/5',
      border: 'border-emerald-500/30',
      ring: 'shadow-[0_0_24px_hsl(142_71%_45%/0.15)]',
      barColor: 'bg-emerald-500',
    },
    SELL: {
      label: 'VENDER AHORA',
      sublabel: 'Presión bajista detectada',
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'from-red-500/15 to-red-500/5',
      border: 'border-red-500/30',
      ring: 'shadow-[0_0_24px_hsl(0_84%_60%/0.15)]',
      barColor: 'bg-red-500',
    },
    WAIT: {
      label: 'ESPERAR SEÑAL',
      sublabel: 'Sin confluencia suficiente',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-amber-500/5',
      border: 'border-amber-500/20',
      ring: '',
      barColor: 'bg-amber-500',
    },
  }[opp.action];

  const ActionIcon = actionConfig.icon;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-5 space-y-4',
        actionConfig.bg,
        actionConfig.border,
        actionConfig.ring,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              opp.action === 'BUY'
                ? 'bg-emerald-500/20'
                : opp.action === 'SELL'
                  ? 'bg-red-500/20'
                  : 'bg-amber-500/15',
            )}
          >
            <ActionIcon className={cn('h-6 w-6', actionConfig.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-lg font-bold tracking-wide',
                  actionConfig.color,
                )}
              >
                {actionConfig.label}
              </span>
              {/* Confidence badge — always visible */}
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                  opp.action === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : opp.action === 'SELL'
                      ? 'bg-red-500/20 text-red-400'
                      : opp.scoreBias >= 0
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-orange-500/15 text-orange-400',
                )}
              >
                <Zap className="h-3 w-3" />
                {opp.action !== 'WAIT'
                  ? `${opp.confidence}% confirmado`
                  : opp.scoreBias > 0
                    ? `${opp.confidence}% alcista`
                    : opp.scoreBias < 0
                      ? `${opp.confidence}% bajista`
                      : `${opp.confidence}% señal`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {opp.summary}
            </p>
          </div>
        </div>

        {/* Confidence bar + info */}
        <div className="shrink-0 text-right hidden sm:flex sm:flex-col sm:items-end gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
              {opp.action !== 'WAIT'
                ? 'Confianza'
                : opp.scoreBias >= 0
                  ? 'Señal alcista'
                  : 'Señal bajista'}
            </p>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  actionConfig.barColor,
                )}
                style={{ width: `${opp.confidence}%` }}
              />
            </div>
            <p className={cn('text-sm font-bold mt-1', actionConfig.color)}>
              {opp.confidence}%
            </p>
          </div>
          {onOpenInfo && (
            <InfoButton indicatorKey="opportunity" onOpen={onOpenInfo} />
          )}
        </div>
      </div>

      {/* Price levels */}
      {opp.action !== 'WAIT' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-background/40 border border-border/40 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Entrada
            </p>
            <p className="text-sm font-bold font-mono">
              $
              {opp.entryPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-muted-foreground">precio actual</p>
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1">
              Stop Loss
            </p>
            <p className="text-sm font-bold font-mono text-red-400">
              $
              {opp.stopLoss.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-red-400/60">
              -
              {(
                (Math.abs(opp.entryPrice - opp.stopLoss) / opp.entryPrice) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">
              Take Profit
            </p>
            <p className="text-sm font-bold font-mono text-emerald-400">
              $
              {opp.takeProfit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-[10px] text-emerald-400/60">
              +
              {(
                (Math.abs(opp.takeProfit - opp.entryPrice) / opp.entryPrice) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
        </div>
      )}

      {/* R/R ratio */}
      {opp.action !== 'WAIT' && opp.riskReward > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5 shrink-0" />
          <span>Riesgo/Beneficio:</span>
          <span
            className={cn(
              'font-bold',
              opp.riskReward >= 1.5 ? 'text-emerald-400' : 'text-amber-400',
            )}
          >
            1:{opp.riskReward}
          </span>
          {opp.riskReward < 1.5 && (
            <span className="text-amber-400/70">
              (mínimo recomendado 1:1.5)
            </span>
          )}
        </div>
      )}

      {/* Indicator checks */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Checklist de indicadores
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {opp.checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs',
                check.ok
                  ? 'bg-emerald-500/8 border border-emerald-500/15'
                  : 'bg-red-500/8 border border-red-500/15',
              )}
            >
              {check.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              )}
              <span className="font-semibold text-muted-foreground w-14 shrink-0">
                {check.label}
              </span>
              <span
                className={cn(
                  'truncate',
                  check.ok ? 'text-foreground/80' : 'text-muted-foreground/60',
                )}
              >
                {check.value}
              </span>
              {check.weight === 'strong' && (
                <span className="ml-auto shrink-0 text-[9px] font-bold text-primary/60 uppercase">
                  fuerte
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {opp.warnings.length > 0 && (
        <div className="space-y-1">
          {opp.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-1.5"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span className="text-xs text-amber-300/80">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        * Análisis técnico automático. No constituye asesoría financiera. El bot
        puede o no ejecutar esta señal dependiendo de su configuración de
        umbrales.
      </p>
    </div>
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
  const livePrice = ticker?.lastPrice ?? data.currentPrice;
  const opportunity = deriveOpportunity(data, livePrice);

  return (
    <div className="market-panel space-y-4">
      {/* ── Opportunity Panel (top, most visible) ── */}
      <OpportunityPanel opp={opportunity} onOpenInfo={setInfoModal} />
      {/* Price header — uses live WebSocket price when available */}
      <div
        className={cn(
          'rounded-xl border p-5 flex items-center justify-between',
          signalCfg.bg,
        )}
      >
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {t('market.currentPrice')}
            </span>
            <InfoButton indicatorKey="price" onOpen={setInfoModal} />
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
            <InfoButton
              indicatorKey="supportResistance"
              onOpen={setInfoModal}
            />
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
          <div className="flex items-center mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('market.signalReasons')}
            </h3>
            <InfoButton indicatorKey="signalReasons" onOpen={setInfoModal} />
          </div>
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
          t={t}
          indicatorKey={infoModal}
          onClose={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const CHART_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type ChartInterval = (typeof CHART_INTERVALS)[number];

function chartColors(isDark: boolean) {
  return {
    bg: isDark ? '#0a0f1e' : '#ffffff',
    text: isDark ? 'rgba(255,255,255,0.75)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

// Offset UTC timestamp by local timezone so lightweight-charts shows local time
const TZ_OFFSET_SECONDS = -new Date().getTimezoneOffset() * 60;

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

// ── Overlay filter config ────────────────────────────────────────────────────

type OverlayKey = 'ema9' | 'ema21' | 'ema200' | 'bollinger' | 'sr';

const OVERLAY_CONFIG: Record<
  OverlayKey,
  { label: string; color: string; dotColor: string }
> = {
  ema9: { label: 'EMA 9', color: '#a78bfa', dotColor: 'bg-violet-400' },
  ema21: { label: 'EMA 21', color: '#38bdf8', dotColor: 'bg-sky-400' },
  ema200: { label: 'EMA 200', color: '#f97316', dotColor: 'bg-orange-400' },
  bollinger: { label: 'Bollinger', color: '#f59e0b', dotColor: 'bg-amber-400' },
  sr: { label: 'S/R', color: '#94a3b8', dotColor: 'bg-slate-400' },
};

// ── Chart Tab ────────────────────────────────────────────────────────────────

function ChartTab({
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
    // When a candle closes, refetch full history so the closed candle is
    // persisted correctly and indicators recalculate.
    if (kline.isClosed) refetch();
  }, [kline, refetch]);

  // Apply/remove price lines whenever overlays or snapshot change
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Remove all existing price lines
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

    // EMA lines
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

    // Bollinger Bands (dashed)
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

    // Support / Resistance
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

    // Signal that a new series is ready so the overlay effect re-runs
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

      {/* Toolbar: indicators + intervals + refresh — all in one row */}
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

// ── Main page ──────────────────────────────────────────────────────────────────

export function MarketPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [activeTab, setActiveTab] = useState<'chart' | 'analysis'>(() =>
    location.hash === '#indicators' ? 'analysis' : 'chart',
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-switch to analysis tab when navigating with #indicators hash
  useEffect(() => {
    if (location.hash === '#indicators') {
      setActiveTab('analysis');
    }
  }, [location.hash]);
  const { data: sharedSnapshot } = useMarketSnapshot(selectedSymbol);

  useGSAP(
    () => {
      gsap.fromTo(
        '.market-panel',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [selectedSymbol, activeTab] },
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

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setActiveTab('chart')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'chart'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          {t('market.tabChart')}
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'analysis'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Activity className="h-4 w-4" />
          {t('market.tabAnalysis')}
        </button>
      </div>

      {/* Tab content */}
      <div className="market-panel">
        {activeTab === 'chart' ? (
          <ChartTab symbol={selectedSymbol} snapshot={sharedSnapshot} />
        ) : (
          <SnapshotPanel symbol={selectedSymbol} />
        )}
      </div>
    </div>
  );
}
