# Sprint Plan — Ciclo 2 — Venta inteligente y gestión activa de riesgo

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo                 | Valor                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Ciclo                 | 2                                                                  |
| Módulo                | trading-agents-core                                                |
| Apps/libs involucrados | apps/api, libs/data-fetcher, libs/trading-engine                  |
| Duración estimada     | ~2 semanas (51h estimadas) — ver advertencia de tamaño abajo      |
| Story points totales  | 62                                                                 |
| Tasks totales          | 16                                                                 |

> ⚠️ **Advertencia de tamaño (para el conductor del loop):** 51h / 62 SP está en el borde
> superior de lo que cycle-01 (36h / 44 SP, 12 tasks) tardó en cerrarse en ~1.5 semanas. Con la
> misma cadencia esto ronda ~2 semanas o las supera levemente. **No divido el ciclo** — la
> decisión de partirlo es del conductor — pero dejo marcado el corte natural que ya impone la
> propia secuencia de riesgo: **TASK-001 a TASK-009 (andamio, 9 tasks, ~29.5h/33 SP) cierran un
> incremento entregable por sí solas** (migraciones + cliente Binance + follow-ups, sin tocar
> comportamiento de trading real) y **TASK-010 a TASK-016 (cableado, 7 tasks, ~21.5h/29 SP)** son
> el segundo incremento. Si hace falta partir, ese es el punto de corte.

## Secuencia de riesgo (obligatoria — inversa a cycle-01)

1. **Follow-ups del cycle-01, independientes desde el día 1** (TASK-001 a TASK-003): no tocan
   trading, no bloquean ni son bloqueados por el resto del ciclo. Se pueden asignar en paralelo
   a las tasks de andamio.
2. **Andamio de datos y contratos** (TASK-004 a TASK-009): migraciones Prisma escritas a mano
   (TradingConfig, Position, Trade.decisionId), órdenes nativas en `BinanceRestClient` con sus
   tests de contrato, y el campo tipado del verdict de AEGIS. Cero cambio de comportamiento de
   trading — solo estructura y contratos verificables por test.
3. **Cableado que cambia comportamiento** (TASK-010 a TASK-016): política de SELL, sizing
   modulado + REDUCE, colocación real de SL/TP, reconciliación, herramientas de ganancia, límites
   agregados y trazabilidad. Cada una depende de su migración/contrato de la fase anterior y
   **todo lo que cambia conducta nace detrás de un default conservador** que reproduce el
   comportamiento actual.

Ninguna task de la fase 2 puede empezar antes de que su dependencia de la fase 1 esté `done` —
ver columna Dependencias de cada task y el diagrama de Orden de ejecución al final.

Criterio de done transversal a **toda** task de este ciclo: `pnpm nx run-many -t test lint`
verde para los proyectos tocados, más el/los test(s) de simulación del CA que la task habilita
(ningún CA de este ciclo requiere BD viva ni credenciales de Binance — todos son test
unitario/integración con mocks, según environment_constraints del brief).

---

## Tasks Backend

### TASK-001: FOLLOW-UP — No-op explícito ante colisión P2002 en EvaluationProcessor

**Historia:** HU-02-09
**App:** apps/api
**Descripción:** En `apps/api/src/agents/evaluation/evaluation.processor.ts`, envolver el
`this.prisma.agentDecisionEvaluation.create(...)` (líneas ~94 y ~123) para capturar el código de
error P2002 de Prisma sobre el UNIQUE `(decisionId, horizonMinutes)` y resolver como no-op
explícito (log + return), sin dejar que la excepción se propague y falle el job de Bull. Agregar
test unitario con mock de `PrismaService` que simula el rechazo P2002 en ambos puntos de
creación (`evaluate` y `createNotEvaluable`).
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Un mock de Prisma que lanza P2002 en `agentDecisionEvaluation.create` no propaga excepción
      fuera de `evaluate` — CA-032
- [ ] El job de Bull no queda marcado como fallido ante esa colisión (test verifica que la
      promesa resuelve, no rechaza)
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-002: FOLLOW-UP — Fusionar ResolvedAgentConfig/ResolvedAgentClient y eliminar casts inseguros

