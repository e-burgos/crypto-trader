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

/**
 * What AEGIS answers when it could not answer at all (FIX-e-burgos-014).
 *
 * The per-field `.catch()` above exist to degrade a PARTIAL payload, and that
 * part of the design is right. What was wrong is that an EMPTY payload went
 * through the same path and came out as `PASS` at full size: a risk gate that
 * authorises the trade whenever it fails is the opposite of a risk gate.
 *
 * Measured in production: with the configured reasoning models, AEGIS spends its
 * whole token budget on reasoning and returns zero characters of content, so
 * this was not a rare edge — it was every single cycle.
 */
const AEGIS_UNAVAILABLE: AegisVerdict = {
  riskScore: 100,
  verdict: 'BLOCK',
  positionSizeMultiplier: 0,
  blockReasons: [],
  reason: 'AEGIS no devolvió un veredicto legible: se bloquea por defecto.',
  alerts: ['AEGIS_UNPARSEABLE'],
};

/**
 * A sentinel distinguishes "the model answered {}" from "there was nothing to
 * parse". Only the second one is a gate failure; the first is a malformed answer
 * that the per-field defaults can still degrade.
 */
const NOTHING_TO_PARSE = Symbol('aegis:nothing-to-parse');

export function parseAegisVerdict(raw: string): AegisVerdict {
  if (!raw || raw.trim() === '') return { ...AEGIS_UNAVAILABLE };

  const parsedJson = safeParseJson<Record<string, unknown> | typeof NOTHING_TO_PARSE>(
    raw,
    NOTHING_TO_PARSE,
  );
  if (parsedJson === NOTHING_TO_PARSE) return { ...AEGIS_UNAVAILABLE };

  // An object with none of the expected keys is a truncated answer wearing the
  // shape of a valid one. Trusting it would reintroduce the same fail-open.
  const hasSignal =
    typeof parsedJson === 'object' &&
    parsedJson !== null &&
    ['verdict', 'riskScore', 'positionSizeMultiplier', 'blockReasons'].some(
      (k) => k in parsedJson,
    );
  if (!hasSignal) return { ...AEGIS_UNAVAILABLE };

  return aegisVerdictSchema.parse(parsedJson);
}

/** True when the verdict is the fail-closed default rather than a real answer. */
export function isAegisUnavailable(verdict: AegisVerdict): boolean {
  return verdict.alerts.includes('AEGIS_UNPARSEABLE');
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
