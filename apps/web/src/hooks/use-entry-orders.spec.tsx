import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntryOrderWire, EntryOrdersPageWire } from '@crypto-trader/shared';
import {
  buildEntryOrdersQuery,
  dedupeEntryOrders,
  entryOrdersListKey,
  useEntryOrders,
  type EntryOrdersFilters,
} from './use-entry-orders';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '../lib/api';

function makeEntryOrder(overrides: Partial<EntryOrderWire>): EntryOrderWire {
  return {
    id: 'eo-1',
    configId: 'cfg-1',
    symbol: 'BTCUSDT',
    mode: 'SANDBOX',
    entryMode: 'LIMIT_MAKER',
    status: 'RESTING',
    quantity: 1,
    limitPrice: 100,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 100,
    plannedNotionalUsd: 100,
    clientOrderId: 'client-1',
    orderListId: null,
    orderId: null,
    placedAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-09-02T00:00:00.000Z',
    filledLeg: null,
    executedPrice: null,
    executedQuantity: null,
    positionId: null,
    cancelReason: null,
    settledAt: null,
    ...overrides,
  } satisfies EntryOrderWire;
}

const PAGE_1: EntryOrdersPageWire = {
  items: [makeEntryOrder({ id: 'eo-1' }), makeEntryOrder({ id: 'eo-2' })],
  nextCursor: 'eo-2',
} satisfies EntryOrdersPageWire;

const PAGE_2: EntryOrdersPageWire = {
  items: [makeEntryOrder({ id: 'eo-2' }), makeEntryOrder({ id: 'eo-3' })],
  nextCursor: null,
} satisfies EntryOrdersPageWire;

const DEFAULT_FILTERS: EntryOrdersFilters = { status: 'ALL', configId: 'ALL' };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('buildEntryOrdersQuery', () => {
  it('omits every filter set to ALL', () => {
    expect(buildEntryOrdersQuery(DEFAULT_FILTERS)).toBe('');
  });

  it('emits configId and status when filters are set', () => {
    const query = buildEntryOrdersQuery({ status: 'RESTING', configId: 'cfg-1' });
    expect(query).toContain('configId=cfg-1');
    expect(query).toContain('status=RESTING');
  });

  it('never emits limit nor since', () => {
    const query = buildEntryOrdersQuery({ status: 'FILLED', configId: 'cfg-1' }, 'cursor-x');
    expect(query).not.toContain('limit=');
    expect(query).not.toContain('since=');
  });

  it('emits cursor when passed', () => {
    const query = buildEntryOrdersQuery(DEFAULT_FILTERS, 'cursor-x');
    expect(query).toBe('cursor=cursor-x');
  });
});

describe('dedupeEntryOrders', () => {
  it('flattens pages keeping the first occurrence of a repeated id', () => {
    const result = dedupeEntryOrders([PAGE_1, PAGE_2]);
    const ids = result.map((item) => item.id);
    expect(result).toHaveLength(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['eo-1', 'eo-2', 'eo-3']);
  });
});

describe('useEntryOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the next page with the nextCursor received from the previous page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);

    const { result } = renderHook(() => useEntryOrders(DEFAULT_FILTERS), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    const secondCallUrl = vi.mocked(api.get).mock.calls[1][0];
    expect(secondCallUrl).toContain('cursor=eo-2');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('has no next page when nextCursor is null', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(PAGE_2);

    const { result } = renderHook(() => useEntryOrders(DEFAULT_FILTERS), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('stops paginating when a page repeats the cursor that was requested for it', async () => {
    const firstPage: EntryOrdersPageWire = {
      items: [makeEntryOrder({ id: 'eo-1' })],
      nextCursor: 'eo-2',
    };
    const loopingPage: EntryOrdersPageWire = {
      items: [makeEntryOrder({ id: 'eo-2' })],
      nextCursor: 'eo-2',
    };
    vi.mocked(api.get).mockResolvedValueOnce(firstPage).mockResolvedValueOnce(loopingPage);

    const { result } = renderHook(() => useEntryOrders(DEFAULT_FILTERS), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('resets pagination when filters change to a distinct queryKey without a cursor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);

    const filtersA: EntryOrdersFilters = { status: 'ALL', configId: 'ALL' };
    const filtersB: EntryOrdersFilters = { status: 'RESTING', configId: 'ALL' };

    expect(entryOrdersListKey(filtersA)).not.toEqual(entryOrdersListKey(filtersB));

    const { result, rerender } = renderHook(
      ({ filters }) => useEntryOrders(filters),
      { wrapper: createWrapper(), initialProps: { filters: filtersA } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ filters: filtersB });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const lastCallUrl = vi.mocked(api.get).mock.calls[1][0];
    expect(lastCallUrl).not.toContain('cursor=');
    expect(lastCallUrl).toContain('status=RESTING');
  });
});
