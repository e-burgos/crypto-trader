import { z } from 'zod';

export const DefiHealthSchema = z.object({
  totalTvl: z.number(),
  tvlChange24h: z.number(),
  tvlChange7d: z.number(),
  stablecoinMcap: z.number(),
  stablecoinChange24h: z.number(),
  stablecoinChange7d: z.number(),
  dominantChain: z.string().optional(),
});
