import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsSteps,
  DocsTable,
  DocsCallout,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { GitFork } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';
export function DocsAgentFlowPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('agent-flow');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.agentFlow.title', 'Agent Decision Flow')}
      />

      <DocsSectionHeader id="agent-flow" icon={<GitFork className="h-5 w-5" />}>
        {t('docs.agentFlow.title', 'Agent Decision Flow')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agentFlow.intro',
          'Understand how the agent makes trading decisions step by step, from data collection to trade execution.',
        )}
      </p>

      {/* Decision Cycle */}
      <h2 id="decision-cycle" className="mb-3 text-lg font-semibold">
        {t('docs.agentFlow.cycleTitle', 'The decision cycle')}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t('docs.agentFlow.step1', 'Data Collection'),
            description: t(
              'docs.agentFlow.step1Desc',
              'Fetch latest market data, OHLCV candles, and technical indicators for the configured pair.',
            ),
          },
          {
            title: t('docs.agentFlow.step2', 'Multi-Agent Consultation'),
            description: t(
              'docs.agentFlow.step2Desc',
              'The orchestrator (KRYPTO) routes market data to relevant specialists: SIGMA for market analysis, AEGIS for risk, CIPHER for blockchain.',
            ),
          },
          {
            title: t('docs.agentFlow.step3', 'Synthesis'),
            description: t(
              'docs.agentFlow.step3Desc',
              'KRYPTO synthesizes specialist opinions into a single recommendation: BUY, SELL, or HOLD.',
            ),
          },
          {
            title: t('docs.agentFlow.step4', 'Confidence Check'),
            description: t(
              'docs.agentFlow.step4Desc',
              'The recommendation includes a confidence score (0-100%). Compared against the agent buy/sell thresholds.',
            ),
          },
          {
            title: t('docs.agentFlow.step5', 'Execution'),
            description: t(
              'docs.agentFlow.step5Desc',
              'If confidence exceeds threshold AND all safety checks pass, the trade is executed.',
            ),
          },
          {
            title: t('docs.agentFlow.step6', 'Wait'),
            description: t(
              'docs.agentFlow.step6Desc',
              'The agent waits for the next cycle (fixed interval or AI-suggested).',
            ),
          },
        ]}
      />

      {/* Decision outcomes */}
      <h2 id="decision-outcomes" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agentFlow.outcomesTitle', 'Decision outcomes')}
      </h2>
      <DocsTable
        headers={[
          t('docs.agentFlow.scenario', 'Scenario'),
          t('docs.agentFlow.decision', 'Decision'),
          t('docs.agentFlow.confidence', 'Confidence'),
          t('docs.agentFlow.threshold', 'Threshold'),
          t('docs.agentFlow.result', 'Result'),
        ]}
        rows={[
          [
            t('docs.agentFlow.strongBuy', 'Strong buy signal'),
            'BUY',
            '85%',
            '70%',
            '✅ ' + t('docs.agentFlow.executed', 'Trade executed'),
          ],
          [
            t('docs.agentFlow.weakBuy', 'Weak buy signal'),
            'BUY',
            '55%',
            '70%',
            '❌ ' + t('docs.agentFlow.skipped', 'Skipped — below threshold'),
          ],
          [
            t('docs.agentFlow.sellProfit', 'Sell with profit'),
            'SELL',
            '80%',
            '70%',
            '✅ ' +
              t(
                'docs.agentFlow.executedProfit',
                'Executed (if min profit met)',
              ),
          ],
          [
            t('docs.agentFlow.sellLoss', 'Sell at loss'),
            'SELL',
            '90%',
            '70%',
            '❌ ' +
              t(
                'docs.agentFlow.blocked',
                'Blocked — never sells at loss via LLM',
              ),
          ],
          [
            t('docs.agentFlow.neutral', 'Market neutral'),
            'HOLD',
            'N/A',
            'N/A',
            t('docs.agentFlow.noAction', 'No action — wait'),
          ],
        ]}
      />

      {/* Wait time */}
      <h2 id="wait-time" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agentFlow.waitTitle', 'The wait time')}
      </h2>
      <DocsCallout
        variant="info"
        title={t('docs.agentFlow.agentMode', 'AGENT mode (default)')}
      >
        {t(
          'docs.agentFlow.agentModeDesc',
          'The AI suggests a wait time based on market volatility. High volatility = shorter wait (2-5 min). Low volatility = longer wait (10-30 min).',
        )}
      </DocsCallout>
      <div className="mt-3">
        <DocsCallout
          variant="info"
          title={t('docs.agentFlow.customMode', 'CUSTOM mode')}
        >
          {t(
            'docs.agentFlow.customModeDesc',
            'Fixed interval set by the user (minimum 5 minutes). The AI does not adjust the frequency.',
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
