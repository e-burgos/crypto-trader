import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsBadge,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { ToggleRight } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsOperationModesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('operation-modes');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.integration', 'Integration')}
        page={t('docs.operationModes.title', 'Operation Modes')}
      />

      <DocsSectionHeader
        id="operation-modes"
        icon={<ToggleRight className="h-5 w-5" />}
      >
        {t('docs.operationModes.title', 'Operation Modes')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.operationModes.intro',
          'CryptoTrader supports three operation modes. Each mode determines how trades are executed and whether real money is at risk.',
        )}
      </p>

      {/* Overview */}
      <h2 id="modes-overview" className="mb-3 text-lg font-semibold">
        {t('docs.operationModes.overviewTitle', 'Modes overview')}
      </h2>
      <DocsTable
        headers={[
          t('docs.operationModes.mode', 'Mode'),
          t('docs.operationModes.exchange', 'Exchange'),
          t('docs.operationModes.realMoney', 'Real money?'),
          t('docs.operationModes.useCase', 'Use case'),
        ]}
        rows={[
          [
            'SANDBOX',
            t('docs.operationModes.simulated', 'Simulated'),
            '❌ No',
            t('docs.operationModes.sandboxUse', 'Learning, testing strategies'),
          ],
          [
            'TESTNET',
            'Binance Testnet',
            '❌ No',
            t('docs.operationModes.testnetUse', 'API integration testing'),
          ],
          [
            'LIVE',
            'Binance Production',
            '✅ Yes',
            t('docs.operationModes.liveUse', 'Real trading'),
          ],
        ]}
      />

      {/* Sandbox details */}
      <h2 id="sandbox-mode" className="mt-10 mb-3 text-lg font-semibold">
        <DocsBadge variant="success">SANDBOX</DocsBadge>{' '}
        {t('docs.operationModes.sandboxTitle', 'Sandbox mode')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.operationModes.sandboxDesc',
          'All trades are simulated in the database. No exchange connection needed, no API keys required. Perfect for learning and strategy testing. Uses real market prices from Binance WebSocket.',
        )}
      </p>
      <DocsCallout
        variant="tip"
        title={t('docs.operationModes.sandboxTipTitle', 'Best for beginners')}
      >
        {t(
          'docs.operationModes.sandboxTip',
          'Start here to understand how the agents work, test configurations, and learn the platform without any risk.',
        )}
      </DocsCallout>

      {/* Testnet details */}
      <h2 id="testnet-mode" className="mt-10 mb-3 text-lg font-semibold">
        <DocsBadge variant="warning">TESTNET</DocsBadge>{' '}
        {t('docs.operationModes.testnetTitle', 'Testnet mode')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.operationModes.testnetDesc',
          'Connects to Binance Testnet — a separate environment with fake money. Orders are placed on a real exchange API but with test funds. Good for validating API key setup and order execution without risk.',
        )}
      </p>
      <DocsCallout
        variant="warning"
        title={t('docs.operationModes.testnetNote', 'Testnet limitations')}
      >
        {t(
          'docs.operationModes.testnetLimitations',
          'Testnet prices may differ from production. Liquidity is limited. Some pairs may not be available.',
        )}
      </DocsCallout>

      {/* Live details */}
      <h2 id="live-mode" className="mt-10 mb-3 text-lg font-semibold">
        <DocsBadge variant="danger">LIVE</DocsBadge>{' '}
        {t('docs.operationModes.liveTitle', 'Live mode')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.operationModes.liveDesc',
          'Real money trading on Binance production. Every trade uses your actual balance. Requires a Binance account with real funds and properly configured API keys.',
        )}
      </p>
      <DocsCallout
        variant="danger"
        title={t('docs.operationModes.liveWarning', 'Risk warning')}
      >
        {t(
          'docs.operationModes.liveRisk',
          'Live trading involves real financial risk. Start with small amounts. The platform provides stop-loss protection but losses are still possible. Only trade what you can afford to lose.',
        )}
      </DocsCallout>

      {/* Switching */}
      <h2 id="switching-modes" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.operationModes.switchingTitle', 'Switching between modes')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.operationModes.switchingDesc',
          "The operation mode is set per-agent. You can have one agent running in SANDBOX and another in LIVE simultaneously. To switch an agent's mode: stop the agent, edit configuration, change the mode, and restart.",
        )}
      </p>

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
