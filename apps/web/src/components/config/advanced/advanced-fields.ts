import {
  TRADING_CONFIG_ADVANCED_FIELDS,
  type EntryOrderMode,
  type TradingConfigAdvancedField,
} from '@crypto-trader/shared';

export type AdvancedSectionId = 'protection' | 'signal' | 'reactive' | 'entry';

export type SyntheticSwitchKey = 'maxPositionHoldEnabled' | 'entryTrailingDeltaEnabled';

export type AdvancedDependency =
  | { kind: 'switch'; field: TradingConfigAdvancedField }
  | { kind: 'syntheticSwitch'; field: SyntheticSwitchKey }
  | { kind: 'entryMode'; anyOf: readonly EntryOrderMode[] }
  | { kind: 'notSandbox' };

export type AdvancedFieldSpec =
  | { kind: 'switch'; section: AdvancedSectionId; dependsOn: readonly AdvancedDependency[] }
  | {
      kind: 'number';
      section: AdvancedSectionId;
      scale: 'percent' | 'raw';
      integer: boolean;
      uiMin: number;
      uiMax: number;
      uiStep: number;
      unit: 'percent' | 'times' | 'minutes' | 'seconds' | 'bips' | 'count';
      wireMin: number;
      wireMax: number;
      nullable: boolean;
      syntheticSwitch?: SyntheticSwitchKey;
      dependsOn: readonly AdvancedDependency[];
    }
  | {
      kind: 'enum';
      section: AdvancedSectionId;
      options: readonly EntryOrderMode[];
      dependsOn: readonly AdvancedDependency[];
    };

export type AdvancedNumberFieldSpec = Extract<AdvancedFieldSpec, { kind: 'number' }>;

const switchOn = (field: TradingConfigAdvancedField): AdvancedDependency => ({
  kind: 'switch',
  field,
});

