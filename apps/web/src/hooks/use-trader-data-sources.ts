import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface TraderDataSourceInfo {
  id: string;
  name: string;
  displayName: string;
  category: 'NEWS' | 'PRICE' | 'ONCHAIN' | 'SOCIAL' | 'ALTERNATIVE';
  isActive: boolean;
  requiresApiKey: boolean;
  monthlyCostUsd: number;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  hasOwnCredential: boolean;
  hasSharedCredential: boolean;
}

export function useTraderDataSources() {
  return useQuery<{ sources: TraderDataSourceInfo[] }>({
    queryKey: ['trader', 'data-sources'],
    queryFn: () => api.get('/users/me/data-sources'),
    staleTime: 30_000,
  });
}

export function useSetTraderCredential() {
  const qc = useQueryClient();
  return useMutation<
    { success: boolean; maskedKey: string },
    Error,
    { id: string; apiKey: string }
  >({
    mutationFn: ({ id, apiKey }) =>
      api.put(`/users/me/data-sources/${id}/credential`, { apiKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trader', 'data-sources'] });
      toast.success('API key saved successfully');
    },
    onError: (err) => {
      toast.error(`Failed to save API key: ${err.message}`);
    },
  });
}

export function useDeleteTraderCredential() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => api.delete(`/users/me/data-sources/${id}/credential`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trader', 'data-sources'] });
      toast.success('API key removed');
    },
    onError: (err) => {
      toast.error(`Failed to remove API key: ${err.message}`);
    },
  });
}
