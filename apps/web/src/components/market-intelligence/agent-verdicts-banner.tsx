import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InfoCard, Badge } from '@crypto-trader/ui';
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
  ChevronDown,
  Play,
  Loader2,
} from 'lucide-react';
import { useAgentDecisions } from '../../hooks/use-analytics';
import { usePlatformMode } from '../../hooks/use-user';
import { useTradingConfigs, useTriggerAnalysis } from '../../hooks/use-trading';

interface VerdictCard {
  agentId: string;
  task: string;
  summary: string;
  cached?: boolean;
  model?: string;
  provider?: string;
}

const AGENT_META: Record<
  string,
  {
    label: string;
    fullNameKey: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
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
};

const TASK_ICON: Record<string, React.ReactNode> = {
  technical_signal: <BarChart3 className="h-3 w-3" />,
  news_sentiment: <Newspaper className="h-3 w-3" />,
  sizing_suggestion: <Wrench className="h-3 w-3" />,
  risk_gate: <Shield className="h-3 w-3" />,
};

const TASK_LABEL_KEYS: Record<string, string> = {
  technical_signal: 'marketIntelligence.verdicts.tasks.technicalSignal',
  news_sentiment: 'marketIntelligence.verdicts.tasks.newsSentiment',
  sizing_suggestion: 'marketIntelligence.verdicts.tasks.positionSizing',
  risk_gate: 'marketIntelligence.verdicts.tasks.riskGate',
};

/** Shorten model name for display (e.g. "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet") */
function shortModel(model?: string): string {
  if (!model) return '';
  const parts = model.split('/');
  return parts[parts.length - 1];
}

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

/** Individual collapsible verdict card */
function VerdictCardComponent({ verdict: v }: { verdict: VerdictCard }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const meta = AGENT_META[v.agentId.toUpperCase()] ?? {
    label: v.agentId,
    fullNameKey: '',
    icon: <Bot className="h-3.5 w-3.5" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  };
  const modelShort = shortModel(v.model);
  const fullName = meta.fullNameKey ? t(meta.fullNameKey) : v.agentId;
  const taskLabel = TASK_LABEL_KEYS[v.task]
    ? t(TASK_LABEL_KEYS[v.task])
    : v.task;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      {/* Header: Agent name + task */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.bgColor} ${meta.color}`}
          >
            {meta.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {fullName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {v.cached && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
              {t('marketIntelligence.verdicts.cached')}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
            {TASK_ICON[v.task]}
            {taskLabel}
          </span>
        </div>
      </div>

      {/* Summary with collapse */}
      <div className="relative">
        <div
          className={`text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none overflow-hidden transition-[max-height] duration-300 ease-in-out [&_p]:my-0.5 [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_pre]:my-1 [&_pre]:text-[11px] [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:text-[11px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_strong]:text-foreground [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground ${expanded ? 'max-h-[2000px]' : 'max-h-[5lh]'}`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{v.summary}</ReactMarkdown>
        </div>
        {!expanded && v.summary.length > 150 && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/collapse toggle + model */}
      <div className="flex items-center justify-between">
        {v.summary.length > 150 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded
              ? t('marketIntelligence.verdicts.showLess')
              : t('marketIntelligence.verdicts.showMore')}
          </button>
        ) : (
          <span />
        )}
        {modelShort && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <Cpu className="h-2.5 w-2.5" />
            <span className="truncate max-w-[180px]">{modelShort}</span>
          </div>
        )}
      </div>
    </div>
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
  const verdicts: VerdictCard[] = latest?.subAgentVerdicts ?? [];
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
              <VerdictCardComponent key={i} verdict={v} />
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
                      {shortModel(latest.llmModel)}
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
