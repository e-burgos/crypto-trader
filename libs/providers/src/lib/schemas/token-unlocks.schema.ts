import { z } from 'zod';

export const TokenUnlockSchema = z.object({
  symbol: z.string(),
  unlockDate: z.string(),
  unlockAmountUsd: z.number(),
  percentOfCirculating: z.number(),
  type: z.string(),
});

export const TokenUnlocksArraySchema = z.array(TokenUnlockSchema);
