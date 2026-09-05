# Constitución — libs/analysis

> Versión 1.4 | Última actualización: cycle-01 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-005 cycle-01 (2026-08-30) + FIX-e-burgos-031 (2026-09-04) + spec-e-burgos-010 cycle-01 (2026-09-04)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Indicadores técnicos (RSI, MACD, Bollinger, EMA, volumen, soportes/resistencias) e integración con proveedores LLM para la decisión del agente.

## 2. Stack tecnológico

- TypeScript. SDKs LLM: @openrouter/sdk, @anthropic-ai/sdk, openai, groq-sdk, @google/generative-ai, @mistralai/mistralai, Together (HTTP).

## 3. Estructura y patrones

- Depende de: `libs/shared`, `libs/data-fetcher`. Consumida por `apps/api` y (solo tipos) por `apps/web`.
- Superficie pública para LLM: los 7 providers (`Claude`, `OpenAI`, `Groq`, `Gemini`, `Mistral`, `Together`, `OpenRouter`), la fábrica `createLLMProvider`, los tipos `LLMProviderClient`/`LLMUsage`/`LLMResponse`/`LLMAnalysisResult` y el helper `parseLLMResponse`. `buildAnalysisPrompt` se retiró (FIX-e-burgos-031): era código muerto, sólo lo usaba su propio test — `apps/api` arma el prompt por otro camino.
- **La lib provee providers y parsing, no política de reintento.** `LLMAnalyzer` (capa de orquestación con reintentos + temperatura sobre un provider) fue eliminada en cycle-01 por no tener consumidores: si vuelve a hacer falta esa capa, el lugar correcto es el llamador.
- Consumidor único de la fábrica desde `apps/api`: `AgentConfigResolverService.resolveClient()`.
- `src/lib/gate/` — gate determinista pre-LLM como funciones puras (sin `Date.now()` interno, sin I/O): `evaluateDeterministicGate()` devuelve `{ holds, conditions, snapshot }` o `{ holds: false, reason, conditions }` con `GateSkipReason` tipado; guardas fail-closed evaluados **antes** que las 5 condiciones de señal. `buildGateSnapshot()` recibe `close`/`takenAt` explícitos — no los deriva de `IndicatorSnapshot` (esa interfaz no tiene `close`, ver `libs/shared/constitution.md`).
- `src/lib/reactive/` — las dos decisiones **puras** del loop reactivo de `apps/api`, con el mismo criterio que `src/lib/gate/`: funciones síncronas, sin `fetch`/`prisma`/`await`, que reciben snapshots ya construidos por el llamador.
  - `reactive-thresholds.ts` — `MaterialEventThresholds` + `DEFAULT_MATERIAL_EVENT_THRESHOLDS`. Mismo patrón que `DEFAULT_GATE_THRESHOLDS`: **ningún umbral lo elige el implementor, todos viven acá con nombre y default**. Excepción: `priceChangePct` se inyecta desde `TradingConfig.gatePriceChangePct` en runtime — el `0.005` del archivo es solo el espejo del default de la columna, no el valor efectivo.
  - `material-event.ts` — `detectMaterialEvent(input)`, tres tipos de evento: `PRICE_MOVED`, `LEVEL_BREAK` y `VOLUME_SPIKE`. Devuelve **como máximo un evento** y **siempre** el `MaterialEventState` siguiente. Es una función de estado explícito: `state` entra y sale, nunca se muta el objeto de entrada (hay test que lo consagra); el dueño del símbolo en `apps/api` guarda ese estado. El umbral de precio es **el mismo `gatePriceChangePct` del gate determinista**, no uno propio: la spec prohíbe un segundo umbral de precio que compita con el existente. `LEVEL_BREAK` usa histéresis (`levelConfirmDistancePct`) para que el ruido alrededor del nivel no genere N eventos. `VOLUME_SPIKE` compara contra el volumen esperado **normalizado por la fracción transcurrida de la vela** (con piso `volumeMinElapsedFraction`) y dispara **una sola vez por vela**; nunca es un umbral absoluto. Fail-closed: sin referencia, con referencia más vieja que `referenceMaxAgeMs`, o con `reference.close <= 0`, no hay evento.
  - `stream-health.ts` — `resolveStreamHealth(input)`. **El estado nunca se infiere de que el precio no se mueva**: se decide por edad del último tick (`TICK_STALE`) y del último heartbeat (`HEARTBEAT_STALE`), y `UNKNOWN/NO_RECORD` se trata igual que `DEGRADED`.
  - `user-data-stream-health.ts` (spec-e-burgos-010 cycle-01) — `resolveUserDataStreamHealth()`, función pura hermana de `stream-health.ts` pero con contrato propio (no comparte umbrales ni razones con la salud del market stream): `UNKNOWN`/`NO_RECORD` sin registro, `DEGRADED`/`HEARTBEAT_STALE` o `DEGRADED`/`KEEPALIVE_STALE` (en ese orden de prioridad si vencieron los dos), `HEALTHY` si ambos están en ventana (antigüedad exactamente igual al umbral cuenta como sana). `lastEventAtMs` **no** entra en el cálculo (el silencio nunca es salud, pero tampoco es muerte) — sólo viaja para diagnóstico. Sin llamador real hoy: su único consumidor (`UserDataStreamService` de `apps/api`) es inerte porque Binance retiró el endpoint del `listenKey` (`410 Gone`) y nace detrás de un interruptor apagado; si cycle-02 migra el transporte (DEC-001), el modelo se reusa tal cual — `lastHeartbeatAtMs`/`lastKeepaliveAtMs` son los únicos insumos y existen en cualquier transporte con ping/pong y renovación de sesión.
  - Barrels: `src/lib/reactive/index.ts` reexportado desde `src/index.ts`. El barrel público de esta lib es **`libs/analysis/src/index.ts`** — `libs/analysis/src/lib/index.ts` no existe (a diferencia de `libs/trading-engine`, que sí tiene el suyo en `src/lib/`).
- `stream-health.ts` importa `StreamHealthRecord`/`StreamHealthState` de `@crypto-trader/shared`: es la primera dependencia de esta lib sobre `shared` fuera de `src/lib/gate/`.
- `src/lib/llm/prompt-cache.ts` — capacidad de prompt caching por proveedor/modelo (`resolvePromptCacheCapability()`, `shouldMarkPromptForCache()`, `postWithCacheControlRetry()` con reintento sin la marca si el proveedor la rechaza). Los 7 providers exponen `truncated` en su resultado, derivado del `stop_reason`/`finishReason` propio de cada API.

## 4. Convenciones propias

- Tests: `pnpm nx test analysis`. Las claves LLM llegan por parámetro (por usuario) — nunca leer env vars globales de proveedores.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
