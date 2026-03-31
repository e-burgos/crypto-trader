import { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Bot,
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// ── Feature Card ─────────────────────────────────────────────────────────────
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <div className={cn(
      'feature-card rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
      className,
    )}>
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ── Stat Badge ────────────────────────────────────────────────────────────────
function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-badge text-center">
      <div className="text-3xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Hero animations
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.hero-badge', { opacity: 0, y: -20, duration: 0.6 })
      .from('.hero-title', { opacity: 0, y: 40, duration: 0.8 }, '-=0.3')
      .from('.hero-subtitle', { opacity: 0, y: 30, duration: 0.7 }, '-=0.5')
      .from('.hero-cta', { opacity: 0, y: 20, duration: 0.6, stagger: 0.15 }, '-=0.4')
      .from('.hero-glow', { opacity: 0, scale: 0.8, duration: 1.2 }, '-=0.8');
  }, { scope: heroRef });

  // Feature cards scroll animation
  useGSAP(() => {
    gsap.from('.feature-card', {
      opacity: 0,
      y: 50,
      duration: 0.7,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: featuresRef.current,
        start: 'top 80%',
      },
    });
  }, { scope: featuresRef });

  // Stats scroll animation
  useGSAP(() => {
    gsap.from('.stat-badge', {
      opacity: 0,
      scale: 0.8,
      duration: 0.6,
      stagger: 0.1,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: statsRef.current,
        start: 'top 80%',
      },
    });
  }, { scope: statsRef });

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-32 text-center">
        {/* Background glow */}
        <div className="hero-glow pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        </div>

        {/* Badge */}
        <div className="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Zap className="h-3.5 w-3.5" />
          AI-Powered Crypto Trading
        </div>

        {/* Title */}
        <h1 className="hero-title mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Trade Smarter with{' '}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            AI Agents
          </span>
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Automate your crypto trading strategy with intelligent AI agents. Real-time analysis,
          risk management, and paper trading to master the markets.
        </p>

        {/* CTAs */}
        <div className="hero-cta mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/register">
            <Button size="lg" className="gap-2 px-8">
              Start Trading <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="https://github.com/e-burgos/crypto-trader" target="_blank" rel="noreferrer">
            <Button variant="outline" size="lg" className="gap-2 px-8">
              View on GitHub
            </Button>
          </a>
        </div>

        {/* Disclaimer */}
        <p className="hero-cta mt-6 text-xs text-muted-foreground/60">
          Free to use. Paper trading mode available. No financial advice.
        </p>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="border-y border-border/40 bg-muted/20 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-4 sm:grid-cols-4">
          <StatBadge value="50+" label="Trading Pairs" />
          <StatBadge value="3" label="AI Providers" />
          <StatBadge value="99.9%" label="Uptime" />
          <StatBadge value="Paper" label="Risk-free Mode" />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section ref={featuresRef} className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to trade smarter
          </h2>
          <p className="mt-4 text-muted-foreground">
            Powered by Claude, OpenAI, and Groq — your AI trading team never sleeps.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Bot className="h-6 w-6" />}
            title="AI Trading Agents"
            description="Autonomous agents analyze markets and execute trades using Claude, OpenAI, or Groq LLMs."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Technical Analysis"
            description="RSI, MACD, Bollinger Bands, EMA, ATR — comprehensive indicators powered in real time."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Risk Management"
            description="Stop-loss, take-profit, position sizing, and a kill-switch to protect your capital."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Paper Trading"
            description="Test your strategies risk-free with simulated trading before going live."
          />
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[300px] w-[600px] rounded-full bg-primary/8 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to automate your trading?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join traders using AI to navigate volatile crypto markets with confidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gap-2 px-8">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© 2024 CryptoTrader. For educational purposes only.</p>
          <p>Trading cryptocurrencies involves substantial risk of loss.</p>
        </div>
      </footer>
    </div>
  );
}
