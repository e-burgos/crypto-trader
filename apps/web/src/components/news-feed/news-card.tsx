import { Sparkles, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { type NewsItem, type AiHeadline } from '../../hooks/use-market';
import { timeAgo, sourceLabel, SENTIMENT_CONFIG } from './news-utils';

export function NewsCard({
  item,
  aiResult,
  onOpen,
}: {
  item: NewsItem;
  aiResult?: AiHeadline;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const effectiveSentiment: NewsItem['sentiment'] =
    (aiResult?.sentiment as NewsItem['sentiment']) ?? item.sentiment;
  const s = SENTIMENT_CONFIG[effectiveSentiment];
  const SentimentIcon = s.icon;
  const changed = aiResult && aiResult.sentiment !== item.sentiment;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="news-card group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
              s.bg,
              s.color,
              s.border,
            )}
          >
            <SentimentIcon className="h-3 w-3" />
            {s.label}
          </span>
          {changed && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              IA
            </span>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={t('news.openInNewTab')}
          className="shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </a>
      </div>

      <p className="mb-2 line-clamp-3 text-sm font-medium leading-snug">
        {item.headline}
      </p>

      {item.summary && !aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/60 leading-snug">
          {item.summary}
        </p>
      )}

      {aiResult?.reasoning && (
        <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground/70 italic leading-snug border-l-2 border-primary/20 pl-2">
          {aiResult.reasoning}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{sourceLabel(item.source)}</span>
        <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
      </div>
    </div>
  );
}
