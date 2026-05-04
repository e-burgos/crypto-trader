import { z } from 'zod';

export const GlobalMarketSchema = z.object({
  totalMarketCap: z.number(),
  totalVolume24h: z.number(),
  btcDominance: z.number(),
  ethDominance: z.number(),
  activeCryptocurrencies: z.number(),
  trendingCoins: z.array(z.string()),
  topGainers24h: z.array(z.string()),
  topLosers24h: z.array(z.string()),
});
