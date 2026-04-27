import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { LayoutDashboard } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('dashboard');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.dashboard.title', 'Dashboard Overview')}
      />

      <DocsSectionHeader
        id="dashboard"
        icon={<LayoutDashboard className="h-5 w-5" />}
      >
        {t('docs.dashboard.title', 'Dashboard Overview')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.intro',
          'The Overview page is your central command center. It shows your portfolio performance, real-time PnL, asset breakdown, and quick access to all platform sections.',
        )}
      </p>

      {/* KPI Cards */}
      <h2 id="kpi-cards" className="mb-3 text-lg font-semibold">
        {t('docs.dashboard.kpiTitle', 'Performance metrics')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.kpiDesc',
          'The top row shows four key metrics for the current operation mode. All metrics update automatically as agents execute trades.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.dashboard.metric', 'Metric'),
          t('docs.dashboard.description', 'Description'),
          t('docs.dashboard.source', 'Source'),
        ]}
        rows={[
          [
            t('docs.dashboard.netPnl', 'Net PnL'),
            t(
              'docs.dashboard.netPnlDesc',
              'Total profit/loss after fees across all closed positions',
            ),
            t('docs.dashboard.closedPositions', 'Closed positions'),
          ],
          [
            t('docs.dashboard.winRate', 'Win Rate'),
            t(
              'docs.dashboard.winRateDesc',
              'Percentage of profitable closed positions',
            ),
            t('docs.dashboard.closedPositions', 'Closed positions'),
          ],
          [
            t('docs.dashboard.openPositions', 'Open Positions'),
            t(
              'docs.dashboard.openPositionsDesc',
              'Number of currently active positions',
            ),
            t('docs.dashboard.liveData', 'Live data'),
          ],
          [
            t('docs.dashboard.totalTrades', 'Total Trades'),
            t(
              'docs.dashboard.totalTradesDesc',
              'All buy + sell orders executed in current mode',
            ),
            t('docs.dashboard.tradeHistory', 'Trade history'),
          ],
        ]}
      />
      <DocsCallout
        variant="info"
        title={t('docs.dashboard.modeNote', 'Mode-aware data')}
      >
        {t(
          'docs.dashboard.modeNoteDesc',
          'All metrics reflect only the current operation mode (SANDBOX, TESTNET, or LIVE). Switching modes shows separate data sets. Use the mode selector in the top navigation to switch.',
        )}
      </DocsCallout>

      {/* PnL Chart */}
      <h2 id="pnl-chart" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.dashboard.pnlChartTitle', 'PnL over time chart')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.pnlChartDesc',
          'The area chart shows your cumulative net profit/loss over time. Each point represents a closed trade. A rising line means profitable activity; flat or declining means losses or no trades.',
        )}
      </p>
      <DocsCallout
        variant="tip"
        title={t('docs.dashboard.pnlChartTip', 'No data yet?')}
      >
        {t(
          'docs.dashboard.pnlChartTipDesc',
          'The chart only appears after at least one closed trade. Start an agent in SANDBOX mode, let it complete at least one full BUY → SELL cycle, then return to see the chart.',
        )}
      </DocsCallout>

      {/* Asset Breakdown */}
      <h2 id="asset-breakdown" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.dashboard.assetTitle', 'Asset breakdown')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.assetDesc',
          'The bar chart shows PnL broken down by trading pair (BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC). This lets you compare which pairs are most profitable for your strategy.',
        )}
      </p>

      {/* Quick Actions */}
      <h2 id="quick-actions" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.dashboard.quickActionsTitle', 'Quick navigation')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.quickActionsDesc',
          'The Overview links to all key sections. Use the sidebar for quick access to Agent Config, Market, Positions, and Agent Log.',
        )}
      </p>
      <DocsTable
        headers={[
          t('docs.dashboard.section', 'Section'),
          t('docs.dashboard.path', 'Path'),
          t('docs.dashboard.purpose', 'Purpose'),
        ]}
        rows={[
          [
            'Agent Config',
            '/dashboard/config',
            t(
              'docs.dashboard.configPurpose',
              'Create, start, stop and manage trading agents',
            ),
          ],
          [
            'Market',
            '/dashboard/market',
            t(
              'docs.dashboard.marketPurpose',
              'Live prices, OHLCV charts, technical indicators',
            ),
          ],
          [
            'Positions',
            '/dashboard/positions',
            t(
              'docs.dashboard.positionsPurpose',
              'View open and closed trading positions',
            ),
          ],
          [
            'Agent Log',
            '/dashboard/agent-log',
            t(
              'docs.dashboard.agentLogPurpose',
              'Review all agent decisions with reasoning',
            ),
          ],
          [
            'Bot Analysis',
            '/dashboard/bot-analysis',
            t(
              'docs.dashboard.botAnalysisPurpose',
              'Combined technical + news + agent score',
            ),
          ],
          [
            'Chat',
            '/dashboard/chat',
            t(
              'docs.dashboard.chatPurpose',
              'Ask AI agents anything about the platform',
            ),
          ],
        ]}
      />

      {/* Balance display */}
      <h2 id="balance-display" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.dashboard.balanceTitle', 'Balance display')}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.dashboard.balanceDesc',
          'The balance shown depends on your operation mode:',
        )}
      </p>
      <div className="space-y-2">
        <DocsCallout
          variant="tip"
          title={`SANDBOX — ${t('docs.dashboard.sandboxBalance', 'Sandbox balance')}`}
        >
          {t(
            'docs.dashboard.sandboxBalanceDesc',
            'Virtual wallet starting at $10,000. Increases/decreases as sandbox trades close. Resets when you change mode.',
          )}
        </DocsCallout>
        <DocsCallout
          variant="warning"
          title={`TESTNET — ${t('docs.dashboard.testnetBalance', 'Testnet balance')}`}
        >
          {t(
            'docs.dashboard.testnetBalanceDesc',
            'Balance from your Binance Testnet account. Shows real USDT/USDC from test funds. Requires testnet API keys configured in Settings → Exchange.',
          )}
        </DocsCallout>
        <DocsCallout
          variant="danger"
          title={`LIVE — ${t('docs.dashboard.liveBalance', 'Live balance')}`}
        >
          {t(
            'docs.dashboard.liveBalanceDesc',
            'Real Binance balance. Shows actual USDT/USDC available. Requires live API keys. This is real money.',
          )}
        </DocsCallout>
      </div>

      <DocsPageFeedback
          question={t('docs.feedback.question', 'Was this page helpful?')}
          yesLabel={t('docs.feedback.yes', 'Yes')}
          noLabel={t('docs.feedback.no', 'No')}
          thanksYes={t('docs.feedback.thanksYes', 'Thanks for your feedback!')}
          thanksNo={t('docs.feedback.thanksNo', "Thanks — we'll work on improving this page.")}
        />

      <DocsPagination
        prev={
          prev ? { title: t(SLUG_TITLE_KEY_MAP[prev.slug] ?? prev.slug, prev.title), href: `/docs/${prev.slug}` } : undefined
        }
        next={
          next
            ? {
                title: t(SLUG_TITLE_KEY_MAP[next.slug] ?? next.slug, next.title),
                href: `/docs/${next.slug}`,
                description: next.description,
              }
            : undefined
        }
        previousLabel={t('docs.pagination.previous', 'Previous')}
        nextLabel={t('docs.pagination.next', 'Next')}
        onNavigate={(href) => {
          navigate(href);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
