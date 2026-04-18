import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Cpu,
  TrendingUp,
  Link,
  Shield,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';
import { cn } from '../../utils';
import type { AgentConfig, AgentId } from './types';

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
  t: (key: string, opts?: Record<string, unknown>) => string;
  selected: AgentId | null;
  onSelect: (agentId: AgentId | null) => void;
  className?: string;
}

export function AgentSelector({
  t,
  selected,
  onSelect,
  className,
}: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedAgent = selected ? AGENTS.find((a) => a.id === selected) : null;
  const SelectedIcon = selectedAgent?.icon ?? Sparkles;

  const handleSelect = (agentId: AgentId | null) => {
    onSelect(agentId);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      data-testid="agent-selector"
    >
      <button
        type="button"
        data-testid="agent-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ring-1 transition-all duration-150',
          'bg-muted/40 ring-border hover:bg-muted/70',
        )}
      >
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
            selectedAgent
              ? cn(selectedAgent.bgColor, selectedAgent.color)
              : 'bg-primary/15 ring-primary/30 text-primary',
          )}
        >
          <SelectedIcon className="h-3 w-3" />
        </div>
        <span
          className={cn(
            'flex-1 font-medium',
            selectedAgent ? selectedAgent.color : 'text-primary',
          )}
        >
          {selectedAgent ? selectedAgent.name : 'KRYPTO'}
        </span>
        <span className="hidden sm:block truncate max-w-[160px] text-xs text-muted-foreground">
          {selectedAgent
            ? t(selectedAgent.description)
            : t('agents.kryptoDesc', { defaultValue: 'Auto-routing' })}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <button
            type="button"
            data-testid="agent-card-auto"
            onClick={() => handleSelect(null)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              selected === null
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1',
                selected === null
                  ? 'bg-primary/15 ring-primary/30 text-primary'
                  : 'bg-muted ring-border',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-none">KRYPTO</p>
              <p className="mt-0.5 truncate text-xs opacity-70">
                {t('agents.kryptoDesc', {
                  defaultValue:
                    'Let KRYPTO decide the best agent for your question',
                })}
              </p>
            </div>
            {selected === null && (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </button>
          <div className="mx-2 h-px bg-border/60" />
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isSelected = selected === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                data-testid={`agent-card-${agent.id}`}
                onClick={() => handleSelect(agent.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? cn('bg-muted/50', agent.color)
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1',
                    isSelected
                      ? cn(agent.bgColor, agent.color)
                      : 'bg-muted ring-border',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-semibold leading-none',
                      isSelected && agent.color,
                    )}
                  >
                    {agent.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs opacity-70">
                    {t(agent.description)}
                  </p>
                </div>
                {isSelected && (
                  <Check className={cn('h-3.5 w-3.5 shrink-0', agent.color)} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