**Historia:** HU-02-10
**App:** apps/api
**Descripción:** En `apps/api/src/agents/agent-config-resolver.service.ts`, unificar las
interfaces `ResolvedAgentConfig` y `ResolvedAgentClient` (hoy declaradas por separado, líneas
~17-24 y ~38-44) en una sola estructura referenciada desde ambos usos, y eliminar los 3 casts
`as unknown as AgentId` del borde `resolveClient → resolveConfig` (líneas ~124, ~202 de ese
archivo, más `agent-prompt.service.ts:30,60`). Migrar los 3 consumidores con vocabulario viejo
identificados en el brief —
`apps/api/src/agents/agent-config.controller.ts` (líneas ~73, ~87, `as AgentId`),
`apps/api/src/agents/admin-agent-config.controller.ts` (línea ~70, `as AgentId`) y
`apps/api/src/market/market.service.ts` (línea ~323, `resolveConfig`) — a `ModelSlotId`
(`apps/api/src/agents/agent-identity.ts`). Actualizar el barrel `apps/api/src/agents/index.ts`.
Quitar el JSDoc narrativo del archivo (regla de cero comentarios).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Una sola estructura definida, referenciada desde los dos usos previos — CA-033
- [ ] Cero apariciones de `as unknown as AgentId` en el árbol (grep dirigido en CI) — CA-034
- [ ] Los 3 consumidores usan `ModelSlotId`, sin el vocabulario `AgentId` anterior en esos 3
      archivos (grep dirigido) — CA-035
- [ ] `pnpm nx run-many -t test lint build` verde para `apps/api`

---

### TASK-003: FOLLOW-UP — Decisión y migración de las tablas huérfanas

**Historia:** HU-02-11
**App:** apps/api
**Descripción:** Ejecutar la decisión que `architect.md` deja registrada sobre
`agent_tool_invocations` (+ enum `AgentToolName`, `apps/api/prisma/schema.prisma:133-141`) y
`agent_model_policies` (sin escritores desde el cycle-01): si la decisión es eliminar, escribir a
mano la migración aditiva y reversible (SQL `DROP TABLE`/`DROP TYPE`, sin `prisma migrate dev` —
no hay BD corriendo), actualizar `schema.prisma` y registrar el nombre exacto del directorio de
migración en `sdd/schema.json`; si la decisión es conservar, no tocar el schema y dejar
constancia de la justificación (ya escrita por el architect) referenciada desde este documento.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna (bloqueada solo por la decisión de `architect.md`, no por otra task)
**Criterio de done:**

- [ ] Existe una decisión explícita y verificable (migración aplicada o justificación escrita) —
      CA-036
- [ ] Si la decisión es eliminar: migración aditiva/reversible con nombre de directorio en
      `sdd/schema.json`, y `pnpm nx run-many -t test lint` verde tras el cambio de
      `schema.prisma` — CA-037
- [ ] Ningún código fuente sigue referenciando `AgentToolInvocation`/`AgentToolName` si se
      eliminó la tabla (grep dirigido)

---

### TASK-004: Migración Prisma — TradingConfig: umbrales de política de venta y herramientas de riesgo/ganancia

**Historia:** HU-02-01, HU-02-05, HU-02-06
**App:** apps/api
**Descripción:** Escribir a mano (sin `prisma migrate dev`) la migración aditiva que agrega a
`TradingConfig` (`apps/api/prisma/schema.prisma:251-269`) los campos que define `architect.md`
para: (a) umbral de confianza de corte de pérdida por señal (RF-01), (b) toggles/parámetros de
trailing stop, take-profit escalonado y salida por tiempo máximo (RF-05), (c) límites de riesgo
agregado por usuario — exposición por activo, pérdida diaria máxima, umbral de drawdown (RF-06).
Todos los campos nuevos con `DEFAULT` que reproduce el comportamiento actual (RN-02, RN-09,
RN-12). Actualizar `schema.prisma` y registrar el directorio de migración en `sdd/schema.json`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El SQL de la migración es aditivo (`ALTER TABLE ... ADD COLUMN`) y cada columna nueva tiene
      `DEFAULT` que reproduce el comportamiento vigente — CA-003, CA-017, CA-021, CA-025
- [ ] `schema.prisma` refleja los campos nuevos y compila (`pnpm nx run-many -t build` para
      `apps/api`)
- [ ] Directorio de migración registrado en `sdd/schema.json` bajo la tabla `trading_configs`

---

### TASK-005: Migración Prisma — Position: estado explícito de protección

