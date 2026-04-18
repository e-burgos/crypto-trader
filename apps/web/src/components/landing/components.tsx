import {
  TrendingUp,
  Activity,
  Brain,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function SparklineChart() {
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
export function TradeRow({
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

export function AgentDashboardCard() {
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
export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function FeatureCard({ icon, title, description, badge }: FeatureCardProps) {
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
export function ProviderCard({
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
export function AgentProfileCard({
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
export function ModeCard({
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
export function ProcessStep({
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

