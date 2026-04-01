import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth.store';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface KeyStatus {
  hasKeys: boolean;
  isActive: boolean;
}

export interface LLMKeyStatus {
  provider: string;
  selectedModel: string;
  isActive: boolean;
}

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ['user', 'profile'],
    queryFn: () => api.get('/users/me'),
    staleTime: 300_000,
  });
}

export function useBinanceKeyStatus() {
  return useQuery<KeyStatus>({
    queryKey: ['user', 'binance-status'],
    queryFn: () => api.get('/users/me/binance-keys/status'),
    staleTime: 60_000,
  });
}

export function useLLMKeys() {
  return useQuery<LLMKeyStatus[]>({
    queryKey: ['user', 'llm-keys'],
    queryFn: () => api.get('/users/me/llm-keys'),
    staleTime: 60_000,
  });
}

export function useSetBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { apiKey: string; apiSecret: string }) =>
      api.post('/users/me/binance-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-status'] });
      toast.success('Binance API keys saved');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to save keys'),
  });
}

export function useSetLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      provider: string;
      apiKey: string;
      selectedModel: string;
    }) => api.post('/users/me/llm-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
      toast.success('LLM API key saved');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Failed to save key'),
  });
}

export function useUpdateProfile() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { isActive?: boolean }) =>
      api.patch(`/users/${user?.id}/status`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });
}
