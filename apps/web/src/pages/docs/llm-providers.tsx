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

export function DocsLlmProvidersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('llm-providers');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.integration', 'Integration')}
        page={t('docs.llmProviders.title', 'LLM Providers')}
      />

      <DocsSectionHeader
        id="llm-providers"
        icon={<Brain className="h-5 w-5" />}
      >
        {t('docs.llmProviders.title', 'LLM Providers')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.llmProviders.intro',
          'CryptoTrader supports 7 LLM providers. Each agent can use a different provider and model.',
        )}
      </p>

      {/* Provider list */}
      <h2 id="supported-providers" className="mb-3 text-lg font-semibold">
        {t('docs.llmProviders.supportedTitle', 'Supported providers')}
      </h2>
      <DocsTable
        headers={[
          t('docs.llmProviders.provider', 'Provider'),
          t('docs.llmProviders.models', 'Notable models'),
          t('docs.llmProviders.cost', 'Cost'),
          t('docs.llmProviders.notes', 'Notes'),
        ]}
        rows={[
          [
            'OpenRouter',
            'DeepSeek V4, Kimi K2, Gemma 4, Qwen 3.5',
            t('docs.llmProviders.varies', 'Varies (free options)'),
            t('docs.llmProviders.openrouterNote', '300+ models, one API key'),
          ],
          [
            'OpenAI',
            'gpt-4o, gpt-4o-mini',
            t('docs.llmProviders.paid', 'Paid'),
            t('docs.llmProviders.openaiNote', 'Highest quality, higher cost'),
          ],
          [
            'Anthropic (Claude)',
            'claude-sonnet-4, claude-opus-4-5',
            t('docs.llmProviders.paid', 'Paid'),
            t('docs.llmProviders.claudeNote', 'Excellent reasoning'),
          ],
          [
            'Google (Gemini)',
            'gemini-2.5-flash, gemini-2.5-pro',
            t('docs.llmProviders.freeTier', 'Free tier'),
            t('docs.llmProviders.geminiNote', 'Good free option'),
          ],
          [
            'Groq',
            'llama-3.3-70b-versatile, llama-3.1-8b-instant',
            t('docs.llmProviders.freeTier', 'Free tier'),
            t('docs.llmProviders.groqNote', 'Ultra-fast inference'),
          ],
          [
            'Mistral',
            'mistral-large-latest, mistral-small-latest',
            t('docs.llmProviders.freeTier', 'Free tier'),
            t('docs.llmProviders.mistralNote', 'European provider'),
          ],
          [
            'Together AI',
            'Llama 4 Maverick, Llama 4 Scout',
            t('docs.llmProviders.paid', 'Paid'),
            t('docs.llmProviders.togetherNote', 'Open-source models'),
          ],
        ]}
      />

      {/* OpenRouter */}
      <h2
        id="openrouter-recommended"
        className="mt-10 mb-3 text-lg font-semibold"
      >
        <DocsBadge variant="success">Recommended</DocsBadge> OpenRouter
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.llmProviders.openrouterDesc',
          'OpenRouter acts as a unified gateway to 300+ models from multiple providers. One API key gives you access to free models (DeepSeek, Gemma, Qwen) and premium models (GPT-4o, Claude).',
        )}
      </p>
      <DocsCallout
        variant="tip"
        title={t('docs.llmProviders.openrouterBenefit', 'Why OpenRouter?')}
      >
        {t(
          'docs.llmProviders.openrouterBenefitDesc',
          'Single API key, model presets (Free/Balanced/Optimized), per-agent model assignment, and automatic fallback if a model is down.',
        )}
      </DocsCallout>

      {/* Presets */}
      <h2 id="model-presets" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.llmProviders.presetsTitle', 'Model presets')}
      </h2>
      <DocsTable
        headers={[
          t('docs.llmProviders.preset', 'Preset'),
          t('docs.llmProviders.cost', 'Cost'),
          t('docs.llmProviders.quality', 'Quality'),
          t('docs.llmProviders.bestFor', 'Best for'),
        ]}
        rows={[
          [
            'Free ($0)',
            '$0/month',
            t('docs.llmProviders.good', 'Good'),
            t('docs.llmProviders.freeFor', 'Testing, learning, low-volume'),
          ],
          [
            'Balanced',
            '$1-5/month',
            t('docs.llmProviders.veryGood', 'Very good'),
            t(
              'docs.llmProviders.balancedFor',
              'Regular trading, cost-effective',
            ),
          ],
          [
            'Optimized',
            '$10-20/month',
            t('docs.llmProviders.best', 'Best'),
            t(
              'docs.llmProviders.optimizedFor',
              'Serious trading, maximum accuracy',
            ),
          ],
        ]}
      />

      {/* Agent-to-model */}
      <h2 id="agent-model-mapping" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.llmProviders.agentModelTitle', 'Agent-to-model mapping')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.llmProviders.agentModelDesc',
          'Not all agents need the same model quality. KRYPTO Routing processes simple classifications — a fast, free model works well. KRYPTO Synthesis makes the final decision — it benefits from a higher-quality model.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.llmProviders.agent', 'Agent'),
          'Free ($0)',
          'Balanced',
          'Optimized',
        ]}
        rows={[
          [
            'KRYPTO Routing',
            'google/gemma-4-26b:free',
            'qwen/qwen3.5-9b',
            'deepseek/deepseek-v4-flash',
          ],
          [
            'KRYPTO Synthesis',
            'nvidia/nemotron-super-120b:free',
            'deepseek/deepseek-v4-pro',
            'moonshotai/kimi-k2.6',
          ],
          [
            'NEXUS Platform',
            'google/gemma-4-31b:free',
            'qwen/qwen3.5-35b',
            'deepseek/deepseek-v4-flash',
          ],
          [
            'FORGE Operations',
            'qwen/qwen3-80b:free',
            'deepseek/deepseek-v4-flash',
            'qwen/qwen3.6-plus',
          ],
          [
            'SIGMA Market',
            'nvidia/nemotron-super-120b:free',
            'deepseek/deepseek-v4-flash',
            'deepseek/deepseek-v4-pro',
          ],
          [
            'CIPHER Blockchain',
            'minimax/minimax-m2.5:free',
            'minimax/minimax-m2.7',
            'qwen/qwen3.6-plus',
          ],
          [
            'AEGIS Risk',
            'nvidia/nemotron-super-120b:free',
            'deepseek/deepseek-v4-pro',
            'moonshotai/kimi-k2.6',
          ],
        ]}
      />
      <DocsCallout
        variant="info"
        title={t('docs.llmProviders.validationTitle', 'Live model validation')}
      >
        {t(
          'docs.llmProviders.validationDesc',
          'In Settings → Agents, each recommended model shows a validation badge (✓ Available / ⚠ Deprecated) checked against the live OpenRouter catalog. Click any model name to apply it instantly.',
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
