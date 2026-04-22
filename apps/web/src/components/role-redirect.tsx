import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Redirects authenticated users to their role-specific home.
 * Shows children (or nothing) for unauthenticated users.
 */
export function RoleRedirect({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Navigate
      to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'}
      replace
    />
  );
}
