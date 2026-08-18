import { describe, it, expect } from 'vitest';
import { resolveSourceBadge } from './agent-source-badge';

describe('resolveSourceBadge', () => {
  it.each([
    ['override', 'settings.agents.usingOverride', 'override'],
    ['user', 'settings.agents.usingOverride', 'override'],
    ['admin', 'settings.agents.usingAdmin', 'admin'],
    ['preset', 'settings.agents.usingDefault', 'default'],
    ['credential', 'settings.agents.usingDefault', 'default'],
  ])('resolves %s to labelKey %s and tone %s', (source, labelKey, tone) => {
    expect(resolveSourceBadge(source)).toEqual({ labelKey, tone });
  });

  it('degrades an unknown source to the unknown tone', () => {
    expect(resolveSourceBadge('marciano')).toEqual({
      labelKey: 'settings.agents.usingUnknown',
      tone: 'unknown',
    });
  });
});
