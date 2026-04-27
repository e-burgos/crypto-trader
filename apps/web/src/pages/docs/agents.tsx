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
import { Sparkles } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';
import { AgentsShowcaseSection } from '../dashboard/agents-showcase';

export function DocsAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('agents');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.platform', 'Platform')}
        page={t('docs.agents.title', 'Agents')}
      />

      <DocsSectionHeader id="agents" icon={<Sparkles className="h-5 w-5" />}>
        {t('docs.agents.title', 'Agents')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agents.intro',
          'CryptoTrader uses a multi-agent system where each agent is a specialized AI with a specific role. The agents collaborate through an orchestration layer to produce trading decisions.',
        )}
      </p>

      {/* Architecture */}
      <h2 id="multi-agent-architecture" className="mb-3 text-lg font-semibold">
        {t('docs.agents.architectureTitle', 'Multi-agent architecture')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agents.architectureDesc',
          'The system has three layers: (1) Routing Layer — classifies user intent and routes to the right agent, (2) Specialist Agents — domain experts that analyze specific aspects, (3) Synthesis Layer — combines agent outputs into a final decision.',
        )}
      </p>

      {/* KRYPTO */}
      <h2 id="krypto" className="mt-10 mb-3 text-lg font-semibold">
        KRYPTO —{' '}
        {t('docs.agents.kryptoRole', 'The Orchestrator (2 configurable roles)')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.agents.kryptoDesc',
          'KRYPTO is the backbone of the multi-agent system. It operates in two independently-configurable LLM roles. The orchestration coordination itself is handled internally by the framework.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.agents.role', 'Role'),
          t('docs.agents.function', 'Function'),
          t('docs.agents.modelType', 'Model recommendation'),
        ]}
        rows={[
          [
            'Routing (KRYPTO-R)',
            t(
              'docs.agents.kryptoRouting',
              'Classifies incoming requests, routes to appropriate specialist',
            ),
            t('docs.agents.ultraFast', 'Ultra-fast (Gemma 4, Qwen 3.5)'),
          ],
          [
            'Synthesis (KRYPTO-S)',
            t(
              'docs.agents.kryptoSynth',
              'Combines outputs into final BUY/SELL/HOLD with confidence score',
            ),
            t(
              'docs.agents.highQuality',
              'High quality (DeepSeek V4 Pro, Kimi K2)',
            ),
          ],
        ]}
      />

      {/* Specialists */}
      <h2 id="specialist-agents" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agents.specialistsTitle', 'Specialist Agents')}
      </h2>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.agents.agent', 'Agent'),
          t('docs.agents.codename', 'Codename'),
          t('docs.agents.domain', 'Domain'),
          t('docs.agents.specialty', 'Specialty'),
        ]}
        rows={[
          [
            'Platform Expert',
            'NEXUS',
            t('docs.agents.nexusDomain', 'Platform functionality'),
            t(
              'docs.agents.nexusSpec',
              'Knows the platform inside-out, explains features and settings',
            ),
          ],
          [
            'Operations',
            'FORGE',
            t('docs.agents.forgeDomain', 'Trade execution'),
            t(
              'docs.agents.forgeSpec',
              'Order types, execution timing, operational constraints',
            ),
          ],
          [
            'Market Analyst',
            'SIGMA',
            t('docs.agents.sigmaDomain', 'Market data analysis'),
            t(
              'docs.agents.sigmaSpec',
              'RSI, MACD, Bollinger Bands, volume profiles, support/resistance',
            ),
          ],
          [
            'Blockchain Expert',
            'CIPHER',
            t('docs.agents.cipherDomain', 'Blockchain & on-chain'),
            t(
              'docs.agents.cipherSpec',
              'On-chain metrics, whale movements, DeFi trends',
            ),
          ],
          [
            'Risk Manager',
            'AEGIS',
            t('docs.agents.aegisDomain', 'Risk assessment'),
            t(
              'docs.agents.aegisSpec',
              'Position sizing, exposure limits, drawdown management',
            ),
          ],
        ]}
      />

      {/* Showcase */}
      <h2 id="agents-showcase" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agents.showcaseTitle', 'Agents Showcase')}
      </h2>
      <AgentsShowcaseSection hideChatCta />

      {/* Configuration */}
      <h2 id="agent-configuration" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.agents.configTitle', 'Agent configuration')}
      </h2>
      <DocsCallout
        variant="info"
        title={t('docs.agents.configInfoTitle', 'Per-agent customization')}
      >
        {t(
          'docs.agents.configInfo',
          'Each agent can be individually configured with its own LLM Provider, specific model, and recommended models set by the admin. Go to Settings → Agents to customize.',
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
