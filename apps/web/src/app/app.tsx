import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppThemeProvider } from '../containers/theme-provider-container';
import { Navbar } from '../containers/navbar-container';
import { PriceTicker } from '../containers/price-ticker-container';
import { ProtectedRoute } from '../components/protected-route';
import { LandingPage } from '../pages/landing';
import { LoginPage } from '../pages/login';
import { RegisterPage } from '../pages/register';
import { OnboardingPage } from '../pages/onboarding';
import { HelpPage } from '../pages/help';
import { DashboardLayout } from '../layouts/dashboard-layout';
import { OverviewPage } from '../pages/dashboard/overview';
import { TradeHistoryPage } from '../pages/dashboard/trade-history';
import { MarketPage } from '../pages/dashboard/market';
import { ConfigPage } from '../pages/dashboard/config';
import { SettingsPage } from '../pages/dashboard/settings';
import { PositionsPage } from '../pages/dashboard/positions';
import { NewsFeedPage } from '../pages/dashboard/news-feed';
import { ChatPage } from '../pages/dashboard/chat';
import { BotAnalysisPage } from '../pages/dashboard/bot-analysis';
import { AgentLogPage } from '../pages/dashboard/agent-log';
import { LiveChartPage } from '../pages/dashboard/live-chart';
import { ChatWidget } from '../containers/chat/chat-widget';
import { NotificationsPage } from '../pages/dashboard/notifications';
import { AdminLayout } from '../pages/admin/index';
import { AdminStatsPage } from '../pages/admin/stats';
import { AdminUsersPage } from '../pages/admin/users';
import { AdminAgentsPage } from '../pages/admin/agents';
import { useWebSocket } from '../hooks/use-websocket';
import { useAuthStore } from '../store/auth.store';

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

/** Initializes WebSocket when the user is authenticated */
function WebSocketInit() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useWebSocket({ enabled: isAuthenticated });
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <WebSocketInit />
        <Toaster richColors position="top-right" />
        <ChatWidget />
        <Routes>
          <Route
            path="/"
            element={
              <PublicLayout>
                <LandingPage />
              </PublicLayout>
            }
          />
          <Route
            path="/login"
            element={
              <PublicLayout>
                <LoginPage />
              </PublicLayout>
            }
          />
          <Route
            path="/register"
            element={
              <PublicLayout>
                <RegisterPage />
              </PublicLayout>
            }
          />
          <Route
            path="/help"
            element={
              <PublicLayout>
                <HelpPage />
              </PublicLayout>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route
              path="chart"
              element={<Navigate to="/dashboard/market" replace />}
            />
            <Route path="positions" element={<PositionsPage />} />
            <Route path="history" element={<TradeHistoryPage />} />
            <Route
              path="agent"
              element={<Navigate to="/dashboard/bot-analysis" replace />}
            />
            <Route
              path="analytics"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route path="market" element={<MarketPage />} />
            <Route path="bot-analysis" element={<BotAnalysisPage />} />
            <Route path="agent-log" element={<AgentLogPage />} />
            <Route
              path="agents"
              element={<Navigate to="/help#agents-showcase" replace />}
            />
            <Route path="live-chart" element={<LiveChartPage />} />
            <Route path="news" element={<NewsFeedPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="" element={<AdminLayout />}>
              <Route index element={<AdminStatsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="agents" element={<AdminAgentsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
