import {
  Bot,
  Cpu,
  TrendingUp,
  Link,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { AgentId } from '@crypto-trader/ui';

export const AGENT_ICON_MAP: Record<
  AgentId,
  React.ComponentType<{ className?: string }>
> = {
  platform: Cpu,
  operations: Bot,
  market: TrendingUp,
  blockchain: Link,
  risk: Shield,
  orchestrator: Sparkles,
};

export const AGENT_COLOR_MAP: Record<AgentId, { text: string; bg: string }> = {
  platform: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  operations: { text: 'text-orange-400', bg: 'bg-orange-500/10' },
  market: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  blockchain: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  risk: { text: 'text-red-400', bg: 'bg-red-500/10' },
  orchestrator: { text: 'text-primary', bg: 'bg-primary/10' },
};

export const AGENT_NAMES: Record<AgentId, string> = {
  platform: 'NEXUS',
  operations: 'FORGE',
  market: 'SIGMA',
  blockchain: 'CIPHER',
  risk: 'AEGIS',
  orchestrator: 'KRYPTO',
};
