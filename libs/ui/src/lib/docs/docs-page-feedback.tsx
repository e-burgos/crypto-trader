import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '../utils';

interface DocsPageFeedbackProps {
  className?: string;
  question?: string;
  yesLabel?: string;
  noLabel?: string;
  thanksYes?: string;
  thanksNo?: string;
}

export function DocsPageFeedback({
  className,
  question = 'Was this page helpful?',
  yesLabel = 'Yes',
  noLabel = 'No',
  thanksYes = 'Thanks for your feedback!',
  thanksNo = "Thanks — we'll work on improving this page.",
}: DocsPageFeedbackProps) {
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4 rounded-lg border border-border/60 bg-card px-6 py-5 mt-10',
        className,
      )}
    >
      {feedback ? (
        <p className="text-sm text-muted-foreground">
          {feedback === 'yes' ? thanksYes : thanksNo}
        </p>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">{question}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeedback('yes')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-500"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {yesLabel}
            </button>
            <button
              type="button"
              onClick={() => setFeedback('no')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-500"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {noLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export type { DocsPageFeedbackProps };
