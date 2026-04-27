import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsCallout,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { AlertTriangle } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsPlatformBehaviorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('platform-behavior');

  return (
    <div>
      <DocsBreadcrumb
        group={t('help.gettingStarted', 'Getting Started')}
        page={t('docs.platformBehavior.title', 'Platform Behavior')}
      />

      <DocsSectionHeader
        id="platform-behavior"
        icon={<AlertTriangle className="h-5 w-5" />}
      >
        {t('docs.platformBehavior.title', 'Platform Behavior')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.intro',
          'Important behaviors, warnings, and mechanisms you should understand before trading.',
        )}
      </p>

      {/* Stop All */}
      <h2 id="stop-all" className="mb-3 text-lg font-semibold">
        {t('help.stopAllTitle', 'Stop All mechanism')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'help.stopAllDesc',
          'The Stop All button immediately stops all running trading agents. When activated: all agents stop their analysis cycles, no new trades are placed, but existing open positions are NOT automatically closed.',
        )}
      </p>
      <DocsCallout
        variant="warning"
        title={t('docs.platformBehavior.stopAllWarning', 'Important')}
      >
        {t(
          'docs.platformBehavior.stopAllNote',
          'Existing open positions remain open after Stop All. You must manually close positions or restart agents to resume trading.',
        )}
      </DocsCallout>

      {/* Auto-stop */}
      <h2 id="auto-stop" className="mt-10 mb-3 text-lg font-semibold">
        {t(
          'docs.platformBehavior.autoStopTitle',
          'Auto-stop on configuration changes',
        )}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.autoStopDesc',
          'The platform automatically stops an agent when you modify its configuration. This prevents the agent from trading with outdated parameters. After saving changes, you must manually restart the agent.',
        )}
      </p>

      {/* Position lifecycle */}
      <h2 id="position-lifecycle" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.platformBehavior.lifecycleTitle', 'Position lifecycle')}
      </h2>
      <p className="mb-2 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.lifecycleDesc',
          'Positions follow a strict lifecycle: OPEN when a BUY trade executes, monitored each cycle, and CLOSED when a SELL trade executes (manual or automatic).',
        )}
      </p>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.lifecycleAutoSell',
          'Automatic sell conditions: take-profit threshold reached, stop-loss threshold reached, or AI agent recommends SELL with sufficient confidence AND minimum profit threshold is met (default 0.3%).',
        )}
      </p>
      <DocsCallout
        variant="info"
        title={t(
          'docs.platformBehavior.noLossTitle',
          'No autonomous loss selling',
        )}
      >
        {t(
          'help.binanceIntegration.minProfitNote',
          'The agent never sells autonomously if the position is at a loss. There is a minimum profitability threshold (default 0.3%) that must be exceeded before an automatic sell is executed. Manual close has no such restriction.',
        )}
      </DocsCallout>

      {/* Rate limiting */}
      <h2 id="rate-limiting" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.platformBehavior.rateLimitTitle', 'Rate limiting')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.rateLimitDesc',
          'Each agent has a configurable minimum interval between analysis cycles (default: 5 minutes). In AGENT mode, the AI suggests optimal wait time based on market volatility. In CUSTOM mode, a fixed interval is used.',
        )}
      </p>

      {/* Data refresh */}
      <h2 id="data-refresh" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.platformBehavior.dataRefreshTitle', 'Data refresh')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.platformBehavior.dataRefreshDesc',
          'Market prices update via WebSocket in real-time. Portfolio data refreshes every 30 seconds. Agent decisions appear in the Agent Log immediately after each cycle.',
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
