import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';
import i18n from '../lib/i18n';

export type TradingMode = 'SANDBOX' | 'TESTNET' | 'LIVE';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  platformOperationMode: TradingMode;
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<UserProfile>({
    queryKey: ['user', 'profile'],
    queryFn: () => api.get('/users/me'),
    staleTime: 300_000,
    enabled: isAuthenticated,
  });
}

export function useBinanceKeyStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<KeyStatus>({
    queryKey: ['user', 'binance-status'],
    queryFn: () => api.get('/users/me/binance-keys/status'),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useLLMKeys() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<LLMKeyStatus[]>({
    queryKey: ['user', 'llm-keys'],
    queryFn: () =>
      api
        .get<{ providers: LLMKeyStatus[] }>('/users/me/llm-keys/status')
        .then((d) => d.providers),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useSetBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { apiKey: string; apiSecret: string }) =>
      api.post('/users/me/binance-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-status'] });
      toast.success(i18n.t('toasts.binanceKeysSaved'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.binanceKeysSaveError')),
  });
}

export function useDeleteBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/users/me/binance-keys'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-status'] });
      toast.success(i18n.t('toasts.binanceKeysDeleted'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.binanceKeysDeleteError')),
  });
}

// ── Binance Testnet keys ───────────────────────────────────────────────────

export function useTestnetBinanceKeyStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<KeyStatus>({
    queryKey: ['user', 'binance-testnet-status'],
    queryFn: () => api.get('/users/me/binance-keys/testnet/status'),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useSetTestnetBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { apiKey: string; apiSecret: string }) =>
      api.post('/users/me/binance-keys/testnet', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-testnet-status'] });
      toast.success(i18n.t('toasts.testnetKeysSaved'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.testnetKeysSaveError')),
  });
}

export function useDeleteTestnetBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/users/me/binance-keys/testnet'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-testnet-status'] });
      toast.success(i18n.t('toasts.testnetKeysDeleted'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.testnetKeysDeleteError')),
  });
}

export function useTestTestnetBinanceConnection() {
  return useMutation({
    mutationFn: () =>
      api.get<{ connected: boolean; error?: string }>(
        '/users/me/binance-keys/testnet/test',
      ),
    onSuccess: (data) => {
      if (data.connected) {
        toast.success(i18n.t('toasts.testnetConnectionSuccess'));
      } else {
        toast.error(
          i18n.t('toasts.testnetConnectionError', { error: data.error ?? 'unknown' }),
        );
      }
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.testnetConnectionTestError')),
  });
}

export function useSetLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      provider: string;
      apiKey: string;
      selectedModel: string | null;
    }) => api.post('/users/me/llm-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
      qc.invalidateQueries({ queryKey: ['llm-keys-validation'] });
      qc.invalidateQueries({ queryKey: ['llm', 'providers', 'status'] });
      toast.success(i18n.t('toasts.llmKeySaved'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.llmKeySaveError')),
  });
}

export function useUpdateLLMModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; selectedModel: string | null }) =>
      api.patch('/users/me/llm-keys/model', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
    },
  });
}

export function useDeleteLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      api.delete(`/users/me/llm-keys/${provider}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
      qc.invalidateQueries({ queryKey: ['llm-keys-validation'] });
      qc.invalidateQueries({ queryKey: ['llm', 'providers', 'status'] });
      toast.success(i18n.t('toasts.llmKeyDeleted'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.llmKeyDeleteError')),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email?: string; password?: string }) =>
      api.put('/users/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'profile'] });
      toast.success(i18n.t('toasts.profileUpdated'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.profileUpdateError')),
  });
}

export interface NewsApiKeyStatus {
  provider: string;
  isActive: boolean;
}

export function useNewsApiKeys() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<NewsApiKeyStatus[]>({
    queryKey: ['user', 'news-api-keys'],
    queryFn: () =>
      api
        .get<{
          providers: NewsApiKeyStatus[];
        }>('/users/me/news-api-keys/status')
        .then((d) => d.providers),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

export function useSetNewsApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; apiKey: string }) =>
      api.post('/users/me/news-api-keys', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'news-api-keys'] });
      toast.success(i18n.t('toasts.newsKeySaved'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.newsKeySaveError')),
  });
}

export function useDeleteNewsApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      api.delete(`/users/me/news-api-keys/${provider}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'news-api-keys'] });
      toast.success(i18n.t('toasts.newsKeyDeleted'));
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.newsKeyDeleteError')),
  });
}

