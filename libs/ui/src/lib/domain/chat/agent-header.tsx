import { Sparkles, Zap } from 'lucide-react';
import { cn } from '../../utils';
import type { AgentConfig, AgentId } from './types';

interface AgentHeaderProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  agents: AgentConfig[];
  agentId: AgentId | null;
  routedByKrypto?: boolean;
  provider?: string;
  model?: string;
  className?: string;
}

export function AgentHeader({
  agents,
  agentId,
  routedByKrypto = false,
  provider,
  model,
  className,
}: AgentHeaderProps) {
  const agent = agentId ? agents.find((a) => a.id === agentId) : null;

  // Format model for compact display: "openai/gpt-oss-120b:free" → "gpt-oss-120b:free"
  const shortModel = model?.includes('/') ? model.split('/').pop() : model;

  if (!agent) {
    return (
      <div
        className={cn('flex items-center gap-2', className)}
        data-testid="agent-header"
        data-agent-id="orchestrator"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold leading-tight">KRYPTO</span>
          {provider && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate leading-tight">
              {provider} · {shortModel}
            </span>
          )}
        </div>
      </div>
    );
  }

  const Icon = agent.icon;

  return (
    <div
      className={cn('flex items-center gap-2.5', className)}
      data-testid="agent-header"
      data-agent-id={agentId ?? 'orchestrator'}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
          agent.bgColor,
          agent.color,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn('text-sm font-semibold leading-tight', agent.color)}
          >
            {agent.name}
          </span>
          {routedByKrypto && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary/80 ring-1 ring-primary/20">
              <Zap className="h-2.5 w-2.5" />
              KRYPTO
            </span>
          )}
        </div>
        {provider && (
          <span className="text-[10px] mt-1 text-muted-foreground/60 font-mono truncate leading-tight">
            {provider} · {shortModel}
          </span>
        )}
      </div>
    </div>
  );
}
