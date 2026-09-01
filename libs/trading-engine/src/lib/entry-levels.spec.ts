import { resolveEntryLevels } from './entry-levels';

describe('resolveEntryLevels', () => {
  it('picks the support level nearest below the reference price', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 100,
      support: [80, 95, 90, 105],
      resistance: [],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toEqual({
      mode: 'LIMIT_MAKER',
      limitPrice: 95,
      limitSource: 'SUPPORT',
      stopPrice: null,
      stopSource: null,
      degradedFromOco: false,
    });
  });

  it('picks the resistance level nearest above the reference price for OCO', () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: 100,
      support: [90],
      resistance: [130, 110, 115, 95],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toEqual({
      mode: 'OCO',
      limitPrice: 90,
      limitSource: 'SUPPORT',
      stopPrice: 110,
      stopSource: 'RESISTANCE',
      degradedFromOco: false,
    });
  });

  it('falls back to the offset below the reference price when no support is usable', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 100,
      support: [],
      resistance: [],
      orderPriceOffsetPct: -0.01,
    });

    expect(plan).toEqual({
      mode: 'LIMIT_MAKER',
      limitPrice: 99,
      limitSource: 'OFFSET_FALLBACK',
      stopPrice: null,
      stopSource: null,
      degradedFromOco: false,
    });
  });

  it('falls back to the offset above the reference price when no resistance is usable', () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: 100,
      support: [90],
      resistance: [],
      orderPriceOffsetPct: -0.01,
    });

    expect(plan).toEqual({
      mode: 'OCO',
      limitPrice: 90,
      limitSource: 'SUPPORT',
      stopPrice: 101,
      stopSource: 'OFFSET_FALLBACK',
      degradedFromOco: false,
    });
  });

  it('returns null with a zero offset and no support levels', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 100,
      support: [],
      resistance: [],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toBeNull();
  });

  it('degrades OCO to LIMIT_MAKER when no resistance fallback is usable', () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: 100,
      support: [90],
      resistance: [],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toEqual({
      mode: 'LIMIT_MAKER',
      limitPrice: 90,
      limitSource: 'SUPPORT',
      stopPrice: null,
      stopSource: null,
      degradedFromOco: true,
    });
  });

  it('returns null when there is no usable lower leg even with an upper leg available', () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: 100,
      support: [],
      resistance: [110],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toBeNull();
  });

  it('excludes a support level equal to the reference price and returns null without a fallback', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 100,
      support: [100],
      resistance: [],
      orderPriceOffsetPct: 0,
    });

    expect(plan).toBeNull();
  });

  it('excludes a resistance level equal to the reference price and degrades to LIMIT_MAKER', () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: 100,
      support: [90],
      resistance: [100],
      orderPriceOffsetPct: 0,
    });

    expect(plan?.mode).toBe('LIMIT_MAKER');
    expect(plan?.degradedFromOco).toBe(true);
  });

  it('returns null for a non-finite reference price', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: Number.NaN,
      support: [90],
      resistance: [],
      orderPriceOffsetPct: -0.01,
    });

    expect(plan).toBeNull();
  });

  it('returns null for a reference price at or below zero', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 0,
      support: [],
      resistance: [],
      orderPriceOffsetPct: -0.01,
    });

    expect(plan).toBeNull();
  });

  it('returns null for a non-finite offset fallback result', () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: 100,
      support: [],
      resistance: [],
      orderPriceOffsetPct: Number.NEGATIVE_INFINITY,
    });

    expect(plan).toBeNull();
  });
});
