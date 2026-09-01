import {
  AGENT_TASK_MAX_TOKENS,
  LLMTruncatedResponseError,
  resolveMaxTokensForTask,
} from './agent-task-limits';
import { AgentTask } from './sub-agent.service';

describe('AGENT_TASK_MAX_TOKENS', () => {
  // Los valores salen del architect.md de spec-001 cycle-03, con DOS
  // desviaciones registradas en FIX-e-burgos-014: news_sentiment (500 -> 900) y
  // macro_context (600 -> 1200). Son las unicas tareas cuyos modelos siguen
  // truncando tras apagar el razonamiento, porque minimax-m2.7 no permite
  // apagarlo (400 "Reasoning is mandatory") y deepseek-v4-flash razona de forma
  // intermitente. Los limites que CA-050 acota quedan intactos, y el harness de
  // costo CA-060/CA-061 sigue en verde con estos valores.
  it('defines the exact limits, with the deviations of FIX-e-burgos-014', () => {
    expect(AGENT_TASK_MAX_TOKENS).toEqual({
      risk_gate: 350,
      sizing_suggestion: 350,
      intent_classification: 200,
      news_technical_relevance: 250,
      ecosystem_impact: 300,
      technical_signal: 500,
      news_sentiment: 1500,
      macro_context: 1200,
      decision_synthesis: 700,
      cross_agent_synthesis: 1024,
    });
  });

  it('keeps risk_gate and sizing_suggestion within the 300-400 range (CA-050)', () => {
    expect(AGENT_TASK_MAX_TOKENS.risk_gate).toBeGreaterThanOrEqual(300);
    expect(AGENT_TASK_MAX_TOKENS.risk_gate).toBeLessThanOrEqual(400);
    expect(AGENT_TASK_MAX_TOKENS.sizing_suggestion).toBeGreaterThanOrEqual(
      300,
    );
    expect(AGENT_TASK_MAX_TOKENS.sizing_suggestion).toBeLessThanOrEqual(400);
  });
});

describe('resolveMaxTokensForTask', () => {
  it.each(Object.entries(AGENT_TASK_MAX_TOKENS) as [AgentTask, number][])(
    'resolves %s to its table value',
    (task, expected) => {
      expect(resolveMaxTokensForTask(task)).toBe(expected);
    },
  );
});

describe('LLMTruncatedResponseError', () => {
  it('carries the agent and task in its message', () => {
    const err = new LLMTruncatedResponseError('risk', 'risk_gate');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LLMTruncatedResponseError');
    expect(err.message).toContain('risk');
    expect(err.message).toContain('risk_gate');
  });
});
