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

  const faqItems = t('help.faqItems', { returnObjects: true }) as { q: string; a: string }[];
  const guideSteps = t('help.guideSteps', { returnObjects: true }) as { title: string; desc: string }[];

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
          {t('help.subtitle')}
        </p>
      </div>

      {/* FAQ */}
      <section className="help-section mb-10">
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">{t('help.faq')}</h2>
        </div>
        <div className="space-y-2">
          {faqItems.map((item, i) => (
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
          {guideSteps.map(({ title, desc }, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
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
              <li>1. {t('help.claudeStep1')}</li>
              <li>2. {t('help.claudeStep2')}</li>
              <li>3. {t('help.claudeStep3')}</li>
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
              <li>1. {t('help.openaiStep1')}</li>
              <li>2. {t('help.openaiStep2')}</li>
              <li>3. {t('help.openaiStep3')}</li>
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
  );
}
