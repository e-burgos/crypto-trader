import type { TradingModeWire } from '@crypto-trader/shared';
import { fieldsBySection, type AdvancedSectionId } from './advanced-fields';
import { DEFAULT_ADVANCED_DRAFT, type AdvancedDraft } from './advanced-draft';
import { AdvancedSection } from './advanced-section';

export interface AdvancedConfigSectionsProps {
  draft: AdvancedDraft;
  onChange: <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => void;
  resolvedMode: TradingModeWire;
  surface: 'create' | 'edit';
}

const RENDERED_SECTIONS: readonly AdvancedSectionId[] = ['protection', 'signal'];

function sectionHasNonDefaultValue(sectionId: AdvancedSectionId, draft: AdvancedDraft): boolean {
  return fieldsBySection(sectionId).some((field) => draft[field] !== DEFAULT_ADVANCED_DRAFT[field]);
}

export function AdvancedConfigSections({ draft, onChange, resolvedMode, surface }: AdvancedConfigSectionsProps) {
  return (
    <div className="space-y-3">
      {RENDERED_SECTIONS.map((sectionId) => (
        <AdvancedSection
          key={sectionId}
          sectionId={sectionId}
          fields={fieldsBySection(sectionId)}
          draft={draft}
          onChange={onChange}
          resolvedMode={resolvedMode}
          defaultOpen={surface === 'edit' && sectionHasNonDefaultValue(sectionId, draft)}
        />
      ))}
    </div>
  );
}
