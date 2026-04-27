import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsTable,
  DocsCallout,
  DocsSteps,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Newspaper } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsNewsFeedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('news-feed');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.newsFeed.title', 'News Feed')}
      />

      <DocsSectionHeader
        id="news-feed"
        icon={<Newspaper className="h-5 w-5" />}
      >
        {t('docs.newsFeed.title', 'News Feed')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.intro',
          'The News Feed page aggregates crypto news headlines, analyzes their sentiment, and shows how recent news aligns with market conditions. This is one of the inputs that influences agent trading decisions.',
        )}
      </p>

      {/* Analysis summary card */}
      <h2 id="analysis-summary" className="mb-3 text-lg font-semibold">
        {t('docs.newsFeed.summaryTitle', 'Analysis summary card')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.summaryDesc',
          'At the top of the News Feed, the Analysis Summary card shows the aggregate sentiment across all recent headlines. It distinguishes between keyword-based analysis (fast, automatic) and AI-powered analysis (deeper, on-demand).',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.newsFeed.method', 'Method'),
          t('docs.newsFeed.description', 'Description'),
          t('docs.newsFeed.when', 'When it runs'),
        ]}
        rows={[
          [
            t('docs.newsFeed.keywordAnalysis', 'Keyword analysis'),
            t(
              'docs.newsFeed.keywordDesc',
              'Fast pattern matching on headlines using predefined crypto keywords',
            ),
            t(
              'docs.newsFeed.keywordWhen',
              'Automatic, every time news refreshes',
            ),
          ],
          [
            t('docs.newsFeed.aiAnalysis', 'AI analysis'),
            t(
              'docs.newsFeed.aiDesc',
              'Deeper semantic analysis using an LLM to understand nuance and context',
            ),
            t(
              'docs.newsFeed.aiWhen',
              'On-demand by clicking "Run AI Analysis"',
            ),
          ],
        ]}
      />

      {/* Sentiment filters */}
      <h2 id="sentiment-filters" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.newsFeed.filtersTitle', 'Filtering by sentiment')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.filtersDesc',
          "Use the filter tabs above the news list to show all news, or only POSITIVE, NEGATIVE, or NEUTRAL headlines. This is useful for quickly spotting what's driving market sentiment.",
        )}
      </p>

      {/* News card anatomy */}
      <h2 id="news-card" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.newsFeed.cardTitle', 'News card anatomy')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.cardDesc',
          "Each news item shows a headline, source, publication time, and sentiment badge. Click any news card to open the detail modal with the full content and the AI's assessment (when AI analysis has been run).",
        )}
      </p>

      {/* SIGMA connection */}
      <h2 id="sigma-connection" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.newsFeed.sigmaTitle', 'Connection to SIGMA')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.sigmaDesc',
          "SIGMA (the market analyst agent) reads recent news as part of its market analysis. The News Feed shows SIGMA's last recorded sentiment (from the most recent decision cycle). If SIGMA sees mostly negative news with bearish technicals, it's more likely to recommend HOLD or SELL.",
        )}
      </p>
      <DocsCallout
        variant="info"
        title={t('docs.newsFeed.sigmaTip', 'SIGMA sentiment badge')}
      >
        {t(
          'docs.newsFeed.sigmaTipDesc',
          "The SIGMA sentiment badge in the analysis summary shows SIGMA's most recent opinion on the market from its last decision cycle. This may differ from the raw news sentiment if SIGMA interpreted the technicals differently.",
        )}
      </DocsCallout>

      {/* News configuration */}
      <h2 id="news-config" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.newsFeed.configTitle', 'Configuring news')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.newsFeed.configDesc',
          'Go to Settings → News to configure how many news items are fetched and shown. The default is 15 headlines. More headlines give SIGMA a broader market picture but may slow analysis.',
        )}
      </p>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.newsFeed.configStep1',
              'Navigate to Settings → News',
            ),
          },
          {
            title: t(
              'docs.newsFeed.configStep2',
              'Set the number of news items',
            ),
            description: t(
              'docs.newsFeed.configStep2Desc',
              'Range: 5–50 items. Default is 15. Higher values give SIGMA more context but each AI analysis call will be larger.',
            ),
          },
          {
            title: t(
              'docs.newsFeed.configStep3',
              'Save and return to News Feed',
            ),
            description: t(
              'docs.newsFeed.configStep3Desc',
              'The news list will refresh with the new count on next load.',
            ),
          },
        ]}
      />

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
