import { useQuery } from '@tanstack/react-query';
import type { EnrichedMarketSnapshot } from '@crypto-trader/shared';
import { api } from '../lib/api';

export function useEnrichedSnapshot(symbol: string) {
  return useQuery<EnrichedMarketSnapshot>({
    queryKey: ['market', 'enriched-snapshot', symbol],
    queryFn: () => api.get(`/market/enriched-snapshot/${symbol}`),
    refetchInterval: 120_000,
  });
}
