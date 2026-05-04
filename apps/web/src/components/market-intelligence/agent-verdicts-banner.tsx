import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  InfoCard,
  Badge,
  AgentVerdictCard,
  formatAgentVerdictSummary,
  shortModelName,
} from '@crypto-trader/ui';
import type { AgentMeta, AgentVerdictData } from '@crypto-trader/ui';
import {
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Newspaper,
  Shield,
  Wrench,
  Cpu,
  Play,
  Loader2,
  Globe,
} from 'lucide-react';
import { useAgentDecisions } from '../../hooks/use-analytics';
import { usePlatformMode } from '../../hooks/use-user';
import { useTradingConfigs, useTriggerAnalysis } from '../../hooks/use-trading';

// ── Agent metadata (icons + colors) ──────────────────────────────────────────

const AGENT_META_MAP: Record<string, AgentMeta & { fullNameKey: string }> = {
  SIGMA: {
    label: 'SIGMA',
    fullNameKey: 'marketIntelligence.verdicts.agents.sigma',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  FORGE: {
    label: 'FORGE',
    fullNameKey: 'marketIntelligence.verdicts.agents.forge',
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  AEGIS: {
    label: 'AEGIS',
    fullNameKey: 'marketIntelligence.verdicts.agents.aegis',
    icon: <Shield className="h-3.5 w-3.5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  CIPHER: {
    label: 'CIPHER',
    fullNameKey: 'marketIntelligence.verdicts.agents.cipher',
    icon: <Globe className="h-3.5 w-3.5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
};

const TASK_ICON: Record<string, React.ReactNode> = {
  technical_signal: <BarChart3 className="h-3 w-3" />,
  news_sentiment: <Newspaper className="h-3 w-3" />,
  sizing_suggestion: <Wrench className="h-3 w-3" />,
  risk_gate: <Shield className="h-3 w-3" />,
  macro_context: <Globe className="h-3 w-3" />,
};

const TASK_LABEL_KEYS: Record<string, string> = {
  technical_signal: 'marketIntelligence.verdicts.tasks.technicalSignal',
  news_sentiment: 'marketIntelligence.verdicts.tasks.newsSentiment',
  sizing_suggestion: 'marketIntelligence.verdicts.tasks.positionSizing',
  risk_gate: 'marketIntelligence.verdicts.tasks.riskGate',
  macro_context: 'marketIntelligence.verdicts.tasks.macroContext',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function decisionBadge(decision: string): 'success' | 'error' | 'neutral' {
  if (decision === 'BUY') return 'success';
  if (decision === 'SELL') return 'error';
  return 'neutral';
}

function decisionIcon(decision: string) {
  if (decision === 'BUY')
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (decision === 'SELL')
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

// ── Verdict card wrapper (adds i18n + ReactMarkdown rendering) ───────────────

function VerdictCardWrapper({ verdict }: { verdict: AgentVerdictData }) {
  const { t } = useTranslation();
  const metaEntry = AGENT_META_MAP[verdict.agentId.toUpperCase()];
  const agentMeta: AgentMeta = metaEntry
    ? {
        ...metaEntry,
        subtitle: t(metaEntry.fullNameKey),
      }
    : {
        label: verdict.agentId,
        subtitle: verdict.agentId,
        icon: <Bot className="h-3.5 w-3.5" />,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };

  const taskLabel = TASK_LABEL_KEYS[verdict.task]
    ? t(TASK_LABEL_KEYS[verdict.task])
    : verdict.task;

  // Format summary and wrap with ReactMarkdown
  const formatted =
    formatAgentVerdictSummary(verdict.summary, verdict.task) || verdict.summary;

  return (
    <AgentVerdictCard
      verdict={verdict}
      agentMeta={agentMeta}
      taskLabel={taskLabel}
      taskIcon={TASK_ICON[verdict.task]}
      cachedLabel={t('marketIntelligence.verdicts.cached')}
      showMoreLabel={t('marketIntelligence.verdicts.showMore')}
      showLessLabel={t('marketIntelligence.verdicts.showLess')}
      modelIcon={<Cpu className="h-2.5 w-2.5" />}
      formattedSummary={formatted}
      renderContent={(content) => (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      )}
    />
  );
}

export function AgentVerdictsBanner() {
  const { t } = useTranslation();
  const { mode } = usePlatformMode();
  const { data: decisions = [], isLoading } = useAgentDecisions(5, mode);
  const { data: configs = [] } = useTradingConfigs();
  const triggerAnalysis = useTriggerAnalysis();

  // Use the most recent orchestrated decision
  const latest = decisions[0];
  const verdicts: AgentVerdictData[] = latest?.subAgentVerdicts ?? [];
  const hasData = verdicts.length > 0;

  // Pick first config matching the current mode for trigger
  const activeConfig =
    configs.find((c) => c.mode === mode?.toUpperCase()) ?? configs[0];

  const handleTrigger = () => {
    if (activeConfig?.id) {
      triggerAnalysis.mutate(activeConfig.id);
    }
  };

  return (
    <InfoCard
      icon={<Bot className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.verdicts.title')}
      subtitle={t(
        'marketIntelligence.verdicts.subtitle',
        'Multi-agent orchestrated consensus',
      )}
      headerRight={
        <div className="flex items-center gap-2">
          {activeConfig && (
            <button
              onClick={handleTrigger}
              disabled={triggerAnalysis.isPending}
              className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('marketIntelligence.verdicts.triggerAnalysis')}
            >
              {triggerAnalysis.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {t('marketIntelligence.verdicts.triggerAnalysis')}
            </button>
          )}
          {latest && (
            <>
              {decisionIcon(latest.decision)}
              <Badge
                variant={decisionBadge(latest.decision)}
                label={`${latest.decision} · ${latest.confidence}%`}
              />
            </>
          )}
        </div>
      }
    >
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <span className="text-sm text-muted-foreground">
            {t(
              'marketIntelligence.verdicts.noDecisions',
              'No agent decisions yet for this cycle',
            )}
          </span>
          <span className="text-xs text-muted-foreground/70 mt-1">
            {t(
              'marketIntelligence.verdicts.waitingHint',
              'Agents analyze market data periodically and publish verdicts here',
            )}
          </span>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {verdicts.map((v, i) => (
              <VerdictCardWrapper key={i} verdict={v} />
            ))}
          </div>

          {/* KRYPTO synthesis section */}
          {latest && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">
                    KRYPTO
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {t('marketIntelligence.verdicts.orchestratorRole')}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {latest.llmModel && (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Cpu className="h-2.5 w-2.5" />
                      {shortModelName(latest.llmModel)}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {latest.reasoning}
              </p>
              <div className="text-[11px] text-muted-foreground/60">
                {t('marketIntelligence.verdicts.lastCycle')}:{' '}
                {new Date(latest.createdAt).toLocaleTimeString()}
              </div>
            </div>
          )}
        </>
      )}
    </InfoCard>
  );
}
