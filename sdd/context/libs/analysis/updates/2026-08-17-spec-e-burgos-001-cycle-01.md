# spec-e-burgos-001 cycle-01 — 2026-08-17

## Estado

Poda: se eliminó `src/lib/llm/llm-analyzer.ts` (`LLMAnalyzer`), que no tenía consumidores fuera de la
propia lib. Con él se fueron el tipo `LLMAnalyzerConfig` de `llm-types.ts`, sus exports en el barrel
`src/lib/llm/index.ts` y su cobertura en `llm.spec.ts`.

Lo que la lib expone para trabajar con LLMs **no se redujo en capacidad**: los 7 providers
(`Claude`, `OpenAI`, `Groq`, `Gemini`, `Mistral`, `Together`, `OpenRouter`), la fábrica
`createLLMProvider`, los tipos `LLMProviderClient`/`LLMUsage`/`LLMResponse`/`LLMAnalysisResult` y los
helpers `buildAnalysisPrompt`/`parseLLMResponse` siguen siendo la superficie pública.

## Estructura

`LLMAnalyzer` era una capa de orquestación (reintentos + temperatura sobre un provider) que
`apps/api` nunca usó: el camino vivo arma sus llamadas con `createLLMProvider` /
`OpenRouterProvider` directamente. **Si vuelve a hacer falta esa capa, el lugar correcto es el
llamador, no la lib** — la lib provee providers y parsing, no política de reintento.

Consumidor único de la fábrica desde `apps/api` a partir de este ciclo:
`AgentConfigResolverService.resolveClient()` (antes también `SubAgentService.getProvider`, borrado).

## Dependencias

Ninguna nueva ni removida.
