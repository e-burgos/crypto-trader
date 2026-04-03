import { useState } from 'react';
import { Bell, Sun, Moon, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { useUnreadCount } from '../hooks/use-notifications';
import { NotificationsDropdown } from './notifications-dropdown';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { cn } from '../lib/utils';

export function DashboardHeader() {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const { user } = useAuthStore();
  const unreadCount = useUnreadCount();
  const [notifOpen, setNotifOpen] = useState(false);
  const lang = i18n.language;

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-1.5 border-b border-border/60 bg-card/50 px-4 backdrop-blur-sm">
      {/* Help */}
      <Link
        to="/help"
        className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </Link>

      {/* Language toggle */}
      <button
        onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
        className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        aria-label="Toggle language"
      >
        {lang === 'en' ? 'ES' : 'EN'}
      </button>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>

      {/* Notifications bell */}
      <div className="relative">
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

      {/* User avatar */}
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary',
        )}
        title={user?.email}
      >
        {user?.email?.charAt(0).toUpperCase() ?? 'U'}
      </div>
    </header>
  );
}
