# Spec e-burgos-001 — Simplificación del núcleo de agentes, venta inteligente y control de costo LLM

> **Autor:** e-burgos · **Fecha:** 2026-08-17 · **Estado:** in-progress
> **Módulo:** trading-agents-core
> **Subproyectos:** `apps/api`, `libs/trading-engine`, `libs/analysis`, `libs/data-fetcher`, `libs/shared`

## 1. Contexto y diagnóstico

Auditoría del sistema de agentes (2026-08-17, branch `claude/agents-simplification-review-97a46l`).
El núcleo activo es coherente: `TradingProcessor` (Bull) → `OrchestratorService` → `SubAgentService` → LLM,
con 6 agentes-personaje (KRYPTO, NEXUS, FORGE, SIGMA, CIPHER, AEGIS). Pero alrededor hay
subsistemas completos desconectados y la capa de ejecución no usa la inteligencia que el
análisis produce.

### Hallazgos críticos

**A. Código muerto de peso (~1.900 líneas registradas en DI pero nunca invocadas):**

| Subsistema | Ubicación | Estado |
| --- | --- | --- |
| Agent tools (6 tools + registry + context planner) | `apps/api/src/agents/tools/`, `context-planner.service.ts` | Nunca invocado desde el flujo real; `decision-memory.tool.ts:55` referencia un campo `model` que no existe en `AgentDecision` |
| `ModelRouterService` | `apps/api/src/agents/model-router.service.ts` (327 líneas) | Sin ningún caller; usa catálogo OpenAI/Claude/Gemini incompatible con el sistema activo (OpenRouter-only) |
| Pipeline de evaluación | `apps/api/src/agents/evaluation/` | `scheduleEvaluation()` nunca se llama tras crear `AgentDecision`; el job `schedule-evaluations` no tiene disparador; `/agents/scorecard` siempre devuelve ceros |
| `LLMAnalyzer` | `libs/analysis/src/lib/llm/llm-analyzer.ts` | Sin consumidores fuera de su lib |
| `BinanceWsClient` | `libs/data-fetcher/src/lib/binance/binance-ws.client.ts` | Exportado pero jamás importado en `apps/api` |
| `buildNewsAggregator_unused()` | `apps/api/src/trading/trading.processor.ts:1141` | Método muerto explícito |

**B. La inteligencia de venta/riesgo existe pero está desconectada de la ejecución:**

- Sizing real = `balance × maxTradePct` fijo (`libs/trading-engine/src/lib/order-executor.ts:164-173`).
  El `maxTradeSize` de FORGE y el `positionSizeMultiplier` de AEGIS solo se muestran en analytics,
  nunca afectan la orden.
- El verdict `REDUCE` de AEGIS no tiene manejo; solo `BLOCK`, y ese además se anula por regex
  sobre texto libre (`orchestrator.service.ts:444-452`).
- Un SELL del LLM se descarta si la posición no está en ganancia ≥ `minProfitPct`
  (`trading.processor.ts:869-879`): el agente no puede cortar pérdidas por señal, solo por
  stop-loss fijo.
- SL/TP es polling una vez por ciclo (5-30 min), sin órdenes stop/OCO nativas de Binance
  (`binance-rest.client.ts` solo implementa MARKET): posiciones desprotegidas entre ciclos
  y ante caídas del proceso.
- Sin trailing stop, sin ventas parciales, sin salida por tiempo, sin límite de exposición
  agregada ni drawdown automático (el código de `RiskBudgetTool` que lo calcula está muerto).
- `Trade` no tiene FK a `AgentDecision`: la justificación de cada operación ejecutada no queda
  vinculada de forma explícita.

**C. Costo LLM alto, sin medición real:**

- 5-6 llamadas LLM por ciclo (~7-8K tokens in, hasta ~2K out), cada 5-30 min →
  ≈ $1,40/día/bot con modelos clase Haiku, $4-5/día con modelos mejores; lineal por bot.
