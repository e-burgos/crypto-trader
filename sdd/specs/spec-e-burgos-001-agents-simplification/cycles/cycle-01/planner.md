# Sprint Plan — Ciclo 1 — Trading Agents Core (Poda y Observabilidad de Costo)

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                                          |
| -------------------- | --------------------------------------------------------------- |
| Ciclo                | 1                                                                |
| Módulo               | trading-agents-core                                              |
| Apps involucradas    | apps/api, libs/analysis, libs/openrouter                        |
| Duración estimada    | ~1.5 semanas (36h estimadas)                                    |
| Story points totales | 44                                                               |
| Tasks totales         | 12                                                               |

## Secuencia de riesgo (obligatoria)

1. **Rescatar** (TASK-001 a TASK-003): extraer la lógica de `RiskBudgetTool` / `TradeSimulationTool` / `PortfolioContextTool` como servicios de dominio puros, testeados, sin depender del contrato de tool ni del LLM.
2. **Verificar/consolidar** (TASK-004 a TASK-009): confirmar la cobertura del seed de `AgentDefinition`, unificar la resolución de provider/modelo, cablear pricing en vivo y el pipeline de evaluación. Estas tasks no requieren el rescate previo, pero sí deben cerrar antes que la poda que depende de ellas.
3. **Borrar** (TASK-010, TASK-011): eliminar `agents/tools/` + registry + context-planner (solo después de TASK-001/002/003), y `model-router.service.ts` + `llm-analyzer.ts` + método muerto.
4. **Cerrar** (TASK-012): colapsar/aislar la indirección `AgentId` y verificación final de cierre de ciclo (cero referencias, `nx run-many -t test lint` verde, diff neto negativo).

Ninguna task de este ciclo toca sizing, política de SELL, verdict REDUCE, SL/TP, trailing stop, ventas parciales ni límites agregados — comportamiento de trading fuera de alcance (RF-07, cycle-02).

---

## Tasks Backend

### TASK-001: Rescatar RiskBudgetTool como servicio de dominio

**Historia:** HU-01-04
**App:** apps/api
**Descripción:** Extraer el cálculo de presupuesto de riesgo de `apps/api/src/agents/tools/risk-budget.tool.ts` a un servicio de dominio puro (propuesta: `apps/api/src/agents/domain/risk-budget.service.ts`, ajustar al contrato final de `architect.md`), sin dependencia del contrato `AgentTool` ni de ningún llamado LLM. Portar y adaptar los tests existentes de la tool al nuevo servicio.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El servicio de dominio es invocable directamente por código de aplicación (sin pasar por `AgentToolRegistry` ni por una llamada LLM) — CA-012
- [ ] Los tests de cálculo de riesgo pasan contra el nuevo servicio — CA-013
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`
- [ ] El servicio queda mergeado antes de tocar `agent-tool-registry.ts` (prerequisito de TASK-010) — CA-014

---

### TASK-002: Rescatar TradeSimulationTool como servicio de dominio

**Historia:** HU-01-04
**App:** apps/api
**Descripción:** Extraer la lógica de simulación de trade de `apps/api/src/agents/tools/trade-simulation.tool.ts` a un servicio de dominio puro (propuesta: `apps/api/src/agents/domain/trade-simulation.service.ts`, ajustar al contrato final de `architect.md`). Portar y adaptar `trade-simulation.tool.spec.ts` al nuevo servicio.
**Estimación:** 2.5h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El servicio de dominio es invocable directamente, sin contrato de tool ni llamada LLM — CA-012
- [ ] Los tests de simulación pasan contra el nuevo servicio — CA-013
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`
- [ ] El servicio queda mergeado antes de tocar `agent-tool-registry.ts` (prerequisito de TASK-010) — CA-014

---

### TASK-003: Rescatar PortfolioContextTool como servicio de dominio

