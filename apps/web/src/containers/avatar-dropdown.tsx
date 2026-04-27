import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, BookOpen, User, LogOut, Languages } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { cn } from '../lib/utils';

interface AvatarDropdownProps {
  /** Size of the avatar button */
  size?: 'sm' | 'md';
}

export function AvatarDropdown({ size = 'md' }: AvatarDropdownProps) {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const DROPDOWN_W = 208;

  const openDropdown = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        left: Math.min(
          rect.right - DROPDOWN_W,
          window.innerWidth - DROPDOWN_W - 8,
        ),
      });
    }
    setOpen(true);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initial = user?.email?.charAt(0).toUpperCase() ?? 'U';

  return (
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        aria-label="User menu"
        title={user?.email}
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/20 font-bold text-primary',
          'hover:ring-2 hover:ring-primary/40 transition-all',
          size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm',
        )}
      >
        {initial}
      </button>

      {open &&
        createPortal(
          <div
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[9999] w-52 rounded-xl border border-border bg-card/95 backdrop-blur-md py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground/60 capitalize">
                {user?.role?.toLowerCase() ?? 'user'}
              </p>
            </div>

            {/* Profile */}
            <button
              onClick={() => {
                close();
                navigate('/dashboard/settings/profile');
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <User className="h-4 w-4 shrink-0" />
              {t('nav.profile')}
            </button>

            {/* Help */}
            <Link
              to="/docs"
              onClick={close}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              {t('nav.help')}
            </Link>

            <div className="my-1 h-px bg-border/50" />

            {/* Language */}
            <button
              onClick={() => {
                i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
                close();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Languages className="h-4 w-4 shrink-0" />
              {i18n.language === 'en' ? 'Español' : 'English'}
            </button>

            {/* Theme */}
            <button
              onClick={() => {
                toggle();
                close();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 shrink-0" />
              ) : (
                <Moon className="h-4 w-4 shrink-0" />
              )}
              {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            </button>

            <div className="my-1 h-px bg-border/50" />

            {/* Sign out */}
            <button
              onClick={() => {
                close();
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t('nav.signOut')}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
