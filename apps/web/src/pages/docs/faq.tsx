import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsCallout,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { HelpCircle } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id} id={item.id}>
          <h3 className="mb-2 text-sm font-semibold">{item.question}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DocsFaqPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('faq');

  const generalFaqs: FaqItem[] = [
    {
      id: 'faq-free',
      question: t('docs.faq.q1', 'Is CryptoTrader free?'),
      answer: t(
        'docs.faq.a1',
        'The platform is free to use. You only pay for LLM API usage (optional — free models available via OpenRouter) and Binance trading fees (0.1% per trade).',
      ),
    },
    {
      id: 'faq-money',
      question: t('docs.faq.q2', 'Can I lose money?'),
      answer: t(
        'docs.faq.a2',
        'In SANDBOX mode — no. In LIVE mode — yes. While the platform has stop-loss protection and never sells at a loss via AI, stop-loss itself can and will close positions at a loss to limit damage. Only trade what you can afford to lose.',
      ),
    },
    {
      id: 'faq-exchanges',
      question: t('docs.faq.q3', 'Which exchanges are supported?'),
      answer: t(
        'docs.faq.a3',
        'Currently Binance only (Spot trading). Support for Binance Futures and other exchanges is on the roadmap.',
      ),
    },
    {
      id: 'faq-coins',
      question: t('docs.faq.q4', 'Which cryptocurrencies can I trade?'),
      answer: t(
        'docs.faq.a4',
        'BTC and ETH with USDT or USDC as quote currencies. Four pairs: BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC.',
      ),
    },
  ];

  const tradingFaqs: FaqItem[] = [
    {
      id: 'faq-stop-loss',
      question: t('docs.faq.q5', 'How does stop-loss work?'),
      answer: t(
        'docs.faq.a5',
        'Stop-loss is a hard circuit breaker. When the price drops by the configured percentage from your entry price, the position is immediately closed — no AI decision involved. This is the only mechanism that can close at a loss.',
      ),
    },
    {
      id: 'faq-sell-loss',
      question: t('docs.faq.q6', 'Can the AI sell at a loss?'),
      answer: t(
        'docs.faq.a6',
        'No. The AI (LLM) never sells at a loss. There is a minimum profitability threshold (default 0.3%) that must be exceeded. Only stop-loss or manual close can exit at a loss.',
      ),
    },
    {
      id: 'faq-multiple-agents',
      question: t('docs.faq.q7', 'Can I run multiple agents simultaneously?'),
      answer: t(
        'docs.faq.a7',
        'Yes. Each agent operates independently with its own configuration, trading pair, and LLM provider. You can have agents in different modes (e.g., one SANDBOX, one LIVE).',
      ),
    },
    {
      id: 'faq-how-long',
      question: t('docs.faq.q8', 'How long does a trade cycle take?'),
      answer: t(
        'docs.faq.a8',
        'A single analysis cycle takes 10-30 seconds depending on the LLM provider speed. The interval between cycles is configurable (minimum 5 minutes, or AI-determined in AGENT mode).',
      ),
    },
  ];

  const technicalFaqs: FaqItem[] = [
    {
      id: 'faq-data-privacy',
      question: t('docs.faq.q9', 'Is my data safe?'),
      answer: t(
        'docs.faq.a9',
        'API keys are encrypted at rest. Market analysis data is sent to LLM providers but never includes your personal information or account details. The platform never has access to withdraw funds from your exchange account.',
      ),
    },
    {
      id: 'faq-self-host',
      question: t('docs.faq.q10', 'Can I self-host?'),
      answer: t(
        'docs.faq.a10',
        'Yes. CryptoTrader is open-source. You can deploy it on your own infrastructure using Docker. See the README for deployment instructions.',
      ),
    },
    {
      id: 'faq-offline',
      question: t('docs.faq.q11', 'What happens if the platform goes offline?'),
      answer: t(
        'docs.faq.a11',
        'All agents stop. Open positions remain open on the exchange. Stop-loss is managed by the platform, not the exchange, so it will not trigger while offline. You should monitor positions and set exchange-level stop-losses for critical trades.',
      ),
    },
  ];

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.reference', 'Reference')}
        page={t('docs.faq.title', 'FAQ')}
      />

      <DocsSectionHeader id="faq" icon={<HelpCircle className="h-5 w-5" />}>
        {t('docs.faq.title', 'FAQ')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t('docs.faq.intro', 'Frequently asked questions about CryptoTrader.')}
      </p>

      {/* General */}
      <h2 id="general-questions" className="mb-4 text-lg font-semibold">
        {t('docs.faq.generalTitle', 'General')}
      </h2>
      <FaqSection items={generalFaqs} />

      {/* Trading */}
      <h2 id="trading-questions" className="mt-10 mb-4 text-lg font-semibold">
        {t('docs.faq.tradingTitle', 'Trading')}
      </h2>
      <FaqSection items={tradingFaqs} />

      {/* Technical */}
      <h2 id="technical-questions" className="mt-10 mb-4 text-lg font-semibold">
        {t('docs.faq.technicalTitle', 'Technical')}
      </h2>
      <FaqSection items={technicalFaqs} />

      <DocsCallout
        variant="info"
        title={t('docs.faq.moreHelp', 'Need more help?')}
      >
        {t(
          'docs.faq.moreHelpDesc',
          'If your question is not answered here, use the multi-agent chat to ask any question about the platform. The AI agents can provide personalized answers based on your configuration.',
        )}
      </DocsCallout>

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
