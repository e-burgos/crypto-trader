import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  TrendingUp,
  Bell,
  HelpCircle,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from './ui/button';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { useUnreadCount } from '../hooks/use-notifications';
import { NotificationsDropdown } from './notifications-dropdown';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { cn } from '../lib/utils';

function LangToggle() {
  const lang = i18n.language;
  return (
    <button
      onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
      className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      aria-label="Toggle language"
    >
      {lang === 'en' ? 'ES' : 'EN'}
    </button>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const unreadCount = useUnreadCount();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span>CryptoTrader</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('nav.dashboard')}</span>
                </Button>
              </Link>

              {/* Notification Bell */}
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
                  'flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary',
                )}
                title={user?.email}
              >
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t('nav.signOut')}</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t('nav.signIn')}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t('nav.getStarted')}</Button>
              </Link>
            </>
          )}

          <Link
            to="/help"
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>

          <LangToggle />

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
        </div>
      </div>
    </nav>
  );
}
