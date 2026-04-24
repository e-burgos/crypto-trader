import { buildDynamicPreset, AgentPresetName } from './agent-presets';
import type { OpenRouterModelInfo } from '@crypto-trader/openrouter';

function makeModel(
  overrides: Partial<OpenRouterModelInfo> & { id: string },
): OpenRouterModelInfo {
  return {
    name: overrides.id,
    contextLength: 128_000,
    maxCompletionTokens: null,
    pricing: { prompt: 0, completion: 0 },
    isFree: true,
    categories: [],
    supportedParameters: [],
    ...overrides,
  };
}

describe('buildDynamicPreset', () => {
  const freeModel = makeModel({
    id: 'free/model-a:free',
    isFree: true,
    categories: ['free', 'reasoning'],
    contextLength: 200_000,
    supportedParameters: ['reasoning'],
  });

  const cheapPaid = makeModel({
    id: 'vendor/cheap-paid',
    isFree: false,
    categories: ['paid', 'fast', 'tool-use'],
    pricing: { prompt: 0.5, completion: 2 },
    contextLength: 128_000,
    supportedParameters: ['tools'],
  });

  const premiumPaid = makeModel({
    id: 'vendor/premium-model',
    isFree: false,
    categories: ['paid', 'reasoning', 'tool-use', 'premium', 'long-context'],
    pricing: { prompt: 5, completion: 15 },
    contextLength: 1_000_000,
    supportedParameters: ['reasoning', 'include_reasoning', 'tools'],
  });

  const models = [freeModel, cheapPaid, premiumPaid];

  it('free preset should only select free models', () => {
    const preset = buildDynamicPreset('free', models);
    for (const entry of Object.values(preset)) {
      expect(entry!.model).toBe('free/model-a:free');
    }
  });

  it('optimized preset should select paid models for all agents', () => {
    const preset = buildDynamicPreset('optimized', models);
    for (const entry of Object.values(preset)) {
      expect(entry!.model).not.toContain(':free');
    }
  });

  it('balanced preset should mix free and paid', () => {
    const preset = buildDynamicPreset('balanced', models);
    const modelIds = Object.values(preset).map((e) => e!.model);
    const hasFree = modelIds.some((id) => id.includes(':free'));
    const hasPaid = modelIds.some((id) => !id.includes(':free'));
    expect(hasFree).toBe(true);
    expect(hasPaid).toBe(true);
  });

  it('should cover all 8 agent roles', () => {
    for (const presetName of [
      'free',
      'optimized',
      'balanced',
    ] as AgentPresetName[]) {
      const preset = buildDynamicPreset(presetName, models);
      expect(Object.keys(preset).length).toBe(8);
    }
  });

  it('should return empty preset for unknown name', () => {
    const preset = buildDynamicPreset('nonexistent' as AgentPresetName, models);
    expect(Object.keys(preset).length).toBe(0);
  });

  it('optimized should prefer premium reasoning for risk agent', () => {
    const preset = buildDynamicPreset('optimized', models);
    // Risk agent requires reasoning + premium preference
    expect(preset.risk?.model).toBe('vendor/premium-model');
  });

  it('optimized should prefer tool-use for operations agent', () => {
    const preset = buildDynamicPreset('optimized', models);
    // Operations requires tool-use
    expect(preset.operations).toBeDefined();
    const selectedModel = models.find((m) => m.id === preset.operations?.model);
    expect(selectedModel?.categories).toContain('tool-use');
  });

  it('should handle empty model list', () => {
    const preset = buildDynamicPreset('free', []);
    expect(Object.keys(preset).length).toBe(0);
  });
});
