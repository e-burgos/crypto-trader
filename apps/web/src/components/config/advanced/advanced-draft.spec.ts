import { describe, expect, it } from 'vitest';
import type { TradingConfigWire } from '@crypto-trader/shared';
import { ADVANCED_FIELDS } from './advanced-fields';
import {
  DEFAULT_ADVANCED_DRAFT,
  type AdvancedDraft,
  clampToRange,
  diffToCreateInput,
  diffToUpdatePayload,
  isFieldEnabled,
  toAdvancedDraft,
} from './advanced-draft';

const BASE_WIRE_FIELDS = {
  id: 'cfg_1',
  userId: 'user_1',
  name: 'Fixture bot',
  asset: 'BTC',
  pair: 'USDT',
  buyThreshold: 72,
  sellThreshold: 68,
  stopLossPct: 0.03,
  takeProfitPct: 0.05,
  minProfitPct: 0.003,
  maxTradePct: 0.1,
  maxConcurrentPositions: 3,
  minIntervalMinutes: 60,
  intervalMode: 'AGENT',
  orderPriceOffsetPct: 0,
  riskProfile: 'MODERATE',
  isRunning: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Partial<TradingConfigWire>;

const WIRE_ALL_OFF: TradingConfigWire = {
  ...BASE_WIRE_FIELDS,
  mode: 'SANDBOX',
  lossCutEnabled: false,
  lossCutConfidenceThreshold: 0.85,
  lossCutMinLossPct: 0.005,
  lossCutMinEdgeRatio: 2,
  smartSizingEnabled: false,
  reduceSizeFactor: 0.5,
  deterministicGateEnabled: false,
  gatePriceChangePct: 0.005,
  nativeProtectionEnabled: false,
  closeOnProtectionFailure: false,
  stopLimitOffsetPct: 0.002,
  trailingStopEnabled: false,
  trailingStopPct: 0.02,
  trailingActivationPct: 0.01,
  partialTpEnabled: false,
  partialTpTriggerPct: 0.02,
  partialTpSellPct: 0.5,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: null,
  reactiveLoopEnabled: false,
  maxActionsPerHour: 6,
  minActionIntervalSec: 60,
  entryOrderMode: 'MARKET',
  entryOrderTtlMinutes: 120,
  entryTrailingDeltaBips: null,
};

const WIRE_ALL_ON_EDGES: TradingConfigWire = {
  ...BASE_WIRE_FIELDS,
  mode: 'TESTNET',
  lossCutEnabled: true,
  lossCutConfidenceThreshold: 0.85,
  lossCutMinLossPct: 0.005,
  lossCutMinEdgeRatio: 100,
  smartSizingEnabled: true,
  reduceSizeFactor: 0.5,
  deterministicGateEnabled: true,
  gatePriceChangePct: 0.0005,
  nativeProtectionEnabled: true,
  closeOnProtectionFailure: true,
  stopLimitOffsetPct: 0.05,
  trailingStopEnabled: true,
  trailingStopPct: 1,
  trailingActivationPct: 0.01,
  partialTpEnabled: true,
  partialTpTriggerPct: 0.02,
  partialTpSellPct: 0.05,
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: 43200,
  reactiveLoopEnabled: true,
  maxActionsPerHour: 60,
  minActionIntervalSec: 5,
  entryOrderMode: 'OCO',
  entryOrderTtlMinutes: 1440,
  entryTrailingDeltaBips: 2000,
};

describe('toAdvancedDraft', () => {
  it('round-trips a wire fixture with everything off into the draft shape', () => {
    const draft = toAdvancedDraft(WIRE_ALL_OFF);
    expect(draft.nativeProtectionEnabled).toBe(false);
    expect(draft.stopLimitOffsetPct).toBe('0.2');
    expect(draft.maxPositionHoldEnabled).toBe(false);
    expect(draft.maxPositionHoldMinutes).toBe(DEFAULT_ADVANCED_DRAFT.maxPositionHoldMinutes);
    expect(draft.entryTrailingDeltaEnabled).toBe(false);
    expect(draft.entryTrailingDeltaBips).toBe(DEFAULT_ADVANCED_DRAFT.entryTrailingDeltaBips);
    expect(draft.entryOrderMode).toBe('MARKET');
  });

  it('round-trips a wire fixture with every field at its edge', () => {
    const draft = toAdvancedDraft(WIRE_ALL_ON_EDGES);
    expect(draft.lossCutMinEdgeRatio).toBe('100');
    expect(draft.maxPositionHoldEnabled).toBe(true);
    expect(draft.maxPositionHoldMinutes).toBe('43200');
    expect(draft.entryTrailingDeltaEnabled).toBe(true);
    expect(draft.entryTrailingDeltaBips).toBe('2000');
    expect(draft.entryOrderMode).toBe('OCO');
    expect(draft.gatePriceChangePct).toBe('0.05');
  });
});

describe('diffToCreateInput', () => {
  it('is empty when the draft never left the default (CA-002)', () => {
    expect(diffToCreateInput(DEFAULT_ADVANCED_DRAFT, DEFAULT_ADVANCED_DRAFT)).toEqual({});
  });

  it('is empty again once a switch is turned on and back off', () => {
    const toggledOn: AdvancedDraft = {
      ...DEFAULT_ADVANCED_DRAFT,
      nativeProtectionEnabled: true,
    };
    const toggledBackOff: AdvancedDraft = {
      ...toggledOn,
      nativeProtectionEnabled: false,
    };
    expect(diffToCreateInput(DEFAULT_ADVANCED_DRAFT, toggledBackOff)).toEqual({});
  });

  it('never emits a synthetic switch key or null', () => {
    const current: AdvancedDraft = {
      ...DEFAULT_ADVANCED_DRAFT,
      maxPositionHoldEnabled: true,
      maxPositionHoldMinutes: '720',
    };
    const diff = diffToCreateInput(DEFAULT_ADVANCED_DRAFT, current);
    expect(diff).toEqual({ maxPositionHoldMinutes: 720 });
    expect(diff).not.toHaveProperty('maxPositionHoldEnabled');
    expect(diff).not.toHaveProperty('entryTrailingDeltaEnabled');
    expect(diff).not.toHaveProperty('isActive');
    expect(diff).not.toHaveProperty('mode');
  });

  it('keeps every emitted numeric value inside the DTO wire range', () => {
    const baseline = toAdvancedDraft(WIRE_ALL_OFF);
    const current = toAdvancedDraft(WIRE_ALL_ON_EDGES);
    const diff = diffToCreateInput(baseline, current);
    for (const [field, value] of Object.entries(diff)) {
      if (typeof value !== 'number') continue;
      const spec = ADVANCED_FIELDS[field as keyof typeof ADVANCED_FIELDS];
      if (spec.kind !== 'number') continue;
      expect(value).toBeGreaterThanOrEqual(spec.wireMin);
      expect(value).toBeLessThanOrEqual(spec.wireMax);
    }
  });
});

describe('diffToUpdatePayload', () => {
  it('is empty for a baseline diffed against itself, even at the range edges', () => {
    const baseline = toAdvancedDraft(WIRE_ALL_ON_EDGES);
    expect(diffToUpdatePayload(baseline, baseline)).toEqual({});
  });

  it('emits exactly one key when a single slider changes', () => {
    const baseline = toAdvancedDraft(WIRE_ALL_OFF);
    const current: AdvancedDraft = { ...baseline, trailingStopEnabled: true };
    const diff = diffToUpdatePayload(baseline, current);
    expect(Object.keys(diff)).toEqual(['trailingStopEnabled']);
    expect(diff.trailingStopEnabled).toBe(true);
  });

  it('emits null when the synthetic switch is turned off with a non-null baseline', () => {
    const baseline = toAdvancedDraft({ ...WIRE_ALL_OFF, maxPositionHoldMinutes: 720 });
    const current: AdvancedDraft = { ...baseline, maxPositionHoldEnabled: false };
    const diff = diffToUpdatePayload(baseline, current);
    expect(diff).toEqual({ maxPositionHoldMinutes: null });
  });

  it('merges the base-fields diff supplied by the caller', () => {
    const baseline = DEFAULT_ADVANCED_DRAFT;
    const current: AdvancedDraft = { ...baseline, reactiveLoopEnabled: true };
    const diff = diffToUpdatePayload(baseline, current, { name: 'Renamed bot' });
    expect(diff).toEqual({ name: 'Renamed bot', reactiveLoopEnabled: true });
  });
});

describe('clampToRange', () => {
  it('keeps a value inside range untouched', () => {
    const spec = ADVANCED_FIELDS.trailingStopPct;
    if (spec.kind !== 'number') throw new Error('unexpected spec kind');
    expect(clampToRange(spec, 5)).toBe(5);
  });

  it('clamps a value above the maximum down to uiMax', () => {
    const spec = ADVANCED_FIELDS.trailingStopPct;
    if (spec.kind !== 'number') throw new Error('unexpected spec kind');
    expect(clampToRange(spec, 1000)).toBe(spec.uiMax);
  });

  it('clamps a value below the minimum up to uiMin', () => {
    const spec = ADVANCED_FIELDS.partialTpSellPct;
    if (spec.kind !== 'number') throw new Error('unexpected spec kind');
    expect(clampToRange(spec, -10)).toBe(spec.uiMin);
  });
});

describe('isFieldEnabled — §6.5 enablement table', () => {
  const simpleDependencyCases: Array<{
    field: keyof AdvancedDraft & Parameters<typeof isFieldEnabled>[0];
    switchField: keyof AdvancedDraft;
  }> = [
    { field: 'stopLimitOffsetPct', switchField: 'nativeProtectionEnabled' },
    { field: 'closeOnProtectionFailure', switchField: 'nativeProtectionEnabled' },
    { field: 'trailingStopPct', switchField: 'trailingStopEnabled' },
    { field: 'trailingActivationPct', switchField: 'trailingStopEnabled' },
    { field: 'partialTpTriggerPct', switchField: 'partialTpEnabled' },
    { field: 'partialTpSellPct', switchField: 'partialTpEnabled' },
    { field: 'moveStopToBreakevenAfterPartial', switchField: 'partialTpEnabled' },
    { field: 'lossCutConfidenceThreshold', switchField: 'lossCutEnabled' },
    { field: 'lossCutMinLossPct', switchField: 'lossCutEnabled' },
    { field: 'lossCutMinEdgeRatio', switchField: 'lossCutEnabled' },
    { field: 'reduceSizeFactor', switchField: 'smartSizingEnabled' },
    { field: 'gatePriceChangePct', switchField: 'deterministicGateEnabled' },
    { field: 'maxActionsPerHour', switchField: 'reactiveLoopEnabled' },
    { field: 'minActionIntervalSec', switchField: 'reactiveLoopEnabled' },
  ];

  it.each(simpleDependencyCases)(
    '$field follows $switchField',
    ({ field, switchField }) => {
      const off: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, [switchField]: false };
      const on: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, [switchField]: true };
      expect(isFieldEnabled(field, off, 'TESTNET')).toBe(false);
      expect(isFieldEnabled(field, on, 'TESTNET')).toBe(true);
    },
  );

  it('maxPositionHoldMinutes follows its synthetic switch', () => {
    const off: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, maxPositionHoldEnabled: false };
    const on: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, maxPositionHoldEnabled: true };
    expect(isFieldEnabled('maxPositionHoldMinutes', off, 'TESTNET')).toBe(false);
    expect(isFieldEnabled('maxPositionHoldMinutes', on, 'TESTNET')).toBe(true);
  });

  it('entryOrderMode is disabled only in SANDBOX', () => {
    expect(isFieldEnabled('entryOrderMode', DEFAULT_ADVANCED_DRAFT, 'SANDBOX')).toBe(false);
    expect(isFieldEnabled('entryOrderMode', DEFAULT_ADVANCED_DRAFT, 'TESTNET')).toBe(true);
    expect(isFieldEnabled('entryOrderMode', DEFAULT_ADVANCED_DRAFT, 'LIVE')).toBe(true);
  });

  it('entryOrderTtlMinutes is enabled for LIMIT_MAKER and OCO, disabled for MARKET', () => {
    const market: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, entryOrderMode: 'MARKET' };
    const limitMaker: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, entryOrderMode: 'LIMIT_MAKER' };
    const oco: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, entryOrderMode: 'OCO' };
    expect(isFieldEnabled('entryOrderTtlMinutes', market, 'TESTNET')).toBe(false);
    expect(isFieldEnabled('entryOrderTtlMinutes', limitMaker, 'TESTNET')).toBe(true);
    expect(isFieldEnabled('entryOrderTtlMinutes', oco, 'TESTNET')).toBe(true);
  });

  it('entryTrailingDeltaBips needs both OCO and its synthetic switch on', () => {
    const ocoSwitchOff: AdvancedDraft = {
      ...DEFAULT_ADVANCED_DRAFT,
      entryOrderMode: 'OCO',
      entryTrailingDeltaEnabled: false,
    };
    const limitMakerSwitchOn: AdvancedDraft = {
      ...DEFAULT_ADVANCED_DRAFT,
      entryOrderMode: 'LIMIT_MAKER',
      entryTrailingDeltaEnabled: true,
    };
    const both: AdvancedDraft = {
      ...DEFAULT_ADVANCED_DRAFT,
      entryOrderMode: 'OCO',
      entryTrailingDeltaEnabled: true,
    };
    expect(isFieldEnabled('entryTrailingDeltaBips', ocoSwitchOff, 'TESTNET')).toBe(false);
    expect(isFieldEnabled('entryTrailingDeltaBips', limitMakerSwitchOn, 'TESTNET')).toBe(false);
    expect(isFieldEnabled('entryTrailingDeltaBips', both, 'TESTNET')).toBe(true);
  });

  it('the three signal root switches are independent of one another', () => {
    const onlyLossCut: AdvancedDraft = { ...DEFAULT_ADVANCED_DRAFT, lossCutEnabled: true };
    expect(isFieldEnabled('reduceSizeFactor', onlyLossCut, 'TESTNET')).toBe(false);
    expect(isFieldEnabled('gatePriceChangePct', onlyLossCut, 'TESTNET')).toBe(false);
  });
});
