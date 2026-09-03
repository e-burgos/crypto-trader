import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  TRADING_CONFIG_ADVANCED_FIELDS,
  type TradingConfigAdvancedField,
  type TradingConfigWire,
} from '@crypto-trader/shared';
import '../../../lib/i18n';
import i18n from '../../../lib/i18n';
import { AdvancedConfigSections } from './advanced-config-sections';
import { ADVANCED_FIELDS, ADVANCED_SECTION_IDS, type AdvancedSectionId } from './advanced-fields';
import {
  DEFAULT_ADVANCED_DRAFT,
  diffToUpdatePayload,
  isFieldEnabled,
  toAdvancedDraft,
  type AdvancedDraft,
} from './advanced-draft';
import {
  configAllOff,
  configAllOn,
  configEntryOnly,
  configProtectionOnly,
  configReactiveOnly,
  configSignalOnly,
  configWithUnknownValues,
} from './fixtures';

function noop() {
  return undefined;
}

function Harness({
  draft,
  resolvedMode,
}: {
  draft: AdvancedDraft;
  resolvedMode: TradingConfigWire['mode'];
}) {
  return (
    <AdvancedConfigSections draft={draft} onChange={noop} resolvedMode={resolvedMode} surface="create" />
  );
}

function openSection(sectionId: AdvancedSectionId) {
  const title = i18n.t(`config.advanced.${sectionId}.title`);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
}

function fieldLabel(field: TradingConfigAdvancedField): string {
  const { section } = ADVANCED_FIELDS[field];
  return i18n.t(`config.advanced.${section}.${field}.label`);
}

function queryControl(field: TradingConfigAdvancedField, draft: AdvancedDraft): HTMLElement | null {
  const spec = ADVANCED_FIELDS[field];
  if (spec.kind === 'switch') {
    return screen.queryByRole('switch', { name: fieldLabel(field) });
  }
  if (spec.kind === 'enum') {
    const optionLabel = i18n.t(`config.advanced.${spec.section}.${field}.options.${draft[field]}`);
    return screen.queryByRole('button', { name: optionLabel });
  }
  return screen.queryByRole('slider', { name: fieldLabel(field) });
}

function expectControlEnabled(field: TradingConfigAdvancedField, draft: AdvancedDraft) {
  const control = queryControl(field, draft);
  expect(control).not.toBeNull();
  expect(control as HTMLElement).toBeEnabled();
}

function expectControlDisabled(field: TradingConfigAdvancedField, draft: AdvancedDraft) {
  const spec = ADVANCED_FIELDS[field];
  const control = queryControl(field, draft);
  if (spec.kind === 'number' && spec.syntheticSwitch) {
    expect(control).toBeNull();
    return;
  }
  expect(control).not.toBeNull();
  expect(control as HTMLElement).toBeDisabled();
}

const FIXTURE_BY_SECTION: Record<AdvancedSectionId, TradingConfigWire> = {
  protection: configProtectionOnly,
  signal: configSignalOnly,
  reactive: configReactiveOnly,
  entry: configEntryOnly,
};

const DEPENDENT_FIELDS = TRADING_CONFIG_ADVANCED_FIELDS.filter(
  (field) => ADVANCED_FIELDS[field].dependsOn.length > 0,
);
const ROOT_SWITCH_FIELDS = TRADING_CONFIG_ADVANCED_FIELDS.filter(
  (field) => ADVANCED_FIELDS[field].dependsOn.length === 0,
);
const SWITCH_FIELDS = TRADING_CONFIG_ADVANCED_FIELDS.filter(
  (field) => ADVANCED_FIELDS[field].kind === 'switch',
);

describe('CA-001 twin — the wire partition matches the web catalogue', () => {
  it('TRADING_CONFIG_ADVANCED_FIELDS set-equals Object.keys(ADVANCED_FIELDS)', () => {
    expect(new Set(Object.keys(ADVANCED_FIELDS))).toEqual(new Set(TRADING_CONFIG_ADVANCED_FIELDS));
  });
});