**Historia:** HU-02-03, HU-02-04
**App:** apps/api
**Descripción:** Escribir a mano la migración aditiva que agrega a `Position`
(`apps/api/prisma/schema.prisma:281-296`) el campo (o enum) de estado de protección que define
`architect.md` para distinguir explícitamente "protegida" de "desprotegida" (RN-06) más el/los
campo(s) para referenciar la orden de protección colocada en el exchange (necesarios para
TASK-012 y TASK-013). Actualizar `schema.prisma` y registrar el directorio de migración en
`sdd/schema.json`.
**Estimación:** 2.5h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El estado de protección es un valor propio (no infierible por ausencia de otro campo) —
      precondición de CA-013, CA-015
- [ ] `schema.prisma` compila y el campo nuevo tiene default consistente con posiciones abiertas
      antes de este ciclo (no rompe lecturas existentes)
- [ ] Directorio de migración registrado en `sdd/schema.json` bajo la tabla `positions`

---

### TASK-006: Migración Prisma — Trade.decisionId (FK nullable a AgentDecision)

**Historia:** HU-02-07
**App:** apps/api
**Descripción:** Escribir a mano la migración aditiva que agrega `decisionId` (nullable) a
`Trade` (`apps/api/prisma/schema.prisma:306-320`) como FK hacia `AgentDecision`, sin backfill de
filas históricas (RN-14). Actualizar `schema.prisma` con la relación y registrar el directorio de
migración en `sdd/schema.json`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El SQL de la migración declara `decisionId` como `NULL`-able, sin ningún `UPDATE` de
      backfill — verificable inspeccionando el archivo de migración — CA-027
- [ ] `schema.prisma` refleja la relación `Trade.decisionId → AgentDecision` y compila
- [ ] Directorio de migración registrado en `sdd/schema.json` bajo la tabla `trades`

---

### TASK-007: BinanceRestClient — órdenes LIMIT y STOP_LOSS_LIMIT + validación de lot-size/minNotional/tick-size

**Historia:** HU-02-03
**App:** libs/data-fetcher
**Descripción:** En `libs/data-fetcher/src/lib/binance/binance-rest.client.ts`, junto al
`placeMarketOrder` existente (línea ~282), agregar `placeLimitOrder` y
`placeStopLossLimitOrder` según el contrato de payload/firma que defina `architect.md`. Extender
la obtención de filtros de símbolo (`getLotSizeFilter`, línea ~235, hoy solo LOT_SIZE) para
incluir también MIN_NOTIONAL y PRICE_FILTER (tick-size), y validar cantidad/precio contra esos 3
filtros **antes** de armar el request — un valor fuera de rango se rechaza localmente sin llamar
al exchange.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El payload y la firma de LIMIT y STOP_LOSS_LIMIT siguen el contrato de `architect.md`,
      verificado con mock de la capa HTTP — CA-010
- [ ] Una cantidad o precio fuera de lot-size/minNotional/tick-size se rechaza localmente sin
      invocar al mock del exchange — CA-011
- [ ] `pnpm nx run-many -t test lint` verde para `libs/data-fetcher`

---

### TASK-008: BinanceRestClient — orden OCO + consulta de estado de orden

**Historia:** HU-02-03, HU-02-04
**App:** libs/data-fetcher
**Descripción:** En `binance-rest.client.ts`, agregar `placeOcoOrder` (payload/firma según
`architect.md`, reutilizando la validación de filtros de símbolo de TASK-007) y un método de
consulta de estado (`queryOrder`/`getOpenOrders`, según lo que defina `architect.md`) necesario
tanto para el manejo de rechazo de la orden de protección (TASK-012) como para la reconciliación
de estado (TASK-013).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-007
**Criterio de done:**

- [ ] Payload y firma de OCO verificados con mock de la capa HTTP, sin red real — CA-010
- [ ] Rechazo del exchange (mock que devuelve error) es manejado explícitamente, sin excepción no
      capturada — precondición de CA-013/CE-02
- [ ] El método de consulta de estado distingue al menos FILLED / CANCELED / NEW sobre un mock —
      precondición de CA-014/CA-015
- [ ] `pnpm nx run-many -t test lint` verde para `libs/data-fetcher`

---

### TASK-009: Campo tipado de bloqueo en AegisVerdict + regla estructurada que reemplaza isFalseConcentrationBlock

