import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  TrendingUp,
  HelpCircle,
  LayoutDashboard,
  Languages,
} from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { useUnreadCount } from '../hooks/use-notifications';
import { AvatarDropdown } from './avatar-dropdown';
import { LoginDropdown } from './login-dropdown';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

function LangToggle({ compact = false }: { compact?: boolean }) {
  const lang = i18n.language;
  if (compact) {
    return (
      <button
        onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
      className="rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      aria-label="Toggle language"
    >
      {lang === 'en' ? 'ES' : 'EN'}
    </button>
  );
}

export function Navbar() {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const { isAuthenticated } = useAuthStore();
  const unreadCount = useUnreadCount();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <TrendingUp className="h-6 w-6 text-primary hidden sm:block" />
          <span>
            Crypto<span className="text-primary">Trader</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* ── Desktop-only items ── */}
              <div className="hidden sm:flex rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <Link to="/dashboard">
                  <div className="flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{t('nav.dashboard')}</span>
                  </div>
                </Link>
              </div>

              {/* Mobile dashboard link */}
              <div className="sm:hidden rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                </Link>
              </div>

              <AvatarDropdown />
            </>
          ) : (
            <>
              <Link to="/login">
                <Button
                  variant="ghost"
                  className="text-xs sm:text-sm max-h-[32px]"
                  size="sm"
                >
                  {t('nav.signIn')}
                </Button>
              </Link>
              <Link to="/register">
                <Button className="text-xs sm:text-sm max-h-[32px]" size="sm">
                  {t('nav.getStarted')}
                </Button>
              </Link>

              {/* Desktop-only buttons */}
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/help"
                  className="rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  aria-label="Help"
                >
                  <HelpCircle className="h-4 w-4" />
                </Link>

                <LangToggle />

                <button
                  onClick={toggle}
                  className="rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Mobile-only dropdown */}
              <LoginDropdown />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
