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
import { Brain } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsBotAnalysisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('bot-analysis');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.botAnalysis.title', 'Bot Analysis')}
      />

      <DocsSectionHeader id="bot-analysis" icon={<Brain className="h-5 w-5" />}>
        {t('docs.botAnalysis.title', 'Bot Analysis')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.intro',
          "The Bot Analysis page is a live diagnostic center that shows everything that influences the agent's next trading decision: technical indicators, news sentiment, recent agent activity, and a combined confidence score.",
        )}
      </p>

      <DocsCallout
        variant="info"
        title={t('docs.botAnalysis.infoTitle', 'What this page is for')}
      >
        {t(
          'docs.botAnalysis.infoDesc',
          'Use Bot Analysis to understand WHY the agent is likely to BUY, SELL, or HOLD. It gives you transparency into the AI reasoning before decisions happen.',
        )}
      </DocsCallout>

      {/* Combined Score */}
      <h2 id="combined-score" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.combinedScoreTitle', 'Combined score banner')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.combinedScoreDesc',
          'The top banner shows an overall market signal (BULLISH, BEARISH, or NEUTRAL) derived from combining technical indicators and news sentiment. This is an informational signal — it does not directly execute trades. The final decision is always made by the AI agents.',
        )}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <DocsBadge variant="success">BULLISH</DocsBadge>
        <DocsBadge variant="default">NEUTRAL</DocsBadge>
        <DocsBadge variant="danger">BEARISH</DocsBadge>
      </div>

      {/* Technical Summary */}
      <h2 id="technical-summary" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.techSummaryTitle', 'Technical summary')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.techSummaryDesc',
          'The Technical Summary panel aggregates all active indicators for the selected pair into a single readable verdict. Each indicator is shown with its current value and a BUY/SELL/NEUTRAL signal.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.botAnalysis.indicator', 'Indicator'),
          t('docs.botAnalysis.value', 'Value shown'),
          t('docs.botAnalysis.signal', 'Signal'),
        ]}
        rows={[
          [
            'RSI',
            t('docs.botAnalysis.rsiValue', '0–100 numeric value'),
            t('docs.botAnalysis.rsiSignal', 'OVERBOUGHT / OVERSOLD / NEUTRAL'),
          ],
          [
            'MACD',
            t(
              'docs.botAnalysis.macdValue',
              'MACD line, signal line, histogram',
            ),
            t('docs.botAnalysis.macdSignal', 'BULLISH / BEARISH / NEUTRAL'),
          ],
          [
            'Bollinger Bands',
            t('docs.botAnalysis.bbValue', 'Upper/lower band position'),
            t('docs.botAnalysis.bbSignal', 'NEAR_UPPER / NEAR_LOWER / NEUTRAL'),
          ],
          [
            t('docs.botAnalysis.volume', 'Volume'),
            t('docs.botAnalysis.volumeValue', '24h volume vs average'),
            t('docs.botAnalysis.volumeSignal', 'HIGH / LOW / NORMAL'),
          ],
          [
            'EMA 9/21',
            t('docs.botAnalysis.emaValue', 'EMA crossover status'),
            t('docs.botAnalysis.emaSignal', 'BULLISH / BEARISH'),
          ],
        ]}
      />

      {/* News Sentiment */}
      <h2 id="news-sentiment" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.newsSentimentTitle', 'News sentiment panel')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.newsSentimentDesc',
          'This panel shows the sentiment of recent crypto news and how it aligns with technical signals. SIGMA processes news headlines to gauge market mood, which is one of the inputs for trading decisions.',
        )}
      </p>
      <DocsTable
        headers={[
          t('docs.botAnalysis.element', 'Element'),
          t('docs.botAnalysis.description', 'Description'),
        ]}
        rows={[
          [
            t('docs.botAnalysis.overallSentiment', 'Overall Sentiment'),
            t(
              'docs.botAnalysis.overallSentimentDesc',
              'Aggregate sentiment score across recent news (POSITIVE / NEGATIVE / NEUTRAL)',
            ),
          ],
          [
            t('docs.botAnalysis.newsCount', 'News count'),
            t(
              'docs.botAnalysis.newsCountDesc',
              'How many recent articles are included in the analysis',
            ),
          ],
          [
            t('docs.botAnalysis.sigmaOpinion', 'SIGMA opinion'),
            t(
              'docs.botAnalysis.sigmaOpinionDesc',
              "SIGMA's last recorded sentiment from the most recent decision cycle",
            ),
          ],
        ]}
      />

      {/* Agent Input Summary */}
      <h2 id="agent-input-summary" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.agentInputTitle', 'Agent input summary')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.agentInputDesc',
          'This section shows a summary of the recent agent decisions: BUY/SELL/HOLD counts, average confidence, and which trading pairs are most active. It helps you understand whether agents have been consistently bullish, bearish, or neutral recently.',
        )}
      </p>

      {/* Next Decision Banner */}
      <h2 id="next-decision" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.nextDecisionTitle', 'Next decision countdown')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.nextDecisionDesc',
          'If any agent is currently running, the Next Decision banner shows a countdown to when the agent will next analyze the market. In AGENT interval mode, this time is dynamically set by the AI based on volatility.',
        )}
      </p>
      <DocsCallout
        variant="tip"
        title={t('docs.botAnalysis.nextDecisionTip', 'No countdown?')}
      >
        {t(
          'docs.botAnalysis.nextDecisionTipDesc',
          'The countdown only appears when at least one agent is actively running. Go to Agent Config, find your agent, and click Play to start it.',
        )}
      </DocsCallout>

      {/* Pair selection */}
      <h2 id="pair-selection" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.botAnalysis.pairSelectionTitle', 'Pair selection')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.botAnalysis.pairSelectionDesc',
          'Use the pair selector at the top to switch between BTCUSDT, BTCUSDC, ETHUSDT, and ETHUSDC. The technical summary and news sentiment update to reflect the selected pair.',
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