**Historia:** HU-01-04
**App:** apps/api
**Descripción:** Extraer la lógica de contexto de portfolio de `apps/api/src/agents/tools/portfolio-context.tool.ts` a un servicio de dominio puro (propuesta: `apps/api/src/agents/domain/portfolio-context.service.ts`, ajustar al contrato final de `architect.md`), con tests propios (la tool original no tenía spec dedicado — agregar cobertura nueva).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El servicio de dominio es invocable directamente, sin contrato de tool ni llamada LLM — CA-012
- [ ] Existen tests de contexto de portfolio contra el nuevo servicio — CA-013
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`
- [ ] El servicio queda mergeado antes de tocar `agent-tool-registry.ts` (prerequisito de TASK-010) — CA-014

---

### TASK-004: AgentDefinition como única fuente de system prompts

**Historia:** HU-01-03
**App:** apps/api
**Descripción:** Verificar que `AGENT_SEEDS` (`apps/api/prisma/seed/agents.ts`) cubre exactamente los 6 `SubAgentId` (`orchestrator`, `platform`, `operations`, `market`, `blockchain`, `risk`) con `isActive: true` y `systemPrompt` no vacío. Aplicar el fallback/guardia de arranque que defina `architect.md` para el caso "falta un `AgentDefinition`" (CE-02). Luego eliminar en `apps/api/src/orchestrator/sub-agent.service.ts` el objeto hardcodeado `AGENT_SYSTEM_PROMPTS` (líneas 41-336) y el fallback silencioso de `resolveSystemPrompt` (líneas 503-516, hoy hace `catch` y devuelve `AGENT_SYSTEM_PROMPTS[agentId]`), dejando la lectura de `AgentDefinition` como único camino.
**Estimación:** 3.5h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Editar el `systemPrompt` de un `AgentDefinition` en BD cambia el texto usado en la próxima ejecución, en cualquier camino que invoque al agente — CA-009
- [ ] Cero caminos de ejecución usan un system prompt hardcodeado — CA-010
- [ ] Los 6 agentes están cubiertos en el seed antes de este merge — CA-011
- [ ] Si falta el `AgentDefinition` de algún agente al arrancar, el comportamiento (falla explícita o fallback documentado por el Architect) queda implementado y testeado — CE-02
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-005: Crear el servicio único de resolución provider/modelo

**Historia:** HU-01-05
**App:** apps/api
**Descripción:** Crear un único servicio (contrato definido por `architect.md`) que implemente la cascada user → admin → fallback, consolidando la lógica hoy duplicada en `agent-config-resolver.service.ts:46-87` (`AgentConfigResolverService.resolveConfig`) y `sub-agent.service.ts:641-747` (`SubAgentService.getProvider`). El servicio nuevo convive con ambos callers todavía sin migrar (lo hace TASK-006). Cubrir con tests las 3 ramas de la cascada y el caso "ninguna fuente resuelve" (CE-04).
**Estimación:** 3.5h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Existe un único servicio con la cascada user→admin→fallback, con tests de las 3 ramas
- [ ] Si ninguna fuente resuelve un provider/modelo válido, el servicio responde con un error explícito, no con un valor vacío — CE-04
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-006: Migrar callers al servicio único y eliminar cascadas duplicadas

**Historia:** HU-01-05
**App:** apps/api
**Descripción:** Reemplazar las implementaciones propias de `AgentConfigResolverService.resolveConfig` y `SubAgentService.getProvider` por llamadas al servicio único creado en TASK-005. Eliminar el código de cascada duplicado en ambos archivos, dejando `agent-config-resolver.service.ts` y `sub-agent.service.ts` como consumidores delgados.
**Estimación:** 2.5h · **Story points:** 3
**Dependencias:** TASK-005
**Criterio de done:**

- [ ] `agent-config-resolver.service.ts` y `sub-agent.service.ts` ya no implementan cada uno su propia cascada user→admin→fallback — CA-017
- [ ] Todos los callers existentes de ambos métodos siguen funcionando (tests de integración/unitarios verdes)
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-007: Cablear pricing en vivo de OpenRouter al registro de costo LLM

**Historia:** HU-01-01
**App:** apps/api (consume libs/openrouter)
**Descripción:** Modificar `LLMUsageService.log()` (`apps/api/src/llm/llm-usage.service.ts:63-92`) para resolver el costo de llamadas OpenRouter/Together contra `OpenRouterModelsService.getModelById()` (`libs/openrouter/src/lib/openrouter-models.service.ts`) en vez de depender solo de `MODEL_PRICING` estático (`apps/api/src/llm/model-pricing.ts`, sin entradas para esos proveedores — ver comentario líneas 242-244). Implementar el fallback documentado por `architect.md` para cuando el catálogo no responde (timeout/error), de forma que el registro de uso no se pierda y el costo quede trazable como "calculado con fallback". Agregar `OPENROUTER: 'OpenRouter'` y `TOGETHER: 'Together AI'` (o el copy que defina UX) a `PROVIDER_DISPLAY` (`llm-usage.service.ts:49-55`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Para tráfico OpenRouter, `LLMUsageService.log()` persiste un `costUsd` mayor a 0 — CA-001
- [ ] El desglose de `getStats()` distingue por proveedor (incluyendo OPENROUTER y TOGETHER) y por día calendario — CA-002
- [ ] OPENROUTER y TOGETHER están en `PROVIDER_DISPLAY` — CA-003
- [ ] Si el catálogo de pricing en vivo falla, el registro de uso no se rompe ni se pierde; el costo queda marcado como "calculado con fallback", nunca como $0 silencioso — CA-004, CE-01
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-008: Cablear scheduleEvaluation al persistir AgentDecision

**Historia:** HU-01-02
**App:** apps/api
**Descripción:** Invocar `EvaluationService.scheduleEvaluation(decisionId)` inmediatamente después de `this.prisma.agentDecision.create(...)` en `apps/api/src/trading/trading.processor.ts` (hoy nunca se llama, ver bloque de guardado de decisión ~líneas 329-356). Inyectar `EvaluationService` en `TradingProcessor` si no está disponible. Confirmar que el job `schedule-evaluations` (cola `agent-evaluation`, `EVALUATION_QUEUE`) tiene un disparador operativo — hoy es huérfano.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Al persistir una `AgentDecision`, el sistema programa su evaluación automáticamente, sin intervención manual — CA-005
- [ ] El job `schedule-evaluations` deja de ser huérfano (tiene disparador operativo) — RN-04
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-009: Evaluar decisiones contra precio real de mercado

**Historia:** HU-01-02
**App:** apps/api
**Descripción:** Reemplazar en `apps/api/src/agents/evaluation/evaluation.processor.ts` (líneas ~50-54) la comparación placeholder contra el último `Trade` ejecutado por una consulta al precio real de mercado al horizonte de evaluación definido (`horizonMinutes`), usando la fuente que especifique `architect.md`. Implementar el estado "no evaluable" cuando el precio de mercado al horizonte no está disponible (gap de datos), sin computarlo como win ni loss.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-008
**Criterio de done:**

- [ ] La evaluación se resuelve contra el precio real de mercado al horizonte definido, no contra el precio del último trade — CA-006
- [ ] Para un agente con decisiones cuyo horizonte ya venció, `/agents/scorecard` devuelve win rate y conteo distintos de cero — CA-007
- [ ] Una decisión cuyo horizonte no venció queda visible en estado pendiente, no cuenta como acierto ni error — CA-008
- [ ] Si el precio al horizonte no está disponible, la decisión queda marcada "no evaluable" explícitamente — CE-01 (funcional)
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`

