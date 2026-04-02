import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Bot, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import {
  useAgentDecisions,
  type AgentDecision,
} from '../../hooks/use-analytics';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

gsap.registerPlugin(useGSAP);

const DECISION_CONFIG = {
  BUY: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: TrendingUp },
  SELL: { color: 'text-red-500', bg: 'bg-red-500/10', icon: TrendingDown },
  HOLD: { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Minus },
  CLOSE: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: TrendingDown },
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  const config = DECISION_CONFIG[decision.decision] || DECISION_CONFIG.HOLD;
  const Icon = config.icon;

  return (
    <div className="decision-card relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm',
            config.bg,
            config.color,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-1 w-px flex-1 bg-border/60" />
      </div>

      {/* Card */}
      <div className="mb-4 flex-1 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <span className={cn('text-xs font-bold uppercase', config.color)}>
              {decision.decision}
            </span>
            <span className="ml-2 text-sm font-semibold">{decision.pair}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(decision.createdAt).toLocaleTimeString()}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {decision.reasoning}
        </p>

        <ConfidenceBar value={decision.confidence} />

        {decision.waitMinutes && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('agentLog.waitMinutes', { count: decision.waitMinutes })}
          </p>
        )}
      </div>
    </div>
  );
}

export function AgentLogPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: decisions = [], isLoading } = useAgentDecisions(30);

  useGSAP(
    () => {
      gsap.from('.decision-card', {
        opacity: 0,
        x: -20,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [decisions.length] },
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('sidebar.agentLog')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('agentLog.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <Bot className="h-4 w-4 text-primary" />
          {t('agentLog.decisions', { count: decisions.length })}
        </div>
      </div>

      <div ref={containerRef}>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">{t('agentLog.noDecisions')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('agentLog.noDecisionsHint')}
            </p>
          </div>
        ) : (
          <div>
            {decisions.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
