import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface ResolvedAgentConfig {
  agentId: string;
  provider: string;
  model: string;
  source: 'user' | 'admin' | 'fallback';
}

export interface AgentHealthItem {
  agentId: string;
  healthy: boolean;
  provider: string;
  model: string;
  source: 'user' | 'admin' | 'fallback';
  hasKey: boolean;
}

export interface AgentHealthReport {
  healthy: boolean;
  agents: AgentHealthItem[];
}

export function useAgentConfigs() {
  return useQuery<ResolvedAgentConfig[]>({
    queryKey: ['agents', 'config'],
    queryFn: () => api.get('/users/me/agents/config'),
    staleTime: 60_000,
  });
}

export function useAgentHealth(simulateRemoveProvider?: string) {
  const params = simulateRemoveProvider
    ? `?simulate=remove&provider=${simulateRemoveProvider}`
    : '';
  return useQuery<AgentHealthReport>({
    queryKey: ['agents', 'health', simulateRemoveProvider],
    queryFn: () => api.get(`/users/me/agents/health${params}`),
    staleTime: 60_000,
  });
}

export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      agentId,
      provider,
      model,
    }: {
      agentId: string;
      provider: string;
      model: string;
    }) => api.put(`/users/me/agents/${agentId}/config`, { provider, model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('settings.agents.saved'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });
}

export function useResetAgentConfig() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ agentId }: { agentId: string }) =>
      api.delete(`/users/me/agents/${agentId}/config`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(t('settings.agents.resetSuccess'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });
}

// Admin hooks
export type AgentPresetName = 'free' | 'optimized' | 'balanced';

export function useApplyPreset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (preset: AgentPresetName) =>
      api.post<{ applied: string; count: number }>(
        `/users/me/agents/config/preset/${preset}`,
        {},
      ),
    onSuccess: (_, preset) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      const names: Record<AgentPresetName, string> = {
        free: t('settings.agents.presets.free'),
        optimized: t('settings.agents.presets.optimized'),
        balanced: t('settings.agents.presets.balanced'),
      };
      toast.success(
        t('settings.agents.presets.applied', {
          name: names[preset],
          defaultValue: `Preset "${names[preset]}" aplicado correctamente`,
        }),
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });
}

export function useAdminAgentConfigs() {
  return useQuery<Array<{ agentId: string; provider: string; model: string }>>({
    queryKey: ['admin', 'agents', 'config'],
    queryFn: () => api.get('/admin/agent-configs'),
    staleTime: 60_000,
  });
}

export function useApplyAdminPreset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (preset: AgentPresetName) =>
      api.post<{ applied: string; count: number }>(
        `/admin/agent-configs/preset/${preset}`,
        {},
      ),
    onSuccess: (_, preset) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      const names: Record<AgentPresetName, string> = {
        free: t('settings.agents.presets.free'),
        optimized: t('settings.agents.presets.optimized'),
        balanced: t('settings.agents.presets.balanced'),
      };
      toast.success(
        t('settings.agents.presets.applied', {
          name: names[preset],
          defaultValue: `Preset "${names[preset]}" applied to all agents`,
        }),
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });
}

export function useUpdateAdminAgentConfig() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      agentId,
      provider,
      model,
    }: {
      agentId: string;
      provider: string;
      model: string;
    }) => api.put(`/admin/agent-configs/${agentId}`, { provider, model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      toast.success(t('settings.agents.saved'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });
}