- Único caché: sentimiento de noticias por TTL. Sin caché para señal técnica, sizing, risk gate
  ni macro; sin deduplicación entre bots/usuarios del mismo par; sin prompt caching de proveedor
  (los system prompts de 650-830 tokens se re-tarifican en cada llamada).
- `MODEL_PRICING` no tiene entradas OpenRouter (el camino por defecto) → el dashboard de costos
  reporta $0 para casi todo el tráfico real (`apps/api/src/llm/model-pricing.ts:242-244`).
- Duplicaciones: resolución de provider en `AgentConfigResolverService.resolveConfig` y en
  `SubAgentService.getProvider` (misma cascada user→admin→fallback en dos archivos); system
  prompts hardcodeados en `sub-agent.service.ts:41-336` + tabla `AgentDefinition` como segunda
  fuente de verdad; 8 valores de `AgentId` para 6 agentes reales.

## 2. Objetivo

Que el agente cumpla el objetivo de la plataforma — **obtener ganancias de forma segura y con
justificación de análisis previo** — con un núcleo más chico, medible y con gestión activa de
posiciones: la inteligencia que ya se paga en análisis debe determinar cuánto se compra, cuándo
se vende y cuánto riesgo se acepta, a una fracción del costo LLM actual.

## 3. Alcance por ciclo

### Cycle-01 — Poda y observabilidad de costo (fundación)

1. Eliminar los subsistemas muertos: `agents/tools/` + `context-planner`, `model-router.service.ts`,
   `llm-analyzer.ts`, `buildNewsAggregator_unused`. El pipeline de evaluación se decide en el
   ciclo: cablearlo (llamar `scheduleEvaluation` al persistir `AgentDecision`, con evaluación
   contra precio real de mercado) o eliminarlo — no puede quedar en el limbo actual.
   La lógica valiosa de `RiskBudgetTool`/`TradeSimulationTool`/`PortfolioContextTool` se rescata
   como servicios de dominio para el cycle-02 antes de borrar el registry.
2. Unificar la resolución de provider/modelo en un único servicio (eliminar la duplicación
   `AgentConfigResolverService` vs `SubAgentService.getProvider`).
3. Una sola fuente de verdad para system prompts (BD `AgentDefinition` con seed; eliminar el
   hardcode de `sub-agent.service.ts`).
4. Costo real: conectar el pricing en vivo de OpenRouter (`libs/openrouter`) a
   `LLMUsageService.log()`; agregar `OPENROUTER`/`TOGETHER` a `PROVIDER_DISPLAY`.
5. Colapsar `orchestrator/routing/synthesis` a un modelo de "KRYPTO con dos velocidades" sin
   triplicar el enum (o documentar y aislar la indirección en un solo punto).

**Criterio de aceptación:** cero referencias a los subsistemas eliminados; `pnpm nx run-many -t test lint`
verde; el dashboard de costos muestra costo > $0 para tráfico OpenRouter; diff neto de líneas negativo
en `apps/api/src/agents` + `orchestrator`.

### Cycle-02 — Venta inteligente y gestión activa de riesgo

1. **Cortar pérdidas por señal:** eliminar el filtro `minProfitPct` como veto absoluto del SELL;
   reemplazarlo por una política explícita (p. ej. SELL en pérdida permitido si la confianza
   supera un umbral configurable).
2. **Cablear el sizing inteligente:** el tamaño de orden usa `maxTradePct` como techo, modulado
   por `positionSizeMultiplier` de AEGIS y el sizing de FORGE; implementar el verdict `REDUCE`.
3. **Protección nativa del exchange:** implementar órdenes LIMIT/STOP_LOSS_LIMIT/OCO en
   `BinanceRestClient` y colocar SL/TP como órdenes reales al abrir posición (spot); reconciliar
   estado al inicio de cada ciclo. Elimina la desprotección entre ciclos y ante caídas del proceso.
4. **Herramientas de ganancia:** trailing stop, take-profit escalonado (venta parcial + stop a
   breakeven) y salida por tiempo máximo de posición, todo configurable en `TradingConfig`.
