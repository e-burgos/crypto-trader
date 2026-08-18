import { z } from 'zod';
import { safeParseJson } from '../json-parse.util';
import { AEGIS_BLOCK_REASONS, AegisBlockReason, AegisVerdict } from './decision-synthesis.dto';

export const aegisVerdictSchema = z.object({
  riskScore: z.coerce.number().min(0).max(100).catch(50),
  verdict: z.enum(['PASS', 'REDUCE', 'BLOCK']).catch('PASS'),
  positionSizeMultiplier: z.coerce.number().min(0).max(1).catch(1),
  blockReasons: z.array(z.enum(AEGIS_BLOCK_REASONS)).catch([]),
  reason: z.string().catch(''),
  alerts: z.array(z.string()).catch([]),
});

export function parseAegisVerdict(raw: string): AegisVerdict {
  const parsedJson = safeParseJson<Record<string, unknown>>(raw, {});
  return aegisVerdictSchema.parse(parsedJson);
}

const OVERRIDABLE_BLOCK_REASONS: ReadonlySet<AegisBlockReason> = new Set([
  'SINGLE_ASSET_CONCENTRATION',
]);

export function isOverridableBlock(verdict: AegisVerdict): boolean {
  return (
    verdict.verdict === 'BLOCK' &&
    verdict.blockReasons.length > 0 &&
    verdict.blockReasons.every((r) => OVERRIDABLE_BLOCK_REASONS.has(r))
  );
}
