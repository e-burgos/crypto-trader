import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Sliders } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';
import {
  StrategyPresets,
  ParameterCards,
  ExplainPanel,
} from '@crypto-trader/ui';

export function DocsAgentConfigPage() {
  const { t: rawT } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('agent-config');

  // Adapter: these UI components expect t(key, opts?) => string
  const t = (key: string, opts?: Record<string, unknown>) =>
    rawT(key, opts as never) as string;

  return (
    <div>
      <DocsBreadcrumb
        group={rawT('docs.group.platform', 'Platform')}
        page={rawT('docs.agentConfig.title', 'Agent Configuration')}
      />

      <DocsSectionHeader
        id="agent-config"
        icon={<Sliders className="h-5 w-5" />}
      >
        {rawT('docs.agentConfig.title', 'Agent Configuration')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {rawT(
          'docs.agentConfig.intro',
          'Configure agent parameters, use presets for quick setup, and understand the key concepts behind each setting.',
        )}
      </p>

      {/* Strategy Presets */}
      <h2 id="strategy-presets" className="mb-3 text-lg font-semibold">
        {rawT('help.agentPresets', 'Strategy Presets')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {rawT(
          'docs.agentConfig.presetsDesc',
          'CryptoTrader offers three built-in presets that configure all agent parameters at once. Choose based on your risk tolerance.',
        )}
      </p>
      <StrategyPresets t={t} />

      {/* Parameters */}
      <h2
        id="configuration-parameters"
        className="mt-10 mb-3 text-lg font-semibold"
      >
        {rawT('docs.agentConfig.paramsTitle', 'Configuration parameters')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {rawT(
          'docs.agentConfig.paramsDesc',
          'Every trading agent has these configurable parameters. Click on each card to learn more.',
        )}
      </p>
      <ParameterCards t={t} />

      {/* Key Concepts */}
      <h2 id="key-concepts" className="mt-10 mb-3 text-lg font-semibold">
        {rawT('docs.agentConfig.conceptsTitle', 'Key concepts explained')}
      </h2>
      <ExplainPanel t={t} />

      <DocsPageFeedback
        question={rawT('docs.feedback.question', 'Was this page helpful?')}
        yesLabel={rawT('docs.feedback.yes', 'Yes')}
        noLabel={rawT('docs.feedback.no', 'No')}
        thanksYes={rawT('docs.feedback.thanksYes', 'Thanks for your feedback!')}
        thanksNo={rawT(
          'docs.feedback.thanksNo',
          "Thanks — we'll work on improving this page.",
        )}
      />

      <DocsPagination
        prev={
          prev
            ? {
                title: rawT(
                  SLUG_TITLE_KEY_MAP[prev.slug] ?? prev.slug,
                  prev.title,
                ),
                href: `/docs/${prev.slug}`,
              }
            : undefined
        }
        next={
          next
            ? {
                title: rawT(
                  SLUG_TITLE_KEY_MAP[next.slug] ?? next.slug,
                  next.title,
                ),
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
