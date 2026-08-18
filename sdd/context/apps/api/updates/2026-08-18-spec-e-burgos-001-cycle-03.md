# spec-e-burgos-001 cycle-03 — 2026-08-18

## Estado

- Cierra la spec y el módulo `trading-agents-core` (3 ciclos). El eje del ciclo fue reducir el
  costo LLM por decisión con el comportamiento de trading intacto por defecto.
- **Gate determinista pre-LLM** (`src/orchestrator/decision-gate.service.ts`): resuelve HOLD sin
  ninguna llamada LLM cuando las 5 condiciones de "sin señal" se cumplen a la vez. Persiste una
  `AgentDecision` normal con `llmCostUsd = 0` y emite el mismo `agent:decision` por WS. Es
  **fail-closed**: reconciliación no confirmada, indicadores incompletos/stale, sin decisión
  previa o sin snapshot en la decisión previa → llama al LLM.
  Nace apagado (`deterministicGateEnabled` DEFAULT false).
- **`AgentDecision.llmCostUsd` ya tiene escritor real** (resuelve: el hallazgo C de la spec, que
  el contexto describía como "el dashboard reporta ~$0"). Tres estados sin ambigüedad: costo real,
  `0` para el HOLD del gate, `null` cuando la cascada de tarifa se agota — nunca un cero encubierto.
- `EP-008 GET /trading/positions` pasó a `implemented` (los 9 campos de protección/trailing).
  EP-009/EP-010 nuevos para costo por bot/día y agregado de plataforma.
- **Re-arme de la OCO nativa** al mover el stop ≥0.1%: cierra la degradación a polling y el
  take-profit zombie que cycle-02 dejó documentados (resuelve: "Qué sigue" de cycle-02).

## Estructura

- `src/cache/` — módulo nuevo: `SharedCachePort` con dos adapters (`InMemorySharedCache`,
  `RedisSharedCache`) y `SignalCacheService` encima. Claves `sig:v1:{tech|macro|news}:...`
  **sin `userId`** — el caché es compartido entre bots y usuarios por diseño. `getOrCompute` hace
  single-flight (colapsa concurrentes sobre la misma clave) y sirve stale si el recálculo falla.
  TTL: técnica 5 min, macro 4 h, news 10 min. Activación explícita por
  `SHARED_SIGNAL_CACHE_ENABLED`; apagado es passthrough puro.
- `src/orchestrator/agent-task-limits.ts` — `max_tokens` por **tipo de tarea**, no por agente ni
  modelo (`risk_gate`/`sizing_suggestion` 350, antes 1024 genérico). Una respuesta truncada lanza
  `LLMTruncatedResponseError` en vez de interpretarse como decisión parcial.
- `src/orchestrator/cost-harness/` — harness determinista del −50 %: 12 escenarios congelados como
  fixture, corridos línea base vs. optimizado, con assert numérico por corrida y **por escenario**.
  Corre dentro de `nx test api`, no como script aparte.
- `src/llm/llm-cost-accumulator.ts` — acumula los outcomes de las llamadas del ciclo y los settlea
  en `{ llmCallCount, pricedCallCount, unpricedCallCount, costUsd }`.
- `src/testing/source-scanner.ts` + `forbidden-symbols.spec.ts` — guard estático que falla si
  reaparecen `isFalseConcentrationBlock` o el cast `as unknown as AgentId` en `apps/api` o `libs/`.
  Los patrones se arman por concatenación para que el guard no se auto-detecte.
- `TradingProcessor`: `closePositionAtMarket` y `creditSandboxWallet` extraídos de
  `checkOpenPositions`; `ensureNativeProtection` + `attemptProtectionPlacement` /
  `applyProtectionOutcome` compartidos por la colocación post-BUY, el re-arme y la venta parcial.

## Dependencias

Sin dependencias nuevas en `package.json`. El adapter Redis usa el cliente ya presente en el stack;
el default sigue siendo in-memory por proceso.

## Qué sigue

- **UI de configuración de los 17 campos de `TradingConfig` y de `EP-004`/`EP-005`** — siguen
  configurándose solo por API. Deuda diferida explícitamente por el orquestador a una spec de UI.
- **`getOrComputeNews` existe pero no está cableado** en `orchestrator.service.ts`: el bloque de
  relectura per-user de sentimiento (~152-187) quedó byte-idéntico a propósito. Cablearlo requiere
  decidir la huella `newsFingerprint` de contenido sobre el bloque real. Es capacidad instalada,
  no comportamiento activo.
- **Atribución del resultado cacheado** (`cached`/`cachedFrom` con provider/model en
  `SubAgentResult`, architect §3.4) no implementada: el caché guarda solo el string de salida.
- **`executeLLMSell` conserva su `$transaction` de wallet SANDBOX inline** — `creditSandboxWallet`
  se usa en los otros dos sitios. Además, las aserciones por slicing de texto que quedan en
  `trading.processor.isolation.spec.ts` cortan entre `executeLLMSell` y `checkOpenPositions`, y ese
  rango hoy contiene también `creditSandboxWallet`, `executePartialTakeProfit` y
  `closePositionAtMarket`: la aserción "usa $transaction en executeLLMSell" ya no prueba solo lo
  que su nombre dice. Unificar el tercer sitio y reescribir esas aserciones van juntos.
- **Fail-open de AEGIS al degradar**: una pierna de sub-agente que falla o se trunca entra a la
  síntesis como `'{}'`, y `parseAegisVerdict('{}')` cae por `.catch()` a `verdict: 'PASS'` con
  multiplicador 1. Es pre-existente, pero `max_tokens: 350` en `risk_gate` vuelve el truncado un
  disparador realista. Evaluar un verdict explícito de "no evaluado" que no habilite operar.
