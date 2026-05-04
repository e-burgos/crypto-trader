import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  InfoCard,
  Badge,
  Tabs,
  AgentVerdictCard,
  formatAgentVerdictSummary,
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
  KRYPTO: {
    label: 'KRYPTO',
    fullNameKey: 'marketIntelligence.verdicts.orchestratorRole',
    icon: <Bot className="h-3.5 w-3.5" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
};

const TASK_ICON: Record<string, React.ReactNode> = {
  technical_signal: <BarChart3 className="h-3 w-3" />,
  news_sentiment: <Newspaper className="h-3 w-3" />,
  sizing_suggestion: <Wrench className="h-3 w-3" />,
  risk_gate: <Shield className="h-3 w-3" />,
  macro_context: <Globe className="h-3 w-3" />,
  decision_synthesis: <Bot className="h-3 w-3" />,
};

const TASK_LABEL_KEYS: Record<string, string> = {
  technical_signal: 'marketIntelligence.verdicts.tasks.technicalSignal',
  news_sentiment: 'marketIntelligence.verdicts.tasks.newsSentiment',
  sizing_suggestion: 'marketIntelligence.verdicts.tasks.positionSizing',
  risk_gate: 'marketIntelligence.verdicts.tasks.riskGate',
  macro_context: 'marketIntelligence.verdicts.tasks.macroContext',
  decision_synthesis: 'marketIntelligence.verdicts.tasks.synthesis',
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

function VerdictCardWrapper({
  verdict,
  className,
}: {
  verdict: AgentVerdictData;
  className?: string;
}) {
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
      className={className}
      renderContent={(content) => (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      )}
    />
  );
}

export function AgentVerdictsBanner() {
  const { t } = useTranslation();
  const { mode } = usePlatformMode();
  // Fetch enough decisions to cover all bots (5 per bot × N bots)
  const { data: decisions = [], isLoading } = useAgentDecisions(20, mode);
  const { data: configs = [] } = useTradingConfigs();
  const triggerAnalysis = useTriggerAnalysis();

  // Only show running configs for current mode
  const activeConfigs = configs.filter(
    (c) => c.isRunning && c.mode === mode?.toUpperCase(),
  );

  // Config selector state — default to first active config
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const effectiveConfigId = selectedConfigId || activeConfigs[0]?.id || '';

  // Filter decisions for the selected config
  const configDecisions = decisions.filter(
    (d) => d.configId === effectiveConfigId,
  );
  const latest = configDecisions[0];

  // Merge verdicts from this config's decisions only
  const EMPTY_VERDICTS = new Set([
    '{}',
    '[]',
    '',
    'Sin datos de sizing disponibles',
    'Decisión orquestada por KRYPTO',
  ]);

  const verdicts: AgentVerdictData[] = (() => {
    const seen = new Map<string, AgentVerdictData>();
    for (const decision of configDecisions) {
      // Include sub-agent verdicts
      for (const v of decision.subAgentVerdicts ?? []) {
        const key = `${v.agentId}:${v.task}`;
        const existing = seen.get(key);
        const isEmpty = EMPTY_VERDICTS.has(v.summary?.trim());
        if (!existing) {
          seen.set(key, v as AgentVerdictData);
        } else if (EMPTY_VERDICTS.has(existing.summary?.trim()) && !isEmpty) {
          seen.set(key, v as AgentVerdictData);
        }
      }
      // Include KRYPTO synthesis from the decision reasoning
      if (decision.reasoning) {
        const key = 'KRYPTO:decision_synthesis';
        const kryptoVerdict: AgentVerdictData = {
          agentId: 'KRYPTO',
          task: 'decision_synthesis',
          summary: decision.reasoning,
          model: decision.llmModel ?? undefined,
          executedAt: decision.createdAt,
        };
        const existing = seen.get(key);
        const isEmpty = EMPTY_VERDICTS.has(decision.reasoning.trim());
        if (!existing) {
          seen.set(key, kryptoVerdict);
        } else if (EMPTY_VERDICTS.has(existing.summary?.trim()) && !isEmpty) {
          seen.set(key, kryptoVerdict);
        }
      }
    }
    return Array.from(seen.values());
  })();
  const hasData = verdicts.length > 0;

  const handleTrigger = () => {
    if (effectiveConfigId) {
      triggerAnalysis.mutate(effectiveConfigId);
    }
  };

  // Build tabs from active configs
  const configTabs = activeConfigs.map((c) => ({
    value: c.id,
    label: `${c.name}`,
    icon: undefined,
  }));

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
          {effectiveConfigId && (
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
        </div>
      }
    >
      {/* Config selector tabs + decision badge */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {configTabs.length > 1 ? (
          <Tabs
            tabs={configTabs}
            value={effectiveConfigId}
            onChange={setSelectedConfigId}
            size="sm"
          />
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {activeConfigs[0]?.name}
          </span>
        )}
        <div className="flex items-center gap-2">
          {latest && (
            <span className="text-[10px] text-muted-foreground/60">
              {t('marketIntelligence.lastCycle', 'Last cycle')}:{' '}
              {new Date(latest.createdAt).toLocaleTimeString()}
            </span>
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
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {verdicts.map((v, i) => (
            <VerdictCardWrapper
              key={i}
              verdict={v}
              className={
                v.agentId === 'KRYPTO'
                  ? 'border-primary/20 bg-primary/5'
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </InfoCard>
  );
}
