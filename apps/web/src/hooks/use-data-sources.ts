import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import type {
  DataSourceStatus,
  DataSourceHealthResult,
  DataSourceToggleResult,
} from '@crypto-trader/shared';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useDataSources() {
  return useQuery<{ sources: DataSourceStatus[] }>({
    queryKey: ['admin', 'data-sources'],
    queryFn: () => api.get('/admin/data-sources'),
    staleTime: 30_000,
  });
}

export function useDataSourceStats() {
  return useQuery<{
    sources: Array<{
      name: string;
      displayName: string;
      category: string;
      isActive: boolean;
      consecutiveErrors: number;
      lastSuccessAt: string | null;
      lastErrorAt: string | null;
      health: string;
      metrics: {
        calls24h: number;
        successes24h: number;
        failures24h: number;
        errorRate24h: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        uptimePercent: number;
      } | null;
    }>;
    totalActive: number;
    totalSources: number;
    circuitBreakers: Record<string, { state: string; failures: number }>;
    cache: { entries: number; sources: string[] };
    rateLimiter: Record<string, { remaining: number; limit: number }>;
  }>({
    queryKey: ['admin', 'data-sources', 'stats'],
    queryFn: () => api.get('/admin/data-sources/stats'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useToggleDataSource() {
  const qc = useQueryClient();
  return useMutation<
    DataSourceToggleResult,
    Error,
    { id: string; isActive: boolean }
  >({
    mutationFn: ({ id, isActive }) =>
      api.patch(`/admin/data-sources/${id}/toggle`, { isActive }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
      toast.success(
        data.isActive ? `${data.name} enabled` : `${data.name} disabled`,
      );
    },
    onError: (err) => {
      toast.error(`Toggle failed: ${err.message}`);
    },
  });
}

export function useUpdateDataSourceConfig() {
  const qc = useQueryClient();
  return useMutation<
    DataSourceStatus,
    Error,
    {
      id: string;
      data: {
        priority?: number;
        rateLimitPerMin?: number;
        pollingIntervalMs?: number;
      };
    }
  >({
    mutationFn: ({ id, data }) => api.patch(`/admin/data-sources/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
      toast.success('Config updated');
    },
    onError: (err) => {
      toast.error(`Update failed: ${err.message}`);
    },
  });
}

export function useHealthCheckSource() {
  return useMutation<DataSourceHealthResult, Error, string>({
    mutationFn: (id) => api.get(`/admin/data-sources/${id}/health`),
  });
}

export function useHealthCheckAll() {
  const qc = useQueryClient();
  return useMutation<Record<string, DataSourceHealthResult>, Error, void>({
    mutationFn: () => api.post('/admin/data-sources/health-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
      toast.success('Health check completed');
    },
    onError: (err) => {
      toast.error(`Health check failed: ${err.message}`);
    },
  });
}

export function useSetCredential() {
  const qc = useQueryClient();
  return useMutation<
    { success: boolean; maskedKey: string },
    Error,
    { id: string; apiKey: string }
  >({
    mutationFn: ({ id, apiKey }) =>
      api.put(`/admin/data-sources/${id}/credential`, { apiKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
      toast.success('API key saved successfully');
    },
    onError: (err) => {
      toast.error(`Failed to save API key: ${err.message}`);
    },
  });
}
