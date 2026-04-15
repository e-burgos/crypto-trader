import { LLMProvider } from '../../generated/prisma/enums';

const RISK_PROFILES: Record<string, string> = {
  CONSERVATIVE: 'Safe',
  MODERATE: 'Balanced',
  AGGRESSIVE: 'Alpha',
};

/**
 * Generates an auto-name for a trading agent based on its configuration.
 * Format: {Asset}-{Profile}-{Provider}:{ModelShort}
 *
 * Examples:
 *   "BTC-Safe-CLAUDE:sonnet-4"
 *   "ETH-Alpha-OPENAI:gpt-5"
 *   "BTC-Balanced-Auto:Auto"
 */
export function generateAgentName(config: {
  asset: string;
  riskProfile: string;
  primaryProvider?: string | null;
  primaryModel?: string | null;
}): string {
  const profile = RISK_PROFILES[config.riskProfile] ?? 'Balanced';
  const model = config.primaryModel
    ? (config.primaryModel.split('/').pop()?.split('-').slice(0, 2).join('-') ??
      'Auto')
    : 'Auto';
  const provider = config.primaryProvider ?? 'Auto';
  return `${config.asset}-${profile}-${provider}:${model}`;
}

/**
 * Resolves the LLM provider/model for a trading config.
 * 3-level fallback: primary → fallback → ranking global.
 */
export interface ResolvedLLM {
  provider: LLMProvider;
  model: string;
}

export function resolveTradingOverride(config: {
  primaryProvider?: LLMProvider | null;
  primaryModel?: string | null;
  fallbackProvider?: LLMProvider | null;
  fallbackModel?: string | null;
}): ResolvedLLM | undefined {
  if (config.primaryProvider && config.primaryModel) {
    return {
      provider: config.primaryProvider,
      model: config.primaryModel,
    };
  }
  if (config.fallbackProvider && config.fallbackModel) {
    return {
      provider: config.fallbackProvider,
      model: config.fallbackModel,
    };
  }
  return undefined;
}
