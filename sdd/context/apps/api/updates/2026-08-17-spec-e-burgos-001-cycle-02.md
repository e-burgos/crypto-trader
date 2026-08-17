# spec-e-burgos-001 cycle-02 — 2026-08-17

## Estado

- **Venta inteligente y gestión activa de riesgo cableadas al camino real de ejecución.** El
  análisis que el sistema ya pagaba ahora determina cuánto se compra, cuándo se corta una pérdida
  y cuánto riesgo agregado se acepta. 16 tasks, 5 migraciones SQL escritas a mano, 391 tests de
  `apps/api` en verde.
- **Invariante rector cumplido y verificable en el SQL:** los 6 interruptores nuevos
  (`lossCutEnabled`, `smartSizingEnabled`, `nativeProtectionEnabled`, `trailingStopEnabled`,
  `partialTpEnabled`, `maxPositionHoldMinutes`) nacen apagados y `user_risk_policies` nace **sin
  fila**. Una instalación existente que despliegue este ciclo sin tocar su config produce las
  mismas órdenes que antes.
- `resuelve: constitution.md §3 "AgentDomainModule … registrado en AppModule y todavía sin
  inyectores — andamio deliberado"` — `RiskBudgetService` y `PortfolioContextService` tienen
  callers reales vía `AggregateRiskService`; `simulateTrade` los tiene vía `evaluateSellPolicy`.
- `resuelve: context_prompt.md §Qué sigue "Tablas huérfanas, deliberadamente no dropeadas"` —
  `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies` **se dropearon** en
  `20260817154000_drop_orphan_agent_tables`, migración dedicada y separable; reverse SQL completo
  publicado en `architect.md` §11.3 del ciclo.
- `resuelve: context_prompt.md §Qué sigue "fusionar ResolvedAgentConfig y ResolvedAgentClient"` —
  hoy existe una sola estructura `ResolvedAgentModel`; `toAgentId(slot)` en `agent-identity.ts` es
  la única puerta de conversión y no queda ningún `as unknown as AgentId` en el árbol.
- `resuelve: context_prompt.md §Qué sigue "EvaluationProcessor.evaluate hace check-then-create"` —
  `P2002` se captura por `code` (string, no `instanceof`) en `evaluate` y en `createNotEvaluable`,
  y resuelve como no-op explícito.

## Estructura

- **Política de SELL:** el veto absoluto de `minProfitPct` en `trading.processor.ts` fue
  reemplazado por `evaluateSellPolicy` (función pura de `libs/trading-engine`). Dos caminos
  independientes: toma de ganancia (piso `minProfitPct`, idéntico a antes) y corte de pérdida por
  señal (fail-closed: confianza ausente o fuera de `[0,1]` ⇒ nunca vende en pérdida).
- **Sizing:** `resolveTradeQuantity` (pura) con `factor = min(aegis × verdict, forge)` y `clamp`
  en cada factor ⇒ el techo `balance × maxTradePct` es inviolable por construcción. `REDUCE`
  reduce tamaño (`reduceSizeFactor`), no bloquea; FORGE `skip` ⇒ tamaño cero
  (`blockedBy: 'FORGE_SKIP'`, distinto de `AEGIS_BLOCK`).
- **Protección nativa (solo LIVE/TESTNET):** tras confirmarse la compra, `executeBuy` coloca la
  OCO con `placeProtectionWithRetry` (3 intentos, backoff 250/1000/3000 ms ±20 % jitter, solo
  ante códigos de Binance reintentables). `listClientOrderId = prot-{positionId}-{attempt}`,
  persistido antes de cada llamada. Agotados los intentos: `protectionStatus = UNPROTECTED` +
  notificación + evento WS `position:unprotected`, y la posición **no** se cierra salvo
  `closeOnProtectionFailure` (default `false`). En SANDBOX `nativeProtectionEnabled` se ignora.
