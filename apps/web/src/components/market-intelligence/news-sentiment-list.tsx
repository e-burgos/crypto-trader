import { useTranslation } from 'react-i18next';
import { InfoCard, Badge } from '@crypto-trader/ui';
import { Newspaper, ExternalLink } from 'lucide-react';
import type { NewsWithSentiment } from '@crypto-trader/shared';
import { SourceFooter } from './source-footer';
import { DataSourceInfoButton } from './data-source-info-button';
import { getNewsSentimentInfo } from './data-source-info-content';

function sentimentColor(val: number): string {
  if (val >= 0.3) return '#10b981';
  if (val >= 0.1) return '#6ee7b7';
  if (val <= -0.3) return '#ef4444';
  if (val <= -0.1) return '#fca5a5';
  return '#6b7280';
}

function sentimentBadge(sentiment: string) {
  if (sentiment === 'positive')
    return <Badge variant="success" label="Bullish" />;
  if (sentiment === 'negative')
    return <Badge variant="error" label="Bearish" />;
  return <Badge variant="neutral" label="Neutral" />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NewsSentimentList({
  data,
}: {
  data: NewsWithSentiment[] | null;
}) {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const avgSentiment =
    data.reduce((sum, n) => sum + n.sentiment, 0) / data.length;
  const positive = data.filter((n) => n.sentimentLabel === 'positive').length;
  const negative = data.filter((n) => n.sentimentLabel === 'negative').length;
  const neutral = data.length - positive - negative;

  return (
    <InfoCard
      icon={<Newspaper className="h-3.5 w-3.5 text-primary" />}
      title={t('marketIntelligence.news.title')}
      subtitle="Finnhub — Crypto news + NLP sentiment"
      headerRight={
        <div className="flex items-center gap-2">
          <Badge
            variant={
              avgSentiment >= 0.1
                ? 'success'
                : avgSentiment <= -0.1
                  ? 'error'
                  : 'neutral'
            }
            label={`Avg: ${avgSentiment > 0 ? '+' : ''}${avgSentiment.toFixed(2)}`}
          />
          <DataSourceInfoButton
            title="News & Sentiment"
            tabs={getNewsSentimentInfo(t)}
          />
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
          <SourceFooter source="finnhub" />
        </div>
      }
    >
      {/* Sentiment distribution summary */}
      <div className="flex items-center gap-3 text-xs mb-3">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {positive} bullish
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-500" />
          {neutral} neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {negative} bearish
        </span>
      </div>

      {/* News items */}
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {data.slice(0, 20).map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2.5 rounded-lg p-2 -mx-1 hover:bg-muted/50 transition-colors"
          >
            {/* Sentiment indicator bar */}
            <div
              className="w-1 h-8 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: sentimentColor(item.sentiment) }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                {item.headline}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                <span className="font-medium">{item.source}</span>
                <span>·</span>
                <span>{timeAgo(item.publishedAt)}</span>
                {item.relatedSymbols.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{item.relatedSymbols.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 mt-1">
              {sentimentBadge(item.sentimentLabel)}
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
      </div>
    </InfoCard>
  );
}
