# spec-e-burgos-001 cycle-03 — 2026-08-18

## Estado

- La lib suma el **gate determinista pre-LLM** como funciones puras, y el soporte de **prompt
  caching de proveedor** en la capa de providers LLM.
- Cierra la spec `spec-e-burgos-001` (último ciclo).

## Estructura

- `src/lib/gate/` — módulo nuevo, 100 % puro (sin `Date.now()` interno, sin I/O):
  - `deterministic-gate.ts` — `evaluateDeterministicGate()` devuelve
    `{ holds: true, conditions, snapshot }` o `{ holds: false, reason, conditions }` con un
    `GateSkipReason` tipado (`DISABLED`, `NO_PREVIOUS_DECISION`, `PREVIOUS_DECISION_STALE`,
    `RECONCILIATION_UNCONFIRMED`, `INDICATORS_INCOMPLETE`, `INDICATORS_STALE`, `EMA_CROSS`,
    `RSI_OUT_OF_BAND`, `PRICE_MOVED`, `POSITIONS_CHANGED`, `NEWS_OR_MACRO_CHANGED`).
    Los guardas de fail-closed se evalúan **antes** que las 5 condiciones de señal.
  - `gate-thresholds.ts` — `DEFAULT_GATE_THRESHOLDS`; ningún umbral lo elige el implementor.
  - `gate-reasoning.ts` — texto legible que identifica la decisión como determinista.
  - `buildGateSnapshot()` recibe `close` y `takenAt` como parámetros explícitos, **no** los deriva
    de `IndicatorSnapshot`: esa interfaz no tiene `close` (solo `Candle` lo tiene) y derivarlo
    habría dado `undefined`/`NaN` silencioso.
- `src/lib/llm/prompt-cache.ts` — capacidad de cache de prompt por proveedor/modelo:
  `resolvePromptCacheCapability()` (`anthropic-blocks` | `implicit` | `none` + mínimo de prefijo),
  `shouldMarkPromptForCache()`, y `postWithCacheControlRetry()` que reintenta **sin** la marca si
  el proveedor la rechaza con un 400 que la menciona.

## Dependencias

Sin dependencias nuevas. Los providers (`claude`, `openrouter`, `openai`, `gemini`, `groq`,
`mistral`, `together`) exponen ahora `truncated` en su resultado, derivado del `stop_reason` /
`finishReason` / `finish_reason` propio de cada API.

## Qué sigue

- **El prompt caching es capacidad dormida, no un ahorro activo.** El mínimo cacheable es 1024
  tokens de prefijo (2048 en Haiku) y los system prompts de `AgentDefinition` miden 650-830: hoy
  `shouldMarkPromptForCache()` devuelve `false` siempre y **ningún prompt se marca**. Es
  deliberado — marcar por debajo del mínimo no cachea y solo simularía un ahorro inexistente. Se
  activa sola si los prompts crecen o si se consolida un prefijo estático compartido; el harness
  de costo tiene un test que documenta que el −50 % no depende de ella.
- El gate consume `positionsFingerprint`/`newsFingerprint`/`macroFingerprint` calculados fuera de
  la lib (`libs/shared/utils/fingerprint.ts`): al agregar condiciones nuevas, mantener la huella
  del lado del llamador para que estas funciones sigan siendo puras y testeables sin mocks.
