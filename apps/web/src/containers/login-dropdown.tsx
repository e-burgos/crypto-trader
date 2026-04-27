import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, BookOpen, Languages, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

export function LoginDropdown() {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border p-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        aria-label="More options"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-[60] w-48 rounded-xl border border-border bg-background/95 backdrop-blur-md py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
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
        </div>
      )}
    </div>
  );
}
