import { Badge } from '@crypto-trader/ui';
import type { BadgeVariant } from '@crypto-trader/ui';

interface DataSourceHealthBadgeProps {
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
}

const healthConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  healthy: {
    label: 'Healthy',
    variant: 'success',
  },
  degraded: {
    label: 'Degraded',
    variant: 'warning',
  },
  down: {
    label: 'Down',
    variant: 'error',
  },
  unknown: {
    label: 'Unknown',
    variant: 'neutral',
  },
};

export function DataSourceHealthBadge({ health }: DataSourceHealthBadgeProps) {
  const cfg = healthConfig[health] ?? healthConfig.unknown;
  return <Badge variant={cfg.variant} label={cfg.label} />;
}
