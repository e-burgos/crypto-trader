# Planner — Cycle 1: Loop de ejecución reactivo

> **Input:** `sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-01/brief.yaml` + `functional.md` + `architect.md`
> **Output:** este archivo y `tasks.json`
> **Generado por:** sdd-planner · realineado contra `architect.md` por el sdd-orchestrator

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 1 |
| Módulo | reactive-execution-loop |
| Tasks (filas en `tasks.json`) | 36 |
| Tasks **activas** (`status: pending`) | 32 |
| Tasks retiradas (`status: skipped`) | 4 — TASK-006/007/008 absorbidas, TASK-025 dividida |
| Horas de trabajo real (32 activas) | **128h** |
| Story points reales (32 activas) | **161** |
| **Entrega 1** | **95h · 122 puntos · 23 tasks** |
| **Entrega 2** | **33h · 39 puntos · 9 tasks** |
| Duración estimada (serial, ambas entregas) | ~3.2 semanas |

> **Este documento fue reconciliado con la numeración final de `tasks.json`.** Una versión previa
> usaba una numeración anterior en la que `TASK-028`/`TASK-029` significaban la extracción de
> `PositionActionService` y la reescritura de specs. **Ya no.** En la numeración vigente esos IDs
> son los umbrales de infraestructura y el vocabulario compartido; la extracción es **TASK-034** y
> la reescritura de specs es **TASK-033**. `tasks.json` es la fuente de verdad de los IDs.

### Tasks absorbidas

`TASK-006`, `TASK-007`, `TASK-008` y `TASK-025` quedaron en **`status: "skipped"`**. Las tres
primeras fueron absorbidas por `TASK-005` y `TASK-020`: el architect
definió `detectMaterialEvent` como **una única función pura** con los tres disparadores adentro,
no como tres detectores separados. Se conservan como filas con su motivo para no romper las
referencias del funcional a US-01-002/003/004; no representan trabajo pendiente.

---

## Orden de las capas (regla no negociable)

1. **Las piezas puras de `libs/` van antes que la orquestación de `apps/api`.** La lib decide, `apps/api` orquesta.
2. **Los caps se implementan y se prueban antes de que cualquier camino reactivo ejecute una orden.** `TASK-012` es dependencia de `TASK-018` y de `TASK-019`.
3. **El interruptor de apagado va temprano** (`TASK-009`), no al final: CA-001 debe poder verificarse desde el principio.
4. **Las specs de regresión se reescriben antes de la extracción** (`TASK-033` → `TASK-034`): el refactor se hace con la protección puesta, no después de quitarla.
5. **Cada task es una unidad independiente que commitea al terminar.** Ninguna deja el árbol sin compilar.

---

## Fase 0 — Fundamentos sin comportamiento observable

Vocabulario compartido, umbrales con nombre, migraciones apagadas, puerto de coordinación y saneamiento de specs. Nada de esta fase cambia lo que el bot hace: es la base sobre la que todo lo demás se apoya, y por eso puede empezarse en paralelo por varios implementores.

*Subtotal: 52h · 63 puntos*

### TASK-029: Vocabulario compartido MarketTick, MarketCandleTick, StreamHealthState, StreamHealthRecord (libs/shared)

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-001, US-01-002, US-01-003, US-01-017
- **depends_on:** ninguna
- **Archivos previstos:**
  - `libs/shared/src/types/interfaces.ts`

### TASK-001: Archivo de umbrales de evento material (DEFAULT_MATERIAL_EVENT_THRESHOLDS)

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-001, US-01-002, US-01-003
- **depends_on:** ninguna
- **Archivos previstos:**
  - `libs/analysis/src/lib/reactive/reactive-thresholds.ts`
  - `libs/analysis/src/lib/reactive/reactive-thresholds.spec.ts`
  - `libs/analysis/src/lib/index.ts`

