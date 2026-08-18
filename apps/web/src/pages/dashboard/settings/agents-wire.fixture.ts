import type {
  AgentHealthReportWire,
  ResolvedAgentModelWire,
} from '@crypto-trader/shared';

export const AGENTS_WIRE_FIXTURE: ResolvedAgentModelWire[] = [
  {
    slot: 'routing',
    provider: 'OPENROUTER',
    model: 'anthropic/claude-3-haiku',
    source: 'user',
  },
  {
    slot: 'synthesis',
    provider: 'OPENROUTER',
    model: 'moonshotai/kimi-k2.6',
    source: 'admin',
  },
  {
    slot: 'platform',
    provider: 'OPENROUTER',
    model: 'qwen/qwen3.5-35b-a3b',
    source: 'preset',
  },
  {
    slot: 'operations',
    provider: 'OPENROUTER',
    model: 'deepseek/deepseek-v4-flash',
    source: 'credential',
  },
  {
    slot: 'market',
    provider: 'OPENROUTER',
    model: 'deepseek/deepseek-v4-pro',
    source: 'override',
  },
  {
    slot: 'blockchain',
    provider: 'OPENROUTER',
    model: 'qwen/qwen3.6-plus',
    source: 'preset',
  },
  {
    slot: 'risk',
    provider: 'OPENROUTER',
    model: 'moonshotai/kimi-k2.6',
    source: 'admin',
  },
];

export const AGENTS_HEALTH_FIXTURE: AgentHealthReportWire = {
  healthy: true,
  agents: AGENTS_WIRE_FIXTURE.map((agent) => ({
    ...agent,
    healthy: true,
    hasKey: true,
  })),
};

export const OPENROUTER_MODELS_FIXTURE = [
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B (free)',
    contextLength: 32000,
    maxCompletionTokens: null,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    categories: [],
    supportedParameters: [],
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    contextLength: 200000,
    maxCompletionTokens: null,
    pricing: { prompt: 0.00025, completion: 0.00125 },
    isFree: false,
    categories: [],
    supportedParameters: [],
  },
];
