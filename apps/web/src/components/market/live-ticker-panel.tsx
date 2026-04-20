import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Activity, Wifi, WifiOff, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useBinanceTicker } from '../../hooks/use-binance-ticker';

export function LiveTickerPanel({ symbol }: { symbol: string }) {
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
