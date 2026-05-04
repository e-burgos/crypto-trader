import { useRef, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { Button, Spinner, Badge } from '@crypto-trader/ui';
import { DataSourceCard } from '../../components/admin/data-source-card';
import { DataSourceMetrics } from '../../components/admin/data-source-metrics';
import { ApiKeyModal } from '../../components/admin/api-key-modal';
import {
  useDataSources,
  useToggleDataSource,
  useHealthCheckAll,
} from '../../hooks/use-data-sources';
import { useDataSourceEvents } from '../../hooks/use-data-source-events';
import { useTranslation } from 'react-i18next';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type {
  DataSourceCategoryType,
  DataSourceStatus,
} from '@crypto-trader/shared';

const CATEGORY_LABELS: Record<DataSourceCategoryType, string> = {
  SENTIMENT: 'Sentiment',
  DERIVATIVES: 'Derivatives',
  DEFI_ONCHAIN: 'DeFi / On-chain',
  NEWS: 'News',
  MARKET_DATA: 'Market Data',
  PREDICTION: 'Prediction',
  TOKEN_UNLOCKS: 'Token Unlocks',
  TECHNICAL: 'Technical Analysis',
};

const CATEGORY_ORDER: DataSourceCategoryType[] = [
  'SENTIMENT',
  'DERIVATIVES',
  'DEFI_ONCHAIN',
  'NEWS',
  'MARKET_DATA',
  'PREDICTION',
  'TOKEN_UNLOCKS',
  'TECHNICAL',
];

export function AdminDataSourcesPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [apiKeySource, setApiKeySource] = useState<DataSourceStatus | null>(
    null,
  );
  const { data, isLoading } = useDataSources();
  const toggleMutation = useToggleDataSource();
  const healthCheckAll = useHealthCheckAll();
  const { events: dsEvents } = useDataSourceEvents();

  const sources = data?.sources ?? [];
  const activeSources = sources.filter((s) => s.isActive);
  const totalCost = sources.reduce(
    (sum, s) => sum + (s.isActive ? s.monthlyCostUsd : 0),
    0,
  );
  const allHealthy = activeSources.every((s) => s.health === 'healthy');

  // Group sources by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    sources: sources.filter((s) => s.category === cat),
  })).filter((g) => g.sources.length > 0);

  useGSAP(
    () => {
      if (!isLoading) {
        gsap.fromTo(
          '.ds-card',
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.06,
            duration: 0.35,
            ease: 'power2.out',
          },
        );
      }
    },
    { scope: containerRef, dependencies: [isLoading] },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            {t('admin.dataSources.title')}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {t('admin.dataSources.subtitle')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => healthCheckAll.mutate()}
          disabled={healthCheckAll.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${healthCheckAll.isPending ? 'animate-spin' : ''}`}
          />
          {t('admin.dataSources.healthCheckAll')}
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge
          variant="neutral"
          label={`${activeSources.length}/${sources.length} ${t('admin.dataSources.active')}`}
        />
        <Badge variant="neutral" label={`$${totalCost}/mo`} />
        <Badge
          variant={allHealthy ? 'success' : 'warning'}
          label={
            allHealthy
              ? t('admin.dataSources.allHealthy')
              : t('admin.dataSources.issuesDetected')
          }
        />
      </div>

      {/* Metrics section (F5) */}
      <DataSourceMetrics />

      {/* Grouped source cards */}
      {grouped.map((group) => (
        <div key={group.category}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            {group.label}
          </h2>
          <div className="space-y-2">
            {group.sources.map((source) => (
              <div key={source.id} className="ds-card">
                <DataSourceCard
                  source={source}
                  onToggle={(id, isActive) =>
                    toggleMutation.mutate({ id, isActive })
                  }
                  onApiKeyClick={setApiKeySource}
                  isToggling={toggleMutation.isPending}
                  realtimeEvent={dsEvents.get(source.name)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* API Key modal */}
      {apiKeySource && (
        <ApiKeyModal
          source={apiKeySource}
          onClose={() => setApiKeySource(null)}
        />
      )}
    </div>
  );
}
