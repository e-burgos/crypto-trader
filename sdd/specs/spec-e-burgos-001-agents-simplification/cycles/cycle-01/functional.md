# Functional — Cycle 01: Poda y observabilidad de costo (fundación)

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

La plataforma opera bots de trading cripto con 6 agentes-personaje (KRYPTO, NEXUS, FORGE,
SIGMA, CIPHER, AEGIS) que analizan el mercado vía LLM y deciden operar. El objetivo de negocio
es obtener ganancias de forma segura y con justificación de análisis previo.

Hoy el dueño del bot paga entre $1,40 y $5 por día por bot en llamadas LLM, pero el dashboard de
costos le reporta $0 para casi todo ese tráfico porque el camino por defecto (OpenRouter) no
tiene tarifas cargadas. Tampoco puede saber si las decisiones del agente fueron correctas: el
scorecard de decisiones existe pero siempre devuelve ceros, porque el pipeline de evaluación
nunca se dispara. Alrededor del núcleo activo (`TradingProcessor` → `OrchestratorService` →
`SubAgentService` → LLM) hay ~1.900 líneas de subsistemas registrados en DI pero nunca
invocados (agent tools, context planner, model router, LLM analyzer, un método muerto), y la
resolución de provider/modelo y los system prompts están duplicados en más de un archivo.

Este ciclo es de **fundación**: no cambia qué compra ni cuándo vende el bot (eso es el
cycle-02) — hace que lo que ya ocurre sea medible (costo real, calidad de decisión) y que el
código que lo sostiene sea la mitad, con una sola fuente de verdad para provider/modelo y para
system prompts.

## Historias de usuario

### HU-01-01: Ver el costo LLM real por proveedor y por día

**Como** operador de la plataforma (dueño del bot)
**Quiero** ver en el dashboard de costos el gasto LLM real, discriminado por proveedor y por día
**Para** saber cuánto me cuesta operar cada bot y decidir si el modelo/proveedor elegido es sostenible

**Criterios de aceptación:**

- [ ] CA-001: Para tráfico servido vía OpenRouter, el dashboard de costos reporta un monto **mayor a $0** (no aparece como $0 ni como "sin datos").
- [ ] CA-002: El desglose de costo distingue al menos por proveedor (incluyendo OPENROUTER y TOGETHER) y por día calendario.
- [ ] CA-003: Los proveedores OPENROUTER y TOGETHER aparecen listados en `PROVIDER_DISPLAY`, junto a los proveedores ya soportados.
- [ ] CA-004: Si el catálogo de pricing en vivo de OpenRouter no responde (timeout o error), el registro de uso (`LLMUsageService.log`) no se pierde ni rompe: aplica el fallback documentado por el Architect y el costo resultante queda trazable como "calculado con fallback", nunca como $0 silencioso.

**Prioridad:** Alta
**Estimación:** M

---

### HU-01-02: Ver el scorecard de decisiones con resultados reales

**Como** operador de la plataforma
**Quiero** que `/agents/scorecard` muestre win rate y resultados reales de las decisiones de cada agente, en vez de ceros
**Para** saber si el agente está acertando y decidir si confío en sus decisiones

**Criterios de aceptación:**

- [ ] CA-005: Al persistir una `AgentDecision`, el sistema programa su evaluación automáticamente, sin intervención manual.
- [ ] CA-006: La evaluación de una decisión se resuelve comparando contra el **precio real de mercado al horizonte de tiempo definido**, no contra el precio del último trade ejecutado.
- [ ] CA-007: Para un agente con decisiones cuyo horizonte de evaluación ya venció, `/agents/scorecard` devuelve win rate y conteo de resultados distintos de cero.
- [ ] CA-008: Una decisión cuyo horizonte de evaluación todavía no venció no cuenta como acierto ni como error: queda visible en estado pendiente.

**Casos de error:**

