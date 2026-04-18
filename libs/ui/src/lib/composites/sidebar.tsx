import * as React from 'react';
import { cn } from '../utils';
import { ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  active?: boolean;
  admin?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarUser {
  email: string;
  role?: string;
  avatarUrl?: string;
}

export interface SidebarProps {
  groups: NavGroup[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user: SidebarUser;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  onProfile: () => void;
  logo: React.ReactNode;
  /** Mobile drawer state */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobile?: () => void;
  /** i18n labels */
  labels?: {
    profile?: string;
    signOut?: string;
    expandSidebar?: string;
    collapseSidebar?: string;
    closeMenu?: string;
  };
  /** Custom link component — defaults to <a> */
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
  }>;
}

/* ── Tooltip ───────────────────────────────────────────────────────────────── */

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
      </div>
    </div>
  );
}

/* ── User dropdown ─────────────────────────────────────────────────────────── */

function UserDropdown({
  collapsed,
  user,
  onLogout,
  onProfile,
  labels,
}: {
  collapsed: boolean;
  user: SidebarUser;
  onLogout: () => void;
  onProfile: () => void;
  labels?: SidebarProps['labels'];
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initial = user.email[0]?.toUpperCase() ?? 'U';

  return (
    <div ref={ref} className="relative">
      <NavTooltip label={user.email} show={collapsed && !open}>
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
                  {user.email}
                </p>
                <p className="text-[10px] text-muted-foreground/60 capitalize">
                  {user.role?.toLowerCase() ?? 'user'}
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
                onProfile();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              {labels?.profile ?? 'Profile'}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              {labels?.signOut ?? 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Nav content ───────────────────────────────────────────────────────────── */

function NavContent({
  groups,
  collapsed,
  user,
  onNavigate,
  onLogout,
  onProfile,
  labels,
  onNavClick,
  LinkComponent,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  user: SidebarUser;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  onProfile: () => void;
  labels?: SidebarProps['labels'];
  onNavClick?: () => void;
  LinkComponent?: SidebarProps['LinkComponent'];
}) {
  const Link = LinkComponent ?? 'a';

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
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-3">
        <div className={cn('space-y-5', collapsed ? 'px-2' : 'px-3')}>
          {groups.map((group) => (
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
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavTooltip label={item.label} show={collapsed}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          onNavClick?.();
                          onNavigate(item.href);
                        }}
                        className={linkClass(!!item.active, item.admin)}
                      >
                        {item.active && (
                          <>
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent" />
                          </>
                        )}
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                            item.active
                              ? item.admin
                                ? 'bg-red-500/15 shadow-[0_0_10px_hsl(0_84%_60%/0.25)]'
                                : 'bg-primary/15 shadow-[0_0_10px_hsl(var(--primary)/0.3)]'
                              : 'group-hover:bg-muted/60',
                          )}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </NavTooltip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className={cn('shrink-0', collapsed ? 'p-2' : 'px-3 pb-3 pt-0')}>
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <UserDropdown
          collapsed={collapsed}
          user={user}
          onLogout={onLogout}
          onProfile={onProfile}
          labels={labels}
        />
      </div>
    </>
  );
}

/* ── Mobile drawer ─────────────────────────────────────────────────────────── */

function MobileDrawer({
  open,
  onClose,
  logo,
  labels,
  children,
}: {
  open: boolean;
  onClose: () => void;
  logo: React.ReactNode;
  labels?: SidebarProps['labels'];
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return createPortal(
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-[201] flex w-72 flex-col border-r border-border bg-card shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          {logo}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={labels?.closeMenu ?? 'Close menu'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */

export function Sidebar({
  groups,
  collapsed,
  onToggleCollapsed,
  user,
  onNavigate,
  onLogout,
  onProfile,
  logo,
  mobileOpen,
  onCloseMobile,
  labels,
  LinkComponent,
}: SidebarProps) {
  const navProps = {
    groups,
    user,
    onNavigate,
    onLogout,
    onProfile,
    labels,
    LinkComponent,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'relative hidden md:flex flex-col h-screen border-r border-border bg-card shrink-0',
          'transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-[68px]' : 'w-[220px] lg:w-[240px] xl:w-[260px]',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center' : 'gap-2.5 px-4',
          )}
        >
          {logo}
        </div>

        <NavContent {...navProps} collapsed={collapsed} />

        <button
          onClick={onToggleCollapsed}
          aria-label={
            collapsed
              ? labels?.expandSidebar ?? 'Expand sidebar'
              : labels?.collapseSidebar ?? 'Collapse sidebar'
          }
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
      <MobileDrawer
        open={mobileOpen}
        onClose={onCloseMobile}
        logo={logo}
        labels={labels}
      >
        <NavContent
          {...navProps}
          collapsed={false}
          onNavClick={onCloseMobile}
        />
      </MobileDrawer>
    </>
  );
}
