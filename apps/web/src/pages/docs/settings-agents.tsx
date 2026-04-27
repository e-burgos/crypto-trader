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
import { Settings } from 'lucide-react';
import { getPageNavigation, SLUG_TITLE_KEY_MAP } from './index';

export function DocsSettingsAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { prev, next } = getPageNavigation('settings-agents');

  return (
    <div>
      <DocsBreadcrumb
        group={t('docs.group.configuration', 'Configuration')}
        page={t('docs.settingsAgents.title', 'Agent Model Settings')}
      />

      <DocsSectionHeader
        id="settings-agents"
        icon={<Settings className="h-5 w-5" />}
      >
        {t('docs.settingsAgents.title', 'Agent Model Settings')}
      </DocsSectionHeader>
      <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.settingsAgents.intro',
          'The Settings → Agents page lets you configure which LLM model each agent uses, apply smart presets, and see real-time model validation against the OpenRouter catalog.',
        )}
      </p>
      <DocsCallout
        variant="tip"
        title={t('docs.settingsAgents.pathNote', 'Where to find it')}
      >
        {t(
          'docs.settingsAgents.pathNoteDesc',
          'Navigate to: Dashboard → Settings → Agents (sidebar) or go directly to /dashboard/settings/agents',
        )}
      </DocsCallout>

      {/* Agent list */}
      <h2 id="agent-list" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.settingsAgents.agentListTitle', 'Configurable agents')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.settingsAgents.agentListDesc',
          'There are 7 agent roles. Each can be assigned an independent LLM provider and model. AEGIS (risk) is locked — it always uses the same model as KRYPTO Synthesis to ensure consistent risk evaluation.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.settingsAgents.role', 'Role'),
          t('docs.settingsAgents.codename', 'Codename'),
          t('docs.settingsAgents.specialty', 'Specialty'),
          t('docs.settingsAgents.locked', 'Locked?'),
        ]}
        rows={[
          [
            'routing',
            'KRYPTO',
            t('docs.settingsAgents.routingSpec', 'Request routing'),
            '–',
          ],
          [
            'synthesis',
            'KRYPTO',
            t('docs.settingsAgents.synthesisSpec', 'Final decision synthesis'),
            '–',
          ],
          [
            'platform',
            'NEXUS',
            t('docs.settingsAgents.platformSpec', 'Platform knowledge'),
            '–',
          ],
          [
            'operations',
            'FORGE',
            t('docs.settingsAgents.operationsSpec', 'Trade execution'),
            '–',
          ],
          [
            'market',
            'SIGMA',
            t('docs.settingsAgents.marketSpec', 'Market & indicators'),
            '–',
          ],
          [
            'blockchain',
            'CIPHER',
            t('docs.settingsAgents.blockchainSpec', 'On-chain data'),
            '–',
          ],
          [
            'risk',
            'AEGIS',
            t('docs.settingsAgents.riskSpec', 'Risk assessment'),
            t('docs.settingsAgents.yes', '🔒 Yes'),
          ],
        ]}
      />

      {/* Preset system */}
      <h2 id="preset-system" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.settingsAgents.presetsTitle', 'Smart preset system')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.settingsAgents.presetsDesc',
          'Instead of configuring each agent individually, use a preset to assign optimal models to all agents at once. The preset auto-selects models based on their role requirements.',
        )}
      </p>
      <DocsTable
        headers={[
          t('docs.settingsAgents.preset', 'Preset'),
          t('docs.settingsAgents.strategy', 'Strategy'),
          t('docs.settingsAgents.cost', 'Est. cost'),
        ]}
        rows={[
          [
            'Free',
            t(
              'docs.settingsAgents.freeStrategy',
              'Assigns only $0 models from OpenRouter',
            ),
            '$0 / month',
          ],
          [
            'Balanced',
            t(
              'docs.settingsAgents.balancedStrategy',
              'Assigns cost-effective models with good quality',
            ),
            '$1–5 / month',
          ],
          [
            'Optimized',
            t(
              'docs.settingsAgents.optimizedStrategy',
              'Assigns best-performing models for each role',
            ),
            '$10–20 / month',
          ],
        ]}
      />
      <DocsCallout
        variant="info"
        title={t('docs.settingsAgents.presetRequires', 'Requires OpenRouter')}
      >
        {t(
          'docs.settingsAgents.presetRequiresDesc',
          'Presets are designed for OpenRouter. They assign specific OpenRouter model IDs per agent role. You can still use direct providers (Claude, OpenAI, etc.) but presets will not apply.',
        )}
      </DocsCallout>

      {/* Recommended models */}
      <h2 id="recommended-models" className="mt-10 mb-3 text-lg font-semibold">
        {t(
          'docs.settingsAgents.recommendedTitle',
          'Recommended models (click-to-apply)',
        )}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.settingsAgents.recommendedDesc',
          'Each agent card shows three recommended models (Free, Balanced, Optimized). Each has a live validation badge checked against the OpenRouter catalog. Click any model name to instantly apply it — no need to type.',
        )}
      </p>
      <DocsTable
        variant="overview"
        headers={[
          t('docs.settingsAgents.badge', 'Badge'),
          t('docs.settingsAgents.meaning', 'Meaning'),
        ]}
        rows={[
          [
            '✓ ' + t('docs.settingsAgents.available', 'Available'),
            t(
              'docs.settingsAgents.availableDesc',
              'Model exists in the OpenRouter catalog — safe to use',
            ),
          ],
          [
            '⚠ ' + t('docs.settingsAgents.deprecated', 'Deprecated'),
            t(
              'docs.settingsAgents.deprecatedDesc',
              'Model not found in catalog — may have been removed. Click a different model.',
            ),
          ],
        ]}
      />
      <DocsCallout
        variant="warning"
        title={t(
          'docs.settingsAgents.deprecatedWarning',
          'If a model shows Deprecated',
        )}
      >
        {t(
          'docs.settingsAgents.deprecatedWarningDesc',
          'OpenRouter occasionally retires models. If your assigned model is deprecated, the agent will still work but may fail. Click one of the other recommended models (Balanced or Optimized) to switch to a current one.',
        )}
      </DocsCallout>

      {/* Per-agent config */}
      <h2 id="per-agent-config" className="mt-10 mb-3 text-lg font-semibold">
        {t('docs.settingsAgents.perAgentTitle', 'Per-agent model override')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {t(
          'docs.settingsAgents.perAgentDesc',
          'Each agent card has a model selector. For OpenRouter agents, it shows a searchable dropdown of all 300+ available models. For direct providers (Claude, OpenAI, etc.), it shows a fixed list of supported models.',
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