export const ADVANCED_FIELDS: Record<TradingConfigAdvancedField, AdvancedFieldSpec> = {
  nativeProtectionEnabled: { kind: 'switch', section: 'protection', dependsOn: [] },
  stopLimitOffsetPct: {
    kind: 'number',
    section: 'protection',
    scale: 'percent',
    integer: false,
    uiMin: 0,
    uiMax: 5,
    uiStep: 0.1,
    unit: 'percent',
    wireMin: 0,
    wireMax: 0.05,
    nullable: false,
    dependsOn: [switchOn('nativeProtectionEnabled')],
  },
  closeOnProtectionFailure: {
    kind: 'switch',
    section: 'protection',
    dependsOn: [switchOn('nativeProtectionEnabled')],
  },
  trailingStopEnabled: { kind: 'switch', section: 'protection', dependsOn: [] },
  trailingStopPct: {
    kind: 'number',
    section: 'protection',
    scale: 'percent',
    integer: false,
    uiMin: 0.1,
    uiMax: 100,
    uiStep: 0.1,
    unit: 'percent',
    wireMin: 0.001,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('trailingStopEnabled')],
  },
  trailingActivationPct: {
    kind: 'number',
    section: 'protection',
    scale: 'percent',
    integer: false,
    uiMin: 0.1,
    uiMax: 100,
    uiStep: 0.1,
    unit: 'percent',
    wireMin: 0.001,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('trailingStopEnabled')],
  },
  partialTpEnabled: { kind: 'switch', section: 'protection', dependsOn: [] },
  partialTpTriggerPct: {
    kind: 'number',
    section: 'protection',
    scale: 'percent',
    integer: false,
    uiMin: 0.1,
    uiMax: 100,
    uiStep: 0.1,
    unit: 'percent',
    wireMin: 0.001,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('partialTpEnabled')],
  },
  partialTpSellPct: {
    kind: 'number',
    section: 'protection',
    scale: 'percent',
    integer: false,
    uiMin: 5,
    uiMax: 100,
    uiStep: 1,
    unit: 'percent',
    wireMin: 0.05,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('partialTpEnabled')],
  },
  moveStopToBreakevenAfterPartial: {
    kind: 'switch',
    section: 'protection',
    dependsOn: [switchOn('partialTpEnabled')],
  },
  maxPositionHoldMinutes: {
    kind: 'number',
    section: 'protection',
    scale: 'raw',
    integer: true,
    uiMin: 5,
    uiMax: 43200,
    uiStep: 5,
    unit: 'minutes',
    wireMin: 5,
    wireMax: 43200,
    nullable: true,
    syntheticSwitch: 'maxPositionHoldEnabled',
    dependsOn: [{ kind: 'syntheticSwitch', field: 'maxPositionHoldEnabled' }],
  },
  lossCutEnabled: { kind: 'switch', section: 'signal', dependsOn: [] },
  lossCutConfidenceThreshold: {
    kind: 'number',
    section: 'signal',
    scale: 'percent',
    integer: false,
    uiMin: 0,
    uiMax: 100,
    uiStep: 1,
    unit: 'percent',
    wireMin: 0,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('lossCutEnabled')],
  },
  lossCutMinLossPct: {
    kind: 'number',
    section: 'signal',
    scale: 'percent',
    integer: false,
    uiMin: 0,
    uiMax: 50,
    uiStep: 0.1,
    unit: 'percent',
    wireMin: 0,
    wireMax: 0.5,
    nullable: false,
    dependsOn: [switchOn('lossCutEnabled')],
  },
  lossCutMinEdgeRatio: {
    kind: 'number',
    section: 'signal',
    scale: 'raw',
    integer: false,
    uiMin: 0,
    uiMax: 100,
    uiStep: 0.1,
    unit: 'times',
    wireMin: 0,
    wireMax: 100,
    nullable: false,
    dependsOn: [switchOn('lossCutEnabled')],
  },
  smartSizingEnabled: { kind: 'switch', section: 'signal', dependsOn: [] },
  reduceSizeFactor: {
    kind: 'number',
    section: 'signal',
    scale: 'percent',
    integer: false,
    uiMin: 5,
    uiMax: 100,
    uiStep: 1,
    unit: 'percent',
    wireMin: 0.05,
    wireMax: 1,
    nullable: false,
    dependsOn: [switchOn('smartSizingEnabled')],
  },
  deterministicGateEnabled: { kind: 'switch', section: 'signal', dependsOn: [] },
  gatePriceChangePct: {
    kind: 'number',
    section: 'signal',
    scale: 'percent',
    integer: false,
    uiMin: 0.05,
    uiMax: 5,
    uiStep: 0.05,
    unit: 'percent',
    wireMin: 0.0005,
    wireMax: 0.05,
    nullable: false,
    dependsOn: [switchOn('deterministicGateEnabled')],
  },
  reactiveLoopEnabled: { kind: 'switch', section: 'reactive', dependsOn: [] },
  maxActionsPerHour: {
    kind: 'number',
    section: 'reactive',
    scale: 'raw',
    integer: true,
    uiMin: 1,
    uiMax: 60,
    uiStep: 1,
    unit: 'count',
    wireMin: 1,
    wireMax: 60,
    nullable: false,
    dependsOn: [switchOn('reactiveLoopEnabled')],
  },
  minActionIntervalSec: {
    kind: 'number',
    section: 'reactive',
    scale: 'raw',
    integer: true,
    uiMin: 5,
    uiMax: 3600,
    uiStep: 5,
    unit: 'seconds',
    wireMin: 5,
    wireMax: 3600,
    nullable: false,
    dependsOn: [switchOn('reactiveLoopEnabled')],
  },
  entryOrderMode: {
    kind: 'enum',
    section: 'entry',
    options: ['MARKET', 'LIMIT_MAKER', 'OCO'],
    dependsOn: [{ kind: 'notSandbox' }],
  },
  entryOrderTtlMinutes: {
    kind: 'number',
    section: 'entry',
    scale: 'raw',
    integer: true,
    uiMin: 5,
    uiMax: 1440,
    uiStep: 5,
    unit: 'minutes',
    wireMin: 5,
    wireMax: 1440,
    nullable: false,
    dependsOn: [{ kind: 'entryMode', anyOf: ['LIMIT_MAKER', 'OCO'] }],
  },
  entryTrailingDeltaBips: {
    kind: 'number',
    section: 'entry',
    scale: 'raw',
    integer: true,
    uiMin: 10,
    uiMax: 2000,
    uiStep: 10,
    unit: 'bips',
    wireMin: 10,
    wireMax: 2000,
    nullable: true,
    syntheticSwitch: 'entryTrailingDeltaEnabled',
    dependsOn: [
      { kind: 'entryMode', anyOf: ['OCO'] },
      { kind: 'syntheticSwitch', field: 'entryTrailingDeltaEnabled' },
    ],
  },
};

export const ADVANCED_SECTION_IDS: readonly AdvancedSectionId[] = [
  'protection',
  'signal',
  'reactive',
  'entry',
];

export function fieldsBySection(section: AdvancedSectionId): TradingConfigAdvancedField[] {
  return TRADING_CONFIG_ADVANCED_FIELDS.filter((field) => ADVANCED_FIELDS[field].section === section);
}
