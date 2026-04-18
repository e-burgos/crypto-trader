import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Bot,
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
  TrendingUp,
  Activity,
  Brain,
  Globe,
  Target,
  Lock,
  RefreshCw,
  BarChart2,
  Sparkles,
  GitFork,
  HelpCircle,
  UserPlus,
  LogIn,
  Play,
  FlaskConical,
  Radio,
} from 'lucide-react';
import { Button } from '@crypto-trader/ui';
import { cn } from '../lib/utils';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// ── Sparkline ─────────────────────────────────────────────────────────────────
function SparklineChart() {
  return (
    <svg
      viewBox="0 0 100 32"
      className="h-8 w-full fill-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.35 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0 }}
          />
        </linearGradient>
      </defs>
      <path
        d="M0,28 L10,26 L20,24 L28,20 L36,22 L46,17 L54,14 L62,12 L70,9 L78,6 L88,4 L100,1 L100,32 L0,32 Z"
        fill="url(#sparkGrad)"
      />
      <path
        d="M0,28 L10,26 L20,24 L28,20 L36,22 L46,17 L54,14 L62,12 L70,9 L78,6 L88,4 L100,1"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Agent Dashboard Card ───────────────────────────────────────────────────────
function TradeRow({
  symbol,
  action,
  amount,
  change,
  positive,
}: {
  symbol: string;
  action: 'BUY' | 'SELL';
  amount: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-4 w-8 items-center justify-center rounded text-[9px] font-bold',
            positive
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {action}
        </span>
        <span className="font-mono text-xs font-semibold">{symbol}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">
          {amount}
        </span>
        <span
          className={cn(
            'font-mono text-xs font-bold',
            positive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {positive ? '+' : ''}
          {change}
        </span>
      </div>
    </div>
  );
}

function AgentDashboardCard() {
  return (
    <div className="agent-card relative w-full max-w-sm">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/40 via-primary/10 to-transparent blur-sm" />
      <div className="relative rounded-2xl border border-border/80 bg-card/95 p-5 shadow-2xl shadow-primary/10 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                AI Trading Agent
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Powered by Esteban Burgos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="landing-status-blink h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-bold text-emerald-400">
              ACTIVE
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 p-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Portfolio Today
          </p>
          <div className="flex items-end justify-between">
            <span className="font-mono text-2xl font-extrabold text-foreground">
              +$2,847
            </span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">
                +4.18%
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent Trades
          </p>
          <div className="divide-y divide-border/30">
            <TradeRow
              symbol="BTC/USDT"
              action="BUY"
              amount="0.0025 BTC"
              change="2.47%"
              positive
            />
            <TradeRow
              symbol="ETH/USDT"
              action="SELL"
              amount="0.15 ETH"
              change="-0.63%"
              positive={false}
            />
            <TradeRow
              symbol="BTC/USDC"
              action="BUY"
              amount="0.001 BTC"
              change="1.82%"
              positive
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            7-Day Performance
          </p>
          <SparklineChart />
        </div>
      </div>
    </div>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────────
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

function FeatureCard({ icon, title, description, badge }: FeatureCardProps) {
  return (
    <div className="feat-card group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/8">
      <div className="pointer-events-none absolute inset-0 -z-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {badge && (
        <span className="relative mb-4 inline-block self-start rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          {badge}
        </span>
      )}
      <div className="relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="relative mb-2 text-base font-bold text-foreground">
        {title}
      </h3>
      <p className="relative text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ── Provider Card ─────────────────────────────────────────────────────────────
function ProviderCard({
  name,
  description,
  highlight,
}: {
  name: string;
  description: string;
  highlight: string;
}) {
  return (
    <div className="provider-card flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-base font-bold text-foreground">{name}</div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
          {highlight}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ── Agent Profile Card ────────────────────────────────────────────────────────
function AgentProfileCard({
  codename,
  role,
  description,
  icon,
  color,
}: {
  codename: string;
  role: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="agent-profile-card group relative flex flex-col items-center text-center rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div
        className={cn(
          'mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform duration-300 group-hover:scale-110',
          color,
        )}
      >
        {icon}
      </div>
      <h3 className="mb-1 font-mono text-lg font-extrabold tracking-wider text-foreground">
        {codename}
      </h3>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
        {role}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ── Mode Card ─────────────────────────────────────────────────────────────────
function ModeCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="mode-card group relative flex flex-col items-center text-center rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div
        className={cn(
          'mb-5 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
          accent,
        )}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ── Process Step ──────────────────────────────────────────────────────────────
function ProcessStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="process-step relative flex flex-col items-center text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full border border-primary/15" />
        <div className="absolute inset-3 rounded-full bg-primary/8" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary shadow-lg shadow-primary/10">
          {icon}
        </div>
        <div className="proc-number absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground shadow-md shadow-primary/25">
          {number}
        </div>
      </div>
      <h3 className="mb-3 text-xl font-bold text-foreground">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export function LandingPage() {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const agentsRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // ─ Hero entrance
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-eyebrow', { opacity: 0, y: -24, duration: 0.7 })
        .from(
          '.hero-headline',
          { opacity: 0, y: 50, duration: 1, ease: 'power4.out' },
          '-=0.4',
        )
        .from('.hero-sub', { opacity: 0, y: 24, duration: 0.8 }, '-=0.6')
        .from('.hero-actions', { opacity: 0, y: 20, duration: 0.6 }, '-=0.5')
        .from('.hero-meta', { opacity: 0, duration: 0.6 }, '-=0.4')
        .from(
          '.agent-card',
          { opacity: 0, x: 60, duration: 0.9, ease: 'power3.out' },
          '-=0.9',
        )
        .from(
          '.hero-glow-bg',
          { opacity: 0, scale: 0.7, duration: 1.5, ease: 'power2.out' },
          0,
        );
    },
    { scope: heroRef },
  );

  // ─ Process: steps stagger + connector line draw
  useGSAP(
    () => {
      gsap.from(['.proc-eyebrow', '.proc-title'], {
        opacity: 0,
        y: 24,
        duration: 0.7,
        stagger: 0.12,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: processRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      // connector line: scale from 0 to 1 horizontally
      gsap.from('.proc-connector-line', {
        scaleX: 0,
        duration: 1.4,
        ease: 'power2.inOut',
        transformOrigin: 'left center',
        immediateRender: false,
        scrollTrigger: {
          trigger: processRef.current,
          start: 'top 80%',
          once: true,
        },
      });
      // steps: fade in + rise, staggered
      gsap.from('.process-step', {
        opacity: 0,
        y: 50,
        duration: 0.75,
        stagger: 0.2,
        ease: 'back.out(1.4)',
        immediateRender: false,
        scrollTrigger: {
          trigger: processRef.current,
          start: 'top 80%',
          once: true,
        },
      });
      // number badges: scale bounce after step fades in
      gsap.from('.proc-number', {
        scale: 0,
        duration: 0.5,
        stagger: 0.2,
        ease: 'back.out(2)',
        delay: 0.4,
        immediateRender: false,
        scrollTrigger: {
          trigger: processRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    },
    { scope: processRef },
  );

  // ─ Features
  useGSAP(
    () => {
      gsap.from(['.feat-eyebrow', '.feat-title', '.feat-sub'], {
        opacity: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: featuresRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      gsap.from('.feat-card', {
        opacity: 0,
        y: 40,
        duration: 0.65,
        stagger: 0.1,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: featuresRef.current,
          start: 'top 85%',
          once: true,
        },
      });
    },
    { scope: featuresRef },
  );

  // ─ Stats
  useGSAP(
    () => {
      gsap.from('.stat-item', {
        opacity: 0,
        scale: 0.8,
        duration: 0.55,
        stagger: 0.1,
        ease: 'back.out(1.6)',
        immediateRender: false,
        scrollTrigger: {
          trigger: statsRef.current,
          start: 'top 85%',
          once: true,
        },
      });
    },
    { scope: statsRef },
  );

  // ─ Providers
  useGSAP(
    () => {
      gsap.from(['.prov-eyebrow', '.prov-title', '.prov-sub'], {
        opacity: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: providersRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      gsap.from('.provider-card', {
        opacity: 0,
        y: 35,
        duration: 0.65,
        stagger: 0.15,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: providersRef.current,
          start: 'top 85%',
          once: true,
        },
      });
    },
    { scope: providersRef },
  );

  // ─ Agents
  useGSAP(
    () => {
      gsap.from(['.agents-eyebrow', '.agents-title', '.agents-sub'], {
        opacity: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: agentsRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      gsap.from('.agent-profile-card', {
        opacity: 0,
        y: 45,
        duration: 0.7,
        stagger: 0.12,
        ease: 'back.out(1.4)',
        immediateRender: false,
        scrollTrigger: {
          trigger: agentsRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    },
    { scope: agentsRef },
  );

  // ─ Trading Modes
  useGSAP(
    () => {
      gsap.from(['.modes-eyebrow', '.modes-title', '.modes-sub'], {
        opacity: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: modesRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      gsap.from('.mode-card', {
        opacity: 0,
        y: 40,
        duration: 0.7,
        stagger: 0.15,
        ease: 'back.out(1.4)',
        immediateRender: false,
        scrollTrigger: {
          trigger: modesRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    },
    { scope: modesRef },
  );

  // ─ Risk section
  useGSAP(
    () => {
      gsap.from(['.risk-eyebrow', '.risk-title'], {
        opacity: 0,
        y: 18,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: riskRef.current,
          start: 'top 85%',
          once: true,
        },
      });
      gsap.from('.risk-card', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.12,
        ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: riskRef.current,
          start: 'top 85%',
          once: true,
        },
      });
    },
    { scope: riskRef },
  );

  // ─ CTA
  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ctaRef.current,
          start: 'top 85%',
          once: true,
        },
        defaults: { ease: 'power2.out', immediateRender: false },
      });
      tl.from('.cta-headline', { opacity: 0, y: 28, duration: 0.7 })
        .from('.cta-sub', { opacity: 0, y: 16, duration: 0.6 }, '-=0.4')
        .from('.cta-actions', { opacity: 0, y: 14, duration: 0.5 }, '-=0.3')
        .from('.cta-disclaimer', { opacity: 0, duration: 0.5 }, '-=0.2');
    },
    { scope: ctaRef },
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ════════════════════════════════════════════ HERO ════════════════ */}
      <section
        ref={heroRef}
        className="relative flex min-h-[calc(100dvh-110px)] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-16 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-12 xl:px-24"
      >
        <div
          className="hero-glow-bg pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--primary)/0.12) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute -z-10 right-0 top-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[130px]" />
        <div className="pointer-events-none absolute -z-10 bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-primary/6 blur-[100px]" />

        {/* Left copy */}
        <div className="z-10 max-w-xl text-center lg:text-left">
          <div className="hero-eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
            <span className="landing-status-blink h-1.5 w-1.5 rounded-full bg-primary" />
            {t('landing.badge')}
          </div>

          <h1 className="hero-headline mb-6 text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.5rem] xl:text-[5.5rem]">
            {t('landing.headline1')}
            <br />
            <span className="text-primary">{t('landing.headline2')}</span>{' '}
            {t('landing.headline3')}
          </h1>

          <p className="hero-sub mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl lg:max-w-none">
            {t('landing.sub')}
          </p>

          <div className="hero-actions flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <Link to="/register">
              <Button
                size="lg"
                className="gap-2 px-8 text-base font-semibold shadow-lg shadow-primary/25"
              >
                {t('landing.startFree')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 px-8 text-base border-border/70"
              >
                {t('nav.signIn')}
              </Button>
            </Link>
          </div>

          <div className="hero-meta mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
            {[
              {
                icon: <Zap className="h-3.5 w-3.5 text-primary" />,
                label: t('landing.badge1'),
              },
              {
                icon: <ShieldCheck className="h-3.5 w-3.5 text-primary" />,
                label: t('landing.badge2'),
              },
              {
                icon: <Bot className="h-3.5 w-3.5 text-primary" />,
                label: t('landing.badge3'),
              },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: agent card */}
        <div className="z-10 mt-12 w-full max-w-sm shrink-0 landing-float lg:mt-0">
          <AgentDashboardCard />
        </div>
      </section>

      {/* ═══════════════════════════════════════════ STATS ════════════════ */}
      <section
        ref={statsRef}
        className="relative border-y border-border/40 bg-muted/30 py-14 px-6"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="h-[180px] w-[700px] rounded-full bg-primary/5 blur-[80px]" />
        </div>
        <div className="relative mx-auto grid max-w-3xl grid-cols-2 gap-10 sm:grid-cols-4">
          {[
            { value: t('landing.stat1Value'), label: t('landing.stat1Label') },
            { value: t('landing.stat2Value'), label: t('landing.stat2Label') },
            { value: t('landing.stat3Value'), label: t('landing.stat3Label') },
            { value: t('landing.stat4Value'), label: t('landing.stat4Label') },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item text-center">
              <div className="mb-1 font-mono text-4xl font-extrabold text-primary sm:text-5xl">
                {value}
              </div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════ HOW IT WORKS ════════════ */}
      <section
        ref={processRef}
        className="relative overflow-hidden bg-background py-28 px-6"
      >
        {/* subtle background grid */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--primary)/0.1) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="pointer-events-none absolute -z-10 left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary/6 blur-[100px]" />

        <div className="mx-auto max-w-5xl">
          <div className="mb-20 text-center">
            <p className="proc-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.howEyebrow')}
            </p>
            <h2 className="proc-title text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('landing.howTitle')}
            </h2>
          </div>

          {/* Steps + connector */}
          <div className="relative">
            {/* Desktop connector line */}
            <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-12 hidden lg:block">
              <div className="proc-connector-line h-px w-full bg-gradient-to-r from-primary/50 via-primary/30 to-primary/50" />
              {/* Moving dot */}
              <div
                className="proc-dot absolute -top-1.5 h-3 w-3 rounded-full bg-primary shadow-sm shadow-primary/50"
                style={{
                  left: '0%',
                  animation:
                    'proc-dot-travel 3s ease-in-out 1.5s infinite alternate',
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-12">
              <ProcessStep
                number="1"
                title={t('landing.step1Title')}
                description={t('landing.step1Desc')}
                icon={<Activity className="h-7 w-7" />}
              />
              <ProcessStep
                number="2"
                title={t('landing.step2Title')}
                description={t('landing.step2Desc')}
                icon={<Brain className="h-7 w-7" />}
              />
              <ProcessStep
                number="3"
                title={t('landing.step3Title')}
                description={t('landing.step3Desc')}
                icon={<ShieldCheck className="h-7 w-7" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════ SPECIALIZED AGENTS ══════════ */}
      <section
        ref={agentsRef}
        className="relative border-t border-border/40 bg-muted/20 py-28 px-6 overflow-hidden"
      >
        <div className="pointer-events-none absolute -z-10 left-1/4 top-0 h-[350px] w-[500px] rounded-full bg-primary/6 blur-[120px]" />
        <div className="pointer-events-none absolute -z-10 right-1/4 bottom-0 h-[300px] w-[400px] rounded-full bg-primary/4 blur-[100px]" />

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="agents-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.agentsEyebrow')}
            </p>
            <h2 className="agents-title text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('landing.agentsTitle')}
            </h2>
            <p className="agents-sub mx-auto mt-4 max-w-2xl text-muted-foreground">
              {t('landing.agentsSub')}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <AgentProfileCard
              codename={t('landing.agentNexus')}
              role={t('landing.agentNexusRole')}
              description={t('landing.agentNexusDesc')}
              icon={<Brain className="h-7 w-7 text-cyan-400" />}
              color="bg-cyan-500/10 ring-cyan-500/40"
            />
            <AgentProfileCard
              codename={t('landing.agentForge')}
              role={t('landing.agentForgeRole')}
              description={t('landing.agentForgeDesc')}
              icon={<Zap className="h-7 w-7 text-orange-400" />}
              color="bg-orange-500/10 ring-orange-500/40"
            />
            <AgentProfileCard
              codename={t('landing.agentSigma')}
              role={t('landing.agentSigmaRole')}
              description={t('landing.agentSigmaDesc')}
              icon={<BarChart3 className="h-7 w-7 text-emerald-400" />}
              color="bg-emerald-500/10 ring-emerald-500/40"
            />
            <AgentProfileCard
              codename={t('landing.agentCipher')}
              role={t('landing.agentCipherRole')}
              description={t('landing.agentCipherDesc')}
              icon={<Lock className="h-7 w-7 text-violet-400" />}
              color="bg-violet-500/10 ring-violet-500/40"
            />
            <AgentProfileCard
              codename={t('landing.agentAegis')}
              role={t('landing.agentAegisRole')}
              description={t('landing.agentAegisDesc')}
              icon={<ShieldCheck className="h-7 w-7 text-amber-400" />}
              color="bg-amber-500/10 ring-amber-500/40"
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════ RISK & PROTECTION ══════════ */}
      <section
        ref={riskRef}
        className="border-t border-border/40 bg-muted/20 py-24 px-6"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="risk-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.riskEyebrow')}
            </p>
            <h2 className="risk-title text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.riskTitle')}
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <ShieldCheck className="h-5 w-5" />,
                title: t('landing.risk1Title'),
                desc: t('landing.risk1Desc'),
              },
              {
                icon: <Target className="h-5 w-5" />,
                title: t('landing.risk2Title'),
                desc: t('landing.risk2Desc'),
              },
              {
                icon: <Lock className="h-5 w-5" />,
                title: t('landing.risk3Title'),
                desc: t('landing.risk3Desc'),
              },
              {
                icon: <RefreshCw className="h-5 w-5" />,
                title: t('landing.risk4Title'),
                desc: t('landing.risk4Desc'),
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="risk-card rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
                <h3 className="mb-1.5 text-sm font-bold text-foreground">
                  {title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ FEATURES ════════════ */}
      <section
        ref={featuresRef}
        className="border-t border-border/40 bg-background py-24 px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="feat-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.featEyebrow')}
            </p>
            <h2 className="feat-title text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.featTitle')}
            </h2>
            <p className="feat-sub mx-auto mt-4 max-w-2xl text-muted-foreground">
              {t('landing.featSub')}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Bot className="h-5 w-5" />}
              title={t('landing.feat1Title')}
              description={t('landing.feat1Desc')}
              badge={t('landing.featCoreBadge')}
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title={t('landing.feat2Title')}
              description={t('landing.feat2Desc')}
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title={t('landing.feat3Title')}
              description={t('landing.feat3Desc')}
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title={t('landing.feat4Title')}
              description={t('landing.feat4Desc')}
              badge={t('landing.featFreeBadge')}
            />
            <FeatureCard
              icon={<Globe className="h-5 w-5" />}
              title={t('landing.feat5Title')}
              description={t('landing.feat5Desc')}
            />
            <FeatureCard
              icon={<BarChart2 className="h-5 w-5" />}
              title={t('landing.feat6Title')}
              description={t('landing.feat6Desc')}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════ AI PROVIDERS ════════════ */}
      <section
        ref={providersRef}
        className="border-t border-border/40 bg-muted/20 py-24 px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="prov-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.aiEyebrow')}
            </p>
            <h2 className="prov-title text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.aiTitle')}
            </h2>
            <p className="prov-sub mt-4 text-muted-foreground">
              {t('landing.aiSub')}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ProviderCard
              name={t('landing.claude')}
              description={t('landing.claudeDesc')}
              highlight={t('landing.claudeTag')}
            />
            <ProviderCard
              name={t('landing.openai')}
              description={t('landing.openaiDesc')}
              highlight={t('landing.openaiTag')}
            />
            <ProviderCard
              name={t('landing.groq')}
              description={t('landing.groqDesc')}
              highlight={t('landing.groqTag')}
            />
            <ProviderCard
              name={t('landing.gemini')}
              description={t('landing.geminiDesc')}
              highlight={t('landing.geminiTag')}
            />
            <ProviderCard
              name={t('landing.mistral')}
              description={t('landing.mistralDesc')}
              highlight={t('landing.mistralTag')}
            />
            <ProviderCard
              name={t('landing.together')}
              description={t('landing.togetherDesc')}
              highlight={t('landing.togetherTag')}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════ TRADING MODES ═══════════ */}
      <section
        ref={modesRef}
        className="bg-background relative border-t border-border/40 py-28 px-6 overflow-hidden"
      >
        <div className="pointer-events-none absolute -z-10 left-1/2 top-1/2 h-[350px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/6 blur-[110px]" />

        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="modes-eyebrow mb-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('landing.modesEyebrow')}
            </p>
            <h2 className="modes-title text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('landing.modesTitle')}
            </h2>
            <p className="modes-sub mx-auto mt-4 max-w-2xl text-muted-foreground">
              {t('landing.modesSub')}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <ModeCard
              icon={<Play className="h-7 w-7 text-emerald-400" />}
              title={t('landing.modeSandbox')}
              description={t('landing.modeSandboxDesc')}
              accent="bg-emerald-500/10"
            />
            <ModeCard
              icon={<FlaskConical className="h-7 w-7 text-blue-400" />}
              title={t('landing.modeTestnet')}
              description={t('landing.modeTestnetDesc')}
              accent="bg-blue-500/10"
            />
            <ModeCard
              icon={<Radio className="h-7 w-7 text-amber-400" />}
              title={t('landing.modeLive')}
              description={t('landing.modeLiveDesc')}
              accent="bg-amber-500/10"
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ CTA ══════════════ */}
      <section
        ref={ctaRef}
        className="relative border-t border-border/40 bg-muted/30 py-32 px-6 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[450px] w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--primary)/0.12) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />

        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {t('landing.ctaEyebrow')}
          </div>

          <h2 className="cta-headline text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t('landing.ctaTitle1')}
            <br />
            <span className="text-primary">{t('landing.ctaTitle2')}</span>
          </h2>

          <p className="cta-sub mt-5 text-lg leading-relaxed text-muted-foreground">
            {t('landing.ctaSub')}
          </p>

          <div className="cta-actions mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register">
              <Button
                size="lg"
                className="gap-2 px-10 text-base font-semibold shadow-xl shadow-primary/20"
              >
                {t('landing.ctaStart')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com/e-burgos/crypto-trader"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="lg"
                className="gap-2 px-8 text-base border-border/70"
              >
                <GitFork className="h-4 w-4" />
                {t('landing.ctaGitHub')}
              </Button>
            </a>
          </div>

          <p className="cta-disclaimer mt-6 text-xs text-muted-foreground/50">
            {t('landing.ctaDisclaimer')}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ FOOTER ══════════════ */}
      <footer className="border-t border-border/40 bg-background">
        {/* Main footer grid */}
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold text-foreground">
                  CryptoTrader
                </span>
              </div>
              <p className="mb-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t('landing.aiEyebrow')} — {t('landing.footerTagline')}
              </p>
              <div className="text-sm text-muted-foreground">
                {t('landing.footerBy')}{' '}
                <a
                  href="https://www.estebanburgos.com.ar"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                >
                  Esteban Burgos
                </a>
              </div>
            </div>

            {/* Platform features */}
            <div>
              <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                {t('landing.footerPlatformTitle')}
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  t('landing.feat1Title'),
                  t('landing.feat2Title'),
                  t('landing.feat3Title'),
                  t('landing.feat4Title'),
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary/50" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Links */}
            <div>
              <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                {t('landing.footerResourcesTitle')}
              </p>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    to="/register"
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('landing.footerSignUp')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {t('landing.footerLogin')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/help"
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {t('landing.footerHelp')}
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/e-burgos/crypto-trader"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/40 px-6 py-5">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground/60 sm:flex-row">
            <p>© {new Date().getFullYear()} CryptoTrader</p>
            <p className="text-center">{t('landing.footerDisclaimer')}</p>
            <p>
              {t('landing.footerBy')}{' '}
              <a
                href="https://www.estebanburgos.com.ar"
                target="_blank"
                rel="noreferrer"
                className="text-primary/60 transition-colors hover:text-primary"
              >
                estebanburgos.com.ar
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
