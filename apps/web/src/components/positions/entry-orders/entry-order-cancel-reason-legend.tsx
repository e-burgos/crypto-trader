import { useTranslation } from 'react-i18next';
import type { EntryOrderCancelReasonWire } from '@crypto-trader/shared';
import {
  entryOrderCancelReasonLabelKey,
  resolveEntryOrderCancelReason,
} from './entry-order-labels';

interface EntryOrderCancelReasonLegendProps {
  cancelReason: EntryOrderCancelReasonWire | null;
}

export function EntryOrderCancelReasonLegend({ cancelReason }: EntryOrderCancelReasonLegendProps) {
  const { t } = useTranslation();
  const resolved = resolveEntryOrderCancelReason(cancelReason);

  if (resolved === null) return null;

  return <p className="text-xs text-muted-foreground">{t(entryOrderCancelReasonLabelKey(resolved))}</p>;
}
