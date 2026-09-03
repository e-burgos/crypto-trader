import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ADVANCED_DRAFT } from './advanced-draft';
import { useAdvancedDraft } from './use-advanced-draft';

describe('useAdvancedDraft', () => {
  it('starts every field off, matching DEFAULT_ADVANCED_DRAFT', () => {
    const { result } = renderHook(() => useAdvancedDraft(DEFAULT_ADVANCED_DRAFT));
    expect(result.current.draft).toEqual(DEFAULT_ADVANCED_DRAFT);
    expect(result.current.changedFields.size).toBe(0);
    expect(result.current.isWithinRanges).toBe(true);
  });

  it('setField changes only the targeted field, leaving every other section untouched', () => {
    const { result } = renderHook(() => useAdvancedDraft(DEFAULT_ADVANCED_DRAFT));

    act(() => {
      result.current.setField('reactiveLoopEnabled', true);
    });

    expect(result.current.draft.reactiveLoopEnabled).toBe(true);
    for (const [field, value] of Object.entries(DEFAULT_ADVANCED_DRAFT)) {
      if (field === 'reactiveLoopEnabled') continue;
      expect(result.current.draft[field as keyof typeof DEFAULT_ADVANCED_DRAFT]).toBe(value);
    }
    expect(result.current.changedFields.has('reactiveLoopEnabled')).toBe(true);
    expect(result.current.changedFields.size).toBe(1);
  });

  it('isFieldEnabled reflects live draft state through resolvedMode', () => {
    const { result } = renderHook(() => useAdvancedDraft(DEFAULT_ADVANCED_DRAFT));
    expect(result.current.isFieldEnabled('trailingStopPct', 'TESTNET')).toBe(false);

    act(() => {
      result.current.setField('trailingStopEnabled', true);
    });

    expect(result.current.isFieldEnabled('trailingStopPct', 'TESTNET')).toBe(true);
  });

  it('flags an out-of-range draft as not within ranges', () => {
    const { result } = renderHook(() => useAdvancedDraft(DEFAULT_ADVANCED_DRAFT));

    act(() => {
      result.current.setField('minActionIntervalSec', '999999');
    });

    expect(result.current.isWithinRanges).toBe(false);
  });
});
