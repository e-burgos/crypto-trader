import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  EntryOrderStatusWire,
  EntryOrderWire,
  EntryOrdersPageWire,
} from '@crypto-trader/shared';

export const ENTRY_ORDERS_QUERY_ROOT = ['trading', 'entry-orders'] as const;

export type EntryOrderStatusFilter = EntryOrderStatusWire | 'ALL';
export type EntryOrderBotFilter = string | 'ALL';

export interface EntryOrdersFilters {
  status: EntryOrderStatusFilter;
  configId: EntryOrderBotFilter;
}

export const ENTRY_ORDERS_DEFAULT_FILTERS: EntryOrdersFilters = {
  status: 'ALL',
  configId: 'ALL',
};

export function entryOrdersListKey(filters: EntryOrdersFilters) {
  return [...ENTRY_ORDERS_QUERY_ROOT, 'list', filters.status, filters.configId] as const;
}

export function restingEntriesKey(configId: string) {
  return [...ENTRY_ORDERS_QUERY_ROOT, 'resting', configId] as const;
}

export function buildEntryOrdersQuery(
  filters: EntryOrdersFilters,
  cursor?: string,
): string {
  const params = new URLSearchParams();
  if (filters.configId !== 'ALL') params.set('configId', filters.configId);
  if (filters.status !== 'ALL') params.set('status', filters.status);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export function dedupeEntryOrders(pages: EntryOrdersPageWire[]): EntryOrderWire[] {
  const seen = new Set<string>();
  const result: EntryOrderWire[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

export function useEntryOrders(filters: EntryOrdersFilters) {
  return useInfiniteQuery({
    queryKey: entryOrdersListKey(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<EntryOrdersPageWire>(
        `/trading/entry-orders?${buildEntryOrdersQuery(filters, pageParam)}`,
      ),
    getNextPageParam: (last, _all, lastParam) =>
      last.nextCursor && last.nextCursor !== lastParam ? last.nextCursor : undefined,
    staleTime: 15_000,
  });
}

export function useRestingEntries(configId: string) {
  return useQuery({
    queryKey: restingEntriesKey(configId),
    queryFn: () =>
      api.get<EntryOrdersPageWire>(
        `/trading/entry-orders?configId=${encodeURIComponent(configId)}&status=RESTING&limit=200`,
      ),
    staleTime: 15_000,
  });
}
