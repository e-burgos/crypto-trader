import { calculateTradeQuantity } from './order-executor';

export type AegisVerdictValue = 'PASS' | 'REDUCE' | 'BLOCK';

export interface TradeSizingInput {
  balance: number;
  price: number;
  maxTradePct: number;
  verdict?: AegisVerdictValue;
  positionSizeMultiplier?: number;
  forgeMaxTradePct?: number | null;
  forgeRecommendation?: 'proceed' | 'skip';
  reduceSizeFactor?: number;
}

export interface TradeSizingResult {
  quantity: number;
  ceilingQuantity: number;
  effectiveFactor: number;
  factors: { aegis: number; verdict: number; forge: number };
  blockedBy: 'AEGIS_BLOCK' | 'FORGE_SKIP' | 'ZERO_SIZE' | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function floor8(value: number): number {
  return Math.floor(value * 1e8) / 1e8;
}

export function resolveTradeQuantity(
  input: TradeSizingInput,
): TradeSizingResult {
  const ceilingQuantity = calculateTradeQuantity(
    input.balance,
    input.price,
    input.maxTradePct,
  );

  const aegis = clamp(input.positionSizeMultiplier ?? 1, 0, 1);
  const verdict =
    input.verdict === 'REDUCE'
      ? clamp(input.reduceSizeFactor ?? 0.5, 0, 1)
      : 1;
  const forge =
    input.forgeRecommendation === 'skip'
      ? 0
      : input.forgeMaxTradePct == null
        ? 1
        : clamp(input.forgeMaxTradePct / input.maxTradePct, 0, 1);

  const effectiveFactor = Math.min(aegis * verdict, forge);
  const quantity = floor8(ceilingQuantity * effectiveFactor);

  const blockedBy =
    input.verdict === 'BLOCK'
      ? 'AEGIS_BLOCK'
      : forge === 0
        ? 'FORGE_SKIP'
        : quantity <= 0
          ? 'ZERO_SIZE'
          : null;

  return {
    quantity,
    ceilingQuantity,
    effectiveFactor,
    factors: { aegis, verdict, forge },
    blockedBy,
  };
}