- CE-01: Si el precio de mercado al horizonte de evaluación no está disponible (gap de datos del proveedor de precios), la decisión queda marcada explícitamente como "no evaluable" — no se computa como win ni como loss de forma silenciosa.

**Prioridad:** Alta
**Estimación:** M

---

### HU-01-03: Editar el system prompt de un agente desde una sola fuente

**Como** admin de la plataforma
**Quiero** editar el system prompt de un agente (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) y que el cambio sea efectivo en todos los caminos que lo usan
**Para** no tener que sincronizar el mismo texto en más de un lugar ni arriesgarme a que un camino quede con el prompt viejo

**Criterios de aceptación:**

- [ ] CA-009: Editar el system prompt de un agente vía su `AgentDefinition` (BD) cambia el texto usado en la próxima ejecución de ese agente, en cualquier camino del sistema que lo invoque.
- [ ] CA-010: No queda ningún camino de ejecución que use un system prompt hardcodeado en vez del de `AgentDefinition`.
- [ ] CA-011: Los 6 agentes (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) tienen su system prompt cubierto en el seed de `AgentDefinition` antes de eliminar el hardcode.

**Casos de error:**

- CE-02: Si al arrancar la aplicación falta el `AgentDefinition` de alguno de los 6 agentes, el arranque falla de forma explícita — o, si el Architect documenta un fallback seguro, éste queda declarado y trazable. Nunca un agente corre en silencio con prompt vacío o indefinido.

**Prioridad:** Alta
**Estimación:** S

---

### HU-01-04: Rescatar la lógica de riesgo y simulación como servicios de dominio reutilizables

**Como** dev del equipo
**Quiero** que la lógica de `RiskBudgetTool`, `TradeSimulationTool` y `PortfolioContextTool` exista como servicios de dominio puros, independientes del contrato de tool y de cualquier llamada LLM
**Para** poder cablearla al camino real de ejecución en el cycle-02 sin tener que reescribirla desde cero

**Criterios de aceptación:**

- [ ] CA-012: Existe un servicio de dominio por cada lógica rescatada (presupuesto de riesgo, simulación de trade, contexto de portfolio), invocable directamente por código de aplicación, sin pasar por el contrato de agent tool ni por una llamada LLM.
- [ ] CA-013: Los tests de esa lógica (cálculo de riesgo, simulación, contexto) pasan contra el servicio de dominio rescatado.
- [ ] CA-014: El rescate está mergeado y testeado **antes** de que se elimine `agent-tool-registry.ts` y las tools originales — no después.

**Prioridad:** Alta
**Estimación:** M

---

### HU-01-05: Un núcleo de agentes con una sola ruta de resolución y cero subsistemas muertos

**Como** dev del equipo
**Quiero** que el núcleo de agentes tenga una sola ruta de resolución de provider/modelo y ningún subsistema registrado en DI que nunca se invoque
**Para** entender y mantener el código sin descartar mentalmente caminos muertos, y reducir el costo de cambio futuro

**Criterios de aceptación:**

- [ ] CA-015: `pnpm nx run-many -t test lint` termina en verde para el workspace afectado por el ciclo.
- [ ] CA-016: Cero referencias en el código fuente (fuera del historial de git) a: `agents/tools/*`, `agent-tool-registry.ts`, `context-planner.service.ts`, `model-router.service.ts`, `llm-analyzer.ts`, `buildNewsAggregator_unused`.
- [ ] CA-017: Existe un único servicio de resolución de provider/modelo; `agent-config-resolver.service.ts` y `sub-agent.service.ts` ya no implementan cada uno su propia cascada user→admin→fallback.
- [ ] CA-018: El diff neto de líneas en `apps/api/src/agents` + orchestrator es **negativo** al cierre del ciclo.
- [ ] CA-019: La indirección orchestrator/routing/synthesis queda colapsada a un modelo de agentes reales sin triplicar el enum `AgentId` — o, si se documenta que migrar el enum en BD no se justifica, la indirección queda documentada y concentrada en un único punto del código (no dispersa en varios archivos).

