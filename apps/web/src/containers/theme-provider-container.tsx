import { ThemeProvider } from '@crypto-trader/ui';
import { useThemeStore } from '../store/theme.store';

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
