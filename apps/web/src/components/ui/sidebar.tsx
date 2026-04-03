import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
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
  Activity,
  BotMessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { useSidebarStore } from '../../store/sidebar.store';
import { useTranslation } from 'react-i18next';

// ── Tooltip (desktop collapsed only) ─────────────────────────────────────────
function NavTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <div
        className={cn(
          'pointer-events-none absolute left-full top-1/2 z-[9999] ml-3 -translate-y-1/2',
          'whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5',
          'text-xs font-medium text-foreground shadow-xl',
          'opacity-0 scale-95 transition-all duration-150',
          'group-hover/tip:opacity-100 group-hover/tip:scale-100',
        )}
      >
        {label}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
        <span className="absolute right-full top-1/2 -translate-y-1/2 ml-px border-4 border-transparent border-r-card" />
      </div>
    </div>
  );
}

// ── Shared nav content ────────────────────────────────────────────────────────
function NavContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const { t } = useTranslation();
  const { logout, user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const GROUPS = [
    {
      label: 'Trading',
      items: [
        {
          to: '/dashboard',
          label: t('sidebar.overview'),
          icon: LayoutDashboard,
          end: true,
        },
        {
          to: '/dashboard/chart',
          label: t('sidebar.liveChart'),
          icon: BarChart3,
        },
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
      ],
    },
    {
      label: 'Analysis',
      items: [
        { to: '/dashboard/market', label: t('sidebar.market'), icon: Activity },
        {
          to: '/dashboard/analytics',
          label: t('sidebar.analytics'),
          icon: LineChart,
        },
        { to: '/dashboard/agent', label: t('sidebar.agentLog'), icon: Bot },
      ],
    },
    {
      label: 'Explore',
      items: [
        { to: '/dashboard/news', label: t('sidebar.news'), icon: Newspaper },
        {
          to: '/dashboard/chat',
          label: t('sidebar.chat'),
          icon: BotMessageSquare,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          to: '/dashboard/config',
          label: t('sidebar.config'),
          icon: SlidersHorizontal,
        },
        {
          to: '/dashboard/settings',
          label: t('sidebar.settings'),
          icon: Settings,
        },
        { to: '/help', label: t('sidebar.help'), icon: HelpCircle },
        ...(isAdmin
          ? [
              {
                to: '/admin',
                label: t('sidebar.admin'),
                icon: Shield,
                admin: true,
              },
            ]
          : []),
      ],
    },
  ];

  const linkClass = (isActive: boolean, admin?: boolean) =>
    cn(
      'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
      'transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      collapsed && 'justify-center px-0',
      isActive
        ? admin
          ? 'bg-red-500/10 text-red-400'
          : 'bg-primary/10 text-primary'
        : admin
          ? 'text-muted-foreground hover:bg-red-500/5 hover:text-red-400'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <>
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-3">
        <div className={cn('space-y-4', collapsed ? 'px-2' : 'px-3')}>
          {GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  {group.label}
                </p>
              ) : (
                <div className="my-1 mx-1 h-px bg-border/50" />
              )}
              <ul className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end, admin }) => (
                  <li key={to}>
                    <NavTooltip label={label} show={collapsed}>
                      <NavLink
                        to={to}
                        end={end}
                        onClick={onNavClick}
                        className={({ isActive }) => linkClass(isActive, admin)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                            )}
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                                isActive
                                  ? admin
                                    ? 'bg-red-500/10'
                                    : 'bg-primary/10'
                                  : '',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            {!collapsed && (
                              <span className="truncate">{label}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </NavTooltip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'shrink-0 border-t border-border',
          collapsed ? 'p-2' : 'p-3',
        )}
      >
        {!collapsed && user?.email && (
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary uppercase">
              {user.email[0]}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        )}
        <NavTooltip label={t('nav.signOut')} show={collapsed}>
          <button
            onClick={logout}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
              'text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400',
              collapsed && 'justify-center px-0',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
              <LogOut className="h-4 w-4" />
            </span>
            {!collapsed && <span className="truncate">{t('nav.signOut')}</span>}
          </button>
        </NavTooltip>
      </div>
    </>
  );
}

// ── Mobile drawer (portal) ────────────────────────────────────────────────────
function MobileDrawer() {
  const { mobileOpen, closeMobile } = useSidebarStore();
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  // Lock body scroll
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={closeMobile}
        className={cn(
          'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-300',
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-[201] flex w-72 flex-col border-r border-border bg-card shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Drawer header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              CryptoTrader
            </span>
          </div>
          <button
            onClick={closeMobile}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavContent collapsed={false} onNavClick={closeMobile} />
      </div>
    </>,
    document.body,
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebarStore();

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className={cn(
          'relative hidden md:flex flex-col h-screen border-r border-border bg-card shrink-0',
          'transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[220px] lg:w-[240px] xl:w-[260px]',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center' : 'gap-2.5 px-4',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight truncate">
              CryptoTrader
            </span>
          )}
        </div>

        <NavContent collapsed={collapsed} />

        {/* Toggle button */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'absolute -right-3 top-[72px] z-10',
            'flex h-6 w-6 items-center justify-center rounded-full',
            'border border-border bg-card text-muted-foreground shadow-md',
            'transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30',
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* Mobile drawer */}
      <MobileDrawer />
    </>
  );
}
