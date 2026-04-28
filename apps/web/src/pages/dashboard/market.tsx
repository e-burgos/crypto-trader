import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, RefreshCw } from 'lucide-react';
import { useMarketSnapshot, MARKET_SYMBOLS } from '../../hooks/use-market';
import {
  LiveTickerPanel,
  SnapshotPanel,
  ChartTab,
} from '../../components/market';
import { Tabs, Tooltip } from '@crypto-trader/ui';

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="text-2xl font-bold whitespace-nowrap">
              {t('market.title')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('market.subtitle')}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1 whitespace-nowrap">
          <span className="hidden sm:inline">{t('market.autoRefresh')}</span>
          <Tooltip
            content={t('market.autoRefresh')}
            side="bottom"
            align="end"
            className="sm:hidden"
          >
            <RefreshCw className="h-4 w-4" />
          </Tooltip>
        </div>
      </div>

      {/* Pair selector */}
      <Tabs
        tabs={MARKET_SYMBOLS.map(({ symbol, label }) => ({
          value: symbol,
          label,
        }))}
        value={selectedSymbol}
        onChange={setSelectedSymbol}
        border
      />

      {/* Live real-time ticker */}
      <LiveTickerPanel symbol={selectedSymbol} />

      {/* Tab switcher */}
      <Tabs
        tabs={[
          {
            value: 'chart',
            label: t('market.tabChart'),
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            value: 'analysis',
            label: t('market.tabAnalysis'),
            icon: <Activity className="h-4 w-4" />,
          },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'chart' | 'analysis')}
        border
      />

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
