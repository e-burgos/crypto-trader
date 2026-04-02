import { useRef, useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Key,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

const FAQ_ITEMS = [
  {
    q: '¿Qué es CryptoTrader? / What is CryptoTrader?',
    a: 'CryptoTrader is a platform that uses LLMs (Claude, OpenAI, Groq) to analyze the market and execute trades automatically on your Binance account. The agent reads market data, asks the LLM for a decision, and executes it.',
  },
  {
    q: 'Does the agent manage my real money?',
    a: 'In LIVE mode: yes, it executes real orders on Binance using your API Key and available balance. In SANDBOX mode: it simulates everything with the same logic but no real money is used. We strongly recommend starting with SANDBOX.',
  },
  {
    q: 'Is it safe to connect my Binance Keys?',
    a: 'Your API keys are encrypted with AES-256 on the backend server. They are never exposed in the UI or logs. We recommend creating keys with only "Read" + "Spot Trading" permissions — never enable withdrawals.',
  },
  {
    q: 'How do I know if the agent is operating?',
    a: 'The Agent Log page shows every decision with full reasoning. The Price Ticker shows live prices. The Positions page shows open trades. All data updates in real time via WebSocket.',
  },
  {
    q: 'Can I lose money?',
    a: 'In LIVE mode: yes. The agent uses configurable Stop Loss and Take Profit to limit losses, but no system is infallible. Always start with SANDBOX until you understand and trust the results.',
  },
  {
    q: 'What LLM providers are supported?',
    a: 'Currently Claude (Anthropic), OpenAI (GPT-4o), and Groq (LLaMA). You can use any of them — each needs its own API key configured in Settings.',
  },
  {
    q: 'Which crypto pairs are supported?',
    a: 'Currently BTC/USDT, BTC/USDC, ETH/USDT, and ETH/USDC. More pairs may be added in future versions.',
  },
];

const GUIDE_STEPS = [
  {
    step: 1,
    title: 'Register & Complete Onboarding',
    desc: 'Create your account and follow the onboarding wizard to connect your keys and set your initial configuration.',
  },
  {
    step: 2,
    title: 'Connect Binance API Keys',
    desc: 'Go to Settings → Binance API Keys. Create read+spot-trading keys in Binance and paste them here.',
  },
  {
    step: 3,
    title: 'Add an LLM API Key',
    desc: 'Go to Settings → LLM Keys. Choose Claude, OpenAI, or Groq and add your API key.',
  },
  {
    step: 4,
    title: 'Configure the Agent',
    desc: 'Go to Configuration. Select BTC or ETH, choose SANDBOX mode, set thresholds and risk parameters.',
  },
  {
    step: 5,
    title: 'Start the Agent',
    desc: 'In the Configuration page, click "Start Agent" next to your config. The agent will start analyzing immediately.',
  },
  {
    step: 6,
    title: 'Monitor Performance',
    desc: 'Watch the Dashboard overview, Live Chart, Agent Log, and Positions pages. The data updates in real time.',
  },
  {
    step: 7,
    title: 'Review Analytics',
    desc: 'After running SANDBOX for a while, review Analytics: Win Rate, P&L Chart, Sharpe Ratio, Drawdown.',
  },
  {
    step: 8,
    title: 'Switch to LIVE (optional)',
    desc: 'Only when you understand and trust the results: change mode to LIVE in Configuration and restart the agent.',
  },
];

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

export function HelpPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        '.help-section',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.12, duration: 0.6, ease: 'power2.out' },
      );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="mx-auto max-w-3xl px-4 py-16">
      <div className="help-section mb-10 text-center">
        <HelpCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold">{t('help.title')}</h1>
        <p className="mt-2 text-muted-foreground">
          Everything you need to know about operating the platform
        </p>
      </div>

      {/* FAQ */}
      <section className="help-section mb-10">
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">{t('help.faq')}</h2>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* Step-by-Step Guide */}
      <section className="help-section mb-10">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">{t('help.guide')}</h2>
        </div>
        <div className="space-y-3">
          {GUIDE_STEPS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {step}
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

      {/* API Keys Guide */}
      <section className="help-section">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">{t('help.apiKeys')}</h2>
        </div>

        <div className="space-y-5">
          {/* Binance */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-semibold flex items-center gap-2">
              Binance API Keys
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
                Log in to Binance → Account → API Management
              </li>
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                Click "Create API" → choose "System Generated"
              </li>
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                Enable permissions: ✅ Read ✅ Spot Trading — ❌ DO NOT enable
                withdrawals
              </li>
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{' '}
                Copy the API Key and Secret → paste in Settings → Binance API
                Keys
              </li>
            </ol>
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Never enable withdrawal permissions. The agent only needs to
              read and trade.
            </div>
          </div>

          {/* Claude */}
          <div className="rounded-xl border border-border bg-card p-5">
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
              <li>1. Go to console.anthropic.com → API Keys</li>
              <li>2. Click "Create Key", copy the value</li>
              <li>
                3. In CryptoTrader → Settings → LLM Keys → Claude → paste the
                key
              </li>
            </ol>
            <div className="mt-3">
              <CodeBlock>sk-ant-api03-XXXXXXXXXXXXXXXXXXXX</CodeBlock>
            </div>
          </div>

          {/* OpenAI */}
          <div className="rounded-xl border border-border bg-card p-5">
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
              <li>1. Go to platform.openai.com → API Keys</li>
              <li>2. Click "Create new secret key", copy the value</li>
              <li>
                3. In CryptoTrader → Settings → LLM Keys → OpenAI → paste the
                key
              </li>
            </ol>
            <div className="mt-3">
              <CodeBlock>sk-proj-XXXXXXXXXXXXXXXXXXXX</CodeBlock>
            </div>
          </div>

          {/* Groq */}
          <div className="rounded-xl border border-border bg-card p-5">
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
              <li>1. Go to console.groq.com → API Keys</li>
              <li>2. Click "Create API Key", copy the value</li>
              <li>
                3. In CryptoTrader → Settings → LLM Keys → Groq → paste the key
              </li>
            </ol>
            <div className="mt-3">
              <CodeBlock>gsk_XXXXXXXXXXXXXXXXXXXX</CodeBlock>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
