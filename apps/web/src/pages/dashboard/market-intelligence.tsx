import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, RefreshCw } from 'lucide-react';
import { Tabs } from '@crypto-trader/ui';
import { cn } from '../../lib/utils';
import { useEnrichedSnapshot } from '../../hooks/use-enriched-snapshot';
import {
  FearGreedGauge,
  DerivativesPanel,
  DefiHealthPanel,
  GlobalMarketPanel,
  NewsSentimentList,
  PredictionMarketsList,
  TokenUnlocksTable,
  TechnicalSignalsPanel,
} from '../../components/market-intelligence';

const MARKET_ASSETS = [
  { asset: 'BTC', label: 'Bitcoin', symbol: 'BTCUSDT' },
  { asset: 'ETH', label: 'Ethereum', symbol: 'ETHUSDT' },
] as const;

export function MarketIntelligencePage() {
  const { t } = useTranslation();
  const [asset, setAsset] = useState<string>(MARKET_ASSETS[0].asset);
  const activeSymbol =
    MARKET_ASSETS.find((a) => a.asset === asset)?.symbol ?? 'BTCUSDT';
  const { data, isLoading, refetch, isFetching } =
    useEnrichedSnapshot(activeSymbol);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            {t('marketIntelligence.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'marketIntelligence.subtitle',
              'Enriched market data from multiple external sources',
            )}
          </p>
        </div>
      </div>

      {/* Asset selector + refresh for market data panels */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Tabs
          tabs={MARKET_ASSETS.map((a) => ({
            value: a.asset,
            label: a.label,
          }))}
          value={asset}
          onChange={setAsset}
          border
        />
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
          />
          {t('marketIntelligence.refresh')}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {/* Market data panels */}
      {data && (
        <div className="space-y-5">
          {/* Primary panels — only render panels with data */}
          {(() => {
            const panels = [
              data.fearGreed && (
                <FearGreedGauge key="fg" data={data.fearGreed} />
              ),
              data.derivatives && (
                <DerivativesPanel key="dv" data={data.derivatives} />
              ),
              data.defiHealth && (
                <DefiHealthPanel key="dh" data={data.defiHealth} />
              ),
              data.technicalSignals && data.technicalSignals.length > 0 && (
                <TechnicalSignalsPanel key="ts" data={data.technicalSignals} />
              ),
            ].filter(Boolean);
            return panels.length > 0 ? (
              <div
                className={cn(
                  'grid grid-cols-1 gap-4',
                  panels.length === 1 && 'md:grid-cols-1',
                  panels.length === 2 && 'md:grid-cols-2',
                  panels.length >= 3 && 'md:grid-cols-2 xl:grid-cols-2',
                )}
              >
                {panels}
              </div>
            ) : null;
          })()}

          {/* Global market + Predictions */}
          {(() => {
            const panels = [
              data.globalMarket && (
                <GlobalMarketPanel key="gm" data={data.globalMarket} />
              ),
              data.predictions && (
                <PredictionMarketsList key="pm" data={data.predictions} />
              ),
            ].filter(Boolean);
            return panels.length > 0 ? (
              <div
                className={cn(
                  'grid grid-cols-1 gap-4',
                  panels.length === 2 && 'md:grid-cols-2',
                )}
              >
                {panels}
              </div>
            ) : null;
          })()}

          {/* News + Unlocks */}
          {(() => {
            const panels = [
              data.news && data.news.length > 0 && (
                <NewsSentimentList key="ns" data={data.news} />
              ),
              data.tokenUnlocks && data.tokenUnlocks.length > 0 && (
                <TokenUnlocksTable key="tu" data={data.tokenUnlocks} />
              ),
            ].filter(Boolean);
            return panels.length > 0 ? (
              <div
                className={cn(
                  'grid grid-cols-1 gap-4',
                  panels.length === 2 && 'md:grid-cols-2',
                )}
              >
                {panels}
              </div>
            ) : null;
          })()}

          {/* Metadata footer */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
            <span>
              {t('marketIntelligence.activeSources')}:{' '}
              {data.activeSources.length}
            </span>
            {data.failedSources.length > 0 && (
              <span className="text-yellow-500">
                {t('marketIntelligence.failedSources')}:{' '}
                {data.failedSources.join(', ')}
              </span>
            )}
            <span>
              {t('marketIntelligence.buildTime')}: {data.snapshotBuildTimeMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
