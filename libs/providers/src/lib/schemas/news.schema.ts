import { z } from 'zod';

export const NewsWithSentimentSchema = z.object({
  headline: z.string(),
  source: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  sentiment: z.number().min(-1).max(1),
  sentimentLabel: z.string(),
  relatedSymbols: z.array(z.string()),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export const NewsArraySchema = z.array(NewsWithSentimentSchema);
