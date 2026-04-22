import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import i18n from '../lib/i18n';

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
  adminId: string;
  details: Record<string, unknown>;
  createdAt: string;
  admin: { email: string };
  target?: { email: string } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  configCount?: number;
}

export interface AdminAgentStatus {
  userId: string;
  email: string;
  configId: string;
  configName: string;
  asset: string;
  pair: string;
  isRunning: boolean;
  mode: string;
  updatedAt: string;
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

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin/users'),
    staleTime: 60_000,
  });
}

export function useAdminAgentsStatus() {
  return useQuery<AdminAgentStatus[]>({
    queryKey: ['admin', 'agents-status'],
    queryFn: () => api.get('/admin/agents/status'),
    refetchInterval: 15_000,
  });
}

export function useKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/admin/kill-switch', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['trading'] });
      toast.success(i18n.t('toasts.killSwitchSuccess'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.killSwitchError')),
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}/status`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(i18n.t('toasts.userStatusUpdated'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.userStatusError')),
  });
}
