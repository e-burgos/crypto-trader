import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  HelpCircle,
  BookOpen,
  AlertTriangle,
  GitFork,
  Sliders,
  Key,
  Clock,
  Menu,
  X,
  BarChart2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../utils';

interface SidebarChild {
  id: string;
  label: string;
}

interface SidebarLink {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: SidebarChild[];
}

interface SidebarGroup {
  label: string;
  links: SidebarLink[];
}

interface HelpSidebarProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  activeId: string;
  onNavigate: (id: string) => void;
}

function SidebarNav({
  groups,
  activeId,
  onNavigate,
}: {
  groups: SidebarGroup[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  // Track which collapsible parents are manually toggled open
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <nav className="space-y-6">
      {groups.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div className="mb-3 h-px bg-border/40" />}
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const isActive = activeId === link.id;
              const hasChildren = !!link.children?.length;
              const childActive =
                link.children?.some((c) => c.id === activeId) ?? false;
              // Expanded when: manually toggled OR any child is active
              const isExpanded = openIds.has(link.id) || childActive;

              return (
                <li key={link.id}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onNavigate(link.id)}
                      className={cn(
                        'group flex flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150',
                        isActive || childActive
                          ? 'bg-primary/10 font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      {link.icon && (
                        <span
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive || childActive
                              ? 'text-primary'
                              : 'text-muted-foreground/60 group-hover:text-muted-foreground',
                          )}
                        >
                          {link.icon}
                        </span>
                      )}
                      <span className="text-sm">{link.label}</span>
                      {isActive && !hasChildren && (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>

                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => toggleOpen(link.id)}
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                          isExpanded
                            ? 'text-primary hover:bg-primary/10'
                            : 'text-muted-foreground/40 hover:bg-muted/50 hover:text-muted-foreground',
                        )}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform duration-200',
                            isExpanded ? 'rotate-180' : '',
                          )}
                        />
                      </button>
                    )}
                  </div>

                  {/* Children */}
                  {hasChildren && isExpanded && (
                    <ul className="mt-0.5 space-y-0.5 pl-4">
                      {link.children!.map((child) => {
                        const isChildActive = activeId === child.id;
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => onNavigate(child.id)}
                              className={cn(
                                'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-150',
                                isChildActive
                                  ? 'bg-primary/10 font-medium text-foreground'
                                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                                  isChildActive
                                    ? 'bg-primary'
                                    : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/60',
                                )}
                              />
                              <span className="text-xs">{child.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function HelpSidebar({ t, activeId, onNavigate }: HelpSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups: SidebarGroup[] = [
    {
      label: t('help.gettingStarted'),
      links: [
        {
          id: 'faq',
          label: t('help.faq'),
          icon: <HelpCircle className="h-4 w-4" />,
        },
        {
          id: 'guide',
          label: t('help.guide'),
          icon: <BookOpen className="h-4 w-4" />,
        },
      ],
    },
    {
      label: t('help.platformBehavior'),
      links: [
        {
          id: 'behaviors',
          label: t('help.behaviors'),
          icon: <AlertTriangle className="h-4 w-4" />,
        },
        {
          id: 'agents-showcase',
          label: t('help.agentsShowcase'),
          icon: <Sparkles className="h-4 w-4" />,
        },
      ],
    },
    {
      label: t('help.agentGroup'),
      links: [
        {
          id: 'agent-flow',
          label: t('help.agentFlow'),
          icon: <GitFork className="h-4 w-4" />,
        },
        {
          id: 'agent-cycle',
          label: t('help.agentCycle'),
          icon: <Clock className="h-4 w-4" />,
        },
        {
          id: 'agent-presets',
          label: t('help.agentPresets'),
          icon: <Sliders className="h-4 w-4" />,
        },
        {
          id: 'agent-params',
          label: t('help.agentParams'),
          icon: <BookOpen className="h-4 w-4" />,
          children: [
            {
              id: 'config-concepts-thresholds',
              label: t('help.conceptThresholds'),
            },
            { id: 'config-concepts-sl', label: t('help.conceptSl') },
            { id: 'config-concepts-capital', label: t('help.conceptCapital') },
            {
              id: 'config-concepts-interval',
              label: t('help.conceptInterval'),
            },
            { id: 'config-concepts-offset', label: t('help.conceptOffset') },
          ],
        },
        {
          id: 'trade-execution',
          label: t('help.tradeExecution'),
          icon: <GitFork className="h-4 w-4" />,
        },
      ],
    },
    {
      label: t('help.integrations'),
      links: [
        {
          id: 'binance-integration',
          label: t('help.binanceIntegrationTitle'),
          icon: <BarChart2 className="h-4 w-4" />,
        },
        {
          id: 'api-keys',
          label: t('help.apiKeys'),
          icon: <Key className="h-4 w-4" />,
          children: [
            { id: 'binance', label: 'Binance' },
            { id: 'claude', label: 'Claude (Anthropic)' },
            { id: 'openai', label: 'OpenAI' },
            { id: 'groq', label: 'Groq' },
          ],
        },
      ],
    },
  ];

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside className="hidden md:flex sticky top-20 h-fit w-60 shrink-0 self-start">
        {/* Content */}
        <div className="flex-1 pr-4">
          <SidebarNav
            groups={groups}
            activeId={activeId}
            onNavigate={onNavigate}
          />
        </div>
        {/* Right divider */}
        <div className="w-px self-stretch bg-gradient-to-b from-transparent via-border/60 to-transparent" />
      </aside>

      {/* Mobile floating button + panel — rendered via portal to avoid fixed-inside-transform issues */}
      {createPortal(
        <>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[40] flex flex-col items-center justify-center gap-2 rounded-r-xl opacity-50 bg-gradient-to-br from-primary to-primary/80 backdrop-blur-sm px-2.5 py-4 text-primary-foreground shadow-lg hover:bg-primary/80 transition-colors"
          >
            <Menu className="h-4 w-4 shrink-0 rotate-90" />
            <span className="text-xs font-semibold [writing-mode:vertical-rl] [text-orientation:mixed]">
              Contents
            </span>
          </button>

          {mobileOpen && (
            <div className="md:hidden fixed inset-0 z-[9999] flex">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              {/* Panel */}
              <div className="relative ml-auto w-72 h-full overflow-y-auto bg-card border-l border-border p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-sm">Contents</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SidebarNav
                  groups={groups}
                  activeId={activeId}
                  onNavigate={(id) => {
                    onNavigate(id);
                    setMobileOpen(false);
                  }}
                />
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
