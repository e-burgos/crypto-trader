export const AGENT_SLOT_WIRE_IDS = [
  'routing',
  'synthesis',
  'platform',
  'operations',
  'market',
  'blockchain',
  'risk',
] as const;
export type AgentSlotWireId = (typeof AGENT_SLOT_WIRE_IDS)[number];

export type ResolutionSource =
  | 'override'
  | 'user'
  | 'admin'
  | 'preset'
  | 'credential';

export interface ResolvedAgentModelWire {
  slot: AgentSlotWireId;
  provider: string;
  model: string;
  source: ResolutionSource;
}

export interface AgentHealthItemWire extends ResolvedAgentModelWire {
  healthy: boolean;
  hasKey: boolean;
}

export interface AgentHealthReportWire {
  healthy: boolean;
  agents: AgentHealthItemWire[];
}
