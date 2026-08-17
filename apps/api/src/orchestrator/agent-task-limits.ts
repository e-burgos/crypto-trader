import type { AgentTask } from './sub-agent.service';
import type { PersonaAgentId } from '../agents/agent-identity';

export const AGENT_TASK_MAX_TOKENS: Readonly<Record<AgentTask, number>> = {
  risk_gate: 350,
  sizing_suggestion: 350,
  intent_classification: 200,
  news_technical_relevance: 250,
  ecosystem_impact: 300,
  technical_signal: 500,
  news_sentiment: 500,
  macro_context: 600,
  decision_synthesis: 700,
  cross_agent_synthesis: 1024,
};

export function resolveMaxTokensForTask(task: AgentTask): number {
  return AGENT_TASK_MAX_TOKENS[task] ?? 1024;
}

export class LLMTruncatedResponseError extends Error {
  constructor(agentId: PersonaAgentId, task: AgentTask) {
    super(`LLM response truncated for agent=${agentId} task=${task}`);
    this.name = 'LLMTruncatedResponseError';
  }
}