describe('isFieldEnabled — root switches (empty dependsOn) are always enabled', () => {
  it.each(ROOT_SWITCH_FIELDS)('%s has no gating dependency', (field) => {
    expect(isFieldEnabled(field, toAdvancedDraft(configAllOff), configAllOff.mode)).toBe(true);
    expect(isFieldEnabled(field, toAdvancedDraft(configAllOn), configAllOn.mode)).toBe(true);
  });
});

describe.each(DEPENDENT_FIELDS)('§6.5 enablement table — %s', (field) => {
  const spec = ADVANCED_FIELDS[field];
  const ownFixture = FIXTURE_BY_SECTION[spec.section];
  const ownDraft = toAdvancedDraft(ownFixture);
  const offDraft = toAdvancedDraft(configAllOff);
  const otherSections = ADVANCED_SECTION_IDS.filter((section) => section !== spec.section);

  it('isFieldEnabled is true once its own section fixture satisfies every dependency', () => {
    expect(isFieldEnabled(field, ownDraft, ownFixture.mode)).toBe(true);
  });

  it('isFieldEnabled is false from the fully-off fixture', () => {
    expect(isFieldEnabled(field, offDraft, configAllOff.mode)).toBe(false);
  });

  it.each(otherSections)(
    'isFieldEnabled stays false under the %s-only fixture (no cross-section dependency)',
    (otherSection) => {
      const otherFixture = FIXTURE_BY_SECTION[otherSection];
      expect(isFieldEnabled(field, toAdvancedDraft(otherFixture), otherFixture.mode)).toBe(false);
    },
  );

  it('the rendered control follows the same enabled/disabled split', () => {
    const enabledRender = render(<Harness draft={ownDraft} resolvedMode={ownFixture.mode} />);
    openSection(spec.section);
    expectControlEnabled(field, ownDraft);
    enabledRender.unmount();

    render(<Harness draft={offDraft} resolvedMode={configAllOff.mode} />);
    openSection(spec.section);
    expectControlDisabled(field, offDraft);
  });
});

describe('diffToUpdatePayload — a single switch never leaks into another key', () => {
  it.each(SWITCH_FIELDS)('toggling %s alone on DEFAULT_ADVANCED_DRAFT diffs only that key', (field) => {
    const current: Record<string, unknown> = {
      ...DEFAULT_ADVANCED_DRAFT,
      [field]: !DEFAULT_ADVANCED_DRAFT[field],
    };
    const diff = diffToUpdatePayload(DEFAULT_ADVANCED_DRAFT, current as AdvancedDraft);
    expect(Object.keys(diff)).toEqual([field]);
    expect(diff[field as keyof typeof diff]).toBe(!DEFAULT_ADVANCED_DRAFT[field]);
  });
});

describe('diffToUpdatePayload — full off-to-on transition', () => {
  it('touches exactly the 25 advanced keys', () => {
    const baseline = toAdvancedDraft(configAllOff);
    const current = toAdvancedDraft(configAllOn);
    const diff = diffToUpdatePayload(baseline, current);
    expect(new Set(Object.keys(diff))).toEqual(new Set(TRADING_CONFIG_ADVANCED_FIELDS));
    expect(Object.keys(diff)).toHaveLength(TRADING_CONFIG_ADVANCED_FIELDS.length);
  });
});

describe('degradation — configWithUnknownValues', () => {
  it('an unrecognized entryOrderMode disables every entry dependent without throwing', () => {
    const draft = toAdvancedDraft(configWithUnknownValues);
    const resolvedMode = configWithUnknownValues.mode;
    expect(() => isFieldEnabled('entryOrderTtlMinutes', draft, resolvedMode)).not.toThrow();
    expect(isFieldEnabled('entryOrderTtlMinutes', draft, resolvedMode)).toBe(false);
    expect(isFieldEnabled('entryTrailingDeltaBips', draft, resolvedMode)).toBe(false);
  });
});
