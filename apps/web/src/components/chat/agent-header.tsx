import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AgentId } from '../../hooks/use-chat-agent';
import { AGENTS } from './agent-selector';
import { useTranslation } from 'react-i18next';

interface AgentHeaderProps {
  agentId: AgentId | null;
  routedByKrypto?: boolean;
  provider?: string;
  model?: string;
  className?: string;
}

export function AgentHeader({
  agentId,
  routedByKrypto = false,
  provider,
  model,
  className,
}: AgentHeaderProps) {
  const { t } = useTranslation();

  const agent = agentId ? AGENTS.find((a) => a.id === agentId) : null;

  if (!agent) {
    // Fallback: show KRYPTO
    return (
      <div
        className={cn('flex items-center gap-2', className)}
        data-testid="agent-header"
        data-agent-id="orchestrator"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <span className="text-sm font-semibold">KRYPTO</span>
        {provider && (
          <span className="text-xs text-muted-foreground">
            {provider} · {model}
          </span>
        )}
      </div>
    );
  }

  const Icon = agent.icon;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-testid="agent-header"
      data-agent-id={agentId ?? 'orchestrator'}
    >
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-lg ring-1',
          agent.bgColor,
          agent.color,
        )}
      >
        <Icon className="h-3 w-3" />
      </div>
      <span className={cn('text-sm font-semibold', agent.color)}>
        {agent.name}
      </span>
      {routedByKrypto && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary ring-1 ring-primary/20">
          {t('agents.routedByKrypto')}
        </span>
      )}
      {provider && (
        <span className="text-xs text-muted-foreground">
          {provider} · {model}
        </span>
      )}
    </div>
  );
}