**Prioridad:** Alta
**Estimación:** L

---

## Requisitos funcionales

### RF-01: Registro de costo LLM con pricing en vivo de OpenRouter

**Descripción:** `LLMUsageService.log()` resuelve el costo de cada llamada usando el catálogo de
pricing en vivo de OpenRouter (`libs/openrouter/openrouter-models.service.ts`) para tráfico
OpenRouter/Together, en vez de depender exclusivamente de `model-pricing.ts` estático (que hoy
no tiene entradas para esos proveedores).

**Reglas de negocio:**

- RN-01: El costo persistido refleja la tarifa vigente al momento de la llamada (o su fallback documentado), nunca un valor fijo desactualizado para proveedores con pricing en vivo.
- RN-02: `PROVIDER_DISPLAY` incluye `OPENROUTER` y `TOGETHER`.

**Casos de error:**

- CE-01: Si el catálogo de pricing en vivo no responde, se aplica el fallback definido por el Architect (ver `architect.md`) sin romper el registro de uso ni dejarlo en $0 no documentado.

**Origen:** spec §1 hallazgo C, §3 Cycle-01 punto 4.

---

### RF-02: Pipeline de evaluación de decisiones cableado

**Descripción:** Al persistir una `AgentDecision`, el sistema dispara su evaluación
automáticamente y la resuelve contra el precio real de mercado al horizonte definido, en vez de
la comparación placeholder contra el último trade.

**Reglas de negocio:**

- RN-03: `scheduleEvaluation()` se invoca al persistir cada `AgentDecision`.
- RN-04: El job `schedule-evaluations` tiene un disparador operativo (deja de ser huérfano).
- RN-05: La evaluación compara contra precio real de mercado al horizonte configurado, no contra el precio del último trade ejecutado.

**Casos de error:**

- CE-02: Si el precio de mercado al horizonte no está disponible, la decisión queda "no evaluable", documentada como tal, sin computarse como acierto ni error.

**Origen:** spec §1 hallazgo A (pipeline de evaluación), §3 Cycle-01 punto 1.

---

### RF-03: Fuente única de system prompts

**Descripción:** El system prompt de cada agente se resuelve exclusivamente desde
`AgentDefinition` (BD), sembrada con los 6 agentes antes de eliminar el hardcode.

**Reglas de negocio:**

- RN-06: `AGENT_SYSTEM_PROMPTS` hardcodeado y el fallback de `resolveSystemPrompt` se eliminan.
- RN-07: El seed de `AgentDefinition` cubre los 6 agentes (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) antes del borrado del hardcode.

**Casos de error:**

- CE-03: Si falta el `AgentDefinition` de un agente al arrancar, el arranque falla de forma explícita, o aplica el fallback seguro documentado por el Architect — nunca corre con prompt indefinido.

**Origen:** spec §1 hallazgo C, §3 Cycle-01 punto 3.

---

### RF-04: Resolución única de provider/modelo

**Descripción:** Un único servicio resuelve provider/modelo con la cascada user→admin→fallback,
reemplazando la lógica duplicada de `agent-config-resolver.service.ts` y
`sub-agent.service.ts.getProvider`.

**Reglas de negocio:**

- RN-08: La cascada de resolución (user→admin→fallback) vive en un único punto del código.

**Casos de error:**

- CE-04: Si ninguna de las tres fuentes de la cascada resuelve un provider/modelo válido, el sistema responde con un error explícito, no con un valor vacío o silencioso.

**Origen:** spec §1 hallazgo C, §3 Cycle-01 punto 2.

---

### RF-05: Rescate de lógica de dominio antes del borrado

**Descripción:** `RiskBudgetTool`, `TradeSimulationTool` y `PortfolioContextTool` se extraen como
servicios de dominio puros antes de eliminar `agents/tools/` y `agent-tool-registry.ts`.