### TASK-028: Archivo de umbrales de infraestructura reactiva (ReactiveRuntimeThresholds: TTLs, intervalos)

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-017, US-01-019, US-01-020
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/src/reactive/reactive-runtime-thresholds.ts`
  - `apps/api/src/reactive/reactive-runtime-thresholds.spec.ts`

### TASK-002: Función pura evaluateActionCaps + classifyActionExposure (contrato exacto architect.md §6.3)

- **Estimación:** 4h · 5 puntos
- **Historias:** US-01-013, US-01-014, US-01-015
- **depends_on:** ninguna
- **Archivos previstos:**
  - `libs/trading-engine/src/lib/risk/action-caps.ts`
  - `libs/trading-engine/src/lib/risk/action-caps.spec.ts`
  - `libs/trading-engine/src/lib/index.ts`

### TASK-004: Función pura planFastPath (NO invoca evaluateSellPolicy; shouldExitByTime queda fuera)

- **Estimación:** 5h · 8 puntos
- **Historias:** US-01-006, US-01-007, US-01-008, US-01-009
- **depends_on:** ninguna
- **Archivos previstos:**
  - `libs/trading-engine/src/lib/fast-path.ts`
  - `libs/trading-engine/src/lib/fast-path.spec.ts`
  - `libs/trading-engine/src/lib/index.ts`

### TASK-003: Función pura resolveStreamHealth (UNKNOWN se trata como degradado en todo consumidor)

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-017
- **depends_on:** TASK-029
- **Archivos previstos:**
  - `libs/analysis/src/lib/reactive/stream-health.ts`
  - `libs/analysis/src/lib/reactive/stream-health.spec.ts`
  - `libs/analysis/src/lib/reactive/index.ts`
  - `libs/analysis/src/lib/index.ts`

### TASK-005: Función pura detectMaterialEvent (PRICE_MOVED, LEVEL_BREAK, VOLUME_SPIKE, guardas fail-closed)

- **Estimación:** 7h · 8 puntos
- **Historias:** US-01-001, US-01-002, US-01-003
- **depends_on:** TASK-001
- **Archivos previstos:**
  - `libs/analysis/src/lib/reactive/material-event.ts`
  - `libs/analysis/src/lib/reactive/material-event.spec.ts`
  - `libs/analysis/src/lib/reactive/index.ts`
  - `libs/analysis/src/lib/index.ts`

### TASK-009: Columna reactiveLoopEnabled en trading_configs (migración propia + DTOs, default false)

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-020
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_reactive_loop_switch/migration.sql`
  - `apps/api/src/trading/dto/trading-config.dto.ts`

### TASK-010: Columnas maxActionsPerHour (1..60, default 6) y minActionIntervalSec (5..3600, default 60) en trading_configs

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-013, US-01-014, US-01-015
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_action_caps_columns/migration.sql`
  - `apps/api/src/trading/dto/trading-config.dto.ts`

### TASK-027: Tabla bot_actions (4 CREATE TYPE + tabla + índices + FKs sin cascada de auditoría) — migración propia

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-013, US-01-014, US-01-015, US-01-016
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_bot_actions/migration.sql`
  - `apps/api/src/prisma/prisma.service.ts`

### TASK-013: AggregateRiskService.evaluateDailyLoss (lectura pura) + assertBuyAllowed reusa la misma aritmética

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-015
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/src/agents/domain/aggregate-risk.service.ts`
  - `apps/api/src/agents/domain/aggregate-risk.service.spec.ts`

### TASK-030: Extensiones aditivas de BinanceWsClient — heartbeat ping/pong, ping propio + pong timeout, addStreams/removeStreams, isConnected

- **Estimación:** 5h · 8 puntos
- **Historias:** US-01-017, US-01-020
- **depends_on:** ninguna
- **Archivos previstos:**
  - `libs/data-fetcher/src/lib/binance/binance-ws.client.ts`
  - `libs/data-fetcher/src/lib/binance/binance-ws.client.spec.ts`

### TASK-031: ReactiveCoordinationPort — RedisReactiveCoordination (CAS Lua) + DisabledReactiveCoordination + fábrica por env (nunca degrada a memoria)

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-019
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/src/reactive/reactive-coordination.port.ts`
  - `apps/api/src/reactive/redis-reactive-coordination.service.ts`
  - `apps/api/src/reactive/redis-reactive-coordination.service.spec.ts`
  - `apps/api/src/reactive/disabled-reactive-coordination.service.ts`
  - `apps/api/src/reactive/reactive-coordination.module.ts`

