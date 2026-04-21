import { AgentId, LLMProvider } from '../../generated/prisma/enums';

export type AgentPresetName = 'free' | 'optimized' | 'balanced';

export interface AgentPresetEntry {
  provider: LLMProvider;
  model: string;
}

export type AgentPreset = Partial<Record<AgentId, AgentPresetEntry>>;

/**
 * Set Gratuito — 100% modelos free en OpenRouter (abril 2026)
 * Fuente: openrouter.ai/models?max_price=0&order=top-weekly
 */
export const PRESET_FREE: AgentPreset = {
  [AgentId.routing]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-nano-9b-v2:free',
  },
  [AgentId.orchestrator]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.synthesis]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
  },
  [AgentId.platform]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemma-4-31b-it:free',
  },
  [AgentId.operations]: {
    provider: LLMProvider.OPENROUTER,
    model: 'openai/gpt-oss-120b:free',
  },
  [AgentId.market]: {
    provider: LLMProvider.OPENROUTER,
    model: 'openrouter/elephant-alpha',
  },
  [AgentId.blockchain]: {
    provider: LLMProvider.OPENROUTER,
    model: 'minimax/minimax-m2.5:free',
  },
  [AgentId.risk]: {
    provider: LLMProvider.OPENROUTER,
    model: 'openai/gpt-oss-120b:free',
  },
};

/**
 * Set Optimizado de Pago — mejores modelos de pago para cada rol (abril 2026)
 *
 * routing     → gemini-2.5-flash-lite   ultra-fast, bajo costo, ideal clasificación
 * orchestrator→ gemini-3-flash-preview  agentic multi-turn, tool use, razonamiento
 * synthesis   → claude-sonnet-4.6       mejor síntesis y coherencia del mercado
 * platform    → gemini-2.5-flash-lite   multilingual, pedagogical, bajo costo
 * operations  → deepseek-v3.2           tool use nativo, agentic, bajo precio
 * market      → gemini-3-flash-preview  reasoning + data analysis + multimodal
 * blockchain  → deepseek-v3.2           razonamiento técnico profundo, bajo precio
 * risk        → claude-sonnet-4.6       chain-of-thought, veredictos estructurados
 */
export const PRESET_OPTIMIZED: AgentPreset = {
  [AgentId.routing]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-2.5-flash-lite',
  },
  [AgentId.orchestrator]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-3-flash-preview',
  },
  [AgentId.synthesis]: {
    provider: LLMProvider.OPENROUTER,
    model: 'anthropic/claude-sonnet-4.6',
  },
  [AgentId.platform]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-2.5-flash-lite',
  },
  [AgentId.operations]: {
    provider: LLMProvider.OPENROUTER,
    model: 'deepseek/deepseek-v3.2',
  },
  [AgentId.market]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-3-flash-preview',
  },
  [AgentId.blockchain]: {
    provider: LLMProvider.OPENROUTER,
    model: 'deepseek/deepseek-v3.2',
  },
  [AgentId.risk]: {
    provider: LLMProvider.OPENROUTER,
    model: 'anthropic/claude-sonnet-4.6',
  },
};

/**
 * Set Equilibrado — mix óptimo calidad/costo (gratuitos donde son suficientes,
 * de pago donde la diferencia de calidad justifica el costo)
 *
 * routing     → nemotron-nano-9b:free   suficientemente rápido para clasificación
 * orchestrator→ gemini-3-flash-preview  coordinación multi-agente requiere calidad
 * synthesis   → gemini-3-flash-preview  síntesis compleja, justifica el costo
 * platform    → gemma-4-31b-it:free     soporte y guía, free es suficiente
 * operations  → deepseek-v3.2           tool use crítico, bajo costo de pago
 * market      → gemini-2.5-flash-lite   análisis cuantitativo, buena relación precio/calidad
 * blockchain  → minimax-m2.5:free       conocimiento técnico, free es suficiente
 * risk        → deepseek-v3.2           veredictos críticos con razonamiento superior
 */
export const PRESET_BALANCED: AgentPreset = {
  [AgentId.routing]: {
    provider: LLMProvider.OPENROUTER,
    model: 'nvidia/nemotron-nano-9b-v2:free',
  },
  [AgentId.orchestrator]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-3-flash-preview',
  },
  [AgentId.synthesis]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-3-flash-preview',
  },
  [AgentId.platform]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemma-4-31b-it:free',
  },
  [AgentId.operations]: {
    provider: LLMProvider.OPENROUTER,
    model: 'deepseek/deepseek-v3.2',
  },
  [AgentId.market]: {
    provider: LLMProvider.OPENROUTER,
    model: 'google/gemini-2.5-flash-lite',
  },
  [AgentId.blockchain]: {
    provider: LLMProvider.OPENROUTER,
    model: 'minimax/minimax-m2.5:free',
  },
  [AgentId.risk]: {
    provider: LLMProvider.OPENROUTER,
    model: 'deepseek/deepseek-v3.2',
  },
};

export const AGENT_PRESETS: Record<AgentPresetName, AgentPreset> = {
  free: PRESET_FREE,
  optimized: PRESET_OPTIMIZED,
  balanced: PRESET_BALANCED,
};