---

### TASK-010: Poda de agent tools, registry y context-planner

**Historia:** HU-01-05
**App:** apps/api
**Descripción:** Eliminar `apps/api/src/agents/tools/` completo (`agent-tool-registry.ts`, `agent-tool.interface.ts`, `agent-tools.module.ts`, `context-planner.service.ts` y sus specs, `decision-memory.tool.ts`, `market-edge.tool.ts`, `portfolio-context.tool.ts`, `risk-budget.tool.ts`, `token-budget.tool.ts`, `trade-simulation.tool.ts`) y su registro DI en `apps/api/src/app/app.module.ts`. `decision-memory.tool.ts:55` referencia un campo `model` inexistente en `AgentDecision` — se va con la poda, no se arregla. Verificar con grep que no queda ningún caller vivo antes de borrar (CE-05); si aparece uno, detener el borrado de ese archivo y documentarlo como excepción en vez de romper el build.
**Estimación:** 2.5h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002, TASK-003
**Criterio de done:**

- [ ] Cero referencias en código fuente a `agents/tools/*`, `agent-tool-registry.ts`, `context-planner.service.ts` — CA-016
- [ ] `AgentToolsModule` ya no está registrado en `app.module.ts`
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api`
- [ ] Ningún caller vivo detectado (o, si lo hubo, documentado como excepción sin romper el build) — CE-05

---

### TASK-011: Poda de model-router, llm-analyzer y método muerto

**Historia:** HU-01-05
**App:** apps/api, libs/analysis
**Descripción:** Eliminar `apps/api/src/agents/model-router.service.ts` (327 líneas, catálogo OpenAI/Claude/Gemini incompatible con el sistema OpenRouter-only) y `model-router.spec.ts`, y su registro DI. Eliminar `libs/analysis/src/lib/llm/llm-analyzer.ts` y limpiar sus exports en el barrel de `libs/analysis`. Eliminar el método muerto `buildNewsAggregator_unused()` en `apps/api/src/trading/trading.processor.ts` (~línea 1141). Verificar con grep que ninguno tiene callers vivos antes de borrar (CE-05).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Cero referencias en código fuente a `model-router.service.ts`, `llm-analyzer.ts`, `buildNewsAggregator_unused` — CA-016
- [ ] El barrel de `libs/analysis` ya no exporta `llm-analyzer`
- [ ] `pnpm nx run-many -t test lint` verde para `apps/api` y `libs/analysis`
- [ ] Ningún caller vivo detectado (o, si lo hubo, documentado como excepción) — CE-05

---

### TASK-012: Colapsar indirección AgentId y verificación final de cierre

**Historia:** HU-01-05
**App:** apps/api
**Descripción:** Aplicar la decisión de `architect.md` sobre el enum `AgentId` (8 valores — `platform`, `operations`, `market`, `blockchain`, `risk`, `orchestrator`, `routing`, `synthesis` — para 6 agentes reales, mapeados hoy en `resolveConfigAgentId`, `sub-agent.service.ts:620-632`): colapsar a un modelo de "KRYPTO con dos velocidades" o, si el costo de migrar el enum persistido en BD lo desaconseja, dejar la indirección documentada y concentrada en un único punto del código (no dispersa). Como cierre del ciclo, correr la verificación completa: cero referencias a todos los subsistemas eliminados en TASK-004/010/011, `pnpm nx run-many -t test lint` verde para todo el workspace afectado, y confirmar que el diff neto de líneas en `apps/api/src/agents` + orchestrator es negativo.
**Estimación:** 3.5h · **Story points:** 5
**Dependencias:** TASK-004, TASK-006, TASK-007, TASK-009, TASK-010, TASK-011
**Criterio de done:**

- [ ] `pnpm nx run-many -t test lint` termina en verde para el workspace afectado por el ciclo — CA-015
- [ ] Cero referencias en código fuente (fuera del historial de git) a los 6 subsistemas listados en RF-06 — CA-016
- [ ] Existe un único servicio de resolución de provider/modelo, sin cascadas duplicadas — CA-017
- [ ] El diff neto de líneas en `apps/api/src/agents` + orchestrator es negativo al cierre del ciclo — CA-018
- [ ] La indirección orchestrator/routing/synthesis queda colapsada, o documentada y concentrada en un único punto del código — CA-019

---

## Orden de ejecución

```
TASK-001 ─┐
TASK-002 ─┼──────────────────────────────────────► TASK-010 ──┐
TASK-003 ─┘                                                     │
                                                                  │
