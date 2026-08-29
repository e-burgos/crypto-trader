import { useState, useMemo } from 'react';
import {
  Database,
  ShieldCheck,
  KeyRound,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { Badge, Spinner } from '@crypto-trader/ui';
import {
  useTraderDataSources,
  type TraderDataSourceInfo,
} from '../../../hooks/use-trader-data-sources';
import { TraderDataSourceCard } from '../../../components/settings/trader-data-source-card';
import { TraderApiKeyModal } from '../../../components/settings/trader-api-key-modal';
import {
  categoryLabel,
  orderedCategories,
} from '../../../components/settings/data-source-categories';

export function SettingsDataSourcesPage() {
  const { data, isLoading } = useTraderDataSources();
  const [modalSource, setModalSource] = useState<TraderDataSourceInfo | null>(
    null,
  );

  const sources = data?.sources ?? [];

  const stats = useMemo(() => {
    const active = sources.filter((s) => s.isActive).length;
    const ownKey = sources.filter((s) => s.hasOwnCredential).length;
    const shared = sources.filter(
      (s) => s.hasSharedCredential && !s.hasOwnCredential,
    ).length;
    const noKey = sources.filter(
      (s) => s.requiresApiKey && !s.hasOwnCredential && !s.hasSharedCredential,
    ).length;
    return { active, ownKey, shared, noKey };
  }, [sources]);

  const grouped = useMemo(() => {
    const groups: Record<string, TraderDataSourceInfo[]> = {};
    for (const s of sources) {
      const cat = s.category || 'ALTERNATIVE';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [sources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Data Sources</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your data source API keys. Sources can use admin-shared keys or
          your own personal keys for higher rate limits.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Active:</span>
          <span className="font-medium">{stats.active}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
          <KeyRound className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground">Own key:</span>
          <span className="font-medium">{stats.ownKey}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-muted-foreground">Admin shared:</span>
          <span className="font-medium">{stats.shared}</span>
        </div>
        {stats.noKey > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground">No key:</span>
            <span className="font-medium text-amber-500">{stats.noKey}</span>
          </div>
        )}
      </div>

      {/* Sources grouped by category */}
      {orderedCategories(Object.keys(grouped)).map((cat) => (
        <div key={cat} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {categoryLabel(cat)}
            </h2>
            <Badge variant="neutral" label={String(grouped[cat].length)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[cat].map((source) => (
              <TraderDataSourceCard
                key={source.id}
                source={source}
                onSetKey={setModalSource}
              />
            ))}
          </div>
        </div>
      ))}

      {sources.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No data sources configured yet.
        </div>
      )}

      {/* Modal */}
      {modalSource && (
        <TraderApiKeyModal
          sourceId={modalSource.id}
          sourceName={modalSource.displayName}
          onClose={() => setModalSource(null)}
          onSuccess={() => setModalSource(null)}
        />
      )}
    </div>
  );
}
