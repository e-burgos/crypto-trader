import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  TrendingUp,
  SlidersHorizontal,
  Briefcase,
  Newspaper,
  Shield,
  HelpCircle,
  Activity,
  BotMessageSquare,
  Brain,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  X,
  ListChecks,
  Sparkles,
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

// ── User dropdown ────────────────────────────────────────────────────────────
function UserDropdown({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initial = user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div ref={ref} className="relative">
      <NavTooltip label={user?.email ?? ''} show={collapsed && !open}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl transition-all duration-150',
            collapsed
              ? 'justify-center p-2 hover:bg-muted/60'
              : 'px-3 py-2.5 ring-1 ring-border/50 bg-muted/30 hover:bg-muted/50 hover:ring-border',
          )}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary uppercase ring-2 ring-primary/20">
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium text-foreground">
                  {user?.email}
                </p>
                <p className="text-[10px] text-muted-foreground/60 capitalize">
                  {user?.role?.toLowerCase() ?? 'user'}
                </p>
              </div>
              <ChevronUp
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </>
          )}
        </button>
      </NavTooltip>

      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-[9999] w-48 rounded-xl border border-border bg-card shadow-xl',
            collapsed ? 'left-full bottom-0 ml-3' : 'bottom-full left-0 mb-2',
          )}
        >
          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/settings?tab=profile');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              {t('nav.profile')}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
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
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  type NavItem = {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    admin?: boolean;
  };

  const GROUPS: { label: string; items: NavItem[] }[] = [
    {
      label: t('sidebar.groupTrading'),
      items: [
        {
          to: '/dashboard',
          label: t('sidebar.overview'),
          icon: LayoutDashboard,
          end: true,
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
        {
          to: '/dashboard/market',
          label: t('sidebar.market'),
          icon: Activity,
        },
      ],
    },
    {
      label: t('sidebar.groupAgente'),
      items: [
        {
          to: '/dashboard/bot-analysis',
          label: t('sidebar.botAnalysis'),
          icon: Brain,
        },
        {
          to: '/dashboard/agent-log',
          label: t('sidebar.agentLog'),
          icon: ListChecks,
        },
        {
          to: '/dashboard/news',
          label: t('sidebar.news'),
          icon: Newspaper,
        },
        {
          to: '/dashboard/chat',
          label: t('sidebar.chat'),
          icon: BotMessageSquare,
        },
        {
          to: '/dashboard/agents',
          label: t('sidebar.agents'),
          icon: Sparkles,
        },
        {
          to: '/dashboard/config',
          label: t('sidebar.config'),
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      label: t('sidebar.groupSystem'),
      items: [
        {
          to: '/dashboard/notifications',
          label: t('sidebar.notifications'),
          icon: Bell,
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
      'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      collapsed && 'justify-center px-0',
      isActive
        ? admin
          ? 'bg-red-500/10 text-red-400 shadow-[inset_0_0_0_1px_hsl(0_84%_60%/0.15)]'
          : 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
        : admin
          ? 'text-muted-foreground hover:bg-red-500/5 hover:text-red-400'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <>
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-3">
        <div className={cn('space-y-5', collapsed ? 'px-2' : 'px-3')}>
          {GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
                </div>
              ) : (
                <div className="my-1 mx-1 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
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
                              <>
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent" />
                              </>
                            )}
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                                isActive
                                  ? admin
                                    ? 'bg-red-500/15 shadow-[0_0_10px_hsl(0_84%_60%/0.25)]'
                                    : 'bg-primary/15 shadow-[0_0_10px_hsl(var(--primary)/0.3)]'
                                  : 'group-hover:bg-muted/60',
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
      <div className={cn('shrink-0', collapsed ? 'p-2' : 'px-3 pb-3 pt-0')}>
        {/* Gradient separator */}
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <UserDropdown collapsed={collapsed} />
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
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-bold tracking-tight">
                Crypto<span className="text-primary">Trader</span>
              </span>
            </div>
          </Link>
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
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="text-sm font-bold tracking-tight truncate">
                CryptoTrader
              </span>
            )}
          </Link>
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