**Reglas de negocio:**

- RN-09: El rescate es prerequisito del borrado — no puede existir un commit que elimine el registry sin que el servicio de dominio equivalente ya exista mergeado y testeado.

**Casos de error:**

- No aplica input externo; el riesgo es de proceso y está cubierto por RN-09 y por CA-014 de HU-01-04.

**Origen:** spec §3 Cycle-01 punto 1, §5 Riesgos ("la poda debe rescatar la lógica de las tools antes de borrar").

---

### RF-06: Poda de subsistemas muertos

**Descripción:** Eliminar `agents/tools/` (6 tools + registry), `context-planner.service.ts`,
`model-router.service.ts`, `llm-analyzer.ts`, `buildNewsAggregator_unused()`, y su registro en el
módulo DI correspondiente.

**Reglas de negocio:**

- RN-10: Cero referencias a los subsistemas eliminados en el código fuente tras el borrado.
- RN-11: El diff neto de líneas en `apps/api/src/agents` + orchestrator es negativo.

**Casos de error:**

- CE-05: Si aparece un caller vivo de alguno de estos subsistemas (contradiciendo el diagnóstico de la spec), el borrado de ese subsistema se detiene y se documenta como excepción — no se rompe el build en silencio.

**Origen:** spec §1 hallazgo A, §3 Cycle-01 punto 1.

---

### RF-07: Comportamiento de trading sin cambios (requisito transversal)

**Descripción:** Ninguna task de este ciclo modifica sizing, política de SELL, verdict REDUCE,
SL/TP, trailing stop, ventas parciales ni límites agregados de exposición: el ciclo es de
fundación (poda + observabilidad), no de comportamiento de trading. Ese trabajo es el cycle-02.

**Reglas de negocio:**

- RN-12: Ante el mismo `AgentDecision` y el mismo set de indicadores de entrada, el sistema produce la misma decisión de trading antes y después de este ciclo.

**Casos de error:**

- CE-06: Si una task de poda o de unificación cambia un valor por defecto de configuración que afecta sizing o umbrales de decisión, esa task queda fuera de scope: se revierte o se separa al cycle-02 antes de mergear.

**Origen:** brief.yaml `out_of_scope`; spec §3 Cycle-02 (delimita lo que este ciclo NO toca).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS | Los 6 agentes-personaje del núcleo de trading; cada uno con un rol de análisis distinto (señal técnica, macro, sizing, riesgo, sentimiento, bloqueo). |
| `AgentDecision` | Registro persistido de una decisión tomada por un agente (verdict, justificación, contexto de mercado al momento de decidir). |
| `AgentDefinition` | Tabla en BD que define cada agente, incluido su system prompt — fuente de verdad única tras este ciclo. |
| Scorecard de decisiones | Vista (`/agents/scorecard`) que muestra win rate y resultados históricos de las decisiones de un agente. |
| Pipeline de evaluación | Proceso que, tiempo después de una decisión, verifica si acertó comparando contra el precio real de mercado al horizonte definido. |
| OpenRouter / Together | Proveedores LLM soportados por la plataforma; OpenRouter es el camino por defecto del sistema activo. |
| `LLMUsageService` | Servicio que registra el uso y costo de cada llamada LLM. |
| Pricing en vivo | Catálogo de tarifas por modelo consultado en tiempo real al proveedor, en vez de una tabla estática desactualizada. |
| Orchestrator / routing / synthesis | Capa intermedia entre `TradingProcessor` y `SubAgentService` que decide qué agente(s) invocar y combina sus resultados. |
| Servicio de dominio (rescatado) | Lógica de negocio pura (cálculo de riesgo, simulación, contexto de portfolio) desacoplada del contrato de agent tool y de cualquier llamada LLM. |
| Subsistema muerto | Código registrado en el contenedor de inyección de dependencias pero sin ningún caller real en el flujo de ejecución activo. |
