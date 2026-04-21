import { Navigate, useLocation } from 'react-router-dom';
import { useLLMKeys } from '../hooks/use-user';
import { useAuthStore } from '../store/auth.store';

// Routes allowed even without an active LLM key
const ALLOWED_WITHOUT_KEY = [
  '/dashboard/settings/llms',
  '/dashboard/settings/profile',
];

interface LLMKeyGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects to /dashboard/settings/llms if the user has no active LLM key.
 * Allows navigation only within the settings/llms and settings/profile pages.
 */
export function LLMKeyGuard({ children }: LLMKeyGuardProps) {
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: llmKeys, isLoading } = useLLMKeys();

  // Don't block while loading or unauthenticated (ProtectedRoute handles that)
  if (!isAuthenticated || isLoading) return <>{children}</>;

  const hasActiveKey = (llmKeys ?? []).some((k) => k.isActive);

  if (
    !hasActiveKey &&
    !ALLOWED_WITHOUT_KEY.some((p) => pathname.startsWith(p))
  ) {
    return <Navigate to="/dashboard/settings/llms" replace />;
  }

  return <>{children}</>;
}

/**
 * Returns whether the user has at least one active LLM key.
 * Used to conditionally disable UI features (e.g. chat widget).
 */
export function useHasActiveLLMKey(): { hasKey: boolean; isLoading: boolean } {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: llmKeys, isLoading } = useLLMKeys();

  if (!isAuthenticated) return { hasKey: false, isLoading: false };

  return {
    hasKey: (llmKeys ?? []).some((k) => k.isActive),
    isLoading,
  };
}
