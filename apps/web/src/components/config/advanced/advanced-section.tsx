import { useTranslation } from 'react-i18next';
import type { TradingConfigAdvancedField, TradingModeWire } from '@crypto-trader/shared';
import { Collapsible } from '@crypto-trader/ui';
import type { AdvancedSectionId } from './advanced-fields';
import type { AdvancedDraft } from './advanced-draft';
import { AdvancedFieldControl } from './advanced-field-control';

export interface AdvancedSectionProps {
  sectionId: AdvancedSectionId;
  fields: readonly TradingConfigAdvancedField[];
  draft: AdvancedDraft;
  onChange: <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => void;
  resolvedMode: TradingModeWire;
  defaultOpen?: boolean;
}

export function AdvancedSection({
  sectionId,
  fields,
  draft,
  onChange,
  resolvedMode,
  defaultOpen = false,
}: AdvancedSectionProps) {
  const { t } = useTranslation();
  const title = t(`config.advanced.${sectionId}.title`);
  const hint = t(`config.advanced.${sectionId}.hint`);

  return (
    <div className="rounded-lg border border-border px-3">
      <Collapsible
        defaultOpen={defaultOpen}
        trigger={
          <span className="flex flex-col items-start text-left">
            <span>{title}</span>
            <span className="text-xs font-normal text-muted-foreground">{hint}</span>
          </span>
        }
      >
        <div className="divide-y divide-border pb-3">
          {fields.map((field) => (
            <AdvancedFieldControl
              key={field}
              field={field}
              draft={draft}
              onChange={onChange}
              resolvedMode={resolvedMode}
            />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}
