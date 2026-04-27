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
import { DocsLayout } from '../pages/docs/layout';
import { DocsQuickstartPage } from '../pages/docs/quickstart';
import { DocsPlatformBehaviorPage } from '../pages/docs/platform-behavior';
import { DocsDashboardPage } from '../pages/docs/dashboard';
import { DocsAgentsPage } from '../pages/docs/agents';
import { DocsAgentFlowPage } from '../pages/docs/agent-flow';
import { DocsAgentConfigPage } from '../pages/docs/agent-config';
import { DocsAgentLogPage } from '../pages/docs/agent-decisions';
import { DocsTradeExecutionPage } from '../pages/docs/trade-execution';
import { DocsMarketPage } from '../pages/docs/market';
import { DocsBotAnalysisPage } from '../pages/docs/bot-analysis';
import { DocsChatPage } from '../pages/docs/chat';
import { DocsNewsFeedPage } from '../pages/docs/news-feed';
import { DocsBinancePage } from '../pages/docs/binance';
import { DocsOperationModesPage } from '../pages/docs/operation-modes';
import { DocsLlmProvidersPage } from '../pages/docs/llm-providers';
import { DocsApiKeysPage } from '../pages/docs/api-keys';
import { DocsSettingsAgentsPage } from '../pages/docs/settings-agents';
import { DocsFaqPage } from '../pages/docs/faq';
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
import { useChatStore } from '../store/chat.store';
import { ScrollToTop } from '../components/scroll-to-top';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

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

/**
 * Pushes page content to the left on desktop when the chat sidebar is open.
 * On mobile the chat is a bottom-sheet overlay so no shift is needed.
 */
function ContentWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen } = useChatStore();
  const { isAuthenticated } = useAuthStore();
  const { pathname } = useLocation();
  const shouldShift =
    isOpen && isAuthenticated && !pathname.startsWith('/dashboard/chat');
  return (
    <div
      className={cn(
        'transition-[padding-right] duration-300 ease-in-out',
        shouldShift && 'md:pr-[400px]',
      )}
    >
      {children}
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <ScrollToTop />
        <WebSocketInit />
        <Toaster richColors position="top-right" />
        <ChatWidget />
        <ContentWrapper>
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
            <Route path="/docs" element={<DocsLayout />}>
              <Route index element={<Navigate to="quickstart" replace />} />
              <Route path="quickstart" element={<DocsQuickstartPage />} />
              <Route
                path="platform-behavior"
                element={<DocsPlatformBehaviorPage />}
              />
              <Route path="dashboard" element={<DocsDashboardPage />} />
              <Route path="agents" element={<DocsAgentsPage />} />
              <Route path="agent-flow" element={<DocsAgentFlowPage />} />
              <Route path="agent-config" element={<DocsAgentConfigPage />} />
              <Route path="agent-decisions" element={<DocsAgentLogPage />} />
              <Route
                path="trade-execution"
                element={<DocsTradeExecutionPage />}
              />
              <Route path="market" element={<DocsMarketPage />} />
              <Route path="bot-analysis" element={<DocsBotAnalysisPage />} />
              <Route path="chat" element={<DocsChatPage />} />
              <Route path="news-feed" element={<DocsNewsFeedPage />} />
              <Route path="binance" element={<DocsBinancePage />} />
              <Route
                path="operation-modes"
                element={<DocsOperationModesPage />}
              />
              <Route path="llm-providers" element={<DocsLlmProvidersPage />} />
              <Route path="api-keys" element={<DocsApiKeysPage />} />
              <Route
                path="settings-agents"
                element={<DocsSettingsAgentsPage />}
              />
              <Route path="faq" element={<DocsFaqPage />} />
            </Route>
            <Route
              path="/help"
              element={<Navigate to="/docs/quickstart" replace />}
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
                element={<Navigate to="/docs#agents-showcase" replace />}
              />
              <Route path="live-chart" element={<LiveChartPage />} />
              <Route path="news" element={<NewsFeedPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route
                path="settings"
                element={<Navigate to="/dashboard/settings/profile" replace />}
              />
              <Route
                path="settings/profile"
                element={<SettingsProfilePage />}
              />
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
              <Route
                path="notifications"
                element={<AdminNotificationsPage />}
              />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="help" element={<AdminHelpPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ContentWrapper>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
