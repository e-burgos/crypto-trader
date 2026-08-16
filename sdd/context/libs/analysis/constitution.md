# Constitución — libs/analysis

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.

## 2. Stack tecnológico

- TypeScript. SDKs LLM: @openrouter/sdk, @anthropic-ai/sdk, openai, groq-sdk, @google/generative-ai, @mistralai/mistralai, Together (HTTP).

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/data-fetcher`. Consumida por `apps/api` y (solo tipos) por `apps/web`.

## 4. Convenciones propias

- Tests: `pnpm nx test analysis`. Las claves LLM llegan por parámetro (por usuario) — nunca leer env vars globales de proveedores.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
