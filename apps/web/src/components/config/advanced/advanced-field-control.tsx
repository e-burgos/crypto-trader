import { useTranslation } from 'react-i18next';
import type { EntryOrderMode, TradingConfigAdvancedField, TradingModeWire } from '@crypto-trader/shared';
import { Callout, FormField, InfoTooltip, Select, SliderField, ToggleSwitch } from '@crypto-trader/ui';
import { ADVANCED_FIELDS, type AdvancedDependency } from './advanced-fields';
import { clampToRange, isFieldEnabled, type AdvancedDraft } from './advanced-draft';

export interface AdvancedFieldControlProps {
  field: TradingConfigAdvancedField;
  draft: AdvancedDraft;
  onChange: <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => void;
  resolvedMode: TradingModeWire;
}

const COHERENCE_REASON_KEY: Partial<Record<TradingConfigAdvancedField, string>> = {
  entryOrderTtlMinutes: 'config.advanced.entry.ttlMarketOnly',
  entryTrailingDeltaBips: 'config.advanced.entry.trailingOcoOnly',
};

function isCoherenceDependency(dependency: AdvancedDependency): boolean {
  return dependency.kind === 'entryMode' || dependency.kind === 'notSandbox';
}

function coherenceSatisfied(
  dependsOn: readonly AdvancedDependency[],
  draft: AdvancedDraft,
  resolvedMode: TradingModeWire,
): boolean {
  return dependsOn.filter(isCoherenceDependency).every((dependency) => {
    if (dependency.kind === 'entryMode') return dependency.anyOf.includes(draft.entryOrderMode);
    return resolvedMode !== 'SANDBOX';
  });
}

export function AdvancedFieldControl({ field, draft, onChange, resolvedMode }: AdvancedFieldControlProps) {
  const { t } = useTranslation();
  const spec = ADVANCED_FIELDS[field];
  const i18nBase = `config.advanced.${spec.section}.${field}`;
  const label = t(`${i18nBase}.label`);
  const hint = t(`${i18nBase}.hint`);
  const fullyEnabled = isFieldEnabled(field, draft, resolvedMode);
  const disabled = !fullyEnabled;

  if (spec.kind === 'switch') {
    return (
      <div className="flex items-start justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={disabled ? 'text-sm text-foreground opacity-60' : 'text-sm text-foreground'}>
            {label}
          </span>
          <InfoTooltip text={hint} />
        </div>
        <ToggleSwitch
          id={field}
          checked={Boolean(draft[field])}
          onChange={(checked) => onChange(field, checked)}
          disabled={disabled}
          ariaLabel={label}
        />
      </div>
    );
  }

  if (spec.kind === 'enum') {
    const options = spec.options.map((mode: EntryOrderMode) => ({
      value: mode,
      label: t(`${i18nBase}.options.${mode}`),
      description: t(`${i18nBase}.descriptions.${mode}`),
    }));
    return (
      <div className="space-y-2 py-2">
        <FormField label={label} htmlFor={field} hint={hint}>
          <Select
            options={options}
            value={draft[field] as EntryOrderMode}
            onChange={(value) => onChange(field, value as EntryOrderMode)}
            disabled={disabled}
          />
        </FormField>
        {disabled && <Callout variant="info">{t('config.advanced.entry.sandboxDisabled')}</Callout>}
      </div>
    );
  }

  const unit = t(`config.advanced.units.${spec.unit}`);
  const value = Number(draft[field]);
  const coherenceKey = COHERENCE_REASON_KEY[field];
  const coherenceOk = coherenceSatisfied(spec.dependsOn, draft, resolvedMode);

  if (spec.syntheticSwitch) {
    const syntheticKey = spec.syntheticSwitch;
    const synthOn = Boolean(draft[syntheticKey]);
    const toggleLabel = t(`${i18nBase}.toggleLabel`);
    const offTextKey = field === 'maxPositionHoldMinutes' ? 'noLimit' : 'fixedLevel';
    const offText = t(`${i18nBase}.${offTextKey}`);

    return (
      <div className="space-y-2 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={coherenceOk ? 'text-sm text-foreground' : 'text-sm text-foreground opacity-60'}>
              {toggleLabel}
            </span>
            <InfoTooltip text={hint} />
            {!coherenceOk && coherenceKey && <InfoTooltip text={t(coherenceKey)} />}
          </div>
          <ToggleSwitch
            id={`${field}-toggle`}
            checked={synthOn}
            onChange={(checked) => onChange(syntheticKey, checked)}
            disabled={!coherenceOk}
            ariaLabel={toggleLabel}
          />
        </div>
        {fullyEnabled ? (
          <SliderField
            id={field}
            label={label}
            hint={hint}
            value={value}
            onChange={(next) => onChange(field, String(clampToRange(spec, next)))}
            min={spec.uiMin}
            max={spec.uiMax}
            step={spec.uiStep}
            unit={unit}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{offText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-2">
      <SliderField
        id={field}
        label={label}
        hint={hint}
        tooltip={disabled && coherenceKey ? t(coherenceKey) : undefined}
        value={value}
        onChange={(next) => onChange(field, String(clampToRange(spec, next)))}
        min={spec.uiMin}
        max={spec.uiMax}
        step={spec.uiStep}
        unit={unit}
        disabled={disabled}
      />
    </div>
  );
}
