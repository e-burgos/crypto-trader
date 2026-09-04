import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { EntryOrderWire } from '@crypto-trader/shared';
import { EntryOrderCancelReasonLegend } from './entry-order-cancel-reason-legend';
import {
  filledLegLabelKey,
  formatEntryOrderDateTime,
  formatEntryOrderNumber,
  resolveEntryOrderStatus,
  resolveFilledLeg,
} from './entry-order-labels';

interface EntryOrderOutcomeCellProps {
  entry: EntryOrderWire;
}

export function EntryOrderOutcomeCell({ entry }: EntryOrderOutcomeCellProps) {
  const { t } = useTranslation();
  const status = resolveEntryOrderStatus(entry.status);

  return (
    <div className="flex flex-col gap-1">
      {status === 'RESTING' && (
        <span>
          {t('positions.entries.outcome.expiresAt', {
            when: formatEntryOrderDateTime(entry.expiresAt),
          })}
        </span>
      )}
      {status === 'FILLED' && <FilledOutcome entry={entry} />}
      {status === 'CANCELLED' && entry.settledAt !== null && (
        <span>
          {t('positions.entries.outcome.cancelledAt', {
            when: formatEntryOrderDateTime(entry.settledAt),
          })}
        </span>
      )}
      {status === 'EXPIRED' && (
        <span>
          {t('positions.entries.outcome.expiredAt', {
            when: formatEntryOrderDateTime(entry.settledAt ?? entry.expiresAt),
          })}
        </span>
      )}
      {status === 'MISSING' && <span>{t('positions.entries.outcome.missing')}</span>}
      <EntryOrderCancelReasonLegend cancelReason={entry.cancelReason} />
    </div>
  );
}

function FilledOutcome({ entry }: { entry: EntryOrderWire }) {
  const { t } = useTranslation();
  const legKey = filledLegLabelKey(resolveFilledLeg(entry.filledLeg));

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1">
        {legKey && <span>{t(legKey)}</span>}
        {entry.executedPrice !== null && (
          <span className="font-mono">
            {t('positions.entries.fill.price', {
              price: formatEntryOrderNumber(entry.executedPrice),
            })}
          </span>
        )}
        {entry.executedQuantity !== null && (
          <span className="text-muted-foreground">
            {t('positions.entries.fill.quantity', { qty: entry.executedQuantity })}
          </span>
        )}
      </div>
      {entry.positionId !== null && (
        <Link
          to={`/dashboard/positions?tab=open&positionId=${entry.positionId}`}
          className="text-xs text-primary hover:underline"
        >
          {t('positions.entries.fill.viewPosition')}
        </Link>
      )}
    </div>
  );
}
