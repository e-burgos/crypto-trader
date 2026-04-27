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
import { Bot } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsAgentLogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('agent-decisions');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.agentDecisions.title', 'Agent Log')}
      />

      <DocsSectionHeader
        id="agent-decisions"
        icon={<Bot className="h-5 w-5" />}
      >
        {t('docs.agentDecisions.title', 'Agent Log')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentDecisions.intro',
          "The Agent Log is the complete record of every decision the AI made: what it analyzed, what it decided, why, and with what confidence. It's the primary tool for auditing agent behavior.",
        )}
      </p>

      {/* Decision card anatomy */}
      <h2 id="decision-card" className="mb-3 text-lg font-semibold">
        {t('docs.agentDecisions.cardTitle', 'Decision card anatomy')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentDecisions.cardDesc',
          'Each entry in the Agent Log is a decision card. Click any card to expand the full reasoning from the AI.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.agentDecisions.field', 'Field'),
          t('docs.agentDecisions.description', 'Description'),
        ]}
        rows={[
          [
            t('docs.agentDecisions.decisionBadge', 'Decision badge'),
            t(
              'docs.agentDecisions.decisionBadgeDesc',
              'BUY (green), SELL (red), or HOLD (gray) — the final recommendation',
            ),
          ],
          [
            t('docs.agentDecisions.confidence', 'Confidence'),
            t(
              'docs.agentDecisions.confidenceDesc',
              'Score from 0–100%. How certain the AI was about its decision',
            ),
          ],
          [
            t('docs.agentDecisions.pair', 'Trading pair'),
            t(
              'docs.agentDecisions.pairDesc',
              'The asset pair analyzed (e.g., BTC/USDT)',
            ),
          ],
          [
            t('docs.agentDecisions.price', 'Price at decision'),
            t(
              'docs.agentDecisions.priceDesc',
              'Market price when the decision was made',
            ),
          ],
          [
            t('docs.agentDecisions.mode', 'Operation mode'),
            t(
              'docs.agentDecisions.modeDesc',
              'SANDBOX, TESTNET, or LIVE — which environment the agent was running in',
            ),
          ],
          [
            t('docs.agentDecisions.timestamp', 'Timestamp'),
            t(
              'docs.agentDecisions.timestampDesc',
              'When the decision cycle completed',
            ),
          ],
          [
            t('docs.agentDecisions.suggestedWait', 'Suggested wait'),
            t(
              'docs.agentDecisions.suggestedWaitDesc',
              'How long the AI suggested waiting before the next analysis (in AGENT mode)',
            ),
          ],
        ]}
      />

      {/* Decision types */}
      <h2 id="decision-types" className="mt-10 mb-3 text-lg font-semibold">
        {t(
          'docs.agentDecisions.typesTitle',
          'Understanding each decision type',
        )}
      </h2>
      <div className="space-y-3">
        <DocsCallout variant="tip" title="BUY">
          {t(
            'docs.agentDecisions.buyDesc',
            'Agent decided to buy. A trade was executed ONLY IF: confidence exceeded the buy threshold AND available capital ≥ minimum trade size AND open positions < max concurrent.',
          )}
        </DocsCallout>
        <DocsCallout variant="danger" title="SELL">
          {t(
            'docs.agentDecisions.sellDesc',
            'Agent decided to sell. A trade was executed ONLY IF: confidence exceeded the sell threshold AND the position profit ≥ minProfitPct (0.3%). The agent never sells at a loss.',
          )}
        </DocsCallout>
        <DocsCallout variant="info" title="HOLD">
          {t(
            'docs.agentDecisions.holdDesc',
            'No action taken. Market conditions did not meet the criteria for BUY or SELL. The agent will wait and re-analyze at the next interval.',
          )}
        </DocsCallout>
      </div>

      {/* Filters */}
      <h2 id="filters" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agentDecisions.filtersTitle', 'Filtering decisions')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentDecisions.filtersDesc',
          'Use the filter panel to narrow down the decision log. You can filter by decision type, trading pair, and which agent produced the decision.',
        )}
      </p>
      <DocsTable
        headers={[
          t('docs.agentDecisions.filter', 'Filter'),
          t('docs.agentDecisions.options', 'Options'),
        ]}
        rows={[
          [
            t('docs.agentDecisions.decisionFilter', 'Decision type'),
            'ALL, BUY, SELL, HOLD',
          ],
          [
            t('docs.agentDecisions.assetFilter', 'Asset / Pair'),
            'ALL, BTC/USDT, BTC/USDC, ETH/USDT, ETH/USDC',
          ],
          [
            t('docs.agentDecisions.agentFilter', 'Agent'),
            t(
              'docs.agentDecisions.agentFilterDesc',
              'ALL or specific agent configuration name',
            ),
          ],
        ]}
      />

      {/* Decision detail */}
      <h2 id="decision-detail" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agentDecisions.detailTitle', 'Decision detail modal')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentDecisions.detailDesc',
          "Click any decision card to open the detail modal. It shows the full AI reasoning text from all participating agents (SIGMA's market analysis, AEGIS's risk evaluation, CIPHER's blockchain input, and KRYPTO's synthesis).",
        )}
      </p>
      <DocsCallout
        variant="info"
        title={t('docs.agentDecisions.detailTip', 'Reading the reasoning')}
      >
        {t(
          'docs.agentDecisions.detailTipDesc',
          "The reasoning field shows KRYPTO Synthesis's final analysis. It explains which signals were strongest, why the decision was made, and what conditions would change the outcome. This is the most direct window into the AI's thinking.",
        )}
      </DocsCallout>

      {/* Mode awareness */}
      <h2 id="mode-awareness" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agentDecisions.modeAwarenessTitle', 'Mode-filtered display')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentDecisions.modeAwarenessDesc',
          'The Agent Log automatically filters to show only decisions from the current operation mode. Switch between SANDBOX, TESTNET, and LIVE using the platform mode selector in the top navigation to see decisions from each environment.',
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