### TASK-032: app.enableShutdownHooks() en main.ts (prerrequisito de OnApplicationShutdown de ReactiveModule)

- **Estimación:** 1h · 1 puntos
- **Historias:** US-01-019
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/src/main.ts`

### TASK-033: Reescribir trading.processor.isolation.spec.ts sobre comportamiento observable (no slicing de texto fuente)

- **Estimación:** 4h · 5 puntos
- **Historias:** US-01-006, US-01-011
- **depends_on:** ninguna
- **Archivos previstos:**
  - `apps/api/src/trading/trading.processor.isolation.spec.ts`

---

## Fase 1 — Caps de frecuencia (la puerta única)

**Esta fase va antes que cualquier camino que ejecute una orden.** El fast path sin caps es un bug que dispara rápido: quitar el temporizador elimina el único limitador de frecuencia que el sistema tiene hoy.

*Subtotal: 14h · 16 puntos*

### TASK-011: Contadores de bot_actions (acciones EXECUTED en la última hora, timestamp de la última) para ActionGateService

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-013, US-01-014, US-01-015, US-01-019
- **depends_on:** TASK-027, TASK-002
- **Archivos previstos:**
  - `apps/api/src/trading/bot-action-counters.ts`
  - `apps/api/src/trading/bot-action-counters.spec.ts`

### TASK-012: ActionGateService.authorizeAndRun — única puerta (passthrough si loop off, fail-closed, lease de bot, revalidación SUPERSEDED, caps, ledger)

- **Estimación:** 7h · 8 puntos
- **Historias:** US-01-011, US-01-012, US-01-013, US-01-014, US-01-015
- **depends_on:** TASK-002, TASK-011, TASK-013, TASK-031
- **Archivos previstos:**
  - `apps/api/src/trading/action-gate.service.ts`
  - `apps/api/src/trading/action-gate.service.spec.ts`
  - `apps/api/src/trading/trading.module.ts`

### TASK-014: EP-016 GET /trading/actions — ledger consultable de bot_actions (paginado, filtros)

- **Estimación:** 4h · 5 puntos
- **Historias:** US-01-016
- **depends_on:** TASK-012, TASK-027
- **Archivos previstos:**
  - `apps/api/src/trading/trading.controller.ts`
  - `apps/api/src/trading/dto/list-bot-actions.dto.ts`
  - `apps/api/src/trading/trading.controller.bot-actions.spec.ts`

---

## Fase 2 — Stream en vivo y dueño único

El riel reactivo y su propiedad bajo N réplicas. El dueño se resuelve antes de suscribir: sin dueño no hay suscripción.

*Subtotal: 17h · 24 puntos*

### TASK-016: MarketStreamService — dueño por símbolo (lease Redis rx:v1:owner:{symbol}, renovación CAS, barrido, cierre ordenado)

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-019
- **depends_on:** TASK-031, TASK-028, TASK-032, TASK-009
- **Archivos previstos:**
  - `apps/api/src/reactive/market-stream.service.ts`
  - `apps/api/src/reactive/market-stream.service.spec.ts`
  - `apps/api/src/reactive/reactive.module.ts`

### TASK-015: MarketStreamService — suscripción WS por símbolo bajo el dueño (BinanceWsClient extendido, warmup, fan-out de ticks)

- **Estimación:** 5h · 8 puntos
- **Historias:** US-01-020
- **depends_on:** TASK-016, TASK-030, TASK-029
- **Archivos previstos:**
  - `apps/api/src/reactive/market-stream.service.ts`
  - `apps/api/src/reactive/market-stream.service.spec.ts`
  - `apps/api/src/reactive/reactive.module.ts`

### TASK-017: StreamHealthService (publica/resuelve/emite transición) + EP-015 GET /trading/stream-health

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-017
- **depends_on:** TASK-003, TASK-015, TASK-029, TASK-028
- **Archivos previstos:**
  - `apps/api/src/reactive/stream-health.service.ts`
  - `apps/api/src/reactive/stream-health.service.spec.ts`
  - `apps/api/src/trading/trading.controller.ts`

---

## Fase 3 — Extracción y fast path

La extracción de `PositionActionService` es la task de mayor riesgo del ciclo, y va **después** de reescribir las specs de regresión (TASK-033), no antes: así el refactor se hace con la red de protección puesta.

*Subtotal: 18h · 24 puntos*

### TASK-034: Extraer PositionActionService de trading.processor.ts (closeAtMarket, executePartialTakeProfit, rearmProtection), preservando comportamiento

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-006, US-01-007, US-01-008, US-01-009, US-01-011
- **depends_on:** TASK-033
- **Archivos previstos:**
  - `apps/api/src/trading/trading.processor.ts`
  - `apps/api/src/trading/position-action.service.ts`
  - `apps/api/src/trading/position-action.service.spec.ts`
  - `apps/api/src/trading/trading.module.ts`
  - `apps/api/src/trading/trading.processor.exit-machine.spec.ts`
  - `apps/api/src/trading/trading.processor.native-protection.spec.ts`
  - `apps/api/src/trading/trading.processor.protection-rearm.spec.ts`
  - `apps/api/src/trading/trading.processor.sell-policy.spec.ts`
  - `apps/api/src/trading/trading.processor.isolation.spec.ts`

### TASK-018: FastPathService — compone planFastPath por tick y delega en PositionActionService vía ActionGateService

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-006, US-01-007, US-01-008, US-01-009, US-01-010, US-01-011
- **depends_on:** TASK-004, TASK-012, TASK-034, TASK-015
- **Archivos previstos:**
  - `apps/api/src/reactive/fast-path.service.ts`
  - `apps/api/src/reactive/fast-path.service.spec.ts`
  - `apps/api/src/reactive/reactive.module.ts`

### TASK-019: Wiring de los 5 puntos de ejecución del camino LLM a actionGate.authorizeAndRun (executeBuy, executeLLMSell, executePartialTakeProfit, closePositionAtMarket, ensureNativeProtection)

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-011, US-01-012
- **depends_on:** TASK-012, TASK-034, TASK-018
- **Archivos previstos:**
  - `apps/api/src/trading/trading.processor.ts`
  - `apps/api/src/trading/trading.processor.reactive-gate.spec.ts`

---

## Fase 4 — Disparo por evento material (D2)

El adelanto del ciclo de Bull sin duplicarlo. Depende de que el stream, el dueño y la salud ya existan.

*Subtotal: 13h · 15 puntos*

### TASK-021: Escribir rx:v1:window:{configId} en coordination inmediatamente después del re-encolado de runCycle

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-001, US-01-002, US-01-003
- **depends_on:** TASK-031
- **Archivos previstos:**
  - `apps/api/src/trading/trading.processor.ts`
  - `apps/api/src/trading/trading.processor.reactive-window.spec.ts`

### TASK-020: MaterialEventService — secuencia de adelanto D2 (guardas, ventana, token de un solo uso, promote())

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-001, US-01-002, US-01-003
- **depends_on:** TASK-005, TASK-021, TASK-031, TASK-016, TASK-017
- **Archivos previstos:**
  - `apps/api/src/reactive/material-event.service.ts`
  - `apps/api/src/reactive/material-event.service.spec.ts`
  - `apps/api/src/reactive/reactive.module.ts`

### TASK-022: Test de regresión: un evento material adelanta el único ciclo de la ventana, nunca agrega uno ni la pospone

- **Estimación:** 2h · 2 puntos
- **Historias:** US-01-004
- **depends_on:** TASK-020
- **Archivos previstos:**
  - `apps/api/src/reactive/material-event.service.spec.ts`

### TASK-023: Staleness suspende el disparo por evento (guarda de salud HEALTHY) y preserva temporizador + REST

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-018
- **depends_on:** TASK-017, TASK-020
- **Archivos previstos:**
  - `apps/api/src/reactive/material-event.service.ts`
  - `apps/api/src/reactive/material-event.service.spec.ts`

---

## Fase 5 — Verificación transversal

Los tres criterios que solo se pueden probar con todo el sistema montado: costo constante,
multi-réplica y kill switch. **La verificación multi-réplica está partida entre las dos entregas**
(TASK-035 en la entrega 1, TASK-036 en la entrega 2) — ver "Corte de entregas".

*Subtotal: 14h · 19 puntos*

### TASK-024: reactive-cost-harness.spec.ts — buildScenarioTicks (interpolación lineal) + assert por escenario + no-vacuidad

- **Estimación:** 6h · 8 puntos
- **Historias:** US-01-005
- **depends_on:** TASK-005, TASK-020
- **Archivos previstos:**
  - `apps/api/src/orchestrator/cost-harness/scenarios.fixture.ts`
  - `apps/api/src/orchestrator/cost-harness/reactive-cost-harness.spec.ts`

### TASK-035: Test CA-007 (parte 1, **entrega 1**) — una sola suscripción por símbolo y una sola ejecución del fast path bajo N instancias

- **Estimación:** 3h · 5 puntos
- **Historias:** US-01-019
- **depends_on:** TASK-011, TASK-012, TASK-016, TASK-018
- **Archivos previstos:**
  - `apps/api/src/reactive/reactive-multi-replica.spec.ts`
- **Bloqueante para desplegar la entrega 1 con más de una réplica.**

### TASK-036: Test CA-007 (parte 2, **entrega 2**) — un evento material produce exactamente un ciclo de decisión bajo N instancias

- **Estimación:** 2h · 3 puntos
- **Historias:** US-01-019
- **depends_on:** TASK-020, TASK-021, TASK-035
- **Archivos previstos:**
  - `apps/api/src/reactive/reactive-multi-replica.spec.ts`

### TASK-026: Test de regresión CA-001: con reactiveLoopEnabled=false, ActionGateService es passthrough y MarketStreamService no toma leases

- **Estimación:** 3h · 3 puntos
- **Historias:** US-01-020
- **depends_on:** TASK-009, TASK-012, TASK-015, TASK-016, TASK-018, TASK-019, TASK-024
- **Archivos previstos:**
  - `apps/api/src/reactive/reactive-kill-switch.spec.ts`

---

## Tasks absorbidas (sin trabajo pendiente)

- **TASK-006** — ABSORBIDO por TASK-005 — detectMaterialEvent es una única función, no 3 detectores separados (architect.md §4.3)
- **TASK-007** — ABSORBIDO por TASK-005 — el spike de volumen se calcula sobre @kline_1h normalizado, no sobre ratio directo (architect.md §12.1)
- **TASK-008** — ABSORBIDO por TASK-005 y TASK-020 — la composición de detectores y la garantía de no alargar el temporizador quedan en detectMaterialEvent y en el diseño de D2
- **TASK-025** — DIVIDIDO en TASK-035 (entrega 1) y TASK-036 (entrega 2) al adoptar el corte en dos entregas. Su ID **no se reutiliza**

---

## Corte de entregas — DECISIÓN TOMADA

> Decidido por el dev el 2026-08-29. **No es una opción abierta.** Detalle completo en
> `artifacts/delivery-split.md`, referenciado desde `cycle.json`.

128h de trabajo serial (~3.2 semanas) exceden el límite de 2 semanas del arnés. El ciclo se
entrega en **dos entregas, con el test multi-réplica adelantado a la entrega 1**.

### El split de TASK-025

`TASK-025` no podía moverse entero a la entrega 1: dependía de `TASK-021`, que queda en la
entrega 2. Se dividió por el riesgo que cada mitad cubre. **`TASK-025` queda en
`status: "skipped"` y su ID no se reutiliza** — la numeración vigente solo crece, para que ningún
ID cambie de significado entre lecturas del plan.

| Task | Qué prueba | Entrega | depends_on |
| --- | --- | --- | --- |
| **TASK-035** | Una sola suscripción por símbolo y una sola ejecución del fast path bajo N instancias | **1** | TASK-011, TASK-012, TASK-016, TASK-018 |
| **TASK-036** | Un evento material produce exactamente un ciclo de decisión bajo N instancias | **2** | TASK-020, TASK-021, TASK-035 |

### Entrega 1 — 95h · 122 puntos · 23 tasks

```
002 003 004 009 010 011 012 013 014 015 016 017 018 019
027 028 029 030 031 032 033 034 035
```

Kill switch, tabla `bot_actions`, caps de frecuencia como puerta única, extracción de
`PositionActionService` con sus specs saneadas, stream en vivo con dueño único, salud del stream
consultable, **fast path completo defendiendo posiciones abiertas sin LLM**, y la prueba de dos
instancias del dueño único.

**Grafo cerrado y verificado:** ninguna task de la entrega 1 depende de una task de la entrega 2.

### Entrega 2 — 33h · 39 puntos · 9 tasks

```
001 005 020 021 022 023 024 026 036
```

El despertar por evento material (D2), la garantía de que el evento nunca pospone el temporizador,
la suspensión del disparo con el stream degradado, el comparativo de costo de LLM y el cierre de
las pruebas de kill switch y multi-réplica.

### Qué queda fuera de la entrega 1

| Historia | Qué no entra |
| --- | --- |
| US-01-001 | Reaccionar a un movimiento de precio sin esperar al reloj |
| US-01-002 | Reaccionar a un quiebre de nivel |
| US-01-003 | Reaccionar a un spike de volumen |
| US-01-004 | Garantía de que el evento nunca pospone el temporizador |
| US-01-005 | Verificación de costo de LLM constante (harness) |
| US-01-018 | Que la degradación del stream suspenda el disparo por evento |

**CA no probados al cierre de la entrega 1:** CA-002, CA-003, y CA-001 en su forma de test formal
(`TASK-026`). **CA-007 queda parcialmente probado:** la propiedad de dueño único y ejecución única
del fast path sí (`TASK-035`); la de ciclo único por evento no (`TASK-036`, entrega 2).

La entrega 1 es la **capa 2 del alcance sin la capa 1**: defiende posiciones abiertas mucho más
rápido, pero todavía no adelanta la apertura de decisiones nuevas.

### Advertencia operativa (bloqueante)

> **La entrega 1 NO debe desplegarse con más de una réplica hasta que `TASK-035` esté en verde.**
>
> `TASK-016` implementa el dueño único por símbolo (lease Redis), y hasta que su prueba de dos
> instancias pase, la propiedad es una afirmación de diseño y no un hecho verificado. Con N
> réplicas y el lease fallando en silencio se obtienen N suscripciones por símbolo y N ejecuciones
> del fast path sobre la misma posición — es decir, **N órdenes**. Es exactamente el riesgo por el
> que este test se adelantó a la entrega 1.

### Opciones descartadas

- **Opción B — una sola entrega de ~3.2 semanas.** Excede el límite del arnés sin ningún punto de
  corte intermedio y concentra todo el riesgo en un único merge.
- **Opción C — tres entregas de ≤2 semanas.** Ninguna entrega superaba el límite, pero costaba tres
  ciclos completos de revisión y cierre para un beneficio marginal sobre el corte en dos, que ya
  deja la entrega 1 con valor desplegable por sí sola.

## Pendiente de documentar en contexto

Desvíos de TASK-034 respecto al listado literal de architect.md §7.3 (que nombra 6 métodos:
`closePositionAtMarket`, `executePartialTakeProfit`, `ensureNativeProtection`,
`attemptProtectionPlacement`, `applyProtectionOutcome`, `releaseProtectionIfNeeded`), necesarios
para que `PositionActionService` compile como una unidad autocontenida sin dejar código muerto ni
llamadas cruzadas de vuelta a `TradingProcessor`:

- **`placeNativeProtection` también se movió**, expuesto como un cuarto método público
  `placeInitialProtection(ctx)`. Es la única llamadora restante de `attemptProtectionPlacement` /
  `applyProtectionOutcome` fuera de los 3 métodos obligatorios (la usa `executeBuy`, que sigue en
  `TradingProcessor` — su wiring a `actionGate` es TASK-019, no esta task). Sin moverlo, hubiera
  quedado un método privado en `TradingProcessor` invocando métodos privados de otra clase.
- **`closePositionAfterProtectionFailure` y `creditSandboxWallet` también se movieron** (privados).
  Ambos solo tenían llamadores dentro del conjunto que se movía (`applyProtectionOutcome` y
  `closeAtMarket`/`executePartialTakeProfit` respectivamente) — dejarlos en `TradingProcessor` los
  hubiera vuelto código muerto ahí.
- **`releaseProtectionIfNeeded` quedó público** (no privado) en `PositionActionService`, porque
  `TradingProcessor.executeLLMSell` (el camino de venta por LLM, fuera del alcance de esta task)
  también debe liberar la protección nativa antes de vender — es la regla no negociable de
  `constitution.md` §3.3 ("cancelar la protección antes de vender"), que aplica a los 4 caminos de
  salida, no solo a los 3 que expone el contrato del fast path.
- **El constructor de `TradingProcessor` recibe `PositionActionService` como último parámetro
  opcional**, con fallback `new PositionActionService(prisma, gateway, notificationsService)`
  cuando se omite. Esto evitó tocar `trading.processor.aggregate-risk.spec.ts`,
  `trading.processor.decision-traceability.spec.ts`, `trading.processor.deterministic-gate.spec.ts`,
  `trading.processor.reconciliation-order.spec.ts` y `trading.processor.sizing.spec.ts` — ninguno
  está en el `files[]` de TASK-034 y todos instancian `TradingProcessor` con 11 argumentos
  posicionales. El fallback construye la instancia con los mismos mocks de prisma/gateway/
  notifications ya pasados, así que el comportamiento es idéntico al de antes de la extracción sin
  tocar esos 5 archivos. En producción, Nest inyecta el `PositionActionService` real desde
  `TradingModule` (que ahora lo declara como provider y lo exporta) — el parámetro nunca queda sin
  resolver fuera de tests.
- **`trading.processor.exit-machine.spec.ts`, `trading.processor.native-protection.spec.ts`,
  `trading.processor.protection-rearm.spec.ts` y `trading.processor.sell-policy.spec.ts`** estaban
  en el `files[]` previsto por el architect pero **no necesitaron ningún cambio**: gracias al
  fallback del punto anterior, sus `buildProcessor(prisma)` con 11 argumentos siguen construyendo
  un `PositionActionService` real conectado a los mismos mocks, y las aserciones (que ya eran sobre
  comportamiento observable — llamadas a `prisma`/`gateway`/`notifications` — no sobre nombres de
  método) pasan sin tocarlas. Solo `trading.processor.isolation.spec.ts` necesitó un cambio de
  wiring (la prueba de `creditSandboxWallet`, que se movió, ahora instancia `PositionActionService`
  directamente en vez de invocar el método sobre `TradingProcessor`).

Desvíos de TASK-016/TASK-015 (`market-stream.service.ts`) respecto a puntos de architect.md que no
quedan completamente especificados (ninguno afecta el invariante de dueño único de §1; son
decisiones de implementación sobre huecos del contrato):

- **`StreamHealthRecord` no se escribe en Redis desde `MarketStreamService`.** §7.4 describe en
  prosa que el servicio "publica salud (throttled 5s)", pero §7.2 asigna esa responsabilidad al
  archivo `stream-health.service.ts` ("Publica y resuelve el estado por símbolo") de TASK-017 —que
  no existe todavía y depende de TASK-015—, y architect.md no define ninguna clave Redis para este
  registro (solo lista `rx:v1:owner:`, `rx:v1:window:`, `rx:v1:advance:`, `rx:v1:bot:`).
  `MarketStreamService` mantiene `connectedAt` / `lastTickAtMs` / `lastHeartbeatAtMs` en memoria por
  símbolo y los expone vía `getHealthSnapshot(symbol)`; TASK-017 deberá leer este snapshot (o los
  eventos `symbol-owned` / `symbol-released`) y hacer el `setJson` real a Redis con la clave que
  defina.
- **Un solo timer cubre renovación (`ownerRenewIntervalMs`) y barrido de adquisición
  (`ownerSweepIntervalMs`)**, en vez de dos temporizadores independientes. Ambos umbrales por
  default valen 10_000ms y architect.md no tiene ningún test que los requiera desacoplados; se
  simplificó a un único `runOwnershipCycle()` que hace renovación + adquisición en la misma
  pasada, invocado desde un solo `setInterval(ownerSweepIntervalMs)`.
- **Superficie de fan-out (eventos `tick`/`candle`/`symbol-owned`/`symbol-released` vía
  `EventEmitter`, y los getters `getOwnedSymbols`/`isOwner`/`isWarmupComplete`/`getSymbolFilters`)
  es una decisión de diseño, no un contrato literal de architect.md**, que solo describe el pipeline
  en prosa (§7.4). Se siguió el mismo patrón que ya usa `BinanceWsClient` (extender `EventEmitter`)
  para que TASK-018 (`fast-path.service.ts`) y TASK-020 (`material-event.service.ts`) puedan
  consumir ticks/velas sin acoplarse a los detalles de ownership.
- **`lotStep`/`minNotional`** se resuelven de forma fire-and-forget al tomar la propiedad (no
  bloquean la conexión WS ni la suscripción), cacheados por símbolo y expuestos vía
  `getSymbolFilters(symbol)`.

Desvíos de TASK-017 (`stream-health.service.ts` + EP-015):

- **Decisión sobre publicación compartida (el punto crítico dejado abierto por TASK-015/016):
  SÍ hace falta.** §5.1 ya lo exige literalmente — habla de `PX = streamHealthTtlMs` sobre el
  registro, que es vocabulario de `SET ... PX` de Redis, no de una estructura en memoria — y el
  propio EP-015 (§10.1) tiene que devolver una respuesta correcta sin importar qué réplica atienda
  el request HTTP, mientras que `MarketStreamService.getHealthSnapshot(symbol)` solo tiene datos en
  la réplica que efectivamente posee el símbolo. Sin publicación compartida, cualquier réplica que
  no sea dueña reportaría `UNKNOWN/NO_RECORD` para un símbolo sano en otra réplica, violando el
  contrato. `StreamHealthService` escribe `StreamHealthRecord` a Redis vía
  `ReactiveCoordinationPort.setJson` con la clave **`rx:v1:health:{symbol}`** (mismo estilo que
  `rx:v1:owner:{symbol}` / `rx:v1:window:{configId}`) y TTL `streamHealthTtlMs`, cada
  `healthPublishIntervalMs`, solo para los símbolos que la réplica actual posee
  (`MarketStreamService.getOwnedSymbols()` + `getHealthSnapshot()`). La lectura (`resolve()`,
  usada por EP-015 y por el futuro guard de TASK-023) siempre pasa por `coordination.getJson` +
  `resolveStreamHealth`, nunca por el snapshot en memoria — así es correcta corra en la réplica que
  corra.
- **Instanciación manual de `StreamHealthService` dentro de `TradingController`** (no como
  provider de Nest en `trading.module.ts`). El architect (§7.1) prohíbe que `TradingModule` importe
  `ReactiveModule` (para evitar el ciclo, ya que `ReactiveModule` importa `TradingModule`), pero
  `MarketStreamService` — necesario para el lado "publica" — solo vive en `ReactiveModule`. Esta
  task tenía además prohibido tocar `trading.module.ts` (otro agente lo está modificando en
  paralelo). Se resolvió construyendo dos instancias separadas de la misma clase: la de
  `ReactiveModule` (registrada como provider real, con `MarketStreamService` inyectado, dueña del
  timer de publicación y de emitir `market:stream-health`) y la de `TradingController` (creada con
  `new StreamHealthService(...)` en el constructor del controller, usando solo `PrismaService` y
  `REACTIVE_COORDINATION` — ambos ya resolubles en `TradingModule` porque ya importa `PrismaModule`
  (global) y `ReactiveCoordinationModule`), sin `MarketStreamService` ni `AppGateway`: esa instancia
  solo lee (`resolve`/`getHealthForUser`), nunca publica ni emite transición. Es una desviación del
  estilo habitual de DI del repo (constructor injection puro); el Reviewer debería evaluar si,
  cuando el otro agente cierre su cambio en `trading.module.ts`, conviene reemplazarlo por un
  provider real de Nest para `StreamHealthService` en ese módulo.
- **No se implementó la notificación persistente de §5.3 punto 3** (`Notification` con
  `NotificationType.AGENT_ERROR` tras `degradedNotifyAfterMs` de degradación sostenida). El título
  de la task y su `files[]` solo cubren "publica/resuelve/emite transición" (puntos 1 y 2 de §5.3);
  la notificación persistente no aparece asignada a ninguna task del ciclo (`grep` sobre
  `planner.md` no encuentra `degradedNotifyAfterMs` fuera de architect.md). Requeriría inyectar
  `NotificationsService` + resolver "usuarios afectados" por símbolo, fuera del alcance y de los
  archivos permitidos de esta task. Queda pendiente crear una task dedicada.
