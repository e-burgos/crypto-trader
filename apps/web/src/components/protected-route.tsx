import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('TRADER' | 'ADMIN')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role as 'TRADER' | 'ADMIN')) {
    const homeRoute = user.role === 'ADMIN' ? '/admin' : '/dashboard';
    return <Navigate to={homeRoute} replace />;
  }

  return <>{children}</>;
}
