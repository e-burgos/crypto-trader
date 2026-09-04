import { useTranslation } from 'react-i18next';
import { Button, Callout, EmptyState } from '@crypto-trader/ui';
import { dedupeEntryOrders, useEntryOrders, type EntryOrdersFilters as EntryOrdersFiltersState } from '../../../hooks/use-entry-orders';
import { useTradingConfigs } from '../../../hooks/use-trading';
import { EntryOrdersFilters } from './entry-orders-filters';
import { EntryOrdersTable } from './entry-orders-table';

interface EntryOrdersPanelProps {
  filters: EntryOrdersFiltersState;
  onFiltersChange: (filters: EntryOrdersFiltersState) => void;
  highlightEntryOrderId?: string;
}

export function EntryOrdersPanel({
  filters,
  onFiltersChange,
  highlightEntryOrderId,
}: EntryOrdersPanelProps) {
  const { t } = useTranslation();
  const { data: configsData } = useTradingConfigs();
  const configs = configsData ?? [];
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useEntryOrders(filters);
  const entries = data ? dedupeEntryOrders(data.pages) : [];
  const hasActiveFilter = filters.status !== 'ALL' || filters.configId !== 'ALL';

  return (
    <div className="space-y-4">
      <EntryOrdersFilters filters={filters} configs={configs} onChange={onFiltersChange} />

      {isError ? (
        <Callout variant="danger" title={t('positions.entries.error.title')}>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            {t('positions.entries.error.retry')}
          </Button>
        </Callout>
      ) : !isPending && entries.length === 0 ? (
        <EmptyState
          title={t('positions.entries.empty.title')}
          description={
            hasActiveFilter
              ? t('positions.entries.empty.filteredHint')
              : t('positions.entries.empty.hint')
          }
        />
      ) : (
        <EntryOrdersTable
          entries={entries}
          configs={configs}
          highlightEntryOrderId={highlightEntryOrderId}
          isLoading={isPending}
        />
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage
              ? t('positions.entries.loadingMore')
              : t('positions.entries.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
