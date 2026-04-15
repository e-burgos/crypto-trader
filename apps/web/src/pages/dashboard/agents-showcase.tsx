import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Bot,
  TrendingUp,
  Link as LinkIcon,
  Shield,
  Sparkles,
  ArrowRight,
  Zap,
  BookOpen,
  BarChart3,
  Network,
  ShieldAlert,
  Target,
  Brain,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

/* ── Agent Data ── */
interface AgentShowcase {
  id: string;
  codename: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  glowColor: string;
  ringColor: string;
  quote: string;
  description: string;
  capabilities: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[];
  tags: string[];
}

function useAgentData(): AgentShowcase[] {
  const { t } = useTranslation();
  return [
    {
      id: 'platform',
      codename: 'NEXUS',
      role: t('agentsShowcase.nexus.role'),
      icon: Cpu,
      color: 'text-cyan-400',
      gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
      glowColor: 'shadow-cyan-500/20',
      ringColor: 'ring-cyan-500/30',
      quote: t('agentsShowcase.nexus.quote'),
      description: t('agentsShowcase.nexus.description'),
      capabilities: [
        { icon: BookOpen, label: t('agentsShowcase.nexus.cap1') },
        { icon: Target, label: t('agentsShowcase.nexus.cap2') },
        { icon: MessageSquare, label: t('agentsShowcase.nexus.cap3') },
      ],
      tags: [
        t('agentsShowcase.nexus.tag1'),
        t('agentsShowcase.nexus.tag2'),
        t('agentsShowcase.nexus.tag3'),
      ],
    },
    {
      id: 'operations',
      codename: 'FORGE',
      role: t('agentsShowcase.forge.role'),
      icon: Bot,
      color: 'text-orange-400',
      gradient: 'from-orange-500/20 via-orange-500/5 to-transparent',
      glowColor: 'shadow-orange-500/20',
      ringColor: 'ring-orange-500/30',
      quote: t('agentsShowcase.forge.quote'),
      description: t('agentsShowcase.forge.description'),
      capabilities: [
        { icon: Zap, label: t('agentsShowcase.forge.cap1') },
        { icon: Target, label: t('agentsShowcase.forge.cap2') },
        { icon: ShieldAlert, label: t('agentsShowcase.forge.cap3') },
      ],
      tags: [
        t('agentsShowcase.forge.tag1'),
        t('agentsShowcase.forge.tag2'),
        t('agentsShowcase.forge.tag3'),
      ],
    },
    {
      id: 'market',
      codename: 'SIGMA',
      role: t('agentsShowcase.sigma.role'),
      icon: TrendingUp,
      color: 'text-emerald-400',
      gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      glowColor: 'shadow-emerald-500/20',
      ringColor: 'ring-emerald-500/30',
      quote: t('agentsShowcase.sigma.quote'),
      description: t('agentsShowcase.sigma.description'),
      capabilities: [
        { icon: BarChart3, label: t('agentsShowcase.sigma.cap1') },
        { icon: TrendingUp, label: t('agentsShowcase.sigma.cap2') },
        { icon: Brain, label: t('agentsShowcase.sigma.cap3') },
      ],
      tags: [
        t('agentsShowcase.sigma.tag1'),
        t('agentsShowcase.sigma.tag2'),
        t('agentsShowcase.sigma.tag3'),
      ],
    },
    {
      id: 'blockchain',
      codename: 'CIPHER',
      role: t('agentsShowcase.cipher.role'),
      icon: LinkIcon,
      color: 'text-violet-400',
      gradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
      glowColor: 'shadow-violet-500/20',
      ringColor: 'ring-violet-500/30',
      quote: t('agentsShowcase.cipher.quote'),
      description: t('agentsShowcase.cipher.description'),
      capabilities: [
        { icon: Network, label: t('agentsShowcase.cipher.cap1') },
        { icon: Shield, label: t('agentsShowcase.cipher.cap2') },
        { icon: BookOpen, label: t('agentsShowcase.cipher.cap3') },
      ],
      tags: [
        t('agentsShowcase.cipher.tag1'),
        t('agentsShowcase.cipher.tag2'),
        t('agentsShowcase.cipher.tag3'),
      ],
    },
    {
      id: 'risk',
      codename: 'AEGIS',
      role: t('agentsShowcase.aegis.role'),
      icon: Shield,
      color: 'text-red-400',
      gradient: 'from-red-500/20 via-red-500/5 to-transparent',
      glowColor: 'shadow-red-500/20',
      ringColor: 'ring-red-500/30',
      quote: t('agentsShowcase.aegis.quote'),
      description: t('agentsShowcase.aegis.description'),
      capabilities: [
        { icon: ShieldAlert, label: t('agentsShowcase.aegis.cap1') },
        { icon: BarChart3, label: t('agentsShowcase.aegis.cap2') },
        { icon: Target, label: t('agentsShowcase.aegis.cap3') },
      ],
      tags: [
        t('agentsShowcase.aegis.tag1'),
        t('agentsShowcase.aegis.tag2'),
        t('agentsShowcase.aegis.tag3'),
      ],
    },
  ];
}

