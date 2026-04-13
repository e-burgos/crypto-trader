import { Bot, Cpu, TrendingUp, Link, Shield, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AgentId } from '../../hooks/use-chat-agent';
import { useTranslation } from 'react-i18next';

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'platform',
    name: 'NEXUS',
    description: 'agents.nexusDesc',
    icon: Cpu,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 ring-cyan-500/30 hover:bg-cyan-500/20',
  },
  {
    id: 'operations',
    name: 'FORGE',
    description: 'agents.forgeDesc',
    icon: Bot,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 ring-orange-500/30 hover:bg-orange-500/20',
  },
  {
    id: 'market',
    name: 'SIGMA',
    description: 'agents.sigmaDesc',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 ring-emerald-500/30 hover:bg-emerald-500/20',
  },
  {
    id: 'blockchain',
    name: 'CIPHER',
    description: 'agents.cipherDesc',
    icon: Link,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 ring-violet-500/30 hover:bg-violet-500/20',
  },
  {
    id: 'risk',
    name: 'AEGIS',
    description: 'agents.aegisDesc',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 ring-red-500/30 hover:bg-red-500/20',
  },
];

interface AgentSelectorProps {
  selected: AgentId | null;
  onSelect: (agentId: AgentId | null) => void;
  className?: string;
}

export function AgentSelector({
  selected,
  onSelect,
  className,
}: AgentSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground px-1">
        {t('agents.selectAgent')}
      </p>

      {/* Auto (KRYPTO decides) */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-all duration-150',
          selected === null
            ? 'bg-primary/10 ring-primary/40 text-primary'
            : 'bg-muted/30 ring-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
            selected === null
              ? 'bg-primary/15 ring-primary/30 text-primary'
              : 'bg-muted ring-border text-muted-foreground',
          )}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">KRYPTO</div>
          <div className="truncate text-xs opacity-70">
            {t('agents.kryptoDesc')}
          </div>
        </div>
        {selected === null && (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </button>

      {/* Sub-agents */}
      <div className="grid grid-cols-1 gap-1.5">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selected === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-all duration-150',
                isSelected
                  ? cn(agent.bgColor, `ring-1`)
                  : 'bg-muted/30 ring-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
                  isSelected
                    ? cn(agent.bgColor, agent.color)
                    : 'bg-muted ring-border text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-semibold', isSelected && agent.color)}>
                  {agent.name}
                </div>
                <div className="truncate text-xs opacity-70">
                  {t(agent.description)}
                </div>
              </div>
              {isSelected && (
                <div className={cn('h-2 w-2 rounded-full', agent.color.replace('text-', 'bg-'))} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
