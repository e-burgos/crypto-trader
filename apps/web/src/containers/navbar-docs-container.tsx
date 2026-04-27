import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  TrendingUp,
  LayoutDashboard,
  Languages,
} from 'lucide-react';
import { Button, NavbarDocs } from '@crypto-trader/ui';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { AvatarDropdown } from './avatar-dropdown';
import { LoginDropdown } from './login-dropdown';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

function LangToggle() {
  const lang = i18n.language;
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

interface NavbarDocsContainerProps {
  /** The search component to render in the center slot */
  searchSlot?: React.ReactNode;
  /** Documentation section title */
  docsTitle?: string;
}

export function NavbarDocsContainer({
  searchSlot,
  docsTitle,
}: NavbarDocsContainerProps) {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const { isAuthenticated } = useAuthStore();

  const logo = (
    <Link to="/" className="flex items-center gap-2 font-bold text-lg">
      <TrendingUp className="h-5 w-5 text-primary hidden sm:block" />
      <span>
        Crypto<span className="text-primary">Trader</span>
      </span>
    </Link>
  );

  const rightSlot = (
    <div className="flex items-center gap-2">
      {isAuthenticated ? (
        <>
          <div className="hidden sm:flex rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            <Link to="/dashboard">
              <div className="flex items-center gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                <span>{t('nav.dashboard')}</span>
              </div>
            </Link>
          </div>
          <div className="sm:hidden rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
            </Link>
          </div>
          <AvatarDropdown size="sm" />
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
          <Link to="/register" className="hidden sm:block">
            <Button className="text-xs sm:text-sm max-h-[32px]" size="sm">
              {t('nav.getStarted')}
            </Button>
          </Link>
          <div className="hidden sm:flex items-center gap-2">
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
          <LoginDropdown />
        </>
      )}
    </div>
  );

  return (
    <NavbarDocs
      logo={logo}
      title={docsTitle}
      centerSlot={searchSlot}
      rightSlot={rightSlot}
    />
  );
}
