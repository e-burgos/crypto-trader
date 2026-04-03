import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type AuthResponse } from '../lib/api';

interface User {
  id: string;
  email: string;
  role: string;
}

/** Decode JWT exp claim without verifying signature (safe — client-side only). */
function getTokenExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  /** Schedule a silent refresh 2 min before the access token expires. */
  scheduleRefresh: () => void;
}

let _refreshTimerId: ReturnType<typeof setTimeout> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      scheduleRefresh: () => {
        if (_refreshTimerId) clearTimeout(_refreshTimerId);
        const token = get().accessToken;
        if (!token) return;
        const expMs = getTokenExpMs(token);
        if (!expMs) return;
        // Refresh 2 minutes before expiry (minimum 5 s from now)
        const msUntilRefresh = Math.max(
          expMs - Date.now() - 2 * 60 * 1000,
          5_000,
        );
        _refreshTimerId = setTimeout(async () => {
          const rt = localStorage.getItem('refreshToken');
          if (!rt || !get().isAuthenticated) return;
          try {
            const data = await api.post<AuthResponse>('/auth/refresh', {
              refreshToken: rt,
            });
            localStorage.setItem('accessToken', data.accessToken);
            if (data.refreshToken)
              localStorage.setItem('refreshToken', data.refreshToken);
            set({ accessToken: data.accessToken });
            get().scheduleRefresh();
          } catch {
            // Silent failure — reactive 401 interceptor in api.ts will handle it
          }
        }, msUntilRefresh);
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.post<AuthResponse>('/auth/login', {
            email,
            password,
          });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
          get().scheduleRefresh();
        } catch (err: unknown) {
          const msg = (err as { message?: string })?.message || 'Login failed';
          set({ error: msg, isLoading: false });
          throw err;
        }
      },

      register: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.post<AuthResponse>('/auth/register', {
            email,
            password,
          });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user: data.user,
            accessToken: data.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
          get().scheduleRefresh();
        } catch (err: unknown) {
          const msg =
            (err as { message?: string })?.message || 'Registration failed';
          set({ error: msg, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        if (_refreshTimerId) {
          clearTimeout(_refreshTimerId);
          _refreshTimerId = null;
        }
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken }).catch(() => null);
          }
        } finally {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          set({ user: null, accessToken: null, isAuthenticated: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'crypto-trader-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // Re-arm the proactive timer when the store is rehydrated from localStorage
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state.accessToken) {
          state.scheduleRefresh();
        }
      },
    },
  ),
);
