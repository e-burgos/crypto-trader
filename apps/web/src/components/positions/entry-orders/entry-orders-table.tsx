import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntryOrderWire, TradingConfigWire } from '@crypto-trader/shared';
import { cn, DataTable, InfoTooltip, type DataTableColumn } from '@crypto-trader/ui';
import {
  entryOrderModeBadgeClassName,
  entryOrderModeLabelKey,
  formatEntryOrderDateTime,
  formatEntryOrderUsd,
  hasKnownConfig,
  resolveBotLabel,
  resolveEntryOrderMode,
} from './entry-order-labels';
import { EntryOrderStatusBadge } from './entry-order-status-badge';
import { EntryOrderLevelCell } from './entry-order-level-cell';
import { EntryOrderOutcomeCell } from './entry-order-outcome-cell';

interface EntryOrdersTableProps {
  entries: EntryOrderWire[];
  configs: TradingConfigWire[];
  highlightEntryOrderId?: string;
  isLoading?: boolean;
}

export function EntryOrdersTable({
  entries,
  configs,
  highlightEntryOrderId,
  isLoading = false,
}: EntryOrdersTableProps) {
  const { t } = useTranslation();

  const columns: DataTableColumn<EntryOrderWire>[] = useMemo(
    () => [
      {
        key: 'bot',
        header: t('positions.entries.columns.bot'),
        render: (entry) => {
          const isKnown = hasKnownConfig(entry.configId, configs);
          return (
            <div className="flex flex-col">
              {entry.id === highlightEntryOrderId && (
                <span className="sr-only">{t('positions.entries.highlighted')}</span>
              )}
              <span className={cn('flex items-center gap-1 font-medium', !isKnown && 'font-mono')}>
                {resolveBotLabel(entry.configId, configs)}
                {!isKnown && <InfoTooltip text={t('positions.entries.unknownBot')} />}
              </span>
              <span className="text-xs text-muted-foreground">{entry.symbol}</span>
            </div>
          );
        },
      },
      {
        key: 'mode',
        header: t('trading.mode'),
        render: (entry) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              entryOrderModeBadgeClassName(entry.mode),
            )}
          >
            {entry.mode}
          </span>
        ),
      },
      {
        key: 'entryMode',
        header: t('positions.entries.columns.type'),
        render: (entry) => <span>{t(entryOrderModeLabelKey(resolveEntryOrderMode(entry.entryMode)))}</span>,
      },
      {
        key: 'level',
        header: t('positions.entries.columns.level'),
        render: (entry) => <EntryOrderLevelCell entry={entry} />,
      },
      {
        key: 'notional',
        header: (
          <span className="inline-flex items-center gap-1">
            {t('positions.entries.columns.notional')}
            <InfoTooltip text={t('positions.entries.notionalHint')} />
          </span>
        ),
        align: 'right' as const,
        render: (entry) => <span className="font-mono">{formatEntryOrderUsd(entry.plannedNotionalUsd)}</span>,
      },
      {
        key: 'status',
        header: t('positions.entries.columns.status'),
        render: (entry) => <EntryOrderStatusBadge status={entry.status} />,
      },
      {
        key: 'outcome',
        header: t('positions.entries.columns.outcome'),
        render: (entry) => <EntryOrderOutcomeCell entry={entry} />,
      },
      {
        key: 'placedAt',
        header: t('positions.entries.columns.placed'),
        render: (entry) => (
          <span className="text-muted-foreground">{formatEntryOrderDateTime(entry.placedAt)}</span>
        ),
      },
    ],
    [t, configs, highlightEntryOrderId],
  );

  return (
    <DataTable
      columns={columns}
      data={entries}
      rowKey={(entry) => entry.id}
      isLoading={isLoading}
      rowClassName={(entry) =>
        cn(
          'entry-order-row',
          entry.id === highlightEntryOrderId && 'ring-2 ring-primary/40 bg-primary/5',
        )
      }
    />
  );
}
