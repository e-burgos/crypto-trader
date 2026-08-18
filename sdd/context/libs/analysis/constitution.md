# Constitución — libs/analysis

> Versión 1.1 | Última actualización: cycle-01 | Fecha: 2026-08-17

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

## 4. Convenciones propias

- Tests: `pnpm nx test analysis`. Las claves LLM llegan por parámetro (por usuario) — nunca leer env vars globales de proveedores.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
