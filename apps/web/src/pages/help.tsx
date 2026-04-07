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
  'agent-flow',
  'agent-presets',
  'agent-params',
  'config-concepts-thresholds',
  'config-concepts-sl',
  'config-concepts-capital',
  'config-concepts-interval',
  'config-concepts-offset',
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

            {/* ── Agent & Configuration ────────────────────────────────── */}

            <section id="agent-flow" data-section className="help-section">
              <SectionTitle icon={<GitFork className="h-5 w-5" />}>
                {t('help.agentFlow')}
              </SectionTitle>
              <div className="rounded-2xl bg-card p-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.flowTitle')}
                </h3>
                <DecisionFlowDiagram />
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
