# Constitución — libs/analysis

> Versión 1.2 | Última actualización: cycle-03 | Fecha: 2026-08-18

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.

## 2. Stack tecnológico

- TypeScript. SDKs LLM: @openrouter/sdk, @anthropic-ai/sdk, openai, groq-sdk, @google/generative-ai, @mistralai/mistralai, Together (HTTP).

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/data-fetcher`. Consumida por `apps/api` y (solo tipos) por `apps/web`.
- Superficie pública para LLM: los 7 providers (`Claude`, `OpenAI`, `Groq`, `Gemini`, `Mistral`, `Together`, `OpenRouter`), la fábrica `createLLMProvider`, los tipos `LLMProviderClient`/`LLMUsage`/`LLMResponse`/`LLMAnalysisResult` y los helpers `buildAnalysisPrompt`/`parseLLMResponse`.
- **La lib provee providers y parsing, no política de reintento.** `LLMAnalyzer` (capa de orquestación con reintentos + temperatura sobre un provider) fue eliminada en cycle-01 por no tener consumidores: si vuelve a hacer falta esa capa, el lugar correcto es el llamador.
- Consumidor único de la fábrica desde `apps/api`: `AgentConfigResolverService.resolveClient()`.
- `src/lib/gate/` — gate determinista pre-LLM como funciones puras (sin `Date.now()` interno, sin I/O): `evaluateDeterministicGate()` devuelve `{ holds, conditions, snapshot }` o `{ holds: false, reason, conditions }` con `GateSkipReason` tipado; guardas fail-closed evaluados **antes** que las 5 condiciones de señal. `buildGateSnapshot()` recibe `close`/`takenAt` explícitos — no los deriva de `IndicatorSnapshot` (esa interfaz no tiene `close`, ver `libs/shared/constitution.md`).
- `src/lib/llm/prompt-cache.ts` — capacidad de prompt caching por proveedor/modelo (`resolvePromptCacheCapability()`, `shouldMarkPromptForCache()`, `postWithCacheControlRetry()` con reintento sin la marca si el proveedor la rechaza). Los 7 providers exponen `truncated` en su resultado, derivado del `stop_reason`/`finishReason` propio de cada API.

## 4. Convenciones propias

- Tests: `pnpm nx test analysis`. Las claves LLM llegan por parámetro (por usuario) — nunca leer env vars globales de proveedores.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
