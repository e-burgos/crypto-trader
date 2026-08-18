import {
  AGENT_TASK_MAX_TOKENS,
  LLMTruncatedResponseError,
  resolveMaxTokensForTask,
} from './agent-task-limits';
import { AgentTask } from './sub-agent.service';

describe('AGENT_TASK_MAX_TOKENS', () => {
  it('defines the exact limits fixed by architect.md', () => {
    expect(AGENT_TASK_MAX_TOKENS).toEqual({
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
