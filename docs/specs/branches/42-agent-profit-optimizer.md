# Spec 42 — Agent Profit Optimizer

**Fecha:** 2026-05-12  
**Versión:** 1.1  
**Estado:** Propuesto  
**Branch:** `feature/agent-profit-optimizer`  
**Dependencias:** Spec 41 (orchestrator-enriched-inputs)

## 1. Resumen ejecutivo

Crypto Trader ya cuenta con agentes especializados, configuración de modelos por rol, OpenRouter, fuentes enriquecidas de mercado, registro de decisiones y tracking básico de uso LLM. La siguiente evolución debe convertir al sistema multi-agente en una capa de decisión orientada a **beneficio neto esperado**, no solo a confianza del LLM.

La plataforma debe responder estas preguntas antes de gastar tokens o ejecutar una orden:

- ¿La oportunidad esperada justifica el costo del análisis LLM?
- ¿Qué agente necesita un modelo premium y cuál puede usar un modelo barato o cacheado?
- ¿Qué herramienta debe consultar cada agente para mejorar la decisión?
- ¿Qué decisión habría generado más P&L neto después de fees, slippage y costo de tokens?
- ¿Qué modelos están aportando más beneficio por dólar gastado?

Esta spec introduce una capa de **Agent Profit Optimizer** compuesta por herramientas internas, políticas de presupuesto, routing dinámico de modelos, evaluación de outcomes y dashboards de rendimiento económico.

Antes de implementar capacidades nuevas, la branch debe corregir **nueve riesgos** encontrados en el análisis profundo del código actual:

**Críticos — corrupción de datos entre usuarios/configs:**

1. `MarketService.buildEnrichedSnapshot()` usa credenciales de fuentes externas sin filtrar por `userId`, lo que rompe aislamiento multi-usuario y atribución de costos.
2. `TradingProcessor.executeLLMSell()` y `checkOpenPositions()` buscan posiciones por `userId + asset + mode`, sin `configId` ni `pair`, por lo que un agente puede cerrar posiciones de otra configuración.
3. `TradingProcessor.executeBuy()` cuenta posiciones abiertas con `{ userId, asset, mode }` sin `configId`, lo que hace que dos configs del mismo asset compartan el límite de `maxConcurrentPositions`.
4. `OrchestratorService.orchestrateDecision()` pasa **todas** las posiciones abiertas del usuario a FORGE y AEGIS sin filtrar por `configId`/`pair`, distorsionando el risk gate y el sizing.

**Altos — lógica operativa rota o race conditions:**

5. `ChatService.executeTool(start_agent|stop_agent)` cambia `isRunning` directamente y no usa `TradingService`, dejando agentes sin job Bull o jobs vivos tras un stop.
6. Operaciones de sandbox wallet en `executeLLMSell`/`checkOpenPositions` no son atómicas — `upsert` + `findUnique` secuenciales sin `$transaction`, generando race conditions de balance con agentes paralelos del mismo par.
7. `TradingProcessor.runCycle()` carga `recentTrades` sin filtro de `configId`, contaminando el contexto del LLM con trades de otras configuraciones del mismo usuario.
8. `OrchestratorService` reutiliza el cache de SIGMA `news_sentiment` de **cualquier** `AgentDecision` del usuario sin filtrar por `pair`/`asset`, aplicando sentiment de BTC a una decisión de ETH.

**Medios — telemetría incompleta:**

9. El tracking de costos/rate limits no refleja bien OpenRouter: `LlmUsageService` calcula costo `0` para modelos dinámicos, `rate-limit-tracker.captureRateLimits()` nunca se invoca porque `LLMResponse` no incluye headers HTTP, y `LLMProviderClient.complete()` no retorna `headers` ni `actualModel`.

## 2. Arquitectura / diseño

### 2.1 Objetivo de decisión

Cada ciclo de trading debe optimizar una función explícita:

```ts
expectedNetValueUsd =
  expectedGrossPnlUsd -
  expectedFeesUsd -
  expectedSlippageUsd -
  llmCostUsd -
  dataCostUsd;
riskAdjustedValue = expectedNetValueUsd * confidence * riskMultiplier;
```

