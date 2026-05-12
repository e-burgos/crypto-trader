# Plan 42 — Agent Profit Optimizer

**Spec:** docs/specs/branches/42-agent-profit-optimizer.md  
**Branch:** feature/agent-profit-optimizer  
**Depende de:** Spec 41 mergeada en main

## Estado inicial requerido

```bash
git checkout main
git pull origin main
git checkout -b feature/agent-profit-optimizer
pnpm nx test api
pnpm nx test web
```

Verificar antes de implementar:

- `docs/specs/branches/41-orchestrator-enriched-inputs.md` ya está integrado.
- `apps/api/src/market/market.service.ts` contiene `buildEnrichedSnapshot`.
- `apps/api/src/trading/trading.processor.ts` contiene `executeLLMSell`, `checkOpenPositions` y `executeBuy`.
- `apps/api/src/orchestrator/orchestrator.service.ts` contiene `orchestrateDecision`.
- `apps/api/src/chat/chat.service.ts` contiene `executeTool`.
- `apps/api/src/llm/llm-usage.service.ts` contiene el cálculo actual de costo.
- `libs/analysis/src/lib/llm/llm-types.ts` contiene `LLMResponse`.
- `libs/analysis/src/lib/rate-limit-tracker.ts` contiene `captureRateLimits` (no invocada).

## Fase A — Correcciones críticas de aislamiento y ciclo operativo

Objetivo: asegurar que ninguna métrica económica se construya sobre datos mezclados. Corrige 9 bugs.

