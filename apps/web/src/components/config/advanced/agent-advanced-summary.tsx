import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, KeyValueRow, SectionTitle } from '@crypto-trader/ui';
import type { TradingConfigAdvancedField, TradingConfigWire } from '@crypto-trader/shared';
import {
  ADVANCED_FIELDS,
  ADVANCED_SECTION_IDS,
  fieldsBySection,
  type AdvancedDependency,
  type AdvancedNumberFieldSpec,
} from './advanced-fields';
import { wireValueToUiString } from './advanced-draft';

function matchesDependency(dependency: AdvancedDependency, cfg: TradingConfigWire): boolean {
  switch (dependency.kind) {
    case 'switch':
      return (cfg[dependency.field] as unknown as boolean) === true;
    case 'syntheticSwitch':
      return dependency.field === 'maxPositionHoldEnabled'
        ? cfg.maxPositionHoldMinutes !== null
        : cfg.entryTrailingDeltaBips !== null;
    case 'entryMode':
      return (dependency.anyOf as readonly string[]).includes(cfg.entryOrderMode);
    case 'notSandbox':
      return cfg.mode !== 'SANDBOX';
  }
}

function isFieldApplicable(field: TradingConfigAdvancedField, cfg: TradingConfigWire): boolean {
  return ADVANCED_FIELDS[field].dependsOn.every((dependency) => matchesDependency(dependency, cfg));
}

function resolveEntryOrderMode(value: string): string {
  const spec = ADVANCED_FIELDS.entryOrderMode;
  return spec.kind === 'enum' && (spec.options as readonly string[]).includes(value)
    ? value
    : 'unknown';
}

function formatUnitValue(uiValue: string, unit: AdvancedNumberFieldSpec['unit'], unitLabel: string): string {
  if (unit === 'count') return uiValue;
  if (unit === 'percent' || unit === 'times') return `${uiValue}${unitLabel}`;
  return `${uiValue} ${unitLabel}`;
}

export function AgentAdvancedSummary({ cfg }: { cfg: TradingConfigWire }) {
  const { t } = useTranslation();

  function renderNotApplicable(): ReactNode {
    return (
      <span className="text-muted-foreground">{t('config.advanced.common.notApplicable')}</span>
    );
  }

  function renderFieldValue(field: TradingConfigAdvancedField): ReactNode {
    const spec = ADVANCED_FIELDS[field];

    if (spec.kind === 'switch') {
      if (!isFieldApplicable(field, cfg)) return renderNotApplicable();
      const enabled = (cfg[field] as unknown as boolean) === true;
      return (
        <Badge
          variant={enabled ? 'success' : 'neutral'}
          label={t(enabled ? 'config.advanced.common.enabled' : 'config.advanced.common.disabled')}
        />
      );
    }

    if (spec.kind === 'enum') {
      const resolved = resolveEntryOrderMode(cfg[field] as unknown as string);
      if (resolved === 'unknown') {
        return <Badge variant="neutral" label={t('config.advanced.common.unknown')} />;
      }
      return <span>{t(`config.advanced.entry.entryOrderMode.options.${resolved}`)}</span>;
    }

    const wireValue = cfg[field] as unknown as number | null;
    if (spec.nullable) {
      if (wireValue === null) {
        const key =
          field === 'maxPositionHoldMinutes'
            ? 'config.advanced.protection.maxPositionHoldMinutes.noLimit'
            : 'config.advanced.entry.entryTrailingDeltaBips.fixedLevel';
        return <span className="text-muted-foreground">{t(key)}</span>;
      }
      const unitLabel = t(`config.advanced.units.${spec.unit}`);
      return <span>{formatUnitValue(wireValueToUiString(spec, wireValue), spec.unit, unitLabel)}</span>;
    }

    if (!isFieldApplicable(field, cfg)) return renderNotApplicable();
    const unitLabel = t(`config.advanced.units.${spec.unit}`);
    return (
      <span>{formatUnitValue(wireValueToUiString(spec, wireValue as number), spec.unit, unitLabel)}</span>
    );
  }

  return (
    <div className="space-y-4">
      {ADVANCED_SECTION_IDS.map((sectionId) => (
        <div key={sectionId} className="space-y-1">
          <SectionTitle title={t(`config.advanced.${sectionId}.title`)} size="sm" />
          <div className="rounded-lg bg-muted/30 px-3 divide-y divide-border/50">
            {fieldsBySection(sectionId).map((field) => (
              <KeyValueRow
                key={field}
                label={t(`config.advanced.${sectionId}.${field}.label`)}
                value={renderFieldValue(field)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