El agente solo puede escalar a modelos caros cuando `riskAdjustedValue` supera un umbral configurable por usuario, modo y perfil de riesgo.

### 2.2 Nueva capa interna

```
TradingProcessor
  -> AgentDecisionPipeline
      -> AgentToolRegistry
          -> PortfolioContextTool
          -> MarketEdgeTool
          -> TradeSimulationTool
          -> RiskBudgetTool
          -> DecisionMemoryTool
          -> TokenBudgetTool
      -> ModelRouterService
      -> OrchestratorService
      -> DecisionOutcomeEvaluator
```

### 2.3 Herramientas internas para agentes

| Tool                   | Consumidor              | Propósito                                                                  | Reglas                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PortfolioContextTool` | FORGE, AEGIS, synthesis | Balance, exposición, posiciones por `configId`, P&L abierto/cerrado, fees  | Siempre filtrar por `userId`, `configId`, `pair`, `mode` cuando aplique                                                                                                                                                                             |
| `MarketEdgeTool`       | SIGMA, CIPHER           | Snapshot técnico + fuentes externas + freshness + health de datos          | Credenciales por usuario; si falta key, fuente queda `unavailable`, no usa llave ajena                                                                                                                                                              |
| `TradeSimulationTool`  | FORGE, synthesis        | Simula BUY/SELL/HOLD con fees, slippage estimado, TP/SL y tamaño sugerido  | Debe devolver EV y downside antes de cualquier trade. Slippage: configurable por asset (default 0.05% BTC, 0.15% altcoins); en LIVE usa spread de orderbook si hay API Binance conectada                                                            |
| `RiskBudgetTool`       | AEGIS                   | Límites diarios/semanales, drawdown, max exposure, kill-switch por pérdida | BLOQUEA antes del LLM premium si el trade es imposible                                                                                                                                                                                              |
| `DecisionMemoryTool`   | SIGMA, AEGIS, synthesis | Outcomes históricos por setup, modelo, rol, símbolo y régimen de mercado   | Usa métricas agregadas, no historial crudo largo                                                                                                                                                                                                    |
| `TokenBudgetTool`      | KRYPTO, ModelRouter     | Presupuesto disponible, costo estimado, truncado/context plan              | Define max input/output tokens y si permite escalar de modelo. **`max_tokens` debe enforcearse vía parámetro `max_tokens` de la API HTTP del provider**, no solo en el prompt (los modelos pueden ignorar instrucciones de límite en system prompt) |

### 2.4 Model routing por rol

El routing no debe ser estático. `ModelRouterService` debe elegir modelo por:

- Rol del agente (`routing`, `market`, `risk`, `operations`, `synthesis`, etc.)
- Modo (`SANDBOX`, `TESTNET`, `LIVE`)
- Perfil de riesgo (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`)
- Valor esperado de la oportunidad
- Salud/rate limit del proveedor
- Presupuesto diario y costo acumulado
- Freshness de datos y divergencia entre sub-agentes

Política recomendada inicial:

| Rol          | SANDBOX              | TESTNET                         | LIVE                                      |
| ------------ | -------------------- | ------------------------------- | ----------------------------------------- |
| `routing`    | modelo barato/rápido | modelo barato/rápido            | modelo barato/rápido                      |
| `platform`   | barato + RAG         | barato + RAG                    | barato + RAG                              |
| `blockchain` | barato/long-context  | balanceado si impacta mercado   | balanceado/premium solo ante riesgo macro |
| `operations` | barato/balanceado    | balanceado tool-use             | balanceado tool-use, temp baja            |
| `market`     | barato/balanceado    | balanceado                      | premium si EV alto o volatilidad alta     |
| `risk`       | balanceado           | premium si trade posible        | premium obligatorio para órdenes reales   |
| `synthesis`  | balanceado           | premium si sub-agentes divergen | premium si puede ejecutar BUY/SELL        |

