import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Key,
  ExternalLink,
  AlertTriangle,
  GitFork,
  Sliders,
  Clock,
  BarChart2,
  Cpu,
  Radio,
  FlaskConical,
  Play,
  Globe,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  HelpSidebar,
  DecisionFlowDiagram,
  StrategyPresets,
  ParameterCards,
  ExplainPanel,
  DocsSectionHeader,
  DocsCallout,
  DocsCodeBlock,
  DocsSteps,
  DocsTable,
  DocsBadge,
  DocsPageFeedback,
} from '@crypto-trader/ui';
import { AgentsShowcaseSection } from './dashboard/agents-showcase';
import { FaqItem } from '../components/help';

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
  'operation-modes',
  'llm-providers',
  'api-keys',
  'binance',
  'openrouter',
  'claude',
  'openai',
  'groq',
];

export function DocsPage() {
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
    <div className="bg-background/50 backdrop-blur-[1px] my-10">
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
          <HelpSidebar t={t} activeId={activeId} onNavigate={scrollToSection} />

          {/* Content */}
          <div ref={contentRef} className="flex-1 min-w-0 max-w-7xl space-y-14">
            {/* ── FAQ ──────────────────────────────────────────────────── */}
            <section id="faq" data-section className="help-section">
              <DocsSectionHeader
                id="faq"
                icon={<HelpCircle className="h-5 w-5" />}
              >
                {t('help.faq')}
              </DocsSectionHeader>
              <div className="space-y-2">
                {faqItems.map((item, i) => (
                  <FaqItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </section>

            {/* ── Step-by-Step Guide ───────────────────────────────────── */}
            <section id="guide" data-section className="help-section">
              <DocsSectionHeader
                id="guide"
                icon={<BookOpen className="h-5 w-5" />}
              >
                {t('help.guide')}
              </DocsSectionHeader>
              <DocsSteps
                steps={guideSteps.map(({ title, desc }) => ({
                  title,
                  description: desc,
                }))}
              />
            </section>

            {/* ── Behaviors & Warnings ─────────────────────────────────── */}
            <section id="behaviors" data-section className="help-section">
              <DocsSectionHeader
                id="behaviors"
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              >
                {t('help.behaviors')}
              </DocsSectionHeader>
              <DocsCallout variant="warning" title={t('help.stopAllTitle')}>
                {t('help.stopAllDesc')}
              </DocsCallout>
            </section>

            {/* ── Agents Showcase ───────────────────────────────────── */}
            <section id="agents-showcase" data-section className="help-section">
              <AgentsShowcaseSection />
            </section>

            {/* ── Agent & Configuration ────────────────────────────────── */}

            <section id="agent-flow" data-section className="help-section">
              <DocsSectionHeader
                id="agent-flow"
                icon={<GitFork className="h-5 w-5" />}
              >
                {t('help.agentFlow')}
              </DocsSectionHeader>

              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t('config.guide.agentFlowDesc')}
              </p>

              {/* 4-step pipeline */}
              <DocsSteps
                steps={[
                  {
                    title: t('config.guide.agentFlowStep1'),
                    description: t('config.guide.agentFlowStep1Desc'),
                  },
                  {
                    title: t('config.guide.agentFlowStep2'),
                    description: t('config.guide.agentFlowStep2Desc'),
                  },
                  {
                    title: t('config.guide.agentFlowStep3'),
                    description: t('config.guide.agentFlowStep3Desc'),
                  },
                  {
                    title: t('config.guide.agentFlowStep4'),
                    description: t('config.guide.agentFlowStep4Desc'),
                  },
                ]}
                className="mb-6"
              />

              {/* Decision flow diagram */}
              <div className="rounded-2xl bg-card p-5 mb-6">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.flowTitle')}
                </h3>
                <DecisionFlowDiagram t={t} />
              </div>

              {/* Possible decisions */}
              <DocsSectionHeader id="agent-decisions" level="h3">
                {t('config.guide.agentDecisionsTitle')}
              </DocsSectionHeader>
              <DocsTable
                variant="overview"
                headers={[
                  t('docs.decision', 'Decision'),
                  t('docs.description', 'Description'),
                ]}
                rows={[
                  [
                    t('config.guide.agentDecisionBuy'),
                    t('config.guide.agentDecisionBuyDesc'),
                  ],
                  [
                    t('config.guide.agentDecisionSell'),
                    t('config.guide.agentDecisionSellDesc'),
                  ],
                  [
                    t('config.guide.agentDecisionHold'),
                    t('config.guide.agentDecisionHoldDesc'),
                  ],
                  [
                    t('config.guide.agentDecisionClose'),
                    t('config.guide.agentDecisionCloseDesc'),
                  ],
                ]}
              />
            </section>

            {/* ── Agent Cycle & Wait Time ──────────────────────────────── */}
            <section id="agent-cycle" data-section className="help-section">
              <DocsSectionHeader
                id="agent-cycle"
                icon={<Clock className="h-5 w-5" />}
              >
                {t('config.explain.cycleTitle')}
              </DocsSectionHeader>

              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t('config.explain.cycleDesc')}
              </p>

              {/* Two sources */}
              <DocsCallout
                variant="info"
                title={t('config.explain.cycleSource1Title')}
              >
                {t('config.explain.cycleSource1Desc')}
                <DocsCodeBlock
                  code="suggestedWaitMinutes: 1 – 60"
                  language="text"
                  className="mt-2"
                />
              </DocsCallout>

              <DocsCallout
                variant="info"
                title={t('config.explain.cycleSource2Title')}
              >
                {t('config.explain.cycleSource2Desc')}
                <DocsCodeBlock
                  code="minIntervalMinutes: 5 – 120"
                  language="text"
                  className="mt-2"
                />
              </DocsCallout>

              {/* Combined formula */}
              <DocsSectionHeader id="cycle-formula" level="h3">
                {t('config.explain.cycleCombined')}
              </DocsSectionHeader>
              <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
                {t('config.explain.cycleCombinedDesc')}
              </p>
              <DocsCodeBlock
                code={t('config.explain.cycleFormula')}
                language="text"
                className="mb-5"
              />

              {/* Examples */}
              <DocsTable
                headers={[
                  t('docs.scenario', 'Scenario'),
                  t('docs.result', 'Result'),
                ]}
                rows={[
                  [
                    t('config.explain.cycleExample1').split('→')[0]?.trim(),
                    `→ ${t('config.explain.cycleExample1').split('→')[1]?.trim()}`,
                  ],
                  [
                    t('config.explain.cycleExample2').split('→')[0]?.trim(),
                    `→ ${t('config.explain.cycleExample2').split('→')[1]?.trim()}`,
                  ],
                  [
                    t('config.explain.cycleExample3').split('→')[0]?.trim(),
                    `→ ${t('config.explain.cycleExample3').split('→')[1]?.trim()}`,
                  ],
                ]}
                className="mb-5"
              />

              {/* Notes */}
              <DocsCallout variant="tip">
                {t('config.explain.cycleTip')}
              </DocsCallout>
              <DocsCallout variant="info">
                {t('config.explain.cycleLlmNote')}
              </DocsCallout>
            </section>

            <section id="agent-presets" data-section className="help-section">
              <DocsSectionHeader
                id="agent-presets"
                icon={<Sliders className="h-5 w-5" />}
              >
                {t('help.agentPresets')}
              </DocsSectionHeader>
              <div className="rounded-2xl bg-card p-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.presetsTitle')}
                </h3>
                <StrategyPresets t={t} />
              </div>
            </section>

            <section id="agent-params" data-section className="help-section">
              <DocsSectionHeader
                id="agent-params"
                icon={<BookOpen className="h-5 w-5" />}
              >
                {t('help.agentParams')}
              </DocsSectionHeader>
              <div className="rounded-2xl bg-card p-5">
                <h3 className="mb-3 text-sm font-bold">
                  {t('config.guide.paramTitle')}
                </h3>
                <ParameterCards t={t} />
              </div>
            </section>

            <section
              id="config-concepts-thresholds"
              data-section
              className="help-section"
            >
              <ExplainPanel t={t} conceptId="threshold" />
            </section>

            <section
              id="config-concepts-sl"
              data-section
              className="help-section"
            >
              <ExplainPanel t={t} conceptId="sl" />
            </section>

            <section
              id="config-concepts-capital"
              data-section
              className="help-section"
            >
              <ExplainPanel t={t} conceptId="capital" />
            </section>

            <section
              id="config-concepts-interval"
              data-section
              className="help-section"
            >
              <ExplainPanel t={t} conceptId="interval" />
            </section>

            <section
              id="config-concepts-offset"
              data-section
              className="help-section"
            >
              <ExplainPanel t={t} conceptId="offset" />
            </section>

            {/* ── Trade Execution Flow ─────────────────────────────────── */}
            <section id="trade-execution" data-section className="help-section">
              <DocsSectionHeader
                id="trade-execution"
                icon={<GitFork className="h-5 w-5" />}
              >
                {t('config.guide.tradeExecTitle')}
              </DocsSectionHeader>
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                {t('config.guide.tradeExecSubtitle')}
              </p>

              {/* Priority table */}
              <DocsSectionHeader id="trade-priority" level="h3">
                {t('config.guide.tradeExecPriorityLabel')}
              </DocsSectionHeader>
              <DocsTable
                headers={['#', t('docs.priority', 'Priority')]}
                rows={[
                  ['1', t('config.guide.tradeExecPriority1')],
                  ['2', t('config.guide.tradeExecPriority2')],
                  ['3', t('config.guide.tradeExecPriority3')],
                ]}
                className="mb-6"
              />

              {/* BUY flow */}
              <DocsSectionHeader id="trade-buy" level="h3">
                {t('config.guide.tradeExecBuyTitle')}
              </DocsSectionHeader>
              <DocsSteps
                steps={[
                  { title: t('config.guide.tradeExecBuyStep1') },
                  { title: t('config.guide.tradeExecBuyStep2') },
                  { title: t('config.guide.tradeExecBuyStep3') },
                  { title: t('config.guide.tradeExecBuyStep4') },
                  { title: t('config.guide.tradeExecBuyStep5') },
                ]}
                className="mb-6"
              />

              {/* SELL flow — 3 paths */}
              <DocsSectionHeader id="trade-sell" level="h3">
                {t('config.guide.tradeExecSellTitle')}
              </DocsSectionHeader>
              <DocsCallout
                variant="tip"
                title={t('config.guide.tradeExecSell1Title')}
              >
                {t('config.guide.tradeExecSell1Desc')}
              </DocsCallout>
              <DocsCallout
                variant="warning"
                title={t('config.guide.tradeExecSell2Title')}
              >
                {t('config.guide.tradeExecSell2Desc')}
              </DocsCallout>
              <DocsCallout
                variant="danger"
                title={t('config.guide.tradeExecSell3Title')}
              >
                {t('config.guide.tradeExecSell3Desc')}
              </DocsCallout>

              {/* Examples */}
              <DocsSectionHeader id="trade-examples" level="h3">
                {t('config.guide.tradeExecExampleTitle')}
              </DocsSectionHeader>
              <DocsTable
                headers={[
                  t('docs.parameter', 'Parameter'),
                  t('docs.value', 'Value'),
                ]}
                rows={[
                  [t('config.guide.tradeExecExampleBuy'), '70%'],
                  [t('config.guide.tradeExecExampleSell'), '70%'],
                  [t('config.guide.tradeExecExampleMinProfit'), '0.3%'],
                  [t('config.guide.tradeExecExampleTP'), '5%'],
                  [t('config.guide.tradeExecExampleSL'), '3%'],
                ]}
                className="mb-4"
              />
              <DocsCallout
                variant="tip"
                title={t('config.guide.tradeExecExample1Title')}
              >
                {t('config.guide.tradeExecExample1Desc')}
              </DocsCallout>
              <DocsCallout
                variant="info"
                title={t('config.guide.tradeExecExample2Title')}
              >
                {t('config.guide.tradeExecExample2Desc')}
              </DocsCallout>

              {/* Manual close + note */}
              <DocsCallout
                variant="info"
                title={t('config.guide.tradeExecManualTitle')}
              >
                {t('config.guide.tradeExecManualDesc')}
              </DocsCallout>
              <DocsCallout variant="tip">
                {t('config.guide.tradeExecNoteTitle')}:{' '}
                {t('config.guide.tradeExecNoteDesc')}
              </DocsCallout>
            </section>

            {/* ── Binance Integration ──────────────────────────────────── */}
            <section
              id="binance-integration"
              data-section
              className="help-section"
            >
              <DocsSectionHeader
                id="binance-integration"
                icon={<BarChart2 className="h-5 w-5" />}
              >
                {t('help.binanceIntegrationTitle')}
              </DocsSectionHeader>
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                {t('help.binanceIntegration.subtitle')}
              </p>

              {/* ── Mercado Spot ── */}
              <DocsCallout
                variant="info"
                title={t('help.binanceIntegration.marketTitle')}
              >
                <DocsBadge variant="info" className="mr-2">
                  SPOT
                </DocsBadge>
                {t('help.binanceIntegration.marketDesc')}
              </DocsCallout>

              {/* ── Pares soportados ── */}
              <DocsSectionHeader id="binance-pairs" level="h3">
                {t('help.binanceIntegration.pairsTitle')}
              </DocsSectionHeader>
              <DocsTable
                headers={[t('docs.pair', 'Pair'), t('docs.symbol', 'Symbol')]}
                rows={[
                  ['BTC / USDT', 'BTCUSDT'],
                  ['BTC / USDC', 'BTCUSDC'],
                  ['ETH / USDT', 'ETHUSDT'],
                  ['ETH / USDC', 'ETHUSDC'],
                ]}
                className="mb-5"
              />

              {/* ── Orders ── */}
              <DocsSectionHeader id="binance-orders" level="h3">
                {t('help.binanceIntegration.ordersTitle')}
              </DocsSectionHeader>
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                <DocsBadge variant="info" className="mr-2">
                  MARKET ORDER
                </DocsBadge>
                {t('help.binanceIntegration.ordersDesc')}
              </p>

              {/* ── SANDBOX vs LIVE ── */}
              <DocsSectionHeader id="binance-modes" level="h3">
                {t('help.binanceIntegration.modesTitle')}
              </DocsSectionHeader>
              <DocsCallout
                variant="warning"
                title={t('help.binanceIntegration.sandboxTitle')}
              >
                {t('help.binanceIntegration.sandboxDesc')}
              </DocsCallout>
              <DocsCallout
                variant="tip"
                title={t('help.binanceIntegration.liveTitle')}
              >
                {t('help.binanceIntegration.liveDesc')}
              </DocsCallout>

              {/* ── Comisiones ── */}
              <DocsSectionHeader id="binance-fees" level="h3">
                {t('help.binanceIntegration.feesTitle')}
              </DocsSectionHeader>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                {t('help.binanceIntegration.feesDesc')}
              </p>

              {/* Fórmulas */}
              <DocsCodeBlock
                code={`${t('help.binanceIntegration.feesEntry')}: ${t('help.binanceIntegration.feesEntryFormula')}\n${t('help.binanceIntegration.feesExit')}: ${t('help.binanceIntegration.feesExitFormula')}\n${t('help.binanceIntegration.feesNetFormula')}`}
                language="text"
                title={t('docs.formulas', 'Formulas')}
                className="mb-5"
              />

              {/* Fee example table */}
              <DocsSectionHeader id="binance-fees-example" level="h3">
                {t('help.binanceIntegration.feesExampleTitle')}
              </DocsSectionHeader>
              <p className="mb-3 text-sm text-muted-foreground">
                {t('help.binanceIntegration.feesExampleSetup')}
              </p>
              <DocsTable
                headers={[
                  t('docs.concept', 'Concept'),
                  t('docs.formula', 'Formula'),
                  t('docs.value', 'Value'),
                ]}
                rows={[
                  [
                    t('help.binanceIntegration.feesTableGrossPnl'),
                    '(87.000 − 85.000) × 0,01',
                    '+$20,00',
                  ],
                  [
                    t('help.binanceIntegration.feesTableEntryFee'),
                    '85.000 × 0,01 × 0,001',
                    '−$0,85',
                  ],
                  [
                    t('help.binanceIntegration.feesTableExitFee'),
                    '87.000 × 0,01 × 0,001',
                    '−$0,87',
                  ],
                  [t('help.binanceIntegration.feesTableNetPnl'), '', '+$18,28'],
                ]}
                variant="overview"
                className="mb-4"
              />

              <DocsCallout variant="tip">
                {t('help.binanceIntegration.feesBnbNote')}
              </DocsCallout>

              {/* ── Seguridad ── */}
              <DocsSectionHeader id="binance-security" level="h3">
                {t('help.binanceIntegration.securityTitle')}
              </DocsSectionHeader>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('help.binanceIntegration.securityDesc')}
              </p>
              <DocsSteps
                steps={[
                  { title: t('help.binanceIntegration.securityStep1') },
                  { title: t('help.binanceIntegration.securityStep2') },
                  { title: t('help.binanceIntegration.securityStep3') },
                  { title: t('help.binanceIntegration.securityStep4') },
                ]}
                className="mb-5"
              />

              {/* ── Permisos ── */}
              <DocsSectionHeader id="binance-permissions" level="h3">
                {t('help.binanceIntegration.permissionsTitle')}
              </DocsSectionHeader>
              <DocsTable
                headers={[
                  t('docs.permission', 'Permission'),
                  t('docs.status', 'Status'),
                ]}
                rows={[
                  [t('help.binanceIntegration.permissionRead'), '✅'],
                  [t('help.binanceIntegration.permissionSpot'), '✅'],
                  [t('help.binanceIntegration.permissionNoWithdraw'), '❌'],
                ]}
                className="mb-4"
              />
              <DocsCallout variant="info">
                {t('help.binanceIntegration.minProfitNote')}
              </DocsCallout>
            </section>

            {/* ── Operation Modes ──────────────────────────────────────── */}
            <section id="operation-modes" data-section className="help-section">
              <DocsSectionHeader
                id="operation-modes"
                icon={<Radio className="h-5 w-5" />}
              >
                {t('help.operationModesTitle', 'Operation Modes')}
              </DocsSectionHeader>
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t(
                  'help.operationModesDesc',
                  'The platform supports three operation modes. Each mode changes how the trading engine executes orders.',
                )}
              </p>

              <div className="grid gap-4 sm:grid-cols-3 mb-5">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-400">
                      SANDBOX
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'help.operationModes.sandboxDesc',
                      'Simulated trading with virtual balance ($10,000 default). No real orders placed. Perfect for testing strategies.',
                    )}
                  </p>
                  <div className="mt-3">
                    <DocsBadge variant="warning">No API keys needed</DocsBadge>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <h4 className="text-sm font-bold text-blue-400">TESTNET</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'help.operationModes.testnetDesc',
                      'Connects to Binance Testnet API. Real order flow with fake funds. Validates API integration without financial risk.',
                    )}
                  </p>
                  <div className="mt-3">
                    <DocsBadge variant="info">
                      Testnet API keys required
                    </DocsBadge>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Play className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-emerald-400">LIVE</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'help.operationModes.liveDesc',
                      'Real trading with real funds on Binance. Market orders are executed instantly. Use with caution.',
                    )}
                  </p>
                  <div className="mt-3">
                    <DocsBadge variant="danger">Real money at risk</DocsBadge>
                  </div>
                </div>
              </div>

              <DocsCallout
                variant="warning"
                title={t('help.operationModes.warningTitle', 'Mode switching')}
              >
                {t(
                  'help.operationModes.warningDesc',
                  'Switching from SANDBOX/TESTNET to LIVE requires Binance API keys with Spot trading permissions. All open sandbox positions are preserved but paused.',
                )}
              </DocsCallout>
            </section>

            {/* ── LLM Providers ────────────────────────────────────────── */}
            <section id="llm-providers" data-section className="help-section">
              <DocsSectionHeader
                id="llm-providers"
                icon={<Cpu className="h-5 w-5" />}
              >
                {t('help.llmProvidersTitle', 'LLM Providers')}
              </DocsSectionHeader>
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {t(
                  'help.llmProvidersDesc',
                  'Each agent can be powered by a different LLM provider. OpenRouter is the recommended default — it gives access to 300+ models from a single API key.',
                )}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                {[
                  {
                    name: 'OpenRouter',
                    badge: 'Recommended',
                    badgeVariant: 'success' as const,
                    desc: t(
                      'help.llmProviders.openrouterDesc',
                      '300+ models, single API key. Free models available.',
                    ),
                  },
                  {
                    name: 'Claude (Anthropic)',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.claudeDesc',
                      'Claude models via Anthropic API.',
                    ),
                  },
                  {
                    name: 'OpenAI',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.openaiDesc',
                      'GPT-4o, GPT-4 Turbo, and more.',
                    ),
                  },
                  {
                    name: 'Groq',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.groqDesc',
                      'Ultra-fast inference with Llama, Mixtral.',
                    ),
                  },
                  {
                    name: 'Gemini',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.geminiDesc',
                      'Google Gemini models.',
                    ),
                  },
                  {
                    name: 'Mistral',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.mistralDesc',
                      'Mistral AI models.',
                    ),
                  },
                  {
                    name: 'Together',
                    badge: 'Direct',
                    badgeVariant: 'default' as const,
                    desc: t(
                      'help.llmProviders.togetherDesc',
                      'Open-source model hosting.',
                    ),
                  },
                ].map(({ name, badge, badgeVariant, desc }) => (
                  <div
                    key={name}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-bold">{name}</h4>
                      <DocsBadge variant={badgeVariant}>{badge}</DocsBadge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>

              <DocsCallout
                variant="tip"
                title={t('help.llmProviders.tipTitle', 'Smart Presets')}
              >
                {t(
                  'help.llmProviders.tipDesc',
                  'Use the preset system (Free / Balanced / Optimized) to auto-assign recommended models to all agents at once. Each preset selects the best model per agent role.',
                )}
              </DocsCallout>

              {/* Recommended models table */}
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">
                  {t(
                    'help.llmProviders.recommendedTitle',
                    'Recommended Models by Agent',
                  )}
                </h3>
                <DocsTable
                  variant="overview"
                  headers={[
                    t('help.llmProviders.tableAgent', 'Agent'),
                    t('help.llmProviders.tableFree', 'Free'),
                    t('help.llmProviders.tableBalanced', 'Balanced'),
                    t('help.llmProviders.tableOptimized', 'Optimized'),
                  ]}
                  rows={[
                    [
                      'KRYPTO (routing)',
                      'google/gemma-4-26b-a4b-it:free',
                      'qwen/qwen3.5-9b',
                      'deepseek/deepseek-v4-flash',
                    ],
                    [
                      'KRYPTO (orchestrator)',
                      'nvidia/nemotron-3-super-120b-a12b:free',
                      'deepseek/deepseek-v4-flash',
                      'moonshotai/kimi-k2.6',
                    ],
                    [
                      'KRYPTO (synthesis)',
                      'nvidia/nemotron-3-super-120b-a12b:free',
                      'deepseek/deepseek-v4-pro',
                      'moonshotai/kimi-k2.6',
                    ],
                    [
                      'NEXUS (platform)',
                      'google/gemma-4-31b-it:free',
                      'qwen/qwen3.5-35b-a3b',
                      'deepseek/deepseek-v4-flash',
                    ],
                    [
                      'FORGE (operations)',
                      'qwen/qwen3-next-80b-a3b-instruct:free',
                      'deepseek/deepseek-v4-flash',
                      'qwen/qwen3.6-plus',
                    ],
                    [
                      'SIGMA (market)',
                      'nvidia/nemotron-3-super-120b-a12b:free',
                      'deepseek/deepseek-v4-flash',
                      'deepseek/deepseek-v4-pro',
                    ],
                    [
                      'CIPHER (blockchain)',
                      'minimax/minimax-m2.5:free',
                      'minimax/minimax-m2.7',
                      'qwen/qwen3.6-plus',
                    ],
                    [
                      'AEGIS (risk)',
                      'nvidia/nemotron-3-super-120b-a12b:free',
                      'deepseek/deepseek-v4-pro',
                      'moonshotai/kimi-k2.6',
                    ],
                  ]}
                />
              </div>
            </section>

            {/* ── API Keys ─────────────────────────────────────────────── */}
            <section id="api-keys" data-section className="help-section">
              <DocsSectionHeader
                id="api-keys"
                icon={<Key className="h-5 w-5" />}
              >
                {t('help.apiKeys')}
              </DocsSectionHeader>

              <div className="space-y-5">
                {/* OpenRouter (recommended first) */}
                <div
                  id="openrouter"
                  data-section
                  className="rounded-xl bg-card p-5 border border-emerald-500/20"
                >
                  <h3 className="mb-3 font-semibold flex items-center gap-2">
                    OpenRouter
                    <DocsBadge variant="success">Recommended</DocsBadge>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      openrouter.ai/keys <ExternalLink className="h-3 w-3" />
                    </a>
                  </h3>
                  <DocsSteps
                    steps={[
                      {
                        title: t(
                          'help.openrouterStep1',
                          'Create an account at openrouter.ai',
                        ),
                      },
                      {
                        title: t(
                          'help.openrouterStep2',
                          'Go to Keys → Create Key',
                        ),
                      },
                      {
                        title: t(
                          'help.openrouterStep3',
                          'Copy the key (starts with sk-or-)',
                        ),
                      },
                      {
                        title: t(
                          'help.openrouterStep4',
                          'Paste in Settings → LLM Providers → OpenRouter',
                        ),
                      },
                    ]}
                  />
                  <div className="mt-3">
                    <DocsCodeBlock
                      code="sk-or-v1-XXXXXXXXXXXXXXXXXXXX"
                      language="text"
                    />
                  </div>
                  <DocsCallout
                    variant="tip"
                    title={t('help.openrouterTip', 'Free models available')}
                  >
                    {t(
                      'help.openrouterTipDesc',
                      'Many models on OpenRouter are free. Use the "Free" preset to configure all agents with $0 cost models.',
                    )}
                  </DocsCallout>
                </div>

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
                  <DocsSteps
                    steps={[
                      { title: t('help.binanceStep1') },
                      { title: t('help.binanceStep2') },
                      { title: t('help.binanceStep3') },
                      { title: t('help.binanceStep4') },
                    ]}
                  />
                  <DocsCallout variant="warning" className="mt-3">
                    {t('help.binanceWarning')}
                  </DocsCallout>
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
                  <DocsSteps
                    steps={[
                      { title: t('help.claudeStep1') },
                      { title: t('help.claudeStep2') },
                      { title: t('help.claudeStep3') },
                    ]}
                  />
                  <div className="mt-3">
                    <DocsCodeBlock
                      code="sk-ant-api03-XXXXXXXXXXXXXXXXXXXX"
                      language="text"
                    />
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
                  <DocsSteps
                    steps={[
                      { title: t('help.openaiStep1') },
                      { title: t('help.openaiStep2') },
                      { title: t('help.openaiStep3') },
                    ]}
                  />
                  <div className="mt-3">
                    <DocsCodeBlock
                      code="sk-proj-XXXXXXXXXXXXXXXXXXXX"
                      language="text"
                    />
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
                  <DocsSteps
                    steps={[
                      { title: t('help.groqStep1') },
                      { title: t('help.groqStep2') },
                      { title: t('help.groqStep3') },
                    ]}
                  />
                  <div className="mt-3">
                    <DocsCodeBlock
                      code="gsk_XXXXXXXXXXXXXXXXXXXX"
                      language="text"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Page Feedback ─────────────────────────────────────────── */}
            <DocsPageFeedback />
          </div>
        </div>
      </div>
    </div>
  );
}
