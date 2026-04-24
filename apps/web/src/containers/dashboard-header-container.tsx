import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useUnreadCount } from '../hooks/use-notifications';
import { NotificationsDropdown } from './notifications-dropdown';
import { useSidebarStore } from '../store/sidebar.store';
import { AvatarDropdown } from './avatar-dropdown';
import { Link } from 'react-router-dom';
import { ConnectionStatusDropdown } from './connection-status-dropdown';
import { ModeSelector } from './mode-selector';
import { useAuthStore } from '../store/auth.store';

export function DashboardHeader() {
  const unreadCount = useUnreadCount();
  const [notifOpen, setNotifOpen] = useState(false);
  const { openMobile } = useSidebarStore();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b border-border/60 bg-card/50 px-4 backdrop-blur-sm">
      {/* Mobile hamburger */}
      <button
        onClick={openMobile}
        className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link to="/" className="flex items-center gap-2.5 sm:hidden">
        <span className="text-lg font-bold tracking-tight">
          Crypto<span className="text-primary">Trader</span>
        </span>
      </Link>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Operation mode selector — only for traders */}
        {user?.role !== 'ADMIN' && <ModeSelector />}

        {/* Connection status */}
        <ConnectionStatusDropdown />

        {/* Notifications bell */}
        <div className="relative border border-border rounded-md">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationsDropdown
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </div>

        <AvatarDropdown size="sm" />
      </div>
    </header>
  );
}
