import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  History,
  Settings,
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
  ListChecks,
} from 'lucide-react';
import { Sidebar, type NavGroup } from '@crypto-trader/ui';
import { useAuthStore } from '../store/auth.store';
import { useSidebarStore } from '../store/sidebar.store';
import { useTranslation } from 'react-i18next';

function SidebarLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link to={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export function SidebarContainer() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } =
    useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const groups: NavGroup[] = [
    {
      label: t('sidebar.groupTrading'),
      items: [
        {
          id: 'overview',
          label: t('sidebar.overview'),
          icon: <LayoutDashboard className="h-4 w-4" />,
          href: '/dashboard',
          active: isActive('/dashboard', true),
        },
        {
          id: 'positions',
          label: t('sidebar.positions'),
          icon: <Briefcase className="h-4 w-4" />,
          href: '/dashboard/positions',
          active: isActive('/dashboard/positions'),
        },
        {
          id: 'history',
          label: t('sidebar.tradeHistory'),
          icon: <History className="h-4 w-4" />,
          href: '/dashboard/history',
          active: isActive('/dashboard/history'),
        },
        {
          id: 'market',
          label: t('sidebar.market'),
          icon: <Activity className="h-4 w-4" />,
          href: '/dashboard/market',
          active: isActive('/dashboard/market'),
        },
      ],
    },
    {
      label: t('sidebar.groupAgente'),
      items: [
        {
          id: 'bot',
          label: t('sidebar.botAnalysis'),
          icon: <Brain className="h-4 w-4" />,
          href: '/dashboard/bot-analysis',
          active: isActive('/dashboard/bot-analysis'),
        },
        {
          id: 'log',
          label: t('sidebar.agentLog'),
          icon: <ListChecks className="h-4 w-4" />,
          href: '/dashboard/agent-log',
          active: isActive('/dashboard/agent-log'),
        },
        {
          id: 'news',
          label: t('sidebar.news'),
          icon: <Newspaper className="h-4 w-4" />,
          href: '/dashboard/news',
          active: isActive('/dashboard/news'),
        },
        {
          id: 'config',
          label: t('sidebar.config'),
          icon: <SlidersHorizontal className="h-4 w-4" />,
          href: '/dashboard/config',
          active: isActive('/dashboard/config'),
        },
        {
          id: 'chat',
          label: t('sidebar.chat'),
          icon: <BotMessageSquare className="h-4 w-4" />,
          href: '/dashboard/chat',
          active: isActive('/dashboard/chat'),
        },
      ],
    },
    {
      label: t('sidebar.groupSystem'),
      items: [
        {
          id: 'notifications',
          label: t('sidebar.notifications'),
          icon: <Bell className="h-4 w-4" />,
          href: '/dashboard/notifications',
          active: isActive('/dashboard/notifications'),
        },
        {
          id: 'settings',
          label: t('sidebar.settings'),
          icon: <Settings className="h-4 w-4" />,
          href: '/dashboard/settings',
          active: isActive('/dashboard/settings'),
        },
        {
          id: 'help',
          label: t('sidebar.help'),
          icon: <HelpCircle className="h-4 w-4" />,
          href: '/help',
          active: isActive('/help'),
        },
        ...(isAdmin
          ? [
              {
                id: 'admin',
                label: t('sidebar.admin'),
                icon: <Shield className="h-4 w-4" />,
                href: '/admin',
                active: isActive('/admin'),
                admin: true,
              },
            ]
          : []),
      ],
    },
  ];

  const logo = (
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
  );

  return (
    <Sidebar
      groups={groups}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      user={{ email: user?.email ?? '', role: user?.role }}
      onNavigate={(href) => navigate(href)}
      onLogout={logout}
      onProfile={() => navigate('/dashboard/settings?tab=profile')}
      logo={logo}
      mobileOpen={mobileOpen}
      onCloseMobile={closeMobile}
      labels={{
        profile: t('nav.profile'),
        signOut: t('nav.signOut'),
      }}
      LinkComponent={SidebarLink}
    />
  );
}
