import {
  TRADING_CONFIG_BASE_FIELDS,
  TRADING_CONFIG_ADVANCED_FIELDS,
  type CreateTradingConfigInput,
  type ExactKeys,
  type AssertNoKeyDrift,
} from './trading-config-wire';

const ALL_CREATE_TRADING_CONFIG_KEYS: readonly (keyof CreateTradingConfigInput)[] = Object.freeze([
  'name', 'asset', 'pair', 'mode',
  'buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct', 'minProfitPct',
  'maxTradePct', 'maxConcurrentPositions', 'minIntervalMinutes', 'orderPriceOffsetPct',
  'intervalMode', 'riskProfile',
  'lossCutEnabled', 'lossCutConfidenceThreshold', 'lossCutMinLossPct', 'lossCutMinEdgeRatio',
  'smartSizingEnabled', 'reduceSizeFactor',
  'nativeProtectionEnabled', 'closeOnProtectionFailure', 'stopLimitOffsetPct',
  'trailingStopEnabled', 'trailingStopPct', 'trailingActivationPct',
  'partialTpEnabled', 'partialTpTriggerPct', 'partialTpSellPct',
  'moveStopToBreakevenAfterPartial', 'maxPositionHoldMinutes',
  'deterministicGateEnabled', 'gatePriceChangePct',
  'reactiveLoopEnabled', 'maxActionsPerHour', 'minActionIntervalSec',
  'entryOrderMode', 'entryOrderTtlMinutes', 'entryTrailingDeltaBips',
]);

type FrozenCreateTradingConfigKey = (typeof ALL_CREATE_TRADING_CONFIG_KEYS)[number];

export type _CreateTradingConfigInputHasExactlyTheFrozenKeys = AssertNoKeyDrift<
  ExactKeys<Record<FrozenCreateTradingConfigKey, unknown>, CreateTradingConfigInput>
>;

describe('TradingConfig wire field partitions', () => {
  it('has exactly 40 keys in the frozen DTO key list', () => {
    expect(ALL_CREATE_TRADING_CONFIG_KEYS.length).toBe(40);
  });

  it('has 15 base fields and 25 advanced fields summing to 40', () => {
    expect(TRADING_CONFIG_BASE_FIELDS.length).toBe(15);
    expect(TRADING_CONFIG_ADVANCED_FIELDS.length).toBe(25);
    expect(TRADING_CONFIG_BASE_FIELDS.length + TRADING_CONFIG_ADVANCED_FIELDS.length).toBe(40);
  });

  it('has no duplicate fields within the base partition', () => {
    expect(new Set(TRADING_CONFIG_BASE_FIELDS).size).toBe(TRADING_CONFIG_BASE_FIELDS.length);
  });

  it('has no duplicate fields within the advanced partition', () => {
    expect(new Set(TRADING_CONFIG_ADVANCED_FIELDS).size).toBe(TRADING_CONFIG_ADVANCED_FIELDS.length);
  });

  it('has no intersection between base and advanced fields', () => {
    const advancedSet = new Set<string>(TRADING_CONFIG_ADVANCED_FIELDS);
    const overlap = TRADING_CONFIG_BASE_FIELDS.filter((field) => advancedSet.has(field));
    expect(overlap).toEqual([]);
  });

  it('partitions exactly the 40 keys of CreateTradingConfigInput', () => {
    const union = new Set<string>([...TRADING_CONFIG_BASE_FIELDS, ...TRADING_CONFIG_ADVANCED_FIELDS]);
    const expected = new Set<string>(ALL_CREATE_TRADING_CONFIG_KEYS);
    expect(union.size).toBe(expected.size);
    expect([...union].sort()).toEqual([...expected].sort());
  });
});
