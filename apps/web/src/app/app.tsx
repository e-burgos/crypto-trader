import { Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../components/theme-provider';
import { Navbar } from '../components/navbar';
import { PriceTicker } from '../components/price-ticker';
import { ProtectedRoute } from '../components/protected-route';
import { LandingPage } from '../pages/landing';
import { LoginPage } from '../pages/login';
import { RegisterPage } from '../pages/register';
import { OnboardingPage } from '../pages/onboarding';
import { DashboardLayout } from '../layouts/dashboard-layout';
import { OverviewPage } from '../pages/dashboard/overview';
import { LiveChartPage } from '../pages/dashboard/live-chart';
import { TradeHistoryPage } from '../pages/dashboard/trade-history';
import { AgentLogPage } from '../pages/dashboard/agent-log';
import { SettingsPage } from '../pages/dashboard/settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <PriceTicker />
      <main>{children}</main>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
          <Route path="/onboarding" element={
            <ProtectedRoute><PublicLayout><OnboardingPage /></PublicLayout></ProtectedRoute>
          } />

          {/* Protected dashboard routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardLayout /></ProtectedRoute>
          }>
            <Route index element={<OverviewPage />} />
            <Route path="chart" element={<LiveChartPage />} />
            <Route path="history" element={<TradeHistoryPage />} />
            <Route path="agent" element={<AgentLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;



