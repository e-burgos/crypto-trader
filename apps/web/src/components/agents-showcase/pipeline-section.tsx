import { MessageSquare, Brain, Zap, Target, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PipelineSection() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: MessageSquare,
      title: t('agentsShowcase.pipeline.step1Title'),
      desc: t('agentsShowcase.pipeline.step1Desc'),
    },
    {
      icon: Brain,
      title: t('agentsShowcase.pipeline.step2Title'),
      desc: t('agentsShowcase.pipeline.step2Desc'),
    },
    {
      icon: Zap,
      title: t('agentsShowcase.pipeline.step3Title'),
      desc: t('agentsShowcase.pipeline.step3Desc'),
    },
    {
      icon: Target,
      title: t('agentsShowcase.pipeline.step4Title'),
      desc: t('agentsShowcase.pipeline.step4Desc'),
    },
  ];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t('agentsShowcase.pipeline.title')}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {t('agentsShowcase.pipeline.subtitle')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="pipeline-card group relative rounded-xl border border-border bg-card/50 p-4 transition-all duration-300 hover:bg-card hover:border-primary/20 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 animate-fade-up"
            style={{ animationDelay: `${300 + i * 100}ms` }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                <step.icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {step.desc}
            </p>
            {i < steps.length - 1 && (
              <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:block">
                <ChevronRight className="h-4 w-4 text-border transition-all duration-300 group-hover:text-primary/40 group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
