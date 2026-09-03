import {
  clamp,
  TRADING_CONFIG_ADVANCED_FIELDS,
  type CreateTradingConfigInput,
  type EntryOrderMode,
  type TradingConfigAdvancedField,
  type TradingConfigWire,
  type TradingModeWire,
  type UpdateTradingConfigPayload,
} from '@crypto-trader/shared';
import {
  ADVANCED_FIELDS,
  type AdvancedDependency,
  type AdvancedFieldSpec,
  type AdvancedNumberFieldSpec,
  type SyntheticSwitchKey,
} from './advanced-fields';

export type BooleanAdvancedField = {
  [K in TradingConfigAdvancedField]: NonNullable<CreateTradingConfigInput[K]> extends boolean
    ? K
    : never;
}[TradingConfigAdvancedField];

type AdvancedDraftValue<K extends TradingConfigAdvancedField> = K extends BooleanAdvancedField
  ? boolean
  : K extends 'entryOrderMode'
    ? EntryOrderMode
    : string;

export type AdvancedDraft = { [K in TradingConfigAdvancedField]: AdvancedDraftValue<K> } & {
  [S in SyntheticSwitchKey]: boolean;
};

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function uiNumberToWireValue(spec: AdvancedNumberFieldSpec, uiValue: number): number {
  const raw = spec.scale === 'percent' ? roundTo(uiValue / 100, 6) : uiValue;
  return spec.integer ? Math.round(raw) : raw;
}

export function wireValueToUiString(spec: AdvancedNumberFieldSpec, wireValue: number): string {
  const uiValue = spec.scale === 'percent' ? roundTo(wireValue * 100, 4) : wireValue;
  return String(spec.integer ? Math.round(uiValue) : uiValue);
}

export function clampToRange(spec: AdvancedNumberFieldSpec, uiValue: number): number {
  return clamp(uiValue, spec.uiMin, spec.uiMax);
}

export const DEFAULT_ADVANCED_DRAFT: AdvancedDraft = {
  nativeProtectionEnabled: false,
  stopLimitOffsetPct: '0.2',
  closeOnProtectionFailure: false,
  trailingStopEnabled: false,
  trailingStopPct: '2',
  trailingActivationPct: '1',
  partialTpEnabled: false,
  partialTpTriggerPct: '2',
  partialTpSellPct: '50',
  moveStopToBreakevenAfterPartial: true,
  maxPositionHoldMinutes: '1440',
  lossCutEnabled: false,
  lossCutConfidenceThreshold: '85',
  lossCutMinLossPct: '0.5',
  lossCutMinEdgeRatio: '2',
  smartSizingEnabled: false,
  reduceSizeFactor: '50',
  deterministicGateEnabled: false,
  gatePriceChangePct: '0.5',
  reactiveLoopEnabled: false,
  maxActionsPerHour: '6',
  minActionIntervalSec: '60',
  entryOrderMode: 'MARKET',
  entryOrderTtlMinutes: '120',
  entryTrailingDeltaBips: '100',
  maxPositionHoldEnabled: false,
  entryTrailingDeltaEnabled: false,
};

export function toAdvancedDraft(cfg: TradingConfigWire): AdvancedDraft {
  const draft: Record<string, unknown> = {};
  for (const field of TRADING_CONFIG_ADVANCED_FIELDS) {
    const spec = ADVANCED_FIELDS[field];
    const wireValue = cfg[field];
    if (spec.kind === 'switch') {
      draft[field] = wireValue as boolean;
      continue;
    }
    if (spec.kind === 'enum') {
      draft[field] = wireValue as EntryOrderMode;
      continue;
    }
    if (spec.nullable && spec.syntheticSwitch) {
      // Synthetic switch never travels on the wire; null encodes "off" (architect.md D4).
      const isEnabled = wireValue !== null;
      draft[spec.syntheticSwitch] = isEnabled;
      draft[field] = isEnabled
        ? wireValueToUiString(spec, wireValue as number)
        : DEFAULT_ADVANCED_DRAFT[field];
      continue;
    }
    draft[field] = wireValueToUiString(spec, wireValue as number);
  }
  return draft as AdvancedDraft;
}

export function isFieldEnabled(
  field: TradingConfigAdvancedField,
  draft: AdvancedDraft,
  resolvedMode: TradingModeWire,
): boolean {
  return ADVANCED_FIELDS[field].dependsOn.every((dependency) =>
    matchesDependency(dependency, draft, resolvedMode),
  );
}

function matchesDependency(
  dependency: AdvancedDependency,
  draft: AdvancedDraft,
  resolvedMode: TradingModeWire,
): boolean {
  switch (dependency.kind) {
    case 'switch':
      return draft[dependency.field] === true;
    case 'syntheticSwitch':
      return draft[dependency.field] === true;
    case 'entryMode':
      return dependency.anyOf.includes(draft.entryOrderMode);
    case 'notSandbox':
      return resolvedMode !== 'SANDBOX';
  }
}

export function isDraftWithinRanges(draft: AdvancedDraft): boolean {
  return TRADING_CONFIG_ADVANCED_FIELDS.every((field) => {
    const spec = ADVANCED_FIELDS[field];
    if (spec.kind !== 'number') return true;
    const wireValue = uiNumberToWireValue(spec, Number(draft[field]));
    return wireValue >= spec.wireMin && wireValue <= spec.wireMax;
  });
}

type AdvancedFieldDiff =
  | { changed: false }
  | { changed: true; value: number | boolean | EntryOrderMode | null };

function toWireFieldValue(
  spec: AdvancedFieldSpec,
  value: AdvancedDraft[TradingConfigAdvancedField],
): number | boolean | EntryOrderMode {
  if (spec.kind === 'switch') return value as boolean;
  if (spec.kind === 'enum') return value as EntryOrderMode;
  return uiNumberToWireValue(spec, Number(value));
}

function diffAdvancedField(
  field: TradingConfigAdvancedField,
  baseline: AdvancedDraft,
  current: AdvancedDraft,
): AdvancedFieldDiff {
  const spec = ADVANCED_FIELDS[field];
  if (spec.kind === 'number' && spec.syntheticSwitch) {
    const wasEnabled = baseline[spec.syntheticSwitch];
    const isEnabled = current[spec.syntheticSwitch];
    if (wasEnabled !== isEnabled) {
      return isEnabled
        ? { changed: true, value: toWireFieldValue(spec, current[field]) }
        : { changed: true, value: null };
    }
    if (!isEnabled) return { changed: false };
  }
  if (baseline[field] === current[field]) return { changed: false };
  return { changed: true, value: toWireFieldValue(spec, current[field]) };
}

export function diffToCreateInput(
  baseline: AdvancedDraft,
  current: AdvancedDraft,
): Partial<CreateTradingConfigInput> {
  const payload: Record<string, unknown> = {};
  for (const field of TRADING_CONFIG_ADVANCED_FIELDS) {
    const diff = diffAdvancedField(field, baseline, current);
    if (!diff.changed || diff.value === null) continue;
    payload[field] = diff.value;
  }
  return payload as Partial<CreateTradingConfigInput>;
}

export function diffToUpdatePayload(
  baseline: AdvancedDraft,
  current: AdvancedDraft,
  baseDiff: Partial<UpdateTradingConfigPayload> = {},
): UpdateTradingConfigPayload {
  const payload: Record<string, unknown> = { ...baseDiff };
  for (const field of TRADING_CONFIG_ADVANCED_FIELDS) {
    const diff = diffAdvancedField(field, baseline, current);
    if (!diff.changed) continue;
    payload[field] = diff.value;
  }
  return payload as UpdateTradingConfigPayload;
}