**Historia:** HU-02-08
**App:** apps/api
**Descripción:** Agregar a `AegisVerdict`
(`apps/api/src/orchestrator/dto/decision-synthesis.dto.ts:12-18`) el campo tipado de motivo de
bloqueo que define `architect.md` (ej. un enum de `blockReason`). Reemplazar en
`apps/api/src/orchestrator/orchestrator.service.ts` (líneas ~451-473) la función
`isFalseConcentrationBlock` (regex sobre `reason`, líneas ~458-465) por una regla estructurada
que lee exclusivamente el campo tipado nuevo. Ajustar el prompt/schema que AEGIS produce si el
contrato de `architect.md` lo requiere para que el LLM emita ese campo.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Un `BLOCK` con motivo distinto al de falso positivo de concentración se respeta sin
      importar el texto de `reason`, probado con textos que contienen la palabra "concentración"
      sin serlo — CA-029
- [ ] El override de falso positivo de concentración se decide leyendo el campo tipado, nunca
      matcheando `reason` — CA-030
- [ ] Cero referencias a `isFalseConcentrationBlock` ni a un regex sobre `reason` en el árbol de
      código fuente (grep dirigido en CI) — CA-031
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-010: Política de SELL — corte de pérdida por señal reemplaza el veto de minProfitPct

**Historia:** HU-02-01
**App:** apps/api
**Descripción:** En `apps/api/src/trading/trading.processor.ts` (líneas ~879-890, el
`if (profitPct < minProfitPct) continue`), extraer y reemplazar el veto absoluto por una función
de política explícita y testeable que combine confianza del agente, `profitPct` y el umbral
configurable de `TradingConfig` (TASK-004) según la fórmula de `architect.md`: permite SELL en
pérdida cuando la confianza supera el umbral (RN-01); `minProfitPct` sigue actuando como piso
independiente del camino de toma de ganancia (RN-01, RN-02). Confianza ausente/inválida nunca se
interpreta como "alta confianza" (CE-01).
**Estimación:** 3.5h · **Story points:** 5
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] Confianza bajo el umbral + `profitPct` negativo → SELL rechazado (test unitario) — CA-001
- [ ] Confianza en/sobre el umbral + `profitPct` negativo → SELL permitido (test unitario) —
      CA-002
- [ ] Con el default de la migración, el mismo escenario de CA-002 sigue rechazado (test de
      regresión) — CA-003
- [ ] `profitPct` positivo bajo `minProfitPct`, sin corte de pérdida aplicable → SELL rechazado
      igual que hoy (test unitario) — CA-004
- [ ] Confianza nula/fuera de rango → el camino se resuelve como si no hubiera señal de corte
      (test unitario) — CE-01
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-011: Sizing modulado con techo inviolable + verdict REDUCE de AEGIS

**Historia:** HU-02-02
**App:** libs/trading-engine, apps/api
**Descripción:** En `libs/trading-engine/src/lib/order-executor.ts`
(`calculateTradeQuantity`, línea ~164), cambiar `balance × maxTradePct` fijo por
`maxTradePct` como techo, modulado por `positionSizeMultiplier` de AEGIS
(`decision-synthesis.dto.ts`), el `maxTradeSize` sugerido por FORGE
(`apps/api/src/orchestrator/sub-agent.service.ts:73`) y el verdict `REDUCE` de AEGIS (hoy sin
manejo en `orchestrator.service.ts`), según la fórmula y magnitud de reducción de
`architect.md`. El techo nunca se supera para ninguna combinación (RN-03); `REDUCE` reduce
tamaño, nunca bloquea (RN-04, `BLOCK` sigue siendo el único bloqueo total).
**Estimación:** 3.5h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] AEGIS neutro + sizing de FORGE ≥ techo → resultado idéntico al actual
      (`balance × maxTradePct`) (test unitario) — CA-005
- [ ] `positionSizeMultiplier` < 1 → tamaño resultante menor al techo, en la proporción definida
      por `architect.md` (test unitario) — CA-006
- [ ] Sizing de FORGE menor al techo ya modulado por AEGIS → resultado ≤ el menor de los dos
      valores (test con varias combinaciones) — CA-007
- [ ] Verdict `REDUCE` reduce el tamaño en la magnitud definida por `architect.md` frente al caso
      sin `REDUCE` (test unitario comparativo) — CA-008