/* ── Orchestrator Hero ── */
function OrchestratorHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-48 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse-soft" />

      <div className="relative py-4 sm:py-8">
        <div className="animate-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse-soft" />
          <span className="text-xs font-semibold tracking-wider text-primary uppercase">
            {t('agentsShowcase.badge')}
          </span>
        </div>

        <h1
          className="animate-fade-up mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          style={{ animationDelay: '100ms' }}
        >
          {t('agentsShowcase.title')}
        </h1>

        <p
          className="animate-fade-up mb-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
          style={{ animationDelay: '200ms' }}
        >
          {t('agentsShowcase.subtitle')}
        </p>

        <button
          onClick={() => navigate('/dashboard/chat')}
          className="animate-fade-up group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
          style={{ animationDelay: '300ms' }}
        >
          <MessageSquare className="h-4 w-4" />
          {t('agentsShowcase.cta')}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        <div
          className="animate-fade-up mt-8 h-px bg-gradient-to-r from-border via-border/60 to-transparent"
          style={{ animationDelay: '400ms' }}
        />
      </div>
    </div>
  );
}

/* ── Orchestrator Pipeline Visual ── */
function PipelineSection() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: MessageSquare,
      title: t('agentsShowcase.pipeline.step1Title'),
      desc: t('agentsShowcase.pipeline.step1Desc'),
    },
    {
      icon: Brain,
      title: t('agentsShowcase.pipeline.step2Title'),
      desc: t('agentsShowcase.pipeline.step2Desc'),
    },
    {
      icon: Zap,
      title: t('agentsShowcase.pipeline.step3Title'),
      desc: t('agentsShowcase.pipeline.step3Desc'),
    },
    {
      icon: Target,
      title: t('agentsShowcase.pipeline.step4Title'),
      desc: t('agentsShowcase.pipeline.step4Desc'),
    },
  ];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t('agentsShowcase.pipeline.title')}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {t('agentsShowcase.pipeline.subtitle')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="pipeline-card group relative rounded-xl border border-border bg-card/50 p-4 transition-all duration-300 hover:bg-card hover:border-primary/20 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 animate-fade-up"
            style={{ animationDelay: `${300 + i * 100}ms` }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                <step.icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {step.desc}
            </p>
            {i < steps.length - 1 && (
              <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:block">
                <ChevronRight className="h-4 w-4 text-border transition-all duration-300 group-hover:text-primary/40 group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Agent Card ── */
function AgentCard({ agent, index }: { agent: AgentShowcase; index: number }) {
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
      </div>
    </div>
  );
}

/* ── Main Page ── */
export function AgentsShowcasePage() {
  const agents = useAgentData();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6 pb-12">
      <OrchestratorHero />
      <PipelineSection />

      <div className="space-y-4">
        {agents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </div>
    </div>
  );
}
