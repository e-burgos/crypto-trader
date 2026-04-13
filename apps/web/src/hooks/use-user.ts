import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { toast } from 'sonner';

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
      toast.success('Claves API de Binance guardadas');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al guardar las claves'),
  });
}

export function useDeleteBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/users/me/binance-keys'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-status'] });
      toast.success('Claves de Binance eliminadas');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al eliminar las claves'),
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
      toast.success('Claves API de Binance Testnet guardadas');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al guardar las claves testnet'),
  });
}

export function useDeleteTestnetBinanceKeys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/users/me/binance-keys/testnet'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'binance-testnet-status'] });
      toast.success('Claves de Binance Testnet eliminadas');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al eliminar las claves testnet'),
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
        toast.success('Conexión con Binance Testnet exitosa');
      } else {
        toast.error(
          `Error de conexión testnet: ${data.error ?? 'desconocido'}`,
        );
      }
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al probar la conexión testnet'),
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
      toast.success('Clave API de LLM guardada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al guardar la clave'),
  });
}

export function useDeleteLLMKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      api.delete(`/users/me/llm-keys/${provider}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'llm-keys'] });
      toast.success('Clave LLM eliminada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al eliminar la clave'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email?: string; password?: string }) =>
      api.put('/users/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'profile'] });
      toast.success('Perfil actualizado');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al actualizar el perfil'),
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
      toast.success('Clave API de noticias guardada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al guardar la clave'),
  });
}

export function useDeleteNewsApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      api.delete(`/users/me/news-api-keys/${provider}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'news-api-keys'] });
      toast.success('Clave API de noticias eliminada');
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al eliminar la clave'),
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

export function useTestLLMKey() {
  return useMutation<TestResult, Error, string>({
    mutationFn: (provider: string) =>
      api.get(`/users/me/llm-keys/${provider}/test`),
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

export function usePlatformMode() {
  const { data: profile, isLoading } = useUserProfile();
  const { data: liveKeyStatus } = useBinanceKeyStatus();
  const { data: testnetKeyStatus } = useTestnetBinanceKeyStatus();

  const mode: TradingMode = profile?.platformOperationMode ?? 'SANDBOX';

  const availableModes: TradingMode[] = ['SANDBOX'];
  if (testnetKeyStatus?.hasKeys) availableModes.push('TESTNET');
  if (liveKeyStatus?.hasKeys) availableModes.push('LIVE');

  return {
    mode,
    isSandbox: mode === 'SANDBOX',
    isTestnet: mode === 'TESTNET',
    isLive: mode === 'LIVE',
    availableModes,
    isLoading,
  };
}

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
    },
    onError: (err: { message?: string }) =>
      toast.error(err?.message || 'Error al cambiar el modo de operación'),
  });
}