5. **Riesgo agregado:** límites por usuario (exposición total por activo entre configs, pérdida
   diaria máxima, drawdown que pausa agentes automáticamente) usando la lógica rescatada de
   `RiskBudgetTool`, aplicada en el camino real de ejecución.
6. **Trazabilidad:** FK `Trade.decisionId → AgentDecision` para que cada orden ejecutada quede
   vinculada a su justificación.
7. Reemplazar el override por regex del BLOCK de AEGIS por una regla estructurada (campo tipado
   en la respuesta del agente, no matching de texto).

**Criterio de aceptación:** tests de simulación que demuestren: corte de pérdida por señal,
sizing modulado, OCO colocada en testnet, trailing/parciales ejecutando, límites agregados
bloqueando sobre-exposición; cada `Trade` nuevo referencia su `AgentDecision`.

### Cycle-03 — Reducción del costo por decisión

1. **Gate determinista pre-LLM:** si los indicadores no muestran señal (sin cruces, RSI neutro,
   sin cambio significativo de precio ni posiciones), el ciclo resuelve HOLD sin llamar al LLM.
2. **Caché por `(asset, pair, timeframe)`** con TTL para señal técnica y macro (CIPHER a TTL de
   horas), compartido entre bots y usuarios; extender el patrón ya existente del caché de
   sentimiento.
3. **Prompt caching de proveedor** donde el modelo lo soporte (Anthropic `cache_control` /
   OpenRouter) para los system prompts estáticos.
4. **`max_tokens` por tarea** (300-400 para risk_gate/sizing en vez del default 1024).
5. Registrar consumo por ciclo en `AgentDecision` (`llmCostUsd` real) y exponer costo/día por
   bot en analytics.

**Criterio de aceptación:** costo medido por ciclo reducido ≥ 50% en el escenario de referencia
(bot BTC/USDT, 15 min) sin degradar la tasa de decisiones correctas del backtest de referencia;
métricas de costo visibles por bot/día.

## 4. Fuera de alcance (specs siguientes)

- **spec-e-burgos-002 — Abstracción de exchange + futuros:** generalizar `BinanceCredential` →
  `ExchangeCredential(userId, exchange, isTestnet)`, interfaz `ExchangeClient` (patrón
  `IDataSourceProvider` ya probado en `libs/providers`), símbolos `{base, quote}` neutrales,
  evaluación de ccxt vs clientes propios, segundo exchange con sandbox (candidatos: Bybit/OKX
  por demo trading spot+derivados; Coinbase Advanced/Kraken por calidad de API), y modelado de
  dominio de futuros (leverage, positionSide, liquidationPrice, shorts). Depende de 001.
- **spec-e-burgos-003 — Chat funcional: function calling real + RAG poblado:** tool-use nativo
  del proveedor (el regex de quickActions nunca matchea un payload real, el endpoint
  `tools/execute` no tiene caller en el frontend y 3 de 5 tools no están implementadas),
  restaurar la columna pgvector `embedding_vec` (una migración posterior la eliminó), declarar
  el vector en el schema Prisma, seed de la base de conocimiento con la documentación de la
  plataforma, unificar los prompts del chat con `AgentDefinition`, y eliminar la síntesis
  cross-agent simulada (`synthesizeCrossAgent([])`). Independiente de 001 (puede paralelizarse
  con otro dev).

## 5. Riesgos

- Cablear sizing/riesgo real cambia el comportamiento de bots corriendo: feature-flag por config
  y default conservador en la migración.
- Órdenes OCO/stop en spot Binance tienen reglas de lot-size/notional propias: validar en
  testnet antes de habilitar en LIVE.
- La poda de código debe rescatar la lógica de las tools antes de borrar (riesgo de perder
  trabajo valioso ya escrito).

---

**Depende de:** — (primera spec del arnés)
**Siguiente:** spec-e-burgos-002 (exchange/futuros), spec-e-burgos-003 (chat/RAG)