export interface TestResult {
  connected: boolean;
  error?: string;
}

export function useTestBinanceConnection() {
  return useMutation<TestResult, Error>({
    mutationFn: () => api.get('/users/me/binance-keys/test'),
  });
}

export interface LLMValidationResult {
  provider: string;
  status: 'ACTIVE' | 'INVALID' | 'INACTIVE';
  error?: string;
}

export interface LLMValidationResponse {
  results: LLMValidationResult[];
  active: number;
  total: number;
}

export function useValidateAllLLMKeys(enabled: boolean) {
  const qc = useQueryClient();
  return useQuery<LLMValidationResponse>({
    queryKey: ['llm-keys-validation'],
    queryFn: async () => {
      const data = await api.get<LLMValidationResponse>(
        '/users/me/llm-keys/validate-all',
      );
      // Invalidate related queries so ProviderStatusGrid + llmKeys refresh
      qc.invalidateQueries({ queryKey: ['llm', 'providers', 'status'] });
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
      return data;
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useTestLLMKey() {
  const qc = useQueryClient();
  return useMutation<TestResult, Error, string>({
    mutationFn: (provider: string) =>
      api.get(`/users/me/llm-keys/${provider}/test`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['llm', 'providers', 'status'] });
      qc.invalidateQueries({ queryKey: ['llm-keys-validation'] });
    },
  });
}

export function useTestNewsApiKey() {
  return useMutation<TestResult, Error, string>({
    mutationFn: (provider: string) =>
      api.get(`/users/me/news-api-keys/${provider}/test`),
  });
}

export interface NewsSourceStatus {
  id: string;
  label: string;
  description: string;
  requiresApiKey: boolean;
  isActive: boolean;
  isConfigured: boolean;
  isReachable: boolean;
  signupUrl?: string;
  error?: string;
}

export function useNewsSourcesStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<NewsSourceStatus[]>({
    queryKey: ['market', 'news-sources-status'],
    queryFn: () => api.get<NewsSourceStatus[]>('/market/news-sources/status'),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });
}

// ── Platform operation mode ────────────────────────────────────────────────

export function useUpdatePlatformMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: TradingMode) =>
      api.patch<{ platformOperationMode: TradingMode }>(
        '/users/me/operation-mode',
        { mode },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'profile'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['trading'] });
      qc.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || i18n.t('toasts.modeChangeError')),
  });
}

export function usePlatformMode() {
  const { data: profile, isLoading } = useUserProfile();
  const { data: liveKeyStatus } = useBinanceKeyStatus();
  const { data: testnetKeyStatus } = useTestnetBinanceKeyStatus();
  const updateMode = useUpdatePlatformMode();

  const mode: TradingMode = profile?.platformOperationMode ?? 'SANDBOX';

  const availableModes: TradingMode[] = ['SANDBOX'];
  if (testnetKeyStatus?.hasKeys) availableModes.push('TESTNET');
  if (liveKeyStatus?.hasKeys) availableModes.push('LIVE');

  // Fallback automático a SANDBOX si el modo activo ya no tiene keys configuradas
  useEffect(() => {
    if (!isLoading && mode !== 'SANDBOX' && !availableModes.includes(mode)) {
      updateMode.mutate('SANDBOX', {
        onSuccess: () => {
          toast.warning(
            i18n.t('toasts.modeFallback', { mode }),
          );
        },
      });
    }
  }, [mode, isLoading, availableModes.join(',')]);

  return {
    mode,
    isSandbox: mode === 'SANDBOX',
    isTestnet: mode === 'TESTNET',
    isLive: mode === 'LIVE',
    availableModes,
    isLoading,
  };
}

// ── Platform LLM Provider Status (user-facing, Spec 38) ─────────────────────

export interface LLMProviderStatus {
  provider: string;
  isActive: boolean;
}

export function usePlatformLLMStatus() {
  return useQuery<LLMProviderStatus[]>({
    queryKey: ['llm-provider-status'],
    queryFn: () => api.get('/llm-providers/status'),
    staleTime: 60_000,
  });
}