- [ ] Para combinaciones extremas de multiplicador/FORGE/verdict, el resultado nunca excede
      `balance × maxTradePct` (test unitario con valores límite) — CA-009
- [ ] `pnpm nx run-many -t test lint` verde para `libs/trading-engine` y `apps/api`

---

### TASK-012: Colocación de SL/TP nativo al abrir posición + estado "desprotegida"

**Historia:** HU-02-03
**App:** apps/api
**Descripción:** En el flujo de apertura de posición de `apps/api/src/trading/trading.processor.ts`,
invocar inmediatamente después de confirmarse la compra la colocación de la orden de protección
(OCO, o STOP_LOSS_LIMIT + LIMIT según defina `architect.md`) usando los métodos de TASK-007/
TASK-008, y persistir el estado de `Position` (TASK-005) en consecuencia. Si la compra ya se
ejecutó pero el exchange rechaza la orden de protección (mock de error) o falla por timeout
simulado, la posición queda marcada explícitamente en el estado "desprotegida" que define
`architect.md` — nunca indistinguible de una posición protegida (RN-06, CE-02).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-005, TASK-007, TASK-008
**Criterio de done:**

- [ ] En un flujo de apertura simulado con cliente Binance mockeado, la orden de protección se
      coloca inmediatamente después de confirmarse la compra (test de integración con mocks, sin
      BD real) — CA-012
- [ ] Compra ejecutada + rechazo de la orden de protección → `Position` queda en el estado
      explícito "desprotegida", verificable y observable (test) — CA-013
- [ ] Timeout simulado en la colocación de la protección → el sistema no asume protección
      silenciosamente, aplica el mismo manejo que CA-013 o el reintento que defina
      `architect.md` (test) — CE-02
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-013: Reconciliación de estado al inicio de ciclo

**Historia:** HU-02-04
**App:** apps/api
**Descripción:** Antes de que el ciclo tome cualquier decisión nueva
(`apps/api/src/trading/trading.processor.ts`), consultar el estado real de las órdenes de
protección abiertas usando el método de consulta de TASK-008 y conciliar con `Position`/`Trade`
locales (TASK-005): orden FILLED → cerrar `Position` local con el precio de cierre reportado
(CA-014); orden cancelada/inexistente → marcar la posición como desprotegida y activar la ruta de
resolución que defina `architect.md` (re-colocar orden o alertar, CA-015). El algoritmo debe ser
idempotente (RN-08).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-005, TASK-008, TASK-012
**Criterio de done:**

- [ ] Mock que reporta la orden de protección como FILLED → `Position` local se actualiza a
      cerrada con el precio de cierre reportado (test de integración con mocks) — CA-014
- [ ] Mock que reporta la orden cancelada/inexistente → `Position` marcada desprotegida y ruta de
      resolución activada (test) — CA-015
- [ ] Ejecutar la reconciliación dos veces seguidas sobre el mismo estado simulado no duplica
      trades ni cambia el resultado de la segunda corrida (test de idempotencia) — CA-016
- [ ] La reconciliación corre antes de cualquier decisión nueva del ciclo (test/verificación de
      orden de invocación) — RN-07
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-014: Herramientas de ganancia — trailing stop, take-profit escalonado y salida por tiempo

**Historia:** HU-02-05
**App:** apps/api, libs/trading-engine
**Descripción:** Implementar, cada una activable de forma independiente por los campos de
`TradingConfig` de TASK-004 (default apagado/neutro): (a) trailing stop — función pura que, dada
una secuencia de precios ascendente, mueve el nivel de stop hacia arriba y nunca lo retrocede
(RN-10); (b) take-profit escalonado — al alcanzar el primer umbral configurado, ejecuta venta
parcial y mueve el stop remanente a breakeven; (c) salida por tiempo máximo — con reloj
controlado/fake timers, dispara la señal de cierre cuando la antigüedad de la posición supera el
límite configurado. Con las tres en su valor por defecto, ningún test de regresión pre-existente
sobre el flujo de salida cambia de resultado (RN-09).
**Estimación:** 5.5h · **Story points:** 8
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] Trailing desactivado (default) → resultado idéntico a un escenario ya cubierto por tests
      existentes (test de regresión) — CA-017
- [ ] Trailing activado + precios ascendentes → el stop sube y nunca retrocede (test unitario) —
      CA-018
