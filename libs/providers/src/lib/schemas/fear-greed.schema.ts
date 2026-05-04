import { z } from 'zod';

export const FearGreedSchema = z.object({
  value: z.number().min(0).max(100),
  classification: z.string(),
  timestamp: z.string(),
  previousClose: z.number().min(0).max(100),
});
