import { useTranslation } from 'react-i18next';
import { Badge } from '@crypto-trader/ui';
import type { EntryOrderStatusWire } from '@crypto-trader/shared';
import {
  entryOrderStatusBadgeVariant,
  entryOrderStatusLabelKey,
  resolveEntryOrderStatus,
} from './entry-order-labels';

interface EntryOrderStatusBadgeProps {
  status: EntryOrderStatusWire;
}

export function EntryOrderStatusBadge({ status }: EntryOrderStatusBadgeProps) {
  const { t } = useTranslation();
  const resolved = resolveEntryOrderStatus(status);

  return (
    <Badge
      variant={entryOrderStatusBadgeVariant(resolved)}
      label={t(entryOrderStatusLabelKey(resolved))}
    />
  );
}