Regla de seguridad: en `LIVE`, modelos gratuitos solo pueden usarse para routing, documentación o análisis no ejecutable. Nunca deben ser el único input para una orden real.

### 2.5 Optimización de tokens

La branch debe introducir un `ContextPlanner` que entregue a cada sub-agente solo la información necesaria:

- Indicadores compactos en JSON estable, no snapshots completos si no aportan señal.
- Noticias deduplicadas por URL/headline hash, top K por recencia + impacto.
- Resúmenes de decisiones históricas agregados por resultado, no razonamientos largos completos.
- Cache por `userId + symbol + task + inputHash` con TTL por tipo de dato.
- Saltos determinísticos: si no hay balance, max positions alcanzado o risk gate bloquea por regla dura, no llamar a modelos caros.
- `max_tokens` defaults por tarea: routing 128-256, sentiment 384-512, technical 512, risk 512-768, synthesis 768-1024.
- **El ContextPlanner debe ser adaptativo por inputs disponibles**, no usar límites fijos. Firma propuesta:
  ```ts
  plan(task: AgentTask, availableInputs: InputDescriptor[]): ContextPlan
  ```
  Si un `technical_signal` tiene 15 indicadores + señales externas, el planner asigna más tokens que uno sin `enrichedData`. Los defaults arriba son pisos, no techos.

**Reducción de system prompts:**

- Los system prompts actuales de cada sub-agente gastan ~500-800 tokens describiendo la red completa de agentes (identidad de NEXUS, FORGE, SIGMA, CIPHER, AEGIS). Esta información no aporta señal para tareas como `technical_signal` o `risk_gate`.
- Mover las descripciones del ecosistema multi-agente a RAG/docs para consultas de chat.
- En tareas de trading, el system prompt debe contener solo: identidad mínima del agente, formato esperado de output, y restricciones de la tarea.

### 2.6 Evaluación de decisiones

Cada `AgentDecision` debe evaluarse después de horizontes configurables:

- `15m`, `1h`, `4h`, `24h` para decisiones HOLD/BUY/SELL no ejecutadas.
- Al cierre real de la posición para trades ejecutados.
- Métricas: P&L realizado, P&L hipotético, missed opportunity, drawdown posterior, costo LLM, costo datos, modelo usado, sub-agentes usados.

Estas evaluaciones alimentan scorecards por agente/modelo y recomendaciones automáticas.

### 2.7 Cambio de interfaz LLMResponse

Para que `captureRateLimits` funcione y se pueda trackear el modelo real usado por OpenRouter:

```ts
// Actual
interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

// Propuesto
interface LLMResponse {
  text: string;
  usage: LLMUsage;
  headers?: Record<string, string>; // para captureRateLimits
  actualModel?: string; // OpenRouter puede rerouted a otro modelo
}
```

Cada provider debe capturar los response headers relevantes en su implementación de `complete()`. Sin este cambio, `captureRateLimits` seguirá muerta.

### 2.8 Circuit breaker de presupuesto

`SubAgentService.call()` debe consultar `AgentBudgetPolicy` **antes** de cada llamada LLM:

1. Calcular gasto acumulado del día actual desde `LlmUsageLog`.
2. Si `dailyUsdBudget` está agotado → devolver HOLD con razón `"presupuesto_diario_agotado"`, no hacer llamada.
3. Si `maxCostPerDecisionUsd` se excedería con el modelo seleccionado → intentar downgrade a modelo más barato.
4. Cachear el gasto diario con TTL corto (1 min) para no impactar performance.

Esto evita que un agente mal configurado gaste USD sin control.

### 2.9 Cold-start y datos insuficientes

Cuando un agente arranca por primera vez o tras un restart largo (< 10 decisiones históricas):

- `DecisionMemoryTool` debe indicar `"insufficient_data": true`.
- `ModelRouterService` debe actuar en modo conservador: usar modelo default por rol sin intentar optimizar por EV/costo.
- No escalar a premium hasta que haya al menos 10 outcomes evaluados para ese par/modo.
- Después de 50+ outcomes, habilitar auto-recomendaciones de modelo basadas en scorecard.

