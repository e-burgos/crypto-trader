import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface AdminStats {
  totalUsers: number;
  activePortfolios: number;
  totalTrades: number;
  openPositions: number;
  tradesToday: number;
  profitToday: number;
  systemStatus: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useAuditLog() {
  return useQuery<AuditLog[]>({
    queryKey: ['admin', 'audit-log'],
    queryFn: () => api.get('/admin/audit-log'),
    staleTime: 60_000,
  });
}

export function useKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/admin/kill-switch', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['trading-configs'] });
      toast.success('Kill switch activated — all trading stopped');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Kill switch failed'),
  });
}