TASK-004 ────────────────────────────────────────────────────────┤
                                                                  │
TASK-005 ──► TASK-006 ─────────────────────────────────────────┤
                                                                  │
TASK-007 ────────────────────────────────────────────────────────┼──► TASK-012
                                                                  │
TASK-008 ──► TASK-009 ──────────────────────────────────────────┤
                                                                  │
TASK-011 ────────────────────────────────────────────────────────┘
```

Camino crítico: `TASK-001/002/003 → TASK-010` y `TASK-005 → TASK-006` y `TASK-008 → TASK-009`, todos convergiendo en `TASK-012` (cierre de ciclo). TASK-004, TASK-007 y TASK-011 son independientes entre sí y pueden ejecutarse en paralelo con cualquier otra rama antes de TASK-012.

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.

---

## Pendiente de documentar en contexto

### TASK-005 — desviaciones del contrato D2 (architect.md §3.2)

- **`slot` tipado como `AgentId` (prisma), no `ModelSlotId`.** `agent-identity.ts` — el único
  archivo que debía definir `ModelSlotId`/`PersonaAgentId` — es explícitamente el alcance de
  TASK-012, que no es dependencia de TASK-005 en el grafo de `tasks.json`. `AgentId` (prisma)
  ya tiene los 8 valores que `ModelSlotId` necesita, así que el comportamiento es idéntico;
  cuando TASK-012 cree `agent-identity.ts`, `resolveClient`/`ResolvedAgentClient` deben migrar
  su firma de `AgentId` a `ModelSlotId`.
- **No se redefinió la interfaz `ResolvedAgentConfig` existente.** El contrato D2 la redefine con
  campo `slot` (en vez de `agentId`) y agrega `'preset'`/`'override'`/`'credential'` a `source`.
  Renombrar `agentId` → `slot` en la interfaz ya consumida por `agent-config.controller.ts`,
  `admin-agent-config.controller.ts` y `market.service.ts` rompería esos callers, y esta task es
  aditiva (`resolveConfig` sigue con callers propios hasta TASK-006). Se agregó en su lugar
  `ResolvedAgentClient` (nueva, con `slot`) sin tocar `ResolvedAgentConfig`. `resolveClient`
  mapea internamente `resolveConfig`'s `source: 'fallback'` → `'preset'` para hablar el
  vocabulario de `ResolutionSource` del contrato. TASK-006 es quien debe decidir si al migrar
  callers conviene fusionar/renombrar ambas interfaces.
