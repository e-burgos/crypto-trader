import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DocsSectionHeader,
  DocsSteps,
  DocsCallout,
  DocsBadge,
  DocsPageFeedback,
  DocsPagination,
  DocsBreadcrumb,
} from '@crypto-trader/ui';
import { Zap } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsQuickstartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('quickstart');

  return (
    <div>
      <DocsBreadcrumb
        group={t('help.gettingStarted', 'Getting Started')}
        page="Quickstart"
      />

      <DocsSectionHeader id="quickstart" icon={<Zap className="h-5 w-5" />}>
        Quickstart
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.quickstart.intro',
          'Get up and running with CryptoTrader in minutes. This guide walks you through account creation, configuring your AI provider, and launching your first trading agent.',
        )}
      </p>

      {/* What is CryptoTrader */}
      <h2 id="what-is-cryptotrader" className="mb-3 text-lg font-semibold">
        {t('docs.quickstart.whatIsTitle', 'What is CryptoTrader?')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.quickstart.whatIsDesc',
          'CryptoTrader is an AI-powered cryptocurrency trading platform that uses a multi-agent system to analyze markets, manage risk, and execute trades on Binance. The platform supports three operation modes (Sandbox, Testnet, Live) and integrates with 7 LLM providers to power its 8 specialized AI agents.',
        )}
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        <DocsBadge variant="info">8 AI Agents</DocsBadge>
        <DocsBadge variant="info">7 LLM Providers</DocsBadge>
        <DocsBadge variant="info">BTC & ETH</DocsBadge>
        <DocsBadge variant="info">3 Operation Modes</DocsBadge>
        <DocsBadge variant="success">Sandbox — Risk Free</DocsBadge>
      </div>

      {/* Create your account */}
      <h2 id="create-account" className="mb-3 text-lg font-semibold">
        {t('docs.quickstart.createAccountTitle', 'Create your account')}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.quickstart.step1',
              'Navigate to the registration page',
            ),
            description: t(
              'docs.quickstart.step1Desc',
              'Go to /register and create your account with email and password.',
            ),
          },
          {
            title: t('docs.quickstart.step2', 'Complete the onboarding wizard'),
            description: t(
              'docs.quickstart.step2Desc',
              'Choose your operation mode (Sandbox recommended), set up exchange keys, configure your LLM provider, and create your first agent.',
            ),
          },
        ]}
      />

      {/* Configure LLM */}
      <h2 id="configure-llm" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.quickstart.configureLlmTitle', 'Configure your LLM provider')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.quickstart.configureLlmDesc',
          'The AI agents need an LLM provider to function. OpenRouter is recommended — one API key gives access to 300+ models, including free ones.',
        )}
      </p>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.quickstart.llmStep1',
              'Go to Settings → LLM Providers',
            ),
          },
          {
            title: t(
              'docs.quickstart.llmStep2',
              'Enter your OpenRouter API key',
            ),
            description: t(
              'docs.quickstart.llmStep2Desc',
              'Get one at openrouter.ai/keys — starts with sk-or-',
            ),
          },
          {
            title: t(
              'docs.quickstart.llmStep3',
              'Use a Preset to auto-assign models',
            ),
            description: t(
              'docs.quickstart.llmStep3Desc',
              'Free ($0 cost), Balanced (good ratio), or Optimized (best quality).',
            ),
          },
        ]}
      />

      {/* Create first agent */}
      <h2 id="first-agent" className="mt-10 mb-3 text-lg font-semibold">
        {t(
          'docs.quickstart.firstAgentTitle',
          'Create your first trading agent',
        )}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.quickstart.agentStep1',
              'Go to Agent Config in the dashboard',
            ),
          },
          {
            title: t(
              'docs.quickstart.agentStep2',
              'Click "New Agent" to open the creation wizard',
            ),
          },
          {
            title: t(
              'docs.quickstart.agentStep3',
              'Choose a name, trading pair (e.g. BTCUSDT), and mode',
            ),
          },
          {
            title: t(
              'docs.quickstart.agentStep4',
              'Configure parameters or use defaults',
            ),
            description: t(
              'docs.quickstart.agentStep4Desc',
              'Buy/Sell Threshold: 70%, Stop Loss: 3%, Take Profit: 5%, Max Trade: 5% of capital.',
            ),
          },
          {
            title: t(
              'docs.quickstart.agentStep5',
              'Click Create — the agent is ready',
            ),
          },
        ]}
      />

      {/* Start the agent */}
      <h2 id="start-agent" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.quickstart.startAgentTitle', 'Start the agent')}
      </h2>
      <DocsSteps
        steps={[
          {
            title: t(
              'docs.quickstart.startStep1',
              'Find your agent card on the Agent Config page',
            ),
          },
          {
            title: t(
              'docs.quickstart.startStep2',
              'Click the Play button to start',
            ),
          },
          {
            title: t(
              'docs.quickstart.startStep3',
              'Monitor activity in Agent Log and Positions',
            ),
            description: t(
              'docs.quickstart.startStep3Desc',
              'The agent will fetch market data, consult the AI multi-agent system, and execute trades automatically based on your thresholds.',
            ),
          },
        ]}
      />

      <DocsCallout variant="tip" title={t('docs.quickstart.tipTitle', 'Tip')}>
        {t(
          'docs.quickstart.tipContent',
          'Start with Sandbox mode and the Free preset to learn the platform without any cost. You can switch to Live trading once you are comfortable with the system.',
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