- [ ] Take-profit escalonado activado + precio alcanza el primer umbral → venta parcial + stop a
      breakeven (test unitario) — CA-019
- [ ] Salida por tiempo activada + posición que supera el límite configurado → señal de cierre
      disparada, con fake timers (sin esperar tiempo real) — CA-020
- [ ] Las tres en default → ningún test de regresión pre-existente del flujo de salida cambia de
      resultado — CA-021
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api` y `libs/trading-engine`

---

### TASK-015: Límites de riesgo agregado por usuario cableados al camino real de ejecución

**Historia:** HU-02-06
**App:** apps/api
**Descripción:** Invocar `RiskBudgetService` y `PortfolioContextService`
(`apps/api/src/agents/domain/`, ya provistos por `AgentDomainModule` desde cycle-01, sin
callers reales) en el punto exacto del pipeline de ejecución que defina `architect.md`, usando
los campos de exposición por activo, pérdida diaria máxima y drawdown agregados por usuario
(TASK-004): exposición combinada entre `TradingConfig` del mismo usuario que supere el límite
rechaza la nueva orden (CA-022); pérdida diaria acumulada sobre el máximo bloquea nuevas compras
del usuario por el resto del día (CA-023); drawdown que cruza el umbral pausa los agentes del
usuario automáticamente (CA-024). En valor por defecto, ningún test pre-existente cambia de
resultado (RN-12).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] Exposición combinada entre 2 `TradingConfig` del mismo usuario que excede el límite →
      nueva orden rechazada por `RiskBudgetService` (test de integración con datos simulados, sin
      BD real) — CA-022
- [ ] Pérdida diaria acumulada sobre el máximo → nuevas compras del usuario bloqueadas por el
      resto del día (test) — CA-023
- [ ] Drawdown que cruza el umbral → agentes del usuario pausados automáticamente sin
      intervención manual (test) — CA-024
- [ ] Límites en default → ningún escenario cubierto por tests pre-existentes cambia de resultado
      (test de regresión) — CA-025
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-016: Trazabilidad — setear Trade.decisionId en el flujo real de ejecución

**Historia:** HU-02-07
**App:** apps/api
**Descripción:** En el punto donde `apps/api/src/trading/trading.processor.ts` crea un `Trade`
dentro del flujo real de ejecución, setear `decisionId` (TASK-006) con el id de la
`AgentDecision` que originó la orden. Un `Trade` generado por un camino sin `AgentDecision`
asociada no debe fallar al persistirse — `decisionId` queda en `null`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-006
**Criterio de done:**

- [ ] Al crear un `Trade` en el flujo real, `decisionId` queda seteado con el id de la
      `AgentDecision` que lo originó (test de integración con mocks de persistencia, sin BD
      real) — CA-026
- [ ] Un `Trade` generado sin `AgentDecision` asociada se persiste igual, con `decisionId: null`
      (test) — CA-028
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

## Orden de ejecución

```
Fase 0 — Follow-ups (paralelos entre sí y con la Fase 1, no bloquean nada del ciclo)
TASK-001 (independiente)
TASK-002 (independiente)
TASK-003 (independiente, bloqueada solo por la decisión de architect.md)

Fase 1 — Andamio de datos y contratos (paralelizable entre sí)
TASK-004 (independiente)
TASK-005 (independiente)
TASK-006 (independiente)
TASK-007 → TASK-008 (OCO + queryOrder reutiliza la validación de filtros de TASK-007)
TASK-009 (independiente)