### 2.10 Retención de evaluaciones

Los jobs de evaluación a 15m/1h/4h/24h generan 4 filas por decisión. Con un agente que corre cada 15min, son ~384 evaluaciones/día/config.

- Evaluaciones `PENDING` no resueltas después de 48h se marcan como `NEUTRAL` con `evaluatedAt = now()`.
- Evaluaciones con `status = NEUTRAL` y `horizonMinutes < 60` se eliminan tras 7 días.
- Se conservan indefinidamente: evaluaciones `WIN`, `LOSS`, `MISSED_OPPORTUNITY`, `AVOIDED_LOSS` y todas las de horizonte `24h`.
- Job de cleanup diario para aplicar estas políticas.

## 3. Modelos de datos

### 3.1 Nuevos enums

```prisma
enum AgentToolName {
  PORTFOLIO_CONTEXT
  MARKET_EDGE
  TRADE_SIMULATION
  RISK_BUDGET
  DECISION_MEMORY
  TOKEN_BUDGET
}

enum AgentOutcomeStatus {
  PENDING
  WIN
  LOSS
  NEUTRAL
  MISSED_OPPORTUNITY
  AVOIDED_LOSS
}
```

### 3.2 Nuevos modelos

```prisma
model AgentBudgetPolicy {
  id                    String   @id @default(cuid())
  userId                String   @unique
  dailyTokenBudget      Int      @default(200000)
  dailyUsdBudget        Float    @default(5)
  maxCostPerDecisionUsd Float    @default(0.15)
  livePremiumOnly       Boolean  @default(true)
  minEvToCostRatio      Float    @default(10)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("agent_budget_policies")
}

model AgentModelPolicy {
  id              String      @id @default(cuid())
  userId          String?
  agentId         AgentId
  mode            TradingMode?
  riskProfile     RiskProfile?
  provider        LLMProvider
  model           String
  maxInputTokens  Int         @default(8000)
  maxOutputTokens Int         @default(768)
  temperature     Float       @default(0.2)
  isPremium       Boolean     @default(false)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, agentId])
  @@index([agentId, mode, riskProfile])
  @@map("agent_model_policies")
}

model AgentToolInvocation {
  id             String        @id @default(cuid())
  userId         String
  decisionId     String?
  agentId        AgentId
  toolName       AgentToolName
  inputHash      String
  outputHash     String?
  status         String
  latencyMs      Int
  freshnessMs    Int?
  inputTokens    Int           @default(0)
  outputTokens   Int           @default(0)
  costUsd        Float         @default(0)
  metadata       Json?
  createdAt      DateTime      @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([decisionId])
  @@index([agentId, toolName])
  @@map("agent_tool_invocations")
}

model AgentDecisionEvaluation {
  id                   String             @id @default(cuid())
  decisionId           String
  userId               String
  horizonMinutes       Int
  status               AgentOutcomeStatus @default(PENDING)
  priceAtDecision      Float
  priceAtEvaluation    Float?
  realizedPnlUsd       Float?
  hypotheticalPnlUsd   Float?
  missedOpportunityUsd Float?
  maxAdverseMovePct    Float?
  maxFavorableMovePct  Float?
  llmCostUsd           Float              @default(0)
  dataCostUsd          Float              @default(0)
  netValueUsd          Float?
  marketRegime         String?            // TRENDING_UP, TRENDING_DOWN, RANGING, HIGH_VOLATILITY
  evaluatedAt          DateTime?
  createdAt            DateTime           @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([decisionId, horizonMinutes])
  @@index([userId, status, createdAt])
  @@map("agent_decision_evaluations")
}
```

### 3.3 Cambios a modelos existentes

```prisma
model AgentDecision {
  // campos existentes
  expectedNetValueUsd Float?
  llmCostUsd          Float?
  dataCostUsd         Float?
  modelRoutingReason  String?
}

model LlmUsageLog {
  // campos existentes
  agentId      AgentId?
  decisionId   String?
  actualModel  String?
  requestId    String?
}
```

