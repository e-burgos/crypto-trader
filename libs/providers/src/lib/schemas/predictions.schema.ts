import { z } from 'zod';

export const PredictionSchema = z.object({
  question: z.string(),
  probability: z.number().min(0).max(1),
  volume: z.number(),
  source: z.string(),
  endDate: z.string(),
  url: z.string().optional(),
});

export const PredictionsArraySchema = z.array(PredictionSchema);
