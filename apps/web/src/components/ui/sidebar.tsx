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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { Button } from './button';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/chart', label: 'Live Chart', icon: BarChart3 },
  { to: '/dashboard/history', label: 'Trade History', icon: History },
  { to: '/dashboard/agent', label: 'Agent Log', icon: Bot },
  { to: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
  { to: '/dashboard/config', label: 'Config', icon: SlidersHorizontal },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { logout, user } = useAuthStore();

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
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
