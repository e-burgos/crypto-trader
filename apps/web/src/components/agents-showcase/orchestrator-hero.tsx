import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function OrchestratorHero({
  hideChatCta = false,
}: {
  hideChatCta?: boolean;
}) {
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

        {!hideChatCta && (
          <button
            onClick={() => navigate('/dashboard/chat')}
            className="animate-fade-up group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
            style={{ animationDelay: '300ms' }}
          >
            <MessageSquare className="h-4 w-4" />
            {t('agentsShowcase.cta')}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        )}

        <div
          className="animate-fade-up mt-8 h-px bg-gradient-to-r from-border via-border/60 to-transparent"
          style={{ animationDelay: '400ms' }}
        />
      </div>
    </div>
  );
}