- **Regla no negociable — cancelar la protección antes de vender.** Una OCO bloquea el balance
  base; todo camino de salida llama `releaseProtectionIfNeeded` (deja `RELEASED`) antes del
  `placeMarketOrder(SELL)`: `executeLLMSell`, `closeAtMarket` de `checkOpenPositions`
  (TIME_EXIT / STOP / TAKE_PROFIT), `executePartialTakeProfit` y `closePositionManually` de
  `TradingService`. Cualquier camino de salida nuevo debe hacer lo mismo o fallará con `-2010`.
- **`ReconciliationService`** (`src/trading/reconciliation.service.ts`) corre como paso previo a
  toda decisión del ciclo (antes del health check del LLM), solo en LIVE/TESTNET. Idempotente por
  **transición condicional** (`updateMany` con `status: 'OPEN'` esperado + guard
  `claimed.count === 0`), nunca por conteo de trades. Barre OCO zombie con `getOpenOrders(symbol)`
  filtrando `clientOrderId` que empiece con `prot-`, sumando antes al set de vivos las posiciones
  `PROTECTED` de **otras configs del mismo usuario/símbolo** (`addExternalLiveOrderIds`) — sin esa
  salvaguarda, dos bots sobre el mismo par se cancelarían la protección entre sí.
- **Máquina de salidas en `checkOpenPositions`**, orden fijo, primero que matchea gana:
  TIME_EXIT → STOP (efectivo = `max(stop persistido, nivel trailed)`) → PARTIAL_TP → TAKE_PROFIT
  fijo (**deshabilitado mientras `trailingStopEnabled` esté activo**) → persistir estado de
  trailing. El `Trade` del parcial se crea en `executePartialTakeProfit`, método propio colocado
  **antes** de `checkOpenPositions` en el archivo (ver "Qué sigue").
- **Riesgo agregado:** `AggregateRiskService` (`src/agents/domain/`) compone
  `PortfolioContextService` (sin `configId` ⇒ agrega todas las configs) y
  `RiskBudgetService.assessAggregate({ userId, since })` — método nuevo; `assess()` per-config
  **no se tocó**. `assertBuyAllowed` se evalúa pre-orden (después del sizing, antes de
  `placeMarketOrder`) en las dos ramas. Pérdida diaria = día calendario **UTC**, no ventana móvil.
- **Riesgo agregado por usuario en tabla propia `user_risk_policies` (1:1 con `User`)**, no en
  `TradingConfig` ni en `AgentBudgetPolicy` — este último es presupuesto de **gasto de LLM** y
  `RiskBudgetService.assess()` ya lo usaba mal como límite de pérdida de trading. No reforzar esa
  confusión: límite de pérdida operativa ≠ presupuesto de tokens.
- **Verdict de AEGIS tipado:** `blockReasons: AegisBlockReason[]` + `aegisVerdictSchema` (zod, un
  `.catch()` por campo para degradar a valores neutros ante payload parcial del LLM;
  `positionSizeMultiplier` clampeado a `[0,1]` ya en el borde). `isOverridableBlock` es
  **fail-closed**: sin `blockReasons`, con array vacío o con cualquier motivo fuera del conjunto
  anulable, el BLOCK se respeta. El regex `isFalseConcentrationBlock` sobre `reason` ya no existe.
  El contrato del JSON viaja en el **user prompt** de `buildTaskUserPrompt('risk_gate')` además
  del seed: el system prompt vive en la tabla `AgentDefinition` y una instalación ya seedeada no
  lo actualiza al desplegar.
- `DecisionPayload` transporta `risk: AegisVerdict` y `sizing: ForgeSizingSummary` ya parseados;
  el processor **nunca** vuelve a parsear `subAgentResults`.
- `Trade.decisionId` (nullable, FK `ON DELETE SET NULL`) seteado en los 4 puntos de creación del
  flujo real; `null` en la reconciliación (lo ejecutó el exchange) y en el cierre manual.
- `Position.quantity` pasa a significar **cantidad abierta remanente**; `initialQuantity` conserva
  la original y es `null` en filas históricas ⇒ los cálculos leen `initialQuantity ?? quantity`.