**A.1 — Aislamiento de credenciales de fuentes externas (Bug #1):**

- Cambiar firma de `MarketService.buildEnrichedSnapshot` a `(userId: string, symbol: string)`.
- Filtrar `dataSourceCredential.findMany` por `userId`.
- Actualizar `MarketController.getEnrichedSnapshot`, `TradingProcessor.runCycle`, `TradingService.triggerAnalysis` y hooks frontend.
- Test: usuario A no obtiene data de fuentes que solo B configuró.

**A.2 — Scoping de posiciones por config (Bugs #2, #3, #4):**

- En `TradingProcessor.executeLLMSell`: cambiar `where: { userId, asset, status: 'OPEN', mode }` a `where: { userId, configId, pair, status: 'OPEN', mode }`.
- En `TradingProcessor.checkOpenPositions`: mismo cambio de filtro.
- En `TradingProcessor.executeBuy`: agregar `configId` al count de posiciones abiertas.
- En `OrchestratorService.orchestrateDecision`: filtrar `openPositions` por `configId` y `pair`, no traer todas las del usuario.
- Tests: dos configs del mismo asset no interfieren en max positions ni en risk gate.

**A.3 — Chat tools delegados (Bug #5):**

- Cambiar `ChatService.executeTool` para delegar en `TradingService.startAgent/stopAgent/deleteConfig/createConfig`.
- Test: start/stop vía chat crea/remueve jobs Bull igual que vía API REST.

**A.4 — Sandbox wallet atómico (Bug #6):**

- Envolver operaciones BUY/SELL/close de sandbox wallet en `prisma.$transaction`.
- Test: dos agentes vendiendo simultáneamente no generan balance negativo.

**A.5 — Contexto contaminado cross-config (Bugs #7, #8):**

- Filtrar `recentTrades` en `TradingProcessor.runCycle` por `configId`.
- Filtrar cache de SIGMA `news_sentiment` en orchestrator por `pair`/`asset`, no solo por `userId`.
- Test: sentiment de BTC no se aplica a decisiones de ETH.

**A.6 — Tests de regresión:**

- Un test unitario por cada bug corregido (9 tests mínimo).

## Fase B — Telemetría económica y costos reales

Objetivo: medir tokens/costos/outcomes con suficiente granularidad para optimizar.

- Crear migración Prisma para `AgentBudgetPolicy`, `AgentModelPolicy`, `AgentToolInvocation`, `AgentDecisionEvaluation` (con `marketRegime`) y campos nuevos en `AgentDecision` y `LlmUsageLog`.
- Extender interfaz `LLMResponse` en `libs/analysis/src/lib/llm/llm-types.ts` con `headers?: Record<string, string>` y `actualModel?: string`.
- Actualizar implementación de `complete()` en cada provider (`ClaudeProvider`, `OpenAIProvider`, `GroqProvider`, `GeminiProvider`, `MistralProvider`, `TogetherProvider`, `OpenRouterProvider`) para capturar response headers.
- Invocar `captureRateLimits(userId, provider, headers)` en `SubAgentService.call()` después de cada llamada exitosa.
- Extender `LlmUsageService.log` para aceptar `agentId`, `decisionId`, `actualModel`, `requestId`.
- Guardar `llmCostUsd`, `dataCostUsd`, `expectedNetValueUsd`, `modelRoutingReason` en `AgentDecision`.
- Resolver costo OpenRouter desde `OpenRouterModelsService` con cache y fallback a `MODEL_PRICING` estático.
- Añadir tests para costo OpenRouter distinto de cero cuando el catálogo provee pricing.

## Fase C — AgentToolRegistry y ContextPlanner

Objetivo: dar herramientas concretas a los agentes y reducir tokens.

- Crear `AgentToolRegistry` en `apps/api/src/agents/tools/`.
- Implementar `PortfolioContextTool`, `MarketEdgeTool`, `TradeSimulationTool` (con slippage configurable por asset), `RiskBudgetTool`, `DecisionMemoryTool`, `TokenBudgetTool`.
- Crear `ContextPlannerService` adaptativo con `plan(task, availableInputs)` (no límites fijos).
- Reducir system prompts de sub-agentes para tareas de trading: eliminar descripciones del ecosistema multi-agente, conservar solo identidad mínima + formato de output + restricciones de tarea. Mover contexto de red de agentes a RAG/docs.
- Reemplazar el armado manual de contextos en `OrchestratorService.orchestrateDecision` por outputs compactos de herramientas.
- Registrar cada tool call en `AgentToolInvocation`.
- Cachear outputs por `inputHash` y TTL por tipo de dato.
- Enforcar `max_tokens` vía parámetro `max_tokens` de la API HTTP del provider, no solo en el prompt.

## Fase D — ModelRouterService orientado a EV

Objetivo: elegir el modelo correcto según valor económico, no solo preferencia estática.

- Crear `ModelRouterService`.
- Implementar políticas por rol/mode/riskProfile.
- Implementar circuit breaker de presupuesto en `SubAgentService.call()`: consultar `AgentBudgetPolicy`, cachear gasto diario (TTL 1 min), rechazar con HOLD si agotado, intentar downgrade si `maxCostPerDecisionUsd` se excedería.
- Integrar provider health, rate limits, presupuesto y EV estimado.
- Bloquear modelos gratuitos como única fuente para decisiones ejecutables en `LIVE`.
- Implementar cold-start mode: modelo default por rol cuando < 10 outcomes históricos para el par/modo, sin optimizar por EV/costo hasta tener datos suficientes.
- Escalar a premium cuando hay divergencia entre sub-agentes o EV/costo alto.
- Persistir `modelRoutingReason`.
- Agregar tests de routing para SANDBOX, TESTNET, LIVE, presupuesto agotado, cold-start y modelo free bloqueado.

## Fase E — Evaluación de outcomes y scorecards

Objetivo: saber qué agentes/modelos generan o protegen dinero.

- Crear jobs Bull para evaluar decisiones en `15m`, `1h`, `4h`, `24h`.
- Calcular `marketRegime` del snapshot de indicadores al momento de la decisión (TRENDING_UP, TRENDING_DOWN, RANGING, HIGH_VOLATILITY).
- Calcular outcomes de decisiones ejecutadas al cierre de posición.
- Calcular missed opportunity y avoided loss para HOLD/SELL/BUY no ejecutados.
- Crear endpoints trader y admin de scorecards.
- Agregar agregaciones por agente, modelo, proveedor, símbolo, modo, riskProfile y `marketRegime`.
- Implementar job de cleanup diario: `PENDING` > 48h → `NEUTRAL`, `NEUTRAL` con horizonte < 60min → borrar tras 7 días. Conservar `WIN`, `LOSS`, `MISSED_OPPORTUNITY`, `AVOIDED_LOSS` y todas las de horizonte 24h indefinidamente.
- Alimentar recomendaciones de modelo/política desde outcomes reales.

## Fase F — Frontend, docs y QA

Objetivo: hacer visible y controlable la inteligencia económica.

- Crear `AgentEconomicsSettingsPage`.
- Crear `AgentScorecardPage`.
- Extender `AIUsageDashboard` para OpenRouter/Together y costo real.
- Extender `AgentDecisionCard`/detalle con costos, EV, tool calls y outcome.
- Agregar tests frontend para hooks y páginas críticas.
- Agregar e2e multi-usuario para aislamiento de data sources.
- Actualizar Help/Docs y `docs/CONSTITUTION.md` si se mergea la feature.

## Criterios de aceptación

- [ ] Un usuario nunca puede usar credenciales de fuentes externas de otro usuario.
- [ ] Un agente no puede cerrar posiciones de otra configuración.
- [ ] Start/stop desde chat usa los mismos invariantes que `/trading/start` y `/trading/stop`.
- [ ] OpenRouter registra costo real cuando el modelo tiene pricing disponible.
- [ ] Rate limit status se alimenta de headers reales cuando el provider los retorna.
- [ ] Cada decisión de trading tiene costo LLM/data o razón de ausencia.
- [ ] `profit-preview` devuelve EV, costo estimado, modelo elegido y razón de routing.
- [ ] En LIVE, una orden ejecutable no se basa solo en modelos gratuitos.
- [ ] Existen scorecards por agente/modelo/proveedor con P&L neto y costo.
- [ ] Web tiene cobertura mínima para Agent Economics y LLM usage.
- [ ] `pnpm nx test api` pasa.
- [ ] `pnpm nx test web` contiene tests reales y pasa.
- [ ] `pnpm nx build api` pasa si hay cambios backend.
- [ ] `pnpm nx build web` pasa si hay cambios frontend.

## Cierre de branch

```bash
pnpm nx test api
pnpm nx test web
pnpm nx build api
pnpm nx build web

git status --short
git add apps/api apps/web libs docs
git commit -m "feat(agents): add profit optimizer intelligence — Spec 42"
git push origin feature/agent-profit-optimizer

gh pr create \
  --base main \
  --head feature/agent-profit-optimizer \
  --title "feat(agents): Agent Profit Optimizer — Spec 42" \
  --body "$(cat <<'EOF'
## Resumen
- Corrige aislamiento multi-usuario y scoping de posiciones antes de optimizar agentes.
- Agrega telemetría económica, herramientas internas, presupuestos y model routing por EV/costo.
- Expone scorecards para entender qué agentes/modelos generan beneficio neto.

## Spec
- docs/specs/branches/42-agent-profit-optimizer.md

## Verificación
- [ ] pnpm nx test api
- [ ] pnpm nx test web
- [ ] pnpm nx build api
- [ ] pnpm nx build web

## Riesgos revisados
- [ ] Credenciales de fuentes externas aisladas por usuario
- [ ] Posiciones filtradas por configuración/par/modo
- [ ] Chat tools delegan en servicios de dominio
- [ ] OpenRouter registra costo real
EOF
)"
```

Después del merge:

- Actualizar `docs/CONSTITUTION.md` en secciones de backend, frontend, modelos de datos, variables si aplica y decisiones arquitecturales.
- Actualizar `docs/plans/crypto-trader-branch-plan.md` marcando la branch como completada si se mantiene tabla de estado.
