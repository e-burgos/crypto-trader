import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Key,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  GitFork,
  Sliders,
  Clock,
  BarChart2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { HelpSidebar } from '../components/help/help-sidebar';
import { DecisionFlowDiagram } from '../components/agent/decision-flow-diagram';
import { StrategyPresets } from '../components/agent/strategy-presets';
import { ParameterCards } from '../components/agent/parameter-cards';
import { ExplainPanel } from '../components/agent/explain-panel';
import { AgentsShowcaseSection } from './dashboard/agents-showcase';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!bodyRef.current) return;
      if (open) {
        gsap.fromTo(
          bodyRef.current,
          { height: 0, opacity: 0 },
          { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' },
        );
      } else {
        gsap.to(bodyRef.current, {
          height: 0,
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in',
        });
      }
    },
    { dependencies: [open] },
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-medium text-sm hover:bg-muted/30 transition-colors"
      >
        {q}
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      <div ref={bodyRef} className="overflow-hidden h-0 opacity-0">
        <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
          {a}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
      <span className="text-primary">{icon}</span>
      <h2 className="text-xl font-bold">{children}</h2>
    </div>
  );
}

const SECTION_IDS = [
  'faq',
  'guide',
  'behaviors',
  'agents-showcase',
  'agent-flow',
  'agent-cycle',
  'agent-presets',
  'agent-params',
  'config-concepts-thresholds',
  'config-concepts-sl',
  'config-concepts-capital',
  'config-concepts-interval',
  'config-concepts-offset',
  'trade-execution',
  'binance-integration',
  'api-keys',
  'binance',
  'claude',
  'openai',
  'groq',
];

