import { z } from 'zod';

export const DerivativesSchema = z.object({
  openInterest: z.number(),
  openInterestChange24h: z.number(),
  fundingRate: z.number(),
  longShortRatio: z.number(),
  liquidations24h: z.number(),
  liquidationsBuy24h: z.number(),
  liquidationsSell24h: z.number(),
  cvd: z.number(),
});
