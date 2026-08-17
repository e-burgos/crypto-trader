import type { AgentTask } from '../orchestrator/sub-agent.service';

// AgentId (Prisma) has 8 values for 2 overlapping axes — 6 personas ∪ 7 model slots — see architect.md cycle-01 §7.1

export const PERSONA_AGENT_IDS = [
  'orchestrator',
  'platform',
  'operations',
  'market',
  'blockchain',
  'risk',
] as const;
export type PersonaAgentId = (typeof PERSONA_AGENT_IDS)[number];

export const MODEL_SLOT_IDS = [
  'routing',
  'synthesis',
  'platform',
  'operations',
  'market',
  'blockchain',
  'risk',
] as const;
export type ModelSlotId = (typeof MODEL_SLOT_IDS)[number];

export function resolveModelSlot(
  agentId: PersonaAgentId,
  task: AgentTask,
  preferCheap: boolean,
): ModelSlotId {
  if (agentId !== 'orchestrator') return agentId;
  return task === 'intent_classification' || preferCheap
    ? 'routing'
    : 'synthesis';
}

export function isPersonaAgent(value: string): value is PersonaAgentId {
  return (PERSONA_AGENT_IDS as readonly string[]).includes(value);
}

export function isModelSlot(value: string): value is ModelSlotId {
  return (MODEL_SLOT_IDS as readonly string[]).includes(value);
}
