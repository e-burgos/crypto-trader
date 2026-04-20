import { MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SENTIMENT_COLOR } from './constants';

export function NewsHeadlinesPanel({
  headlines,
}: {
  headlines: Array<{ headline: string; sentiment: string; source?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          News context
        </span>
      </div>
      <div className="space-y-1.5">
        {headlines.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={cn(
                'mt-0.5 shrink-0 text-[10px] font-bold uppercase',
                SENTIMENT_COLOR[h.sentiment] ?? 'text-muted-foreground',
              )}
            >
              {h.sentiment.slice(0, 3)}
            </span>
            <p className="text-[11px] leading-snug text-foreground/80">
              {h.headline}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
