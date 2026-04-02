import { useRef, useState } from 'react';
import {
  Newspaper,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useTranslation } from 'react-i18next';
import { useMarketNews, type NewsItem } from '../../hooks/use-market';

type Sentiment = 'ALL' | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SENTIMENT_CONFIG: Record<
  NewsItem['sentiment'],
  { label: string; icon: typeof TrendingUp; color: string; bg: string }
> = {
  POSITIVE: {
    label: 'Positive',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  NEGATIVE: {
    label: 'Negative',
    icon: TrendingDown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  NEUTRAL: {
    label: 'Neutral',
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  },
};

export function NewsFeedPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Sentiment>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: news = [], isLoading } = useMarketNews(40);

  const filtered =
    filter === 'ALL' ? news : news.filter((n) => n.sentiment === filter);

  useGSAP(
    () => {
      if (isLoading) return;
      gsap.fromTo(
        '.news-card',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out' },
      );
    },
    { scope: containerRef, dependencies: [isLoading, filter] },
  );

  return (
    <div ref={containerRef} className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('sidebar.news')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Latest crypto market news
          </p>
        </div>

        {/* Sentiment filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {(['ALL', 'POSITIVE', 'NEGATIVE', 'NEUTRAL'] as Sentiment[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'ALL'
                  ? 'All'
                  : SENTIMENT_CONFIG[s as NewsItem['sentiment']].label}
              </button>
            ),
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('common.empty')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            News requires a CRYPTOPANIC_API_KEY to be configured on the server.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const s = SENTIMENT_CONFIG[item.sentiment];
            const SentimentIcon = s.icon;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      s.bg,
                      s.color,
                    )}
                  >
                    <SentimentIcon className="h-3 w-3" />
                    {s.label}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <p className="mb-3 line-clamp-3 text-sm font-medium leading-snug">
                  {item.headline}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{item.source}</span>
                  <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