## 4. API endpoints

### 4.1 Usuario trader

| Método | Endpoint                                  | Descripción                                                               |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| `GET`  | `/agents/intelligence/budget-policy`      | Ver política de tokens/costos del usuario                                 |
| `PUT`  | `/agents/intelligence/budget-policy`      | Actualizar presupuesto diario, costo por decisión y EV/costo mínimo       |
| `GET`  | `/agents/intelligence/model-policies`     | Ver modelos efectivos por rol/mode/riskProfile                            |
| `PUT`  | `/agents/intelligence/model-policies/:id` | Ajustar política del usuario                                              |
| `GET`  | `/agents/intelligence/scorecard`          | Scorecard por agente/modelo: P&L, costo, win rate, avoided loss           |
| `GET`  | `/agents/intelligence/tool-invocations`   | Auditoría de herramientas internas por decisión                           |
| `POST` | `/trading/config/:id/profit-preview`      | Ejecuta análisis sin orden y devuelve EV, costo estimado y modelo elegido |
| `GET`  | `/analytics/agent-outcomes`               | Evaluaciones por horizonte y resultado                                    |

### 4.2 Admin

| Método | Endpoint                                       | Descripción                                                 |
| ------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/admin/agent-intelligence/model-policies`     | Políticas globales por rol/modo                             |
| `PUT`  | `/admin/agent-intelligence/model-policies/:id` | Editar política global                                      |
| `POST` | `/admin/agent-intelligence/preset/:preset`     | Aplicar preset `free`, `balanced`, `profit`, `premium-live` |
| `GET`  | `/admin/agent-intelligence/platform-scorecard` | Costo, tokens, P&L y salud por proveedor/modelo agregados   |

### 4.3 Cambios a endpoints existentes

- `GET /market/enriched-snapshot/:symbol` debe pasar `CurrentUser.userId` a `MarketService.buildEnrichedSnapshot(userId, symbol)`.
- Los ciclos internos de trading deben llamar `buildEnrichedSnapshot(userId, symbol)`.
- `POST /chat/:sessionId/tools` debe delegar start/stop/create/delete a servicios de dominio, no mutar Prisma directo.

## 5. Componentes frontend

### 5.1 Nuevas vistas

| Ruta                                   | Componente                   | Propósito                                                         |
| -------------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `/dashboard/settings/agents/economics` | `AgentEconomicsSettingsPage` | Presupuesto, EV/costo, modelos por modo y riesgo                  |
| `/dashboard/analytics/agent-scorecard` | `AgentScorecardPage`         | Ranking por agente/modelo: net P&L, costo, win rate, avoided loss |
| `/dashboard/agent-log/:decisionId`     | `DecisionEconomicsPanel`     | Desglose de herramientas, tokens, costo y outcome de una decisión |
| `/admin/agent-intelligence`            | `AdminAgentIntelligencePage` | Políticas globales, health, costos y presets                      |

### 5.2 Cambios a UI existente

- `SettingsAgentsPage` debe mostrar, junto al modelo, costo estimado por 1K decisiones y recomendación por modo.
- `AIUsageDashboard` debe incluir OpenRouter y Together en paleta/labels y mostrar costo real dinámico de OpenRouter.
- `AgentDecisionCard` debe mostrar `expectedNetValueUsd`, `llmCostUsd`, `modelRoutingReason` y outcome cuando exista.
- `MarketIntelligence` debe indicar freshness y fuentes omitidas por falta de key, sin exponer detalles sensibles.

## 6. Fases de implementación

### Fase A — Correcciones críticas de aislamiento y ciclo operativo

**A.1 — Aislamiento de credenciales de fuentes externas (Bug #1):**

- Cambiar `MarketService.buildEnrichedSnapshot(symbol)` a `buildEnrichedSnapshot(userId, symbol)`.
- Filtrar `DataSourceCredential` por `userId`.
- Ajustar `MarketController`, `TradingProcessor.runCycle`, `TradingService.triggerAnalysis` y hooks frontend para pasar `userId`.
- Test: usuario A no obtiene data de fuentes que solo B configuró.

**A.2 — Scoping de posiciones por config (Bugs #2, #3, #4):**

- En `TradingProcessor.executeLLMSell` y `checkOpenPositions`: filtrar posiciones por `configId`, `pair`, `mode` y `userId`.
- En `TradingProcessor.executeBuy`: filtrar count de posiciones abiertas por `configId` además de asset/mode.
- En `OrchestratorService.orchestrateDecision`: filtrar `openPositions` y `sandboxWallets` por `configId` y `pair` antes de pasarlas a FORGE y AEGIS.
- Test: dos configs del mismo asset no interfieren en max positions ni risk gate.

**A.3 — Chat tools delegados (Bug #5):**

- Cambiar `ChatService.executeTool` para `start_agent` → `TradingService.startAgent()`, `stop_agent` → `TradingService.stopAgent()`.
- Test: start/stop vía chat crea/remueve jobs Bull igual que vía API REST.

**A.4 — Sandbox wallet atómico (Bug #6):**

- Envolver operaciones BUY/SELL/close de sandbox wallet en `prisma.$transaction`.
- Test: dos agentes vendiendo simultáneamente no generan balance negativo.

**A.5 — Contexto contaminado cross-config (Bugs #7, #8):**

- Filtrar `recentTrades` en `runCycle` por `configId`.
- Filtrar cache de SIGMA `news_sentiment` en orchestrator por `pair`/`asset`, no solo por `userId`.
- Test: sentiment de BTC no se aplica a decisiones de ETH.

**A.6 — Tests de regresión:**

- Un test unitario por cada bug corregido (9 tests mínimo).

### Fase B — Telemetría económica y costos reales

- Migrar modelos nuevos (Prisma migration).
- Extender interfaz `LLMResponse` con `headers?` y `actualModel?` (ver §2.7).
- Actualizar cada provider (`ClaudeProvider`, `OpenAIProvider`, `GroqProvider`, etc.) para capturar response headers en `complete()`.
- Invocar `captureRateLimits(userId, provider, headers)` después de cada llamada exitosa en `SubAgentService.call()`.
- Asociar `LlmUsageLog` con `agentId`, `decisionId`, `actualModel` y `requestId`.
- Resolver pricing dinámico de OpenRouter desde `OpenRouterModelsService` con cache y fallback a tabla estática.
- Guardar costo LLM/data por `AgentDecision`.
- Test: OpenRouter registra costo > 0 cuando el catálogo provee pricing.

### Fase C — AgentToolRegistry y ContextPlanner

- Crear `AgentToolRegistry` en `apps/api/src/agents/tools/`.
- Implementar las seis herramientas internas (ver §2.3), incluyendo slippage configurable en `TradeSimulationTool`.
- Crear `ContextPlannerService` adaptativo (ver §2.5) con `plan(task, availableInputs)`.
- Reducir system prompts de sub-agentes para tareas de trading: eliminar descripciones de la red de agentes, conservar solo identidad mínima + formato de output.
- Reemplazar contextos manuales del orchestrator por tool outputs compactos.
- Registrar cada tool call en `AgentToolInvocation`.
- Cachear outputs por `inputHash` + TTL por tipo de dato.
- Enforcar `max_tokens` vía parámetro HTTP de la API del provider (no solo en prompt).

### Fase D — ModelRouterService orientado a EV

- Crear `ModelRouterService` con políticas por rol/modo/riesgo.
- Implementar circuit breaker de presupuesto en `SubAgentService.call()` (ver §2.8).
- Calcular costo estimado antes de llamar LLM; escalar a premium solo si EV/costo y riesgo lo justifican.
- Impedir modelos gratuitos como única fuente de órdenes `LIVE`.
- Implementar cold-start mode (ver §2.9): modo conservador cuando < 10 outcomes históricos.
- Escalar a premium cuando hay divergencia entre sub-agentes o EV/costo alto.
- Persistir `modelRoutingReason`.
- Tests de routing para: SANDBOX, TESTNET, LIVE, presupuesto agotado, cold-start, y modelo free bloqueado.

### Fase E — Evaluación de outcomes y scorecards

- Crear jobs Bull para evaluar decisiones en `15m`, `1h`, `4h`, `24h`.
- Calcular `marketRegime` del snapshot de indicadores al momento de la decisión (TRENDING_UP, TRENDING_DOWN, RANGING, HIGH_VOLATILITY).
- Calcular outcomes de decisiones ejecutadas al cierre de posición.
- Calcular missed opportunity y avoided loss para HOLD/SELL/BUY no ejecutados.
- Crear endpoints trader y admin de scorecards.
- Agregar agregaciones por agente, modelo, proveedor, símbolo, modo, riskProfile y `marketRegime`.
- Implementar job de cleanup de evaluaciones (ver §2.10): `PENDING` > 48h → `NEUTRAL`, `NEUTRAL` < 1h → borrar tras 7 días.
- Alimentar recomendaciones de modelo/política desde outcomes reales.

### Fase F — Frontend y QA end-to-end

- Crear páginas y paneles descritos.
- Agregar tests frontend para Agent Hub, economics dashboard y tool lifecycle.
- Agregar e2e de profit preview, start/stop por chat y aislamiento multi-usuario.
- Documentar nuevas métricas en Help/Docs.

## 7. Out of scope

- Trading de futuros, margen o apalancamiento.
- Optimización automática de parámetros con dinero real sin aprobación del usuario.
- Copy trading o social trading.
- Nuevos exchanges distintos de Binance.
- Estrategias on-chain/DEX.
- Entrenamiento/fine-tuning propio de modelos.

## 8. Decisiones de diseño

| #   | Decisión                                              | Alternativa                                   | Razón                                                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Optimizar por beneficio neto esperado                 | Seguir usando solo confidence del LLM         | Confidence no incorpora fees, slippage ni costo de tokens                             |
| 2   | Herramientas internas tipadas                         | Prompts monolíticos con todo el contexto      | Reduce tokens, mejora trazabilidad y facilita tests                                   |
| 3   | Model routing dinámico por EV/costo                   | Modelo fijo por agente                        | Permite gastar premium solo cuando hay oportunidad real                               |
| 4   | Free models prohibidos como única fuente para LIVE    | Permitir cualquier modelo configurado         | La ejecución real requiere mayor confiabilidad y auditabilidad                        |
| 5   | Evaluación post-decisión por horizonte                | Medir solo trades ejecutados                  | HOLD y oportunidades perdidas también enseñan al sistema                              |
| 6   | Pricing dinámico OpenRouter                           | Tabla estática local                          | OpenRouter cambia catálogo/precios; el costo debe ser real                            |
| 7   | Corregir aislamiento antes de nuevas features         | Construir scorecards encima del estado actual | Sin aislamiento por usuario/config, las métricas económicas serían falsas             |
| 8   | `LLMResponse` debe incluir headers y actualModel      | No cambiar la interfaz                        | Sin headers, `captureRateLimits` queda muerta y rate limits son invisibles            |
| 9   | Circuit breaker de presupuesto antes de cada LLM call | Validar solo al inicio del ciclo              | Un ciclo con 5+ sub-agentes puede gastar $0.50+; el check debe ser granular           |
| 10  | Cold-start conservador (< 10 outcomes)                | Usar routing agresivo desde el inicio         | Sin datos históricos, optimizar por EV/costo es especulativo — mejor defaults seguros |
| 11  | `max_tokens` enforceado vía API HTTP del provider     | Solo pedir límite en el prompt                | Los modelos pueden ignorar instrucciones de límite en system prompt                   |
| 12  | `marketRegime` en evaluaciones                        | Solo medir por horizonte temporal             | Una decisión HOLD en trending fuerte es missed opportunity; en ranging es correcta    |
| 13  | Retención automática de evaluaciones                  | Guardar todo indefinidamente                  | ~384 evaluaciones/día/config sin cleanup satura la DB rápidamente                     |
