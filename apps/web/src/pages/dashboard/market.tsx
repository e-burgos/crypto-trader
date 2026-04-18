import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useMarketSnapshot, MARKET_SYMBOLS } from '../../hooks/use-market';
import {
  LiveTickerPanel,
  SnapshotPanel,
  ChartTab,
} from '../../components/market';

gsap.registerPlugin(useGSAP);

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
