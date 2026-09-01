import { RestingEntryMode } from '@crypto-trader/shared';

export interface EntryLevelInput {
  mode: RestingEntryMode;
  referencePrice: number;
  support: number[];
  resistance: number[];
  orderPriceOffsetPct: number;
}

export type EntryLevelSource = 'SUPPORT' | 'RESISTANCE' | 'OFFSET_FALLBACK';

export interface EntryLevelPlan {
  mode: RestingEntryMode;
  limitPrice: number;
  limitSource: EntryLevelSource;
  stopPrice: number | null;
  stopSource: EntryLevelSource | null;
  degradedFromOco: boolean;
}

interface ResolvedLeg {
  price: number;
  source: EntryLevelSource;
}

function nearestBelow(values: number[], referencePrice: number): number | null {
  let result: number | null = null;
  for (const value of values) {
    if (value < referencePrice && (result === null || value > result)) {
      result = value;
    }
  }
  return result;
}

function nearestAbove(values: number[], referencePrice: number): number | null {
  let result: number | null = null;
  for (const value of values) {
    if (value > referencePrice && (result === null || value < result)) {
      result = value;
    }
  }
  return result;
}

function resolveLowerLeg(
  referencePrice: number,
  support: number[],
  orderPriceOffsetPct: number,
): ResolvedLeg | null {
  const supportLevel = nearestBelow(support, referencePrice);
  if (supportLevel !== null) {
    return { price: supportLevel, source: 'SUPPORT' };
  }
  if (orderPriceOffsetPct < 0) {
    return { price: referencePrice * (1 + orderPriceOffsetPct), source: 'OFFSET_FALLBACK' };
  }
  return null;
}

function resolveUpperLeg(
  referencePrice: number,
  resistance: number[],
  orderPriceOffsetPct: number,
): ResolvedLeg | null {
  const resistanceLevel = nearestAbove(resistance, referencePrice);
  if (resistanceLevel !== null) {
    return { price: resistanceLevel, source: 'RESISTANCE' };
  }
  if (orderPriceOffsetPct < 0) {
    return { price: referencePrice * (1 - orderPriceOffsetPct), source: 'OFFSET_FALLBACK' };
  }
  return null;
}

function satisfiesInvariant(
  referencePrice: number,
  limitPrice: number,
  stopPrice: number | null,
): boolean {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    return false;
  }
  if (!Number.isFinite(limitPrice) || !(limitPrice < referencePrice)) {
    return false;
  }
  if (stopPrice !== null && (!Number.isFinite(stopPrice) || !(referencePrice < stopPrice))) {
    return false;
  }
  return true;
}

export function resolveEntryLevels(input: EntryLevelInput): EntryLevelPlan | null {
  const { mode, referencePrice, support, resistance, orderPriceOffsetPct } = input;

  const lowerLeg = resolveLowerLeg(referencePrice, support, orderPriceOffsetPct);
  if (lowerLeg === null) {
    return null;
  }

  if (mode === 'LIMIT_MAKER') {
    if (!satisfiesInvariant(referencePrice, lowerLeg.price, null)) {
      return null;
    }
    return {
      mode: 'LIMIT_MAKER',
      limitPrice: lowerLeg.price,
      limitSource: lowerLeg.source,
      stopPrice: null,
      stopSource: null,
      degradedFromOco: false,
    };
  }

  const upperLeg = resolveUpperLeg(referencePrice, resistance, orderPriceOffsetPct);
  if (upperLeg === null) {
    if (!satisfiesInvariant(referencePrice, lowerLeg.price, null)) {
      return null;
    }
    return {
      mode: 'LIMIT_MAKER',
      limitPrice: lowerLeg.price,
      limitSource: lowerLeg.source,
      stopPrice: null,
      stopSource: null,
      degradedFromOco: true,
    };
  }

  if (!satisfiesInvariant(referencePrice, lowerLeg.price, upperLeg.price)) {
    return null;
  }

  return {
    mode: 'OCO',
    limitPrice: lowerLeg.price,
    limitSource: lowerLeg.source,
    stopPrice: upperLeg.price,
    stopSource: upperLeg.source,
    degradedFromOco: false,
  };
}
