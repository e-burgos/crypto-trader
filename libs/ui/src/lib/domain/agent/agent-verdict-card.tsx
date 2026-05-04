import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentVerdictTask =
  | 'technical_signal'
  | 'news_sentiment'
  | 'sizing_suggestion'
  | 'risk_gate'
  | 'macro_context'
  | 'decision_synthesis'
  | (string & {});

export interface AgentVerdictData {
  agentId: string;
  task: AgentVerdictTask;
  summary: string;
  cached?: boolean;
  model?: string;
  provider?: string;
}

export interface AgentMeta {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export interface AgentVerdictCardProps {
  verdict: AgentVerdictData;
  /** Agent display metadata. If not provided, uses a generic fallback. */
  agentMeta?: AgentMeta;
  /** Task display label. Falls back to task id. */
  taskLabel?: string;
  /** Task icon. */
  taskIcon?: React.ReactNode;
  /** Whether to show the "cached" badge. */
  showCachedBadge?: boolean;
  /** Text for "cached" badge. Default: "cached" */
  cachedLabel?: string;
  /** Text for expand button. Default: "More" */
  showMoreLabel?: string;
  /** Text for collapse button. Default: "Less" */
  showLessLabel?: string;
  /** Model icon element. */
  modelIcon?: React.ReactNode;
  /** Override formatted summary. If not provided, auto-formats from raw summary. */
  formattedSummary?: string;
  /** Custom render function for the summary content (e.g., ReactMarkdown wrapper). */
  renderContent?: (content: string) => React.ReactNode;
  /** Additional className for the outer container. */
  className?: string;
  /** Max collapsed height in CSS. Default: 'max-h-[5lh]' */
  collapsedMaxHeight?: string;
  /** Summary length threshold to show expand toggle. Default: 150 */
  expandThreshold?: number;
}

// ── Format utility ───────────────────────────────────────────────────────────

/**
 * Formats raw agent summary into human-readable markdown.
 * Handles: raw JSON, <think> tags from reasoning models, empty objects,
 * and plain text passthrough.
 */
export function formatAgentVerdictSummary(
  raw: string,
  task: AgentVerdictTask,
): string {
  if (!raw || raw === '{}' || raw === '[]') return '';

  // Strip <think>...</think> blocks from reasoning models (Qwen3, DeepSeek-R1)
  let text = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
  if (!text) {
    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
    text = thinkMatch?.[1]?.trim() ?? raw;
  }

  // Try to detect and format JSON responses
  const jsonMatch = text.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Object.keys(parsed).length === 0) return '';

      switch (task) {
        case 'technical_signal': {
          const signal = parsed.signal ?? parsed.direction ?? '';
          const conf = parsed.confidence
            ? `${Math.round(parsed.confidence * 100)}%`
            : '';
          const reasoning = parsed.reasoning ?? '';
          return reasoning
            ? `**${signal}** (${conf} confidence) — ${reasoning}`
            : `${signal} ${conf}`.trim();
        }
        case 'news_sentiment': {
          const sentiment = parsed.sentiment ?? parsed.impact ?? '';
          const score = parsed.score != null ? ` (score: ${parsed.score})` : '';
          const reasoning =
            parsed.reasoning ?? parsed.explanation ?? parsed.summary ?? '';
          return reasoning
            ? `**${sentiment}**${score} — ${reasoning}`
            : `${sentiment}${score}`;
        }
        case 'sizing_suggestion': {
          const rec = parsed.recommendation ?? parsed.action ?? '';
          const size = parsed.maxTradeSize
            ? `max trade: ${Math.round(parsed.maxTradeSize * 100)}%`
            : parsed.positionSizeMultiplier
              ? `multiplier: ${parsed.positionSizeMultiplier}`
              : '';
          const reasoning =
            parsed.reasoning ?? parsed.reason ?? parsed.suggestion ?? '';
          if (rec || size || reasoning) {
            const header = rec ? `**${rec.toUpperCase()}**` : '';
            return [header, size, reasoning].filter(Boolean).join(' — ');
          }
          return Object.entries(parsed)
            .map(
              ([k, v]) =>
                `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`,
            )
            .join(', ');
        }
        case 'risk_gate': {
          const verdict = parsed.verdict ?? parsed.action ?? '';
          const riskScore = parsed.riskScore
            ? ` (riskScore ${parsed.riskScore})`
            : '';
          const reason =
            parsed.reason ?? parsed.reasoning ?? parsed.explanation ?? '';
          return reason
            ? `**${verdict}**${riskScore}: ${reason}`
            : `${verdict}${riskScore}`;
        }
        case 'macro_context': {
          const regime = parsed.regime ?? '';
          const bias = parsed.bias ?? '';
          const conf = parsed.confidence
            ? `${Math.round(parsed.confidence * 100)}%`
            : '';
          const reasoning = parsed.reasoning ?? '';
          const header = regime
            ? `**${regime}** ${bias ? `(${bias})` : ''} ${conf ? `— ${conf} conf.` : ''}`
            : '';
          return [header, reasoning].filter(Boolean).join('\n\n');
        }
        default: {
          return Object.entries(parsed)
            .map(
              ([k, v]) =>
                `**${k}**: ${typeof v === 'object' ? JSON.stringify(v) : v}`,
            )
            .join('\n');
        }
      }
    } catch {
      // Not valid JSON — use text as-is
    }
  }

  return text;
}

