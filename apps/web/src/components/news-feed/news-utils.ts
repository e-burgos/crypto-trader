import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { type NewsItem } from '../../hooks/use-market';

export type SentimentFilter = 'ALL' | 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export const NEWS_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function sourceLabel(source: string): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'cryptopanic') return 'CryptoPanic';
  if (source === 'newsdata') return 'NewsData';
  if (source.startsWith('rss:')) {
    const name = source.replace('rss:', '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (source.startsWith('reddit:')) return `r/${source.replace('reddit:', '')}`;
  return source;
}

export const SENTIMENT_CONFIG: Record<
  NewsItem['sentiment'],
  {
    label: string;
    icon: typeof TrendingUp;
    color: string;
    bg: string;
    border: string;
  }
> = {
  POSITIVE: {
    label: 'Positivo',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  NEGATIVE: {
    label: 'Negativo',
    icon: TrendingDown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  NEUTRAL: {
    label: 'Neutral',
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
  },
};
