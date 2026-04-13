import { useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

gsap.registerPlugin(useGSAP);

interface OrchestratingIndicatorProps {
  step?: string;
  className?: string;
}

export function OrchestratingIndicator({
  step,
  className,
}: OrchestratingIndicatorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      );

      if (dotsRef.current) {
        const dots = dotsRef.current.querySelectorAll('.dot');
        gsap.to(dots, {
          y: -4,
          duration: 0.4,
          ease: 'power1.inOut',
          stagger: 0.12,
          yoyo: true,
          repeat: -1,
        });
      }
    },
    { scope: containerRef },
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3',
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">
          {t('agents.orchestrating')}
        </p>
        {step && (
          <p className="truncate text-xs text-muted-foreground">{step}</p>
        )}
      </div>
      <div ref={dotsRef} className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="dot h-1.5 w-1.5 rounded-full bg-primary/60"
          />
        ))}
      </div>
    </div>
  );
}
