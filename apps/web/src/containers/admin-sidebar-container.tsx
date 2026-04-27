import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bot,
  BotMessageSquare,
  Bell,
  BookOpen,
  TrendingUp,
  Clock,
  Shield,
  User,
  Key,
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

export function AdminSidebarContainer() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } =
    useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const groups: NavGroup[] = [
    {
      label: t('sidebar.adminGroupManagement'),
      items: [
        {
          id: 'admin-overview',
          label: t('sidebar.adminOverview'),
          icon: <LayoutDashboard className="h-4 w-4" />,
          href: '/admin',
          active: isActive('/admin', true),
        },
        {
          id: 'admin-users',
          label: t('sidebar.adminUsers'),
          icon: <Users className="h-4 w-4" />,
          href: '/admin/users',
          active: isActive('/admin/users'),
        },
        {
          id: 'admin-agents',
          label: t('sidebar.adminAgents'),
          icon: <Bot className="h-4 w-4" />,
          href: '/admin/agents',
          active: isActive('/admin/agents'),
        },
        {
          id: 'admin-audit-log',
          label: t('sidebar.adminAuditLog'),
          icon: <Clock className="h-4 w-4" />,
          href: '/admin/audit-log',
          active: isActive('/admin/audit-log'),
        },
      ],
    },
    {
      label: t('sidebar.adminGroupConfig'),
      items: [
        {
          id: 'admin-llm-providers',
          label: t('sidebar.adminLLMProviders'),
          icon: <Key className="h-4 w-4" />,
          href: '/admin/llm-providers',
          active: isActive('/admin/llm-providers'),
        },
        {
          id: 'admin-agent-models',
          label: t('sidebar.adminAgentModels'),
          icon: <Bot className="h-4 w-4" />,
          href: '/admin/agent-models',
          active: isActive('/admin/agent-models'),
        },
        {
          id: 'admin-profile',
          label: t('sidebar.adminProfile'),
          icon: <User className="h-4 w-4" />,
          href: '/admin/profile',
          active: isActive('/admin/profile'),
        },
      ],
    },
    {
      label: t('sidebar.adminGroupPlatform'),
      items: [
        {
          id: 'admin-notifications',
          label: t('sidebar.notifications'),
          icon: <Bell className="h-4 w-4" />,
          href: '/admin/notifications',
          active: isActive('/admin/notifications'),
        },
        {
          id: 'admin-help',
          label: t('sidebar.help'),
          icon: <BookOpen className="h-4 w-4" />,
          href: '/admin/help',
          active: isActive('/admin/help'),
        },
      ],
    },
  ];

  const logo = (
    <Link to="/admin" className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
        <Shield className="h-4 w-4 text-red-500" />
      </div>
      {!collapsed && (
        <span className="text-sm font-bold tracking-tight truncate">
          CryptoTrader <span className="text-red-500">Admin</span>
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
      onProfile={() => navigate('/admin/profile')}
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
