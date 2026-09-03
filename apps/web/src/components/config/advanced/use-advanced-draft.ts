import { useCallback, useMemo, useState } from 'react';
import {
  TRADING_CONFIG_ADVANCED_FIELDS,
  type TradingConfigAdvancedField,
  type TradingModeWire,
} from '@crypto-trader/shared';
import { type AdvancedDraft, isDraftWithinRanges, isFieldEnabled } from './advanced-draft';

export interface UseAdvancedDraftResult {
  draft: AdvancedDraft;
  setField: <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => void;
  isFieldEnabled: (field: TradingConfigAdvancedField, resolvedMode: TradingModeWire) => boolean;
  changedFields: ReadonlySet<TradingConfigAdvancedField>;
  isWithinRanges: boolean;
}

export function useAdvancedDraft(baseline: AdvancedDraft): UseAdvancedDraftResult {
  const [draft, setDraft] = useState<AdvancedDraft>(baseline);

  const setField = useCallback(
    <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => {
      setDraft((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const isFieldEnabledInDraft = useCallback(
    (field: TradingConfigAdvancedField, resolvedMode: TradingModeWire) =>
      isFieldEnabled(field, draft, resolvedMode),
    [draft],
  );

  const changedFields = useMemo(
    () =>
      new Set(
        TRADING_CONFIG_ADVANCED_FIELDS.filter((field) => baseline[field] !== draft[field]),
      ),
    [baseline, draft],
  );

  const isWithinRanges = useMemo(() => isDraftWithinRanges(draft), [draft]);

  return {
    draft,
    setField,
    isFieldEnabled: isFieldEnabledInDraft,
    changedFields,
    isWithinRanges,
  };
}