export function HelpPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState('faq');

  const faqItems = t('help.faqItems', { returnObjects: true }) as {
    q: string;
    a: string;
  }[];
  const guideSteps = t('help.guideSteps', { returnObjects: true }) as {
    title: string;
    desc: string;
  }[];

  // IntersectionObserver keeps sidebar active link in sync while scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Scroll to hash on initial load
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) scrollToSection(hash);
  }, [location.hash]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  }, []);

  useGSAP(
    () => {
      gsap.fromTo(
        '.help-section',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' },
      );
    },
    { scope: contentRef },
  );

  return (
    <div className="bg-background/50 backdrop-blur-[1px]">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('help.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('help.subtitle')}
          </p>
        </div>

        <div className="flex gap-8 items-start">
          {/* Sidebar */}
          <HelpSidebar activeId={activeId} onNavigate={scrollToSection} />

          {/* Content */}
          <div ref={contentRef} className="flex-1 min-w-0 max-w-7xl space-y-14">
            {/* ── FAQ ──────────────────────────────────────────────────── */}
            <section id="faq" data-section className="help-section">
              <SectionTitle icon={<HelpCircle className="h-5 w-5" />}>
                {t('help.faq')}
              </SectionTitle>
              <div className="space-y-2">
                {faqItems.map((item, i) => (
                  <FaqItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </section>

            {/* ── Step-by-Step Guide ───────────────────────────────────── */}
            <section id="guide" data-section className="help-section">
              <SectionTitle icon={<BookOpen className="h-5 w-5" />}>
                {t('help.guide')}
              </SectionTitle>
              <div className="space-y-3">
                {guideSteps.map(({ title, desc }, i) => (
                  <div key={i} className="flex gap-4 rounded-xl bg-card p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Behaviors & Warnings ─────────────────────────────────── */}
            <section id="behaviors" data-section className="help-section">
              <SectionTitle
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              >
                {t('help.behaviors')}
              </SectionTitle>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  {t('help.stopAllTitle')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('help.stopAllDesc')}
                </p>
              </div>
            </section>

            {/* ── Agents Showcase ───────────────────────────────────── */}
            <section id="agents-showcase" data-section className="help-section">
              <AgentsShowcaseSection />
            </section>

            {/* ── Agent & Configuration ────────────────────────────────── */}

            <section id="agent-flow" data-section className="help-section">
              <SectionTitle icon={<GitFork className="h-5 w-5" />}>
                {t('help.agentFlow')}
              </SectionTitle>

              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t('config.guide.agentFlowDesc')}
              </p>

              {/* 4-step pipeline */}
              <div className="grid gap-3 sm:grid-cols-2 mb-6">
                {(
                  [
                    {
                      step: 1,
                      title: t('config.guide.agentFlowStep1'),
                      desc: t('config.guide.agentFlowStep1Desc'),
                    },
                    {
                      step: 2,
                      title: t('config.guide.agentFlowStep2'),
                      desc: t('config.guide.agentFlowStep2Desc'),
                    },
                    {
                      step: 3,
                      title: t('config.guide.agentFlowStep3'),
                      desc: t('config.guide.agentFlowStep3Desc'),
                    },
                    {
                      step: 4,
                      title: t('config.guide.agentFlowStep4'),
                      desc: t('config.guide.agentFlowStep4Desc'),
                    },
                  ] as { step: number; title: string; desc: string }[]
                ).map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 rounded-xl bg-card p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Decision flow diagram */}
              <div className="rounded-2xl bg-card p-5 mb-6">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.flowTitle')}
                </h3>
                <DecisionFlowDiagram />
              </div>

              {/* Possible decisions grid */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">
                  {t('config.guide.agentDecisionsTitle')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        label: t('config.guide.agentDecisionBuy'),
                        desc: t('config.guide.agentDecisionBuyDesc'),
                        color: 'emerald',
                      },
                      {
                        label: t('config.guide.agentDecisionSell'),
                        desc: t('config.guide.agentDecisionSellDesc'),
                        color: 'red',
                      },
                      {
                        label: t('config.guide.agentDecisionHold'),
                        desc: t('config.guide.agentDecisionHoldDesc'),
                        color: 'slate',
                      },
                      {
                        label: t('config.guide.agentDecisionClose'),
                        desc: t('config.guide.agentDecisionCloseDesc'),
                        color: 'orange',
                      },
                    ] as {
                      label: string;
                      desc: string;
                      color: string;
                    }[]
                  ).map(({ label, desc, color }) => (
                    <div
                      key={label}
                      className={`rounded-xl border p-4 ${
                        color === 'emerald'
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : color === 'red'
                            ? 'border-red-500/30 bg-red-500/5'
                            : color === 'orange'
                              ? 'border-orange-500/30 bg-orange-500/5'
                              : 'border-border bg-muted/20'
                      }`}
                    >
                      <p
                        className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${
                          color === 'emerald'
                            ? 'text-emerald-400'
                            : color === 'red'
                              ? 'text-red-400'
                              : color === 'orange'
                                ? 'text-orange-400'
                                : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Agent Cycle & Wait Time ──────────────────────────────── */}
            <section id="agent-cycle" data-section className="help-section">
              <SectionTitle icon={<Clock className="h-5 w-5" />}>
                {t('config.explain.cycleTitle')}
              </SectionTitle>

              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t('config.explain.cycleDesc')}
              </p>

              {/* Two sources */}
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                {/* Source 1: LLM */}
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <h3 className="text-sm font-bold text-purple-300">
                      {t('config.explain.cycleSource1Title')}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.explain.cycleSource1Desc')}
                  </p>
                  <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-purple-300">
                    suggestedWaitMinutes: 1 – 60
                  </div>
                </div>

                {/* Source 2: minInterval */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">⚙️</span>
                    <h3 className="text-sm font-bold text-blue-300">
                      {t('config.explain.cycleSource2Title')}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.explain.cycleSource2Desc')}
                  </p>
                  <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-blue-300">
                    minIntervalMinutes: 5 – 120
                  </div>
                </div>
              </div>

              {/* Combined formula */}
              <div className="rounded-xl border border-border bg-card p-5 mb-5">
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    =
                  </span>
                  {t('config.explain.cycleCombined')}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                  {t('config.explain.cycleCombinedDesc')}
                </p>
                <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-xs text-foreground mb-4">
                  {t('config.explain.cycleFormula')}
                </code>

                {/* Examples table */}
                <div className="space-y-2">
                  {[
                    {
                      text: t('config.explain.cycleExample1'),
                      highlight: '30 min',
                      color: 'text-amber-400',
                    },
                    {
                      text: t('config.explain.cycleExample2'),
                      highlight: '15 min',
                      color: 'text-blue-400',
                    },
                    {
                      text: t('config.explain.cycleExample3'),
                      highlight: '60 min',
                      color: 'text-amber-400',
                    },
                  ].map((ex) => (
                    <div
                      key={ex.text}
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs font-mono"
                    >
                      <span className="text-muted-foreground">
                        {ex.text.split('→')[0]}
                      </span>
                      <span className={`font-bold ${ex.color}`}>
                        → {ex.text.split('→')[1]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                  💡 {t('config.explain.cycleTip')}
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                  🔒 {t('config.explain.cycleLlmNote')}
                </div>
              </div>
            </section>

            <section id="agent-presets" data-section className="help-section">
              <SectionTitle icon={<Sliders className="h-5 w-5" />}>
                {t('help.agentPresets')}
              </SectionTitle>
              <div className="rounded-2xl bg-card p-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.presetsTitle')}
                </h3>
                <StrategyPresets />
              </div>
            </section>

            <section id="agent-params" data-section className="help-section">
              <SectionTitle icon={<BookOpen className="h-5 w-5" />}>
                {t('help.agentParams')}
              </SectionTitle>
              <div className="rounded-2xl bg-card p-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.paramTitle')}
                </h3>
                <ParameterCards />
              </div>
            </section>

            <section
              id="config-concepts-thresholds"
              data-section
              className="help-section"
            >
              <ExplainPanel conceptId="threshold" />
            </section>

            <section
              id="config-concepts-sl"
              data-section
              className="help-section"
            >
              <ExplainPanel conceptId="sl" />
            </section>

            <section
              id="config-concepts-capital"
              data-section
              className="help-section"
            >
              <ExplainPanel conceptId="capital" />
            </section>

            <section
              id="config-concepts-interval"
              data-section
              className="help-section"
            >
              <ExplainPanel conceptId="interval" />
            </section>

            <section
              id="config-concepts-offset"
              data-section
              className="help-section"
            >
              <ExplainPanel conceptId="offset" />
            </section>

            {/* ── Trade Execution Flow ─────────────────────────────────── */}
            <section id="trade-execution" data-section className="help-section">
              <SectionTitle icon={<GitFork className="h-5 w-5" />}>
                {t('config.guide.tradeExecTitle')}
              </SectionTitle>
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                {t('config.guide.tradeExecSubtitle')}
              </p>

              {/* Priority table */}
              <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('config.guide.tradeExecPriorityLabel')}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    {
                      n: 1,
                      label: t('config.guide.tradeExecPriority1'),
                      color: 'text-emerald-400',
                      bg: 'bg-emerald-500/5',
                    },
                    {
                      n: 2,
                      label: t('config.guide.tradeExecPriority2'),
                      color: 'text-amber-400',
                      bg: 'bg-amber-500/5',
                    },
                    {
                      n: 3,
                      label: t('config.guide.tradeExecPriority3'),
                      color: 'text-red-400',
                      bg: 'bg-red-500/5',
                    },
                  ].map(({ n, label, color, bg }) => (
                    <div
                      key={n}
                      className={`flex items-center gap-3 px-4 py-3 ${bg}`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold ${color}`}
                      >
                        {n}
                      </span>
                      <span className="text-sm font-mono">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BUY flow */}
              <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <h3 className="mb-3 text-sm font-bold text-emerald-400">
                  {t('config.guide.tradeExecBuyTitle')}
                </h3>
                <div className="space-y-1.5">
                  {(
                    [
                      t('config.guide.tradeExecBuyStep1'),
                      t('config.guide.tradeExecBuyStep2'),
                      t('config.guide.tradeExecBuyStep3'),
                      t('config.guide.tradeExecBuyStep4'),
                      t('config.guide.tradeExecBuyStep5'),
                    ] as string[]
                  ).map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SELL flow — 3 paths */}
              <div className="mb-5 space-y-3">
                <h3 className="text-sm font-bold">
                  {t('config.guide.tradeExecSellTitle')}
                </h3>
                {[
                  {
                    title: t('config.guide.tradeExecSell1Title'),
                    desc: t('config.guide.tradeExecSell1Desc'),
                    border: 'border-emerald-500/30',
                    bg: 'bg-emerald-500/5',
                    badge: 'bg-emerald-500/20 text-emerald-400',
                  },
                  {
                    title: t('config.guide.tradeExecSell2Title'),
                    desc: t('config.guide.tradeExecSell2Desc'),
                    border: 'border-amber-500/30',
                    bg: 'bg-amber-500/5',
                    badge: 'bg-amber-500/20 text-amber-400',
                  },
                  {
                    title: t('config.guide.tradeExecSell3Title'),
                    desc: t('config.guide.tradeExecSell3Desc'),
                    border: 'border-red-500/30',
                    bg: 'bg-red-500/5',
                    badge: 'bg-red-500/20 text-red-400',
                  },
                ].map(({ title, desc, border, bg, badge }) => (
                  <div
                    key={title}
                    className={`rounded-xl border p-4 ${border} ${bg}`}
                  >
                    <p
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mb-2 ${badge}`}
                    >
                      {title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Examples */}
              <div className="mb-5 rounded-xl border border-border bg-card p-5">
                <h3 className="mb-4 text-sm font-bold">
                  {t('config.guide.tradeExecExampleTitle')}
                </h3>
                {/* Config table */}
                <div className="mb-4 grid grid-cols-5 gap-2">
                  {[
                    {
                      label: t('config.guide.tradeExecExampleBuy'),
                      value: '70%',
                      color: 'text-emerald-400',
                    },
                    {
                      label: t('config.guide.tradeExecExampleSell'),
                      value: '70%',
                      color: 'text-red-400',
                    },
                    {
                      label: t('config.guide.tradeExecExampleMinProfit'),
                      value: '0.3%',
                      color: 'text-blue-400',
                    },
                    {
                      label: t('config.guide.tradeExecExampleTP'),
                      value: '5%',
                      color: 'text-amber-400',
                    },
                    {
                      label: t('config.guide.tradeExecExampleSL'),
                      value: '3%',
                      color: 'text-red-500',
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="rounded-lg bg-muted/40 p-2.5 text-center"
                    >
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Scenario A */}
                <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-semibold text-emerald-400 mb-1">
                    {t('config.guide.tradeExecExample1Title')}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.guide.tradeExecExample1Desc')}
                  </p>
                </div>
                {/* Scenario B */}
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {t('config.guide.tradeExecExample2Title')}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.guide.tradeExecExample2Desc')}
                  </p>
                </div>
              </div>

              {/* Manual close + note */}
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold mb-1">
                    {t('config.guide.tradeExecManualTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.guide.tradeExecManualDesc')}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className="text-xs font-semibold mb-1">
                    💡 {t('config.guide.tradeExecNoteTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('config.guide.tradeExecNoteDesc')}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Binance Integration ──────────────────────────────────── */}
            <section
              id="binance-integration"
              data-section
              className="help-section"
            >
              <SectionTitle icon={<BarChart2 className="h-5 w-5" />}>
                {t('help.binanceIntegrationTitle')}
              </SectionTitle>
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                {t('help.binanceIntegration.subtitle')}
              </p>

              {/* ── Mercado Spot ── */}
              <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                    SPOT
                  </span>
                  <h3 className="text-sm font-bold">
                    {t('help.binanceIntegration.marketTitle')}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('help.binanceIntegration.marketDesc')}
                </p>
              </div>

              {/* ── Pares soportados + Tipo de órdenes ── */}
              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-bold">
                    {t('help.binanceIntegration.pairsTitle')}
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { pair: 'BTC / USDT', symbol: 'BTCUSDT' },
                      { pair: 'BTC / USDC', symbol: 'BTCUSDC' },
                      { pair: 'ETH / USDT', symbol: 'ETHUSDT' },
                      { pair: 'ETH / USDC', symbol: 'ETHUSDC' },
                    ].map(({ pair, symbol }) => (
                      <div
                        key={symbol}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <span className="text-sm font-medium">{pair}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-2 text-sm font-bold">
                    {t('help.binanceIntegration.ordersTitle')}
                  </h3>
                  <div className="mb-3 inline-flex items-center rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-400">
                    MARKET ORDER
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('help.binanceIntegration.ordersDesc')}
                  </p>
                </div>
              </div>

              {/* ── SANDBOX vs LIVE ── */}
              <div className="mb-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('help.binanceIntegration.modesTitle')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base">🧪</span>
                      <h4 className="text-sm font-bold text-amber-400">
                        {t('help.binanceIntegration.sandboxTitle')}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('help.binanceIntegration.sandboxDesc')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base">🔴</span>
                      <h4 className="text-sm font-bold text-emerald-400">
                        {t('help.binanceIntegration.liveTitle')}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('help.binanceIntegration.liveDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Comisiones ── */}
              <div className="mb-5 rounded-xl border border-border bg-card p-5">
                <h3 className="mb-1 text-sm font-bold">
                  {t('help.binanceIntegration.feesTitle')}
                </h3>
                <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                  {t('help.binanceIntegration.feesDesc')}
                </p>

                {/* Fórmulas */}
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {t('help.binanceIntegration.feesEntry')}
                    </span>
                    <code className="font-mono text-xs text-primary">
                      {t('help.binanceIntegration.feesEntryFormula')}
                    </code>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {t('help.binanceIntegration.feesExit')}
                    </span>
                    <code className="font-mono text-xs text-primary">
                      {t('help.binanceIntegration.feesExitFormula')}
                    </code>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <code className="font-mono text-xs text-foreground">
                      {t('help.binanceIntegration.feesNetFormula')}
                    </code>
                  </div>
                </div>

                {/* Ejemplo */}
                <h4 className="mb-2 text-xs font-semibold">
                  {t('help.binanceIntegration.feesExampleTitle')}
                </h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('help.binanceIntegration.feesExampleSetup')}
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {[
                        {
                          label: t('help.binanceIntegration.feesTableGrossPnl'),
                          formula: '(87.000 − 85.000) × 0,01',
                          value: '+$20,00',
                          color: 'text-emerald-400',
                        },
                        {
                          label: t('help.binanceIntegration.feesTableEntryFee'),
                          formula: '85.000 × 0,01 × 0,001',
                          value: '−$0,85',
                          color: 'text-red-400',
                        },
                        {
                          label: t('help.binanceIntegration.feesTableExitFee'),
                          formula: '87.000 × 0,01 × 0,001',
                          value: '−$0,87',
                          color: 'text-red-400',
                        },
                        {
                          label: t('help.binanceIntegration.feesTableNetPnl'),
                          formula: '',
                          value: '+$18,28',
                          color: 'text-emerald-400 font-bold',
                        },
                      ].map(({ label, formula, value, color }) => (
                        <tr key={label} className="px-3">
                          <td className="px-3 py-2 font-medium text-muted-foreground">
                            {label}
                          </td>
                          <td className="px-3 py-2 font-mono text-muted-foreground/60">
                            {formula}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${color}`}
                          >
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                  💡 {t('help.binanceIntegration.feesBnbNote')}
                </div>
              </div>

              {/* ── Seguridad + Permisos ── */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {t('help.binanceIntegration.securityTitle')}
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {t('help.binanceIntegration.securityDesc')}
                  </p>
                  <ol className="space-y-1.5">
                    {[
                      t('help.binanceIntegration.securityStep1'),
                      t('help.binanceIntegration.securityStep2'),
                      t('help.binanceIntegration.securityStep3'),
                      t('help.binanceIntegration.securityStep4'),
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 mt-0.5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-bold">
                    {t('help.binanceIntegration.permissionsTitle')}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-300">
                        {t('help.binanceIntegration.permissionRead')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-300">
                        {t('help.binanceIntegration.permissionSpot')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="text-xs font-medium text-red-300">
                        {t('help.binanceIntegration.permissionNoWithdraw')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                    🛡️ {t('help.binanceIntegration.minProfitNote')}
                  </div>
                </div>
              </div>
            </section>

            {/* ── API Keys ─────────────────────────────────────────────── */}
            <section id="api-keys" data-section className="help-section">
              <SectionTitle icon={<Key className="h-5 w-5" />}>
                {t('help.apiKeys')}
              </SectionTitle>

              <div className="space-y-5">
                {/* Binance */}
                <div
                  id="binance"
                  data-section
                  className="rounded-xl bg-card p-5"
                >
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    {t('help.binanceTitle')}
                    <a
                      href="https://www.binance.com/en/my/settings/api-management"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open Binance <ExternalLink className="h-3 w-3" />
                    </a>
                  </h3>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                      {t('help.binanceStep1')}
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                      {t('help.binanceStep2')}
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                      {t('help.binanceStep3')}
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                      {t('help.binanceStep4')}
                    </li>
                  </ol>
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                    {t('help.binanceWarning')}
                  </div>
                </div>

                {/* Claude */}
                <div
                  id="claude"
                  data-section
                  className="rounded-xl bg-card p-5"
                >
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    Claude (Anthropic)
                    <a
                      href="https://console.anthropic.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      console.anthropic.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </h3>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. {t('help.claudeStep1')}</li>
                    <li>2. {t('help.claudeStep2')}</li>
                    <li>3. {t('help.claudeStep3')}</li>
                  </ol>
                  <div className="mt-3">
                    <CodeBlock>sk-ant-api03-XXXXXXXXXXXXXXXXXXXX</CodeBlock>
                  </div>
                </div>

                {/* OpenAI */}
                <div
                  id="openai"
                  data-section
                  className="rounded-xl bg-card p-5"
                >
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    OpenAI
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      platform.openai.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </h3>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. {t('help.openaiStep1')}</li>
                    <li>2. {t('help.openaiStep2')}</li>
                    <li>3. {t('help.openaiStep3')}</li>
                  </ol>
                  <div className="mt-3">
                    <CodeBlock>sk-proj-XXXXXXXXXXXXXXXXXXXX</CodeBlock>
                  </div>
                </div>

                {/* Groq */}
                <div id="groq" data-section className="rounded-xl bg-card p-5">
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    Groq
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      console.groq.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </h3>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. {t('help.groqStep1')}</li>
                    <li>2. {t('help.groqStep2')}</li>
                    <li>3. {t('help.groqStep3')}</li>
                  </ol>
                  <div className="mt-3">
                    <CodeBlock>gsk_XXXXXXXXXXXXXXXXXXXX</CodeBlock>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
