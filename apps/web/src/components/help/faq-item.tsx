import { useState, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export function FaqItem({ q, a }: { q: string; a: string }) {
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
