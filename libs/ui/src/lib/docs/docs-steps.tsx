import { cn } from '../utils';

interface DocsStep {
  title: string;
  description?: string | React.ReactNode;
}

interface DocsStepsProps {
  steps: DocsStep[];
  className?: string;
}

export function DocsSteps({ steps, className }: DocsStepsProps) {
  return (
    <div className={cn('relative space-y-0', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/60" />
            )}

            {/* Number badge */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-4 ring-background">
              {i + 1}
            </div>

            {/* Content */}
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">
                {step.title}
              </p>
              {step.description && (
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { DocsStepsProps, DocsStep };