// ── Utility ──────────────────────────────────────────────────────────────────

/** Shorten model name for display (e.g. "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet") */
export function shortModelName(model?: string): string {
  if (!model) return '';
  const parts = model.split('/');
  return parts[parts.length - 1];
}

// ── Component ────────────────────────────────────────────────────────────────

const DEFAULT_META: AgentMeta = {
  label: 'Agent',
  icon: null,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
};

export function AgentVerdictCard({
  verdict,
  agentMeta,
  taskLabel,
  taskIcon,
  showCachedBadge = true,
  cachedLabel = 'cached',
  showMoreLabel = 'More',
  showLessLabel = 'Less',
  modelIcon,
  formattedSummary,
  renderContent,
  className,
  collapsedMaxHeight = 'max-h-[5lh]',
  expandThreshold = 150,
}: AgentVerdictCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = agentMeta ?? DEFAULT_META;
  const modelShort = shortModelName(verdict.model);

  const displaySummary =
    formattedSummary ??
    (formatAgentVerdictSummary(verdict.summary, verdict.task) ||
      verdict.summary);

  const shouldShowToggle = verdict.summary.length > expandThreshold;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border p-3',
        className,
      )}
    >
      {/* Header: Agent name + task */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              meta.bgColor,
              meta.color,
            )}
          >
            {meta.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">
              {meta.label}
            </span>
            {meta.subtitle && (
              <span className="text-[10px] text-muted-foreground leading-tight">
                {meta.subtitle}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {showCachedBadge && verdict.cached && (
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
              {cachedLabel}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
            {taskIcon}
            {taskLabel ?? verdict.task}
          </span>
        </div>
      </div>

      {/* Summary with collapse */}
      <div className="relative">
        <div
          className={cn(
            'text-xs text-muted-foreground overflow-hidden transition-[max-height] duration-300 ease-in-out',
            'prose prose-xs dark:prose-invert max-w-none',
            '[&_p]:my-0.5 [&_p]:leading-relaxed',
            '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0',
            '[&_pre]:my-1 [&_pre]:text-[11px] [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words',
            '[&_code]:text-[11px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
            '[&_strong]:text-foreground',
            '[&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground',
            expanded ? 'max-h-[2000px]' : collapsedMaxHeight,
          )}
        >
          {renderContent ? renderContent(displaySummary) : displaySummary}
        </div>
        {!expanded && shouldShowToggle && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/collapse toggle + model */}
      <div className="flex items-center justify-between">
        {shouldShowToggle ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
            {expanded ? showLessLabel : showMoreLabel}
          </button>
        ) : (
          <span />
        )}
        {modelShort && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            {modelIcon}
            <span className="truncate max-w-[180px]">{modelShort}</span>
          </div>
        )}
      </div>
    </div>
  );
}
