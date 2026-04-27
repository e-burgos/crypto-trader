import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { type AgentShowcase } from './types';

export function AgentCard({
  agent,
  index,
  hideChatCta = false,
}: {
  agent: AgentShowcase;
  index: number;
  hideChatCta?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const Icon = agent.icon;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/60 bg-card',
        'transition-all duration-500 ease-out',
        'hover:border-border hover:-translate-y-1',
        'hover:shadow-xl',
        agent.glowColor,
        'hover:shadow-lg',
        'animate-fade-up',
      )}
      style={{ animationDelay: `${500 + index * 120}ms` }}
    >
      {/* Gradient accent — slides in on hover */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-700 group-hover:opacity-100',
          agent.gradient,
        )}
      />
      {/* Top edge shimmer on hover */}
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div
          className={cn(
            'h-full w-1/2 animate-shimmer',
            agent.color.replace('text-', 'bg-').replace('-400', '-500/40'),
          )}
        />
      </div>

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start')}>
          {/* Icon + Identity */}
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1',
                'transition-all duration-500',
                agent.ringColor,
                'bg-background group-hover:ring-2 group-hover:scale-110',
              )}
            >
              <Icon
                className={cn(
                  'h-7 w-7 transition-all duration-500 group-hover:scale-110',
                  agent.color,
                )}
              />
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <h3
                  className={cn(
                    'text-xl font-bold tracking-tight transition-all duration-300',
                    agent.color,
                  )}
                >
                  {agent.codename}
                </h3>
                <span className="text-xs font-medium text-muted-foreground/60 tracking-wider uppercase transition-colors duration-300 group-hover:text-muted-foreground">
                  #{agent.id}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {agent.role}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            {agent.tags.map((tag, ti) => (
              <span
                key={tag}
                className="animate-fade-in rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors duration-300 group-hover:border-border group-hover:bg-muted/50"
                style={{ animationDelay: `${600 + index * 120 + ti * 60}ms` }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Quote */}
        <blockquote
          className={cn(
            'mt-4 border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/90',
            agent.ringColor.replace('ring-', 'border-'),
          )}
        >
          &ldquo;{agent.quote}&rdquo;
        </blockquote>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground/80">
          {agent.description}
        </p>

        {/* Capabilities */}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {agent.capabilities.map((cap, i) => {
            const CapIcon = cap.icon;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/50 p-2.5',
                  'transition-all duration-300',
                  'hover:border-border/70 hover:bg-background/80 hover:translate-x-0.5',
                  'group-hover:border-border/60',
                )}
              >
                <CapIcon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:scale-110',
                    agent.color,
                  )}
                />
                <span className="text-xs font-medium text-foreground/80">
                  {cap.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {!hideChatCta && (
          <button
            onClick={() => navigate('/dashboard/chat')}
            className={cn(
              'mt-4 inline-flex items-center gap-1.5 text-xs font-semibold',
              'transition-all duration-300',
              agent.color,
              'opacity-0 translate-x-[-8px] group-hover:opacity-100 group-hover:translate-x-0',
            )}
          >
            {t('agentsShowcase.chatWith', { name: agent.codename })}
            <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </div>
  );
}
