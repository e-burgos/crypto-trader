import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  History,
  Bot,
  Settings,
  LogOut,
  TrendingUp,
  LineChart,
  SlidersHorizontal,
  Briefcase,
  Newspaper,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const { t } = useTranslation();
  const { logout, user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const NAV_ITEMS = [
    {
      to: '/dashboard',
      label: t('sidebar.overview'),
      icon: LayoutDashboard,
      end: true,
    },
    { to: '/dashboard/chart', label: t('sidebar.liveChart'), icon: BarChart3 },
    {
      to: '/dashboard/positions',
      label: t('sidebar.positions'),
      icon: Briefcase,
    },
    {
      to: '/dashboard/history',
      label: t('sidebar.tradeHistory'),
      icon: History,
    },
    { to: '/dashboard/agent', label: t('sidebar.agentLog'), icon: Bot },
    {
      to: '/dashboard/analytics',
      label: t('sidebar.analytics'),
      icon: LineChart,
    },
    { to: '/dashboard/news', label: t('sidebar.news'), icon: Newspaper },
    {
      to: '/dashboard/config',
      label: t('sidebar.config'),
      icon: SlidersHorizontal,
    },
    { to: '/dashboard/settings', label: t('sidebar.settings'), icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4 font-bold text-lg">
        <TrendingUp className="h-5 w-5 text-primary" />
        CryptoTrader
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4">
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
              {t('sidebar.admin')}
            </div>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-red-500/10 text-red-500'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Shield className="h-4 w-4" />
              {t('sidebar.admin')}
            </NavLink>
          </div>
        )}

        {/* Help link */}
        <div className="mt-4">
          <NavLink
            to="/help"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <HelpCircle className="h-4 w-4" />
            {t('sidebar.help')}
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="mb-2 px-2 text-xs text-muted-foreground truncate">
          {user?.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {t('nav.signOut')}
        </Button>
      </div>
    </aside>
  );
}
