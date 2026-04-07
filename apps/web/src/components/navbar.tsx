import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  TrendingUp,
  Bell,
  HelpCircle,
  LogOut,
  LayoutDashboard,
  MoreVertical,
  Languages,
} from 'lucide-react';
import { Button } from './ui/button';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { useUnreadCount } from '../hooks/use-notifications';
import { NotificationsDropdown } from './notifications-dropdown';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

function LangToggle({ compact = false }: { compact?: boolean }) {
  const lang = i18n.language;
  if (compact) {
    return (
      <button
        onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Toggle language"
      >
        <Languages className="h-4 w-4 shrink-0" />
        <span>{lang === 'en' ? 'Español' : 'English'}</span>
      </button>
    );
  }
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

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
              {/* ── Desktop-only items ── */}
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{t('nav.dashboard')}</span>
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => logout()}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('nav.signOut')}</span>
                </Button>

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

              {/* ── Shared: notifications + avatar ── */}
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

              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
                title={user?.email}
              >
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>

              {/* ── Mobile-only: More dropdown ── */}
              <div ref={moreRef} className="relative sm:hidden">
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {moreOpen && (
                  <div className="absolute right-0 top-10 z-[60] w-52 rounded-xl border border-border bg-background/95 backdrop-blur-md py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <Link
                      to="/dashboard"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      {t('nav.dashboard')}
                    </Link>
                    <Link
                      to="/help"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <HelpCircle className="h-4 w-4 shrink-0" />
                      {t('nav.help', { defaultValue: 'Ayuda' })}
                    </Link>

                    <div className="my-1 h-px bg-border/50" />

                    <LangToggle compact />

                    <button
                      onClick={() => {
                        toggle();
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4 shrink-0" />
                      ) : (
                        <Moon className="h-4 w-4 shrink-0" />
                      )}
                      {theme === 'dark'
                        ? t('nav.lightMode')
                        : t('nav.darkMode')}
                    </button>

                    <div className="my-1 h-px bg-border/50" />

                    <button
                      onClick={() => {
                        logout();
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
