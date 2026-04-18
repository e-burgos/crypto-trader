import { useEffect } from 'react';

interface ThemeProviderProps {
  theme: 'light' | 'dark';
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}

export type { ThemeProviderProps };