- Archivos nuevos no previstos en el diseño, todos extracciones mecánicas:
  `src/trading/protection-retry.ts` (única implementación del backoff, compartida por `executeBuy`
  y por el reintento de la reconciliación), `src/orchestrator/dto/forge-sizing.schema.ts` y
  `src/orchestrator/json-parse.util.ts`.

## Dependencias

- **Ninguna dependencia externa nueva.** `zod@4` ya estaba en el repo y es lo que valida el
  payload de AEGIS y de FORGE.
- `TradingModule` importa `AgentDomainModule` (por `AggregateRiskService`).
- `PrismaService`: alta del getter `userRiskPolicy`, baja de `agentModelPolicy` y
  `agentToolInvocation` — sus getters son 1:1 con los modelos y dropear un modelo sin borrar su
  getter rompe el build.
- `ValidationPipe` global con `forbidNonWhitelisted: true`: **un campo nuevo de `TradingConfig`
  que no esté declarado en ambos DTO hace que el request entero responda 400**, no que se ignore.
  Los 17 campos nuevos están en `CreateTradingConfigDto` y `UpdateTradingConfigDto`.

## Qué sigue

- ⚠️ **`apps/web` quedó desalineado con el wire de `/users/me/agents/config` y
  `/users/me/agents/health`.** La fusión en `ResolvedAgentModel` (CA-033/034/035) renombró el
  campo `agentId` → `slot` y el valor `source: 'fallback'` → `'preset'`. `apps/web` sigue leyendo
  `config.agentId` en `pages/dashboard/settings/agents.tsx` y tipándolo en
  `hooks/use-agent-config.ts`: los nombres de agente quedan vacíos, los filtros por `'risk'` /
  `'routing'` no matchean y guardar dispara `PUT /users/me/agents/undefined/config`. El frontend
  estaba fuera de alcance de este ciclo (brief `out_of_scope`); **la corrección es prerrequisito
  de deploy**, no un nice-to-have.
- **Con `nativeProtectionEnabled` + (`trailingStopEnabled` | `partialTpEnabled`) simultáneos, la
  posición degrada a protección por polling.** No se re-arma la OCO cuando el trailing o el
  breakeven mueven el stop (`architect.md` §8.3 último bullet). Es seguro —`checkOpenPositions`
  cierra a mercado en el stop trailed local tras cancelar la OCO obsoleta, con latencia de un
  ciclo— pero la OCO viva en el exchange conserva **el stop y el take-profit originales**: puede
  llenar el TP fijo que la máquina local da por deshabilitado durante el trailing. Ambos flags
  nacen apagados. Re-armar la OCO en cada movimiento de stop es candidato de cycle-03.
- **`GET /trading/positions` (EP-008) todavía no expone los campos nuevos de `Position`**
  (`protectionStatus`, `stopPrice`, `takeProfitPrice`, `highWaterPrice`, `trailingActive`,
  `initialQuantity`, `partialExitCount`, `realizedPnl`, `exitReason`): el `select` de
  `TradingService.getPositions` no se extendió. Sin esto la UI no puede mostrar una posición
  desprotegida ni el estado del trailing.
- **No hay guard automatizado que impida reintroducir `isFalseConcentrationBlock` ni
  `as unknown as AgentId`.** Hoy están ausentes y se verificó por grep, pero CA-031/CA-034 pedían
  verificación estática en el pipeline. El repo ya tiene el patrón (`readFileSync` sobre el fuente
  en `trading.processor.isolation.spec.ts`) para escribirlo en una línea.
- `checkOpenPositions` sigue con `closeAtMarket` y el crédito de wallet SANDBOX inline, sin
  extraer: dos specs de regresión hacen *string-matching* sobre el rango de texto fuente entre
  `private async checkOpenPositions` y `private parseSymbolForSandbox`. Antes de refactorizar ese
  método hay que reescribir esas dos aserciones.
