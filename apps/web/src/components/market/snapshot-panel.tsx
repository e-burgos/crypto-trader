import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  useMarketSnapshot,
  deriveOverallSignal,
  deriveOpportunity,
} from '../../hooks/use-market';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';
import { IndicatorInfoModal, type IndicatorKey } from '@crypto-trader/ui';
import {
  SIGNAL_CONFIG,
  rsiColor,
  macdColor,
  trendColor,
  bollingerColor,
  volumeColor,
  InfoButton,
  IndicatorRow,
  SRLevels,
} from './constants';
import { OpportunityPanel } from './opportunity-panel';

export function SnapshotPanel({ symbol }: { symbol: string }) {
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
      {/* Opportunity Panel (top) */}
      <OpportunityPanel opp={opportunity} onOpenInfo={setInfoModal} />

      {/* Price header */}
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

      {/* Refresh */}
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