Fase 2 — Cableado que cambia comportamiento
TASK-004 → TASK-010 (política de SELL)
TASK-011 (independiente, sizing/REDUCE no requiere migración)
TASK-005, TASK-007, TASK-008 → TASK-012 (SL/TP nativo)
TASK-005, TASK-008, TASK-012 → TASK-013 (reconciliación)
TASK-004 → TASK-014 (trailing/TP escalonado/salida por tiempo)
TASK-004 → TASK-015 (límites de riesgo agregado)
TASK-006 → TASK-016 (Trade.decisionId)
```

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.

## Pendiente de documentar en contexto

- **TASK-004 — desviación respecto a la descripción original de este documento.** La descripción
  de TASK-004 (líneas 130-141) listaba los límites de riesgo agregado por usuario (RF-06,
  HU-02-06) como campos nuevos de `TradingConfig`. `architect.md` §3 (decisión D2) resolvió esto
  distinto: esos límites viven en una tabla nueva `user_risk_policies` (1:1 con `User`), no en
  `TradingConfig` — evita elegir "cuál config gana" cuando dos configs del mismo usuario
  difieren, y evita reforzar la confusión ya detectada entre presupuesto de LLM
  (`AgentBudgetPolicy.dailyUsdBudget`) y límite de pérdida de trading (hallazgo 1.1-2 de
  `architect.md`). TASK-004 implementó lo que `architect.md` define como autoridad: 17 columnas
  nuevas en `trading_configs` (política de SELL, sizing, protección nativa, herramientas de
  ganancia — sin los límites agregados) + la migración y el modelo `UserRiskPolicy` completos
  (`20260817153000_add_user_risk_policies`). Ninguna otra task del ciclo tenía asignada esta
  migración; quedó bajo TASK-004 por ser la única con `HU-02-06` en su `user_stories`.
- **`apps/api/src/prisma/prisma.service.ts` no estaba en el alcance de archivos original de
  TASK-004/005/006/003**, pero sus getters son 1:1 con los modelos de Prisma: agregar
  `UserRiskPolicy` y dropear `AgentModelPolicy`/`AgentToolInvocation` sin actualizarlo rompe el
  build de `apps/api` (el cliente generado ya no expone esos modelos). Se tocó de forma mínima y
  mecánica (alta/baja de 3 getters, cero lógica) en TASK-004 y TASK-003.
- **DTO de `UserRiskPolicy` (`EP-004`/`EP-005`, `apps/api/src/trading/dto/user-risk-policy.dto.ts`
  en `architect.md` §15) no se creó en esta oleada.** El modelo y la migración existen y
  compilan, pero el DTO y el wiring de controller/service quedan pendientes — `trading.service.ts`
  y `trading.controller.ts` estaban fuera del alcance de archivos autorizado para este batch.
  Candidato natural para TASK-015 (que ya cablea `RiskBudgetService`/`PortfolioContextService`
  contra esta misma tabla) o una task dedicada si el conductor del ciclo prefiere separarlo.
- **TASK-007/TASK-008 — `ExchangeOrderState`/`ExchangeOrderStatus` viven en `libs/shared`, no en
  `libs/data-fetcher`.** `architect.md` §5.1 los define junto al resto del contrato de
  `BinanceRestClient`, pero §15 (tabla de archivos) lista `libs/shared` como modificado para
  "estados de orden". Se siguió la tabla de §15: ambos tipos se agregaron a
  `libs/shared/src/types/interfaces.ts` y se re-exportan desde ahí. Esto es lo que permite que
  `libs/trading-engine/order-executor.ts` (el `OrderExecutorPort` extendido) los use sin que
  `trading-engine` pase a depender de `data-fetcher` — no había ningún precedente de esa
  dependencia entre libs y `LiveOrderExecutor` ya evita el acoplamiento tipando su constructor
  estructuralmente en vez de importar `BinanceRestClient`. El resto del contrato de §5.1
  (`SymbolFilters`, `OrderValidationError`, `OcoOrderResult`, etc.) sí quedó en `data-fetcher`,
  tal como indica el título de esa sección.
- **TASK-007 — se eliminó `getLotSizeFilter`/`LotSizeFilter` en vez de dejarlo junto a
  `getSymbolFilters`.** `architect.md` describe "extender" el caché de filtros; no tenía
  consumidores fuera del propio `binance-rest.client.ts` (`placeMarketOrder` era el único
  caller), así que se reemplazó por `getSymbolFilters(symbol).lotSize` en vez de mantener dos
  métodos que golpean el mismo caché con nombres distintos. El contrato de §5.1 solo lista
  `getSymbolFilters`, consistente con esta lectura.
- **TASK-007/TASK-008 — tabla de códigos reintentables exportada desde `binance-rest.client.ts`
  (`RETRYABLE_BINANCE_ERROR_CODES`, `isRetryableBinanceErrorCode`, `getBinanceErrorCode`), sin
  método explícito en el contrato de `architect.md` §5.1.** La tabla de §5.3 no está atada a
  ningún método de la clase — es información que el retry-loop de `executeBuy` (TASK-012,
  `apps/api`, fuera de este alcance) va a necesitar para decidir si reintenta la colocación de
  la protección. Se expuso como utilidades puras del cliente (el lugar natural donde se parsea
  el error de Binance) en vez de dejarlas sin implementar a la espera de TASK-012.
- **TASK-008 — `SandboxOrderExecutor.placeLimitOrder`/`placeStopLossLimitOrder` no están
  descritos en `architect.md` §5.6** (esa sección solo cubre `placeProtectionOrder`/
  `getProtectionOrderStatus`/`cancelProtectionOrder`). Como `OrderExecutorPort` exige los 8
  métodos en toda implementación, se resolvieron como fills inmediatos al precio pedido
  (mismo mecanismo que `placeMarketOrder`, factorizado en un `fillAtPrice` privado
  compartido) — coherente con que SANDBOX no simula un libro de órdenes real y con que
  `nativeProtectionEnabled` ya se ignora en SANDBOX según esa misma sección.
- **TASK-012/TASK-013 — `OrderExecutorPort` se extendió a 9 métodos, sumando `getOpenOrders`**,
  no listado en el contrato de §5.4 de `architect.md` (que enumera 8). El barrido de OCO zombie
  de §7.1 fila 5 exige `getOpenOrders(symbol)` — método que solo existe en `BinanceRestClient`,
  no en el port. Extenderlo (en vez de que `ReconciliationService` importe `BinanceRestClient`
  directamente) mantiene la inversión de dependencia: la reconciliación solo conoce el port,
  igual que el resto del processor. `LiveOrderExecutor.getOpenOrders` delega 1:1;
  `SandboxOrderExecutor.getOpenOrders` devuelve las protecciones simuladas del símbolo (para
  poder testear el contrato) — sin impacto real porque `nativeProtectionEnabled` ya se ignora en
  SANDBOX (§5.6), así que SANDBOX nunca ejecuta el barrido en el flujo real.
- **TASK-012/TASK-013 — nuevo archivo `apps/api/src/trading/protection-retry.ts`**, no listado en
  la tabla de archivos de `architect.md` §15. Contiene la única implementación del algoritmo de
  reintento de §6 paso 3 (3 intentos, backoff 250/1000/3000ms con jitter ±20%, solo códigos
  reintentables, `listClientOrderId` persistido antes de cada llamada) como función pura
  reutilizada tal cual por `TradingProcessor.placeNativeProtection` (colocación inicial en
  `executeBuy`) y por `ReconciliationService.attemptProtection` (reintento del ciclo siguiente,
  §7.1). Extraerla evita reimplementar el mismo backoff dos veces y es lo que hace que
  `startingFailureCount` continúe la numeración de `listClientOrderId` entre ciclos sin
  coordinación adicional.
- **TASK-013 — barrido de huérfanos con salvaguarda cross-config no descrita en `architect.md`.**
  `getOpenOrders(symbol)` es a nivel de cuenta+símbolo en Binance, no por `TradingConfig`; si dos
  configs del mismo usuario operan el mismo símbolo, el barrido de la reconciliación de una config
  cancelaría la OCO legítima de la otra. Se agregó una consulta adicional
  (`addExternalLiveOrderIds`) que suma al set de `orderListId` "vivos" las posiciones `PROTECTED`
  de otras configs del mismo usuario/asset/pair/mode antes de barrer. No hay CA que lo pida
  explícitamente; es una salvaguarda de correctitud directamente derivada del hallazgo 1.1-3 del
  architect (bloqueo de saldo por OCO).
- **TASK-012/TASK-013 — la regla "toda salida cancela la protección antes de vender" (§5.4,
  hallazgo 1.1-3) se aplicó en este mismo batch a los 3 caminos de salida que ya existían en el
  alcance de archivos (`executeLLMSell`, el cierre por stop/TP de `checkOpenPositions` en
  `trading.processor.ts`, y `closePositionManually` en `trading.service.ts`)**, aunque
  `architect.md` la describe como aplicable también al parcial de TP de TASK-014 (aún no
  implementado, no existe ese camino todavía). Sin esto, cualquier SELL sobre una posición
  `PROTECTED` fallaría por saldo bloqueado en la OCO en cuanto TASK-012 empezara a colocar
  protección real — no tenía sentido entregar la colocación sin el release correspondiente en los
  caminos de salida ya existentes.
