import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppThemeProvider } from '../containers/theme-provider-container';
import { Navbar } from '../containers/navbar-container';
import { PriceTicker } from '../containers/price-ticker-container';
import { ProtectedRoute } from '../components/protected-route';
import { RoleRedirect } from '../components/role-redirect';
import { GuestRoute } from '../components/guest-route';
import { LandingPage } from '../pages/landing';
import { LoginPage } from '../pages/login';
import { RegisterPage } from '../pages/register';
import { OnboardingPage } from '../pages/onboarding';
import { HelpPage } from '../pages/help';
import { DashboardLayout } from '../layouts/dashboard-layout';
import { AdminDashboardLayout } from '../layouts/admin-dashboard-layout';
import { OverviewPage } from '../pages/dashboard/overview';
import { TradeHistoryPage } from '../pages/dashboard/trade-history';
import { MarketPage } from '../pages/dashboard/market';
import { ConfigPage } from '../pages/dashboard/config';
import { SettingsPage } from '../pages/dashboard/settings';
import {
  SettingsProfilePage,
  SettingsExchangePage,
  SettingsLLMsPage,
  SettingsNewsPage,
  SettingsAgentsPage,
} from '../pages/dashboard/settings/index';
import { PositionsPage } from '../pages/dashboard/positions';
import { NewsFeedPage } from '../pages/dashboard/news-feed';
import { ChatPage } from '../pages/dashboard/chat';
import { BotAnalysisPage } from '../pages/dashboard/bot-analysis';
import { AgentLogPage } from '../pages/dashboard/agent-log';
import { LiveChartPage } from '../pages/dashboard/live-chart';
import { ChatWidget } from '../containers/chat/chat-widget';
import { NotificationsPage } from '../pages/dashboard/notifications';
import {
  AdminStatsPage,
  AdminUsersPage,
  AdminAgentsPage,
  AdminProfilePage,
  AdminNotificationsPage,
  AdminLLMProvidersPage,
  AdminAgentModelsPage,
  AdminAuditLogPage,
  AdminHelpPage,
} from '../pages/admin/index';
import { useWebSocket } from '../hooks/use-websocket';
import { useAuthStore } from '../store/auth.store';
import { ScrollToTop } from '../components/scroll-to-top';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <PriceTicker />
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
        <ScrollToTop />
        <WebSocketInit />
        <Toaster richColors position="top-right" />
        <ChatWidget />
        <Routes>
          <Route
            path="/"
            element={
              <PublicLayout>
                <RoleRedirect>
                  <LandingPage />
                </RoleRedirect>
              </PublicLayout>
            }
          />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <PublicLayout>
                  <LoginPage />
                </PublicLayout>
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <PublicLayout>
                  <RegisterPage />
                </PublicLayout>
              </GuestRoute>
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
              <ProtectedRoute allowedRoles={['TRADER']}>
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
            <Route
              path="settings"
              element={<Navigate to="/dashboard/settings/profile" replace />}
            />
            <Route path="settings/profile" element={<SettingsProfilePage />} />
            <Route
              path="settings/exchange"
              element={<SettingsExchangePage />}
            />
            <Route path="settings/llms" element={<SettingsLLMsPage />} />
            <Route path="settings/news" element={<SettingsNewsPage />} />
            <Route path="settings/agents" element={<SettingsAgentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminStatsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="agents" element={<AdminAgentsPage />} />
            <Route path="llm-providers" element={<AdminLLMProvidersPage />} />
            <Route path="agent-models" element={<AdminAgentModelsPage />} />
            <Route path="audit-log" element={<AdminAuditLogPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="help" element={<AdminHelpPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
