import { z } from 'zod';
import { safeParseJson } from '../json-parse.util';
import { ForgeSizingSummary } from './decision-synthesis.dto';

export const forgeSizingSchema = z
  .object({
    recommendation: z.enum(['proceed', 'skip']).catch('proceed'),
    maxTradeSize: z.coerce.number().min(0).max(1).nullable().catch(null),
    reasoning: z.string().catch(''),
  })
  .transform(
    (parsed): ForgeSizingSummary => ({
      recommendation: parsed.recommendation,
      maxTradePct: parsed.maxTradeSize,
      reasoning: parsed.reasoning,
    }),
  );

export function parseForgeSizing(raw: string): ForgeSizingSummary {
  const parsedJson = safeParseJson<Record<string, unknown>>(raw, {});
  return forgeSizingSchema.parse(parsedJson);
}
