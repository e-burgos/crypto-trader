import { describe, expect, it } from 'vitest';
import { TRADING_CONFIG_ADVANCED_FIELDS } from '@crypto-trader/shared';
import { ADVANCED_FIELDS } from './advanced-fields';
import { DEFAULT_ADVANCED_DRAFT, uiNumberToWireValue } from './advanced-draft';

describe('ADVANCED_FIELDS catalogue', () => {
  it('declares exactly the fields of TRADING_CONFIG_ADVANCED_FIELDS, no more, no less', () => {
    expect(new Set(Object.keys(ADVANCED_FIELDS))).toEqual(
      new Set(TRADING_CONFIG_ADVANCED_FIELDS),
    );
  });

  it('converts every ui range bound to the exact wire range bound', () => {
    for (const field of TRADING_CONFIG_ADVANCED_FIELDS) {
      const spec = ADVANCED_FIELDS[field];
      if (spec.kind !== 'number') continue;
      expect(uiNumberToWireValue(spec, spec.uiMin)).toBeCloseTo(spec.wireMin, 6);
      expect(uiNumberToWireValue(spec, spec.uiMax)).toBeCloseTo(spec.wireMax, 6);
    }
  });

  it('has every boolean field off by default except moveStopToBreakevenAfterPartial (D6)', () => {
    const booleanFields = TRADING_CONFIG_ADVANCED_FIELDS.filter(
      (field) => ADVANCED_FIELDS[field].kind === 'switch',
    );
    for (const field of booleanFields) {
      if (field === 'moveStopToBreakevenAfterPartial') {
        expect(DEFAULT_ADVANCED_DRAFT[field]).toBe(true);
        continue;
      }
      expect(DEFAULT_ADVANCED_DRAFT[field]).toBe(false);
    }
  });

  it('has both synthetic switches off by default', () => {
    expect(DEFAULT_ADVANCED_DRAFT.maxPositionHoldEnabled).toBe(false);
    expect(DEFAULT_ADVANCED_DRAFT.entryTrailingDeltaEnabled).toBe(false);
  });

  it('never lets a switch dependency cross into another section', () => {
    for (const field of TRADING_CONFIG_ADVANCED_FIELDS) {
      const spec = ADVANCED_FIELDS[field];
      for (const dependency of spec.dependsOn) {
        if (dependency.kind !== 'switch') continue;
        expect(ADVANCED_FIELDS[dependency.field].section).toBe(spec.section);
      }
    }
  });
});
