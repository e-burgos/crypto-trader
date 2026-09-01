import type { AgentTask } from './sub-agent.service';
import type { PersonaAgentId } from '../agents/agent-identity';

export const AGENT_TASK_MAX_TOKENS: Readonly<Record<AgentTask, number>> = {
  risk_gate: 350,
  sizing_suggestion: 350,
  intent_classification: 200,
  news_technical_relevance: 250,
  ecosystem_impact: 300,
  technical_signal: 500,
  // Subidos por FIX-e-burgos-014. Son las dos unicas tareas cuyos modelos por
  // defecto siguen truncando tras apagar el razonamiento: minimax-m2.7
  // (macro_context) NO permite apagarlo — responde 400 "Reasoning is mandatory" —
  // y deepseek-v4-flash razona de forma intermitente. CA-050 acota risk_gate y
  // sizing_suggestion, que quedan intactos.
  news_sentiment: 1500,
  macro_context: 1200,
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
