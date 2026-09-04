import { useTranslation } from 'react-i18next';
import type { EntryOrderWire } from '@crypto-trader/shared';
import { formatEntryOrderUsd, resolveEntryOrderMode } from './entry-order-labels';

interface EntryOrderLevelCellProps {
  entry: EntryOrderWire;
}

export function EntryOrderLevelCell({ entry }: EntryOrderLevelCellProps) {
  const { t } = useTranslation();
  const mode = resolveEntryOrderMode(entry.entryMode);

  return (
    <div className="flex flex-col">
      <span className="font-mono">{formatEntryOrderUsd(entry.limitPrice)}</span>
      {mode === 'OCO' && entry.trailingDeltaBips !== null && (
        <span className="text-xs text-muted-foreground">
          {t('positions.entries.level.trailing', { bips: entry.trailingDeltaBips })}
        </span>
      )}
      {mode === 'OCO' &&
        entry.trailingDeltaBips === null &&
        entry.stopPrice !== null &&
        entry.stopLimitPrice !== null && (
          <span className="text-xs text-muted-foreground">
            {t('positions.entries.level.stopPair', {
              stop: formatEntryOrderUsd(entry.stopPrice),
              stopLimit: formatEntryOrderUsd(entry.stopLimitPrice),
            })}
          </span>
        )}
    </div>
  );
}
