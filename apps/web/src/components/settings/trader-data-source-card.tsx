import { Card, Badge, Button } from '@crypto-trader/ui';
import type { BadgeVariant } from '@crypto-trader/ui';
import { Key, Trash2, DollarSign } from 'lucide-react';
import type { TraderDataSourceInfo } from '../../hooks/use-trader-data-sources';
import { useDeleteTraderCredential } from '../../hooks/use-trader-data-sources';
import { categoryLabel } from './data-source-categories';

interface TraderDataSourceCardProps {
  source: TraderDataSourceInfo;
  onSetKey: (source: TraderDataSourceInfo) => void;
}

const healthConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  healthy: { label: 'Healthy', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  down: { label: 'Down', variant: 'error' },
  unknown: { label: 'Unknown', variant: 'neutral' },
};

function getCredentialBadge(source: TraderDataSourceInfo): {
  label: string;
  variant: BadgeVariant;
} {
  if (source.hasOwnCredential) {
    return { label: 'Your key ✓', variant: 'success' };
  }
  if (source.hasSharedCredential) {
    return { label: 'Admin shared', variant: 'neutral' };
  }
  if (source.requiresApiKey) {
    return { label: 'Key required', variant: 'warning' };
  }
  return { label: 'Free', variant: 'neutral' };
}

export function TraderDataSourceCard({
  source,
  onSetKey,
}: TraderDataSourceCardProps) {
  const { mutate: deleteCredential, isPending: isDeleting } =
    useDeleteTraderCredential();

  const healthCfg = healthConfig[source.health] ?? healthConfig.unknown;
  const credentialBadge = getCredentialBadge(source);

  return (
    <Card className="p-4" data-testid="trader-data-source-card">
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1.5 break-words">
            {source.displayName}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={healthCfg.variant} label={healthCfg.label} />
            <Badge
              variant={credentialBadge.variant}
              label={credentialBadge.label}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-1">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {source.monthlyCostUsd === 0
                ? 'Free'
                : `$${source.monthlyCostUsd}/mo`}
            </span>
            <span className="text-zinc-600">•</span>
            <span>{categoryLabel(source.category)}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {source.hasOwnCredential ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteCredential(source.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {isDeleting ? 'Removing...' : 'Remove Key'}
            </Button>
          ) : source.requiresApiKey ? (
            <Button variant="ghost" size="sm" onClick={() => onSetKey(source)}>
              <Key className="h-3.5 w-3.5 mr-1" />
              Set Key
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
