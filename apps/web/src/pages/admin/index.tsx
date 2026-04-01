import { Outlet, Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export function AdminLayout() {
  const { user } = useAuthStore();

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="h-5 w-5 text-red-500" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border pb-4">
        {[
          { to: '/admin', label: 'Stats & Overview', end: true },
          { to: '/admin/users', label: 'Users' },
        ].map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-red-500/10 text-red-500'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
