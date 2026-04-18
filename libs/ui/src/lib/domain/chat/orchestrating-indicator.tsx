import { useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { cn } from '../../utils';

gsap.registerPlugin(useGSAP);

interface OrchestratingIndicatorProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  step?: string;
  className?: string;
}

export function OrchestratingIndicator({
  t,
  step,
  className,
}: OrchestratingIndicatorProps) {
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
      data-testid="orchestrating-indicator"
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5',
        className,
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary">
          {t('agents.orchestrating')}
        </p>
        {step && (
          <p className="text-[10px] text-muted-foreground truncate">{step}</p>
        )}
      </div>
      <div ref={dotsRef} className="flex items-center gap-1">
        <span className="dot h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-primary/50" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-primary/30" />
      </div>
    </div>
  );
}
