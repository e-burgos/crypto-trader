import type { ResolutionSource } from '@crypto-trader/shared';

export type AgentSourceTone = 'override' | 'admin' | 'default' | 'unknown';

export interface AgentSourceBadge {
  labelKey: string;
  tone: AgentSourceTone;
}

export function resolveSourceBadge(source: string): AgentSourceBadge {
  switch (source as ResolutionSource) {
    case 'override':
    case 'user':
      return { labelKey: 'settings.agents.usingOverride', tone: 'override' };
    case 'admin':
      return { labelKey: 'settings.agents.usingAdmin', tone: 'admin' };
    case 'preset':
    case 'credential':
      return { labelKey: 'settings.agents.usingDefault', tone: 'default' };
    default:
      return { labelKey: 'settings.agents.usingUnknown', tone: 'unknown' };
  }
}
