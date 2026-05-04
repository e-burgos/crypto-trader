import { Card, ToggleSwitch } from '@crypto-trader/ui';
import { DataSourceHealthBadge } from './data-source-health-badge';
import { Bot, DollarSign, KeyRound } from 'lucide-react';
import type { DataSourceStatus } from '@crypto-trader/shared';
import type { DataSourceEvent } from '../../hooks/use-data-source-events';
import { useTranslation } from 'react-i18next';

interface DataSourceCardProps {
  source: DataSourceStatus;
  onToggle: (id: string, isActive: boolean) => void;
  onApiKeyClick?: (source: DataSourceStatus) => void;
  isToggling?: boolean;
  realtimeEvent?: DataSourceEvent;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return '—';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DataSourceCard({
  source,
  onToggle,
  onApiKeyClick,
  isToggling,
  realtimeEvent,
}: DataSourceCardProps) {
  const { t } = useTranslation();

  // Real-time status indicator from WebSocket events
  const rtBadge = realtimeEvent ? (
    realtimeEvent.type === 'degraded' ? (
      <span
        className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse"
        title="Degraded (live)"
      />
    ) : realtimeEvent.type === 'recovered' ? (
      <span
        className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-ping"
        title="Recovered (live)"
      />
    ) : null
  ) : null;

  return (
    <Card className="p-4" data-testid="data-source-card">
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {source.displayName}
            </span>
            <DataSourceHealthBadge health={source.health} />
            {rtBadge}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {/* Target agents */}
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {source.targetAgents.join(', ').toUpperCase() || 'All'}
            </span>

            {/* Cost */}
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {source.monthlyCostUsd === 0
                ? t('admin.dataSources.free')
                : `$${source.monthlyCostUsd}/mo`}
            </span>
          </div>

          {/* Last success */}
          {source.isActive && (
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('admin.dataSources.lastSuccess')}:{' '}
              {formatRelativeTime(source.lastSuccessAt)}
              {source.lastErrorMessage && (
                <span className="text-red-400 ml-2">
                  — {source.lastErrorMessage}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApiKeyClick?.(source)}
            className={`rounded-md p-1.5 transition-colors ${
              source.hasUserCredential
                ? 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                : 'text-zinc-500 hover:text-primary hover:bg-primary/10'
            }`}
            title={
              source.hasUserCredential
                ? t('admin.dataSources.keyConfigured')
                : t('admin.dataSources.configureKey')
            }
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <ToggleSwitch
            checked={source.isActive}
            onChange={() => onToggle(source.id, !source.isActive)}
            disabled={isToggling}
            size="sm"
          />
        </div>
      </div>
    </Card>
  );
}
