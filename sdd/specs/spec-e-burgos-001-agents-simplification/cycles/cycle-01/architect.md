# Architect — Cycle 01: Poda y observabilidad de costo (fundación)

> **Input:** brief.yaml · functional.md · spec-e-burgos-001 §1 hallazgos A y C, §3 Cycle-01
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect
> **Fecha:** 2026-08-17
> **Stack (de sdd/context/apps/api/constitution.md y del código real):** NestJS + Prisma (PostgreSQL,
> cliente generado en `apps/api/generated/prisma`) + Bull/Redis + Nx/pnpm. Los schemas se expresan en
> Prisma, nunca en SQL plano ni JPA.

---

## 0. Resumen de decisiones

| #      | Decisión                                                                                                                                                                                                | Impacto en BD                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **D1** | Rescate en 3 piezas con **dos ubicaciones**: `simulateTrade()` puro va a `libs/trading-engine`; `RiskBudgetService` y `PortfolioContextService` a `apps/api/src/agents/domain/`. **Se reescribe el acceso a datos** — las tools originales consultan columnas inexistentes | Ninguno                                                                           |
| **D2** | Un único `AgentConfigResolverService` dueño de toda la cascada (`user → admin → preset → primera credencial`) + fábrica de cliente. `SubAgentService.getProvider` se borra                                | Ninguno                                                                           |
| **D3** | **Se VALIDA cablear** el pipeline de evaluación. `scheduleEvaluation` en los 2 puntos de persistencia, sweep repetible, precio real vía `MarketService.getPriceAt()` (Binance klines/ticker)              | `AgentOutcomeStatus += NOT_EVALUABLE`; `@@unique([decisionId, horizonMinutes])`   |
| **D4** | `ModelPricingService` con cascada **live OpenRouter → snapshot stale → tabla estática → UNPRICED**. `MODEL_PRICING` sobrevive para los proveedores directos. El origen del precio se persiste            | `LlmUsageLog += pricingSource` (enum nuevo `PricingSource`, nullable)             |
| **D5** | `AgentPromptService` único, con caché e invalidación. **Fail-fast al boot** (los 6 `AgentDefinition`) y **fail-closed en runtime**. Se borra el hardcode de 295 líneas                                    | Ninguno                                                                           |
| **D6** | **NO se migra el enum `AgentId`.** Se conservan los 8 valores y se aísla la indirección en un único archivo `agent-identity.ts`                                                                          | Ninguno                                                                           |

**Total de cambios de BD del ciclo: 1 migración** (`add_pricing_source_and_not_evaluable`), toda aditiva
y sin backfill de datos. No se crean tablas nuevas.

---

## 1. Evidencia leída antes de decidir

| Archivo                                                        | Líneas | Qué se verificó                                                                                                        |
| -------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/agents/tools/*`                                   |    826 | 6 tools + registry + context planner; **ningún caller fuera de `agent-tools.module.ts`** y del propio registry          |
| `apps/api/src/agents/model-router.service.ts`                   |    326 | Sin callers; único consumidor de `agentModelPolicy`                                                                    |
| `apps/api/src/agents/agent-config-resolver.service.ts`          |    142 | Cascada `user → admin → PRESET_FREE`                                                                                   |
| `apps/api/src/orchestrator/sub-agent.service.ts`                |    748 | `AGENT_SYSTEM_PROMPTS` (l. 41-336), `resolveSystemPrompt` (l. 503-516), `resolveConfigAgentId` (620-632), `getProvider` (641-747) |
| `apps/api/src/agents/evaluation/*`                              |    484 | `scheduleEvaluation` sin callers; `schedule-evaluations` y `cleanup()` sin disparador; evaluación contra último trade   |
| `apps/api/src/llm/llm-usage.service.ts` + `model-pricing.ts`    |    483 | `MODEL_PRICING` sin entradas OpenRouter (l. 242-244); `PROVIDER_DISPLAY` sin OPENROUTER/TOGETHER                        |
| `libs/openrouter/src/lib/openrouter-models.service.ts`          |    124 | Catálogo con `pricing.{prompt,completion}` ya normalizado a USD/millón de tokens + caché TTL 15 min                     |
| `apps/api/prisma/seed/agents.ts`                                |    414 | **`AGENT_SEEDS` cubre exactamente los 6 ids** que `SubAgentId` puede pedir                                              |
| `apps/api/prisma/schema.prisma`                                 |      — | `AgentId` (8 valores), `AgentDefinition`, `AgentDecision`, `AgentDecisionEvaluation`, `LlmUsageLog`, `Position`, `Trade` |
| `apps/web/src/hooks/use-agent-scorecard.ts` + `pages/dashboard/agent-scorecard` | — | El frontend del scorecard **existe y está ruteado** (`app.tsx:235`)                                                     |

### 1.1 Hallazgo nuevo (no estaba en la spec) — las tools consultan columnas que no existen

Esto condiciona D1 y hay que decirlo antes: **la lógica de dos de las tres tools a rescatar no funciona
hoy**, y por eso todas sus lecturas de Prisma están envueltas en `as Record<string, unknown>`, lo que
oculta el error en tiempo de compilación.

| Tool                  | Código actual                                                       | Realidad del schema                                                                              |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `RiskBudgetTool`      | `prisma.trade.findMany({ where: { createdAt: {gte}, configId } })`   | `Trade` **no tiene** `createdAt` (tiene `executedAt`) ni `configId` → **la query lanzaría error** |
| `RiskBudgetTool`      | `t.pnl` para el P&L diario                                          | `Trade` **no tiene** `pnl`; el P&L vive en `Position.pnl`, y solo cuando la posición cierra       |
| `PortfolioContextTool`| `p.unrealizedPnl`                                                   | `Position` **no tiene** `unrealizedPnl`; solo `pnl` (realizado al cerrar)                          |
| `PortfolioContextTool`| `w.asset ?? w.currency`                                             | `SandboxWallet` solo tiene `currency`                                                             |
| `PortfolioContextTool`| `p.pair` como símbolo de mercado                                    | `Position.pair` es `QuoteCurrency` (USDT/USDC); el símbolo es `asset + pair`                       |
| `TradeSimulationTool` | aritmética pura, sin Prisma                                         | **correcta** — es la única rescatable tal cual                                                     |

**Consecuencia para el Planner:** "rescatar" no es mover archivos. Para `RiskBudget` y `PortfolioContext`
es *re-especificar* el cálculo contra las columnas reales; el valor rescatado es la **política**
(qué se mide y con qué umbrales), no la implementación. Los contratos de §2 ya están escritos contra el
schema real y son la fuente de verdad para el implementador.

---

## 2. D1 — Servicios de dominio rescatados

Objetivo de diseño: que el cycle-02 pueda invocarlos desde `TradingProcessor`/`OrderExecutor` **sin
contrato de tool, sin `tokenEstimate`/`freshnessMs` (residuos del presupuesto de tokens del LLM) y sin
`Record<string, unknown>`** — todo tipado.

### 2.1 `simulateTrade` — función pura, `libs/trading-engine`

**Ubicación:** `libs/trading-engine/src/lib/risk/trade-simulation.ts`, exportada por el barrel de la lib.
**Por qué ahí y no en `apps/api`:** no toca Prisma ni Nest; el cycle-02 la necesita dentro del
`OrderExecutor` (`libs/trading-engine/src/lib/order-executor.ts:164-173`) y también sirve a backtests.

```ts
export type TradeSide = 'BUY' | 'SELL';

export interface TradeSimulationInput {
  asset: string;          // 'BTC' | 'ETH' — base, sin quote
  side: TradeSide;
  price: number;          // precio de entrada
  quantity: number;       // cantidad en base asset
  feePct?: number;        // default 0.001 (0.1%)
  stopLossPct?: number;   // ej 0.03
  takeProfitPct?: number; // ej 0.05
}

export interface TradeSimulationResult {
  notionalUsd: number;
  feesUsd: number;
  slippagePct: number;
  slippageUsd: number;
  expectedPnlUsd: number;      // neto de fees y slippage, asumiendo takeProfit alcanzado
  expectedNetValueUsd: number; // notional + expectedPnlUsd
  downsideUsd: number;         // pérdida si toca el stopLoss, incl. fees y slippage
  riskRewardRatio: number;     // expectedPnlUsd / downsideUsd (0 si downside === 0)
}

export function simulateTrade(input: TradeSimulationInput): TradeSimulationResult;

export const SLIPPAGE_PCT_BY_ASSET: Readonly<Record<string, number>>; // BTC 0.0005, ETH 0.001, default 0.0015
```

Diferencias respecto de `TradeSimulationTool`: entrada tipada en vez de `AgentToolInput`
(`Number(input.price) || 0` desaparece — el llamador ya tiene números); se agrega `riskRewardRatio`
(el cycle-02 lo necesita para la política de SELL); se elimina el parseo del par por regex
(`.replace(/USDT$|USD$|\/.*$/, '')`) porque el llamador pasa el `asset` del `TradingConfig`.
Los tests de `trade-simulation.tool.spec.ts` se portan 1:1 sobre la función pura.

### 2.2 `RiskBudgetService` — Prisma, `apps/api/src/agents/domain/`

**Ubicación:** `apps/api/src/agents/domain/risk-budget.service.ts`.

```ts
export interface RiskBudgetInput {
  userId: string;
  configId?: string;
  windowHours?: number;    // default 24
}

export interface RiskBudgetAssessment {
  canTrade: boolean;
  blockedBy: 'MAX_POSITIONS' | 'DAILY_LOSS_LIMIT' | 'DRAWDOWN' | null;
  reason: string | null;
  openPositionCount: number;
  maxConcurrentPositions: number;   // de TradingConfig, NO el 5 hardcodeado
  realizedPnlUsd: number;           // Position.pnl de posiciones CLOSED en la ventana
  dailyLossLimitUsd: number;        // AgentBudgetPolicy.dailyUsdBudget (default 5)
  drawdownPct: number;              // |realizedPnlUsd| / dailyLossLimitUsd, 0 si hay ganancia
  maxDrawdownPct: number;           // 0.10 por ahora (constante exportada, configurable en cycle-02)
}

@Injectable()
export class RiskBudgetService {
  constructor(private readonly prisma: PrismaService) {}
  assess(input: RiskBudgetInput): Promise<RiskBudgetAssessment>;
}
```

Correcciones obligatorias respecto de `RiskBudgetTool` (ver §1.1):

- El P&L de la ventana sale de `Position` (`status: 'CLOSED'`, `exitAt >= since`, sumando `pnl`), **no de
  `Trade`** — `Trade` no tiene ni `pnl` ni `createdAt` ni `configId`.
- `maxPositions` deja de ser `5` hardcodeado: se lee de `TradingConfig.maxConcurrentPositions` cuando hay
  `configId`; sin `configId` se usa el máximo entre las configs del usuario.
- Se elimina `maxPositionSizeUsd = maxCostPerDecisionUsd * 100` (la propia tool lo rotula
  `rough heuristic`): mezcla presupuesto **de LLM** con tamaño **de posición**. El sizing es del cycle-02
  y sale de `maxTradePct` + AEGIS/FORGE, no de este servicio.
- `blockedBy` tipado reemplaza el string libre `reason` como dato de decisión; `reason` queda solo para
  mostrar al usuario.

### 2.3 `PortfolioContextService` — Prisma, `apps/api/src/agents/domain/`

**Ubicación:** `apps/api/src/agents/domain/portfolio-context.service.ts`.

```ts
export interface PortfolioContextInput {
  userId: string;
  configId?: string;
  mode?: TradingMode;
  recentTradesLimit?: number; // default 10
}

export interface OpenPositionView {
  id: string;
  symbol: string;        // `${asset}${pair}` — ej 'BTCUSDT'
  asset: Asset;
  pair: QuoteCurrency;
  mode: TradingMode;
  quantity: number;
  entryPrice: number;
  entryAt: Date;
  notionalAtEntryUsd: number; // quantity * entryPrice
}

export interface PortfolioContextSnapshot {
  positions: OpenPositionView[];
  exposureAtEntryUsd: number;              // Σ notionalAtEntryUsd — exposición al costo, no a mercado
  realizedPnlUsd: number;                  // Σ Position.pnl de las CLOSED recientes
  feesUsd: number;                         // Σ Trade.fee de los trades recientes
  wallets: Array<{ currency: QuoteCurrency; balance: number }>;
  recentTrades: Array<{ id: string; type: TradeType; symbol: string; price: number; quantity: number; fee: number; executedAt: Date }>;
}

@Injectable()
export class PortfolioContextService {
  constructor(private readonly prisma: PrismaService) {}
  build(input: PortfolioContextInput): Promise<PortfolioContextSnapshot>;
}
```

Correcciones respecto de `PortfolioContextTool`: se elimina `openPnl` (dependía de `unrealizedPnl`, que
no existe; el P&L no realizado exige precio de mercado y es responsabilidad del cycle-02 —
`exposureAtEntryUsd` deja explícito que es exposición al costo); `wallets` usa `currency`; el símbolo se
compone de `asset + pair` en vez de leer un `pair` que es la moneda quote.

### 2.4 Módulo y consumo

```ts
// apps/api/src/agents/domain/agent-domain.module.ts
@Module({
  imports: [PrismaModule],
  providers: [RiskBudgetService, PortfolioContextService],
  exports: [RiskBudgetService, PortfolioContextService],
})
export class AgentDomainModule {}
```

`AgentDomainModule` se registra en `AppModule` **en el lugar que hoy ocupa `AgentToolsModule`** (el
reemplazo neto mantiene el conteo de módulos y hace evidente la sustitución en el diff). En este ciclo
**nadie lo inyecta** — es el andamio para el cycle-02, y eso es intencional y está documentado aquí para
que el reviewer no lo confunda con código muerto nuevo. Su cobertura de tests (CA-013) es la prueba de
que la lógica sobrevivió.

> ⚠️ **Orden inviolable (RN-09/CA-014):** `AgentDomainModule` mergeado y con tests verdes **antes** del
> commit que borra `apps/api/src/agents/tools/`.

### 2.5 Lógica que se descarta deliberadamente

`MarketEdgeTool`, `DecisionMemoryTool` y `TokenBudgetTool` **no se rescatan**: `DecisionMemoryTool`
referencia `AgentDecision.model` (campo inexistente, spec §1 hallazgo A), `MarketEdgeTool` duplica lo que
`MarketService.buildEnrichedSnapshot` ya hace en el camino vivo, y `TokenBudgetTool` pertenece al
presupuesto de tokens que el cycle-03 rediseña. Se borran con el resto.

---

## 3. D2 — Resolución única de provider/modelo

### 3.1 Duplicación actual

`AgentConfigResolverService.resolveConfig` (l. 46-87) resuelve `user → admin → PRESET_FREE`, pero
**devuelve solo datos**. `SubAgentService.getProvider` (l. 641-747) repite la cascada con tres ramas casi
idénticas (override / resolver / primera credencial activa), y cada rama repite las mismas cuatro
operaciones: buscar `LLMCredential`, `assertProviderActive`, `decrypt`, construir `OpenRouterProvider` o
`createLLMProvider`. Son ~107 líneas para una operación que es una.

### 3.2 Diseño

Se conserva **`AgentConfigResolverService`** como única clase (no se renombra: lo inyectan
`MarketService`, `SubAgentService` y los controllers de agent-config; renombrar sumaría diff sin valor y
el criterio del ciclo es diff neto negativo). Absorbe los dos pasos que faltaban y expone dos métodos:

```ts
// apps/api/src/agents/agent-config-resolver.service.ts

export type ResolutionSource = 'override' | 'user' | 'admin' | 'preset' | 'credential';

export interface ResolvedAgentConfig {
  slot: ModelSlotId;          // ver D6 §7
  provider: LLMProvider;
  model: string;
  source: ResolutionSource;
}

export interface ResolvedAgentClient extends ResolvedAgentConfig {
  client: LLMProviderClient;
}

@Injectable()
export class AgentConfigResolverService {
  /** Cascada completa, SIN tocar credenciales ni construir cliente. */
  resolveConfig(slot: ModelSlotId, userId: string): Promise<ResolvedAgentConfig>;

  /**
   * Cascada + credencial + assertProviderActive + decrypt + construcción del cliente.
   * Única puerta de entrada para obtener un cliente LLM de agente.
   * @throws NoLLMCredentialError  si ningún paso de la cascada llega a una credencial activa
   */
  resolveClient(
    userId: string,
    slot: ModelSlotId,
    override?: { provider: LLMProvider; model: string },
  ): Promise<ResolvedAgentClient>;

  resolveAllConfigs(userId: string): Promise<ResolvedAgentConfig[]>;
  checkHealth(userId: string, simulateRemoveProvider?: LLMProvider): Promise<AgentHealthReport>;
}
```

**Orden de la cascada dentro de `resolveClient` (único punto del sistema donde existe):**

1. `override` explícito, si el usuario tiene credencial activa para ese provider.
2. `resolveConfig(slot, userId)` → user override (con credencial activa) → admin default → preset
   (`PRESET_FREE`), y se busca credencial para el provider resuelto.
3. Última red: primera `LLMCredential` activa del usuario, con su `selectedModel`.
4. Si no hay ninguna → `NoLLMCredentialError` (extiende `BadRequestException`) con el mensaje actual
   `No active LLM credentials for user {userId}. Configure them in Settings.` — **CE-04: error explícito,
   nunca provider vacío.**

En los pasos 1-3, apenas hay credencial se llama a `platformLLMProviderService.assertProviderActive()`
antes de construir el cliente (comportamiento actual de `getProvider`, preservado tal cual).

**Construcción del cliente** (helper privado único, hoy triplicado):

```ts
private buildClient(provider: LLMProvider, apiKey: string, model: string, fallbackModels: string[]): LLMProviderClient
// OPENROUTER → new OpenRouterProvider({ apiKey, model, fallbackModels })
// resto       → createLLMProvider(provider, apiKey, model)
```

### 3.3 Cambios de wiring

- `SubAgentService`: se borran `getProvider` (l. 641-747) y `resolveConfigAgentId` (l. 620-632). `call()`
  pasa a `const { client, provider, model } = await this.agentConfigResolver.resolveClient(userId, slot, override)`.
  Con eso `SubAgentService` deja de importar `decrypt`, `createLLMProvider`, `OpenRouterProvider` y
  `PlatformLLMProviderService`, y pierde su `eslint-disable @nx/enforce-module-boundaries` de la línea 4.
- `AgentConfigModule` agrega `LlmModule` a sus `imports` (para `PlatformLLMProviderService`). **Sin ciclo:**
  `LlmModule` importa solo `PrismaModule` y `NotificationsModule`; la dependencia
  `AgentConfigModule → LlmModule` es nueva y unidireccional. El `eslint-disable` de módulo se muda a
  `agent-config-resolver.service.ts`, que ahora es el que importa `@crypto-trader/analysis`.
- `AgentConfigResolverService` deja de ser `@Optional()` en `SubAgentService`: sin él no hay forma de
  obtener cliente, y un `undefined` silencioso es justamente el fallo que CE-04 prohíbe. Los specs que
  hoy construyen `SubAgentService` sin resolver deben pasar un doble.

---

## 4. D3 — Pipeline de evaluación: **se valida cablearlo**

### 4.1 Validación de la recomendación del brief

La decisión del brief se confirma. Evidencia a favor y contra, medida sobre el código:

| A favor de cablear                                                                                                     | Costo/riesgo                                              |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| El **frontend ya existe y está ruteado**: `apps/web/src/pages/dashboard/agent-scorecard` + `use-agent-scorecard.ts` (hooks para `/agents/scorecard` y `/summary`). Eliminar el pipeline obliga a borrar también una página y sus hooks | Eliminar sería un diff más grande, no más chico            |
| La tabla `AgentDecisionEvaluation`, el processor, el controller y `getScorecard/getSummary` están **completos y testeados** (`evaluation.service.spec.ts`, 312 líneas). Lo único que falta es el disparador y la fuente de precio | ~30 líneas nuevas de producción                            |
| `AgentDecisionEvaluation` está **vacía en todo entorno**: `agentDecisionEvaluation.create` solo aparece en `evaluation.processor.ts:66`, alcanzable únicamente desde jobs que nunca se encolaron | Añadir un índice UNIQUE no requiere deduplicar nada        |
| Es la única telemetría de calidad de decisión; sin ella el cycle-03 no puede probar su criterio ("sin degradar la tasa de decisiones correctas") | —                                                          |
| El precio real ya es accesible sin credenciales: `BinanceRestClient` sin API key apunta a `BINANCE_PUBLIC_URL` y `MarketService` ya instancia uno (`market.service.ts:128`) | Se agrega un parámetro opcional a `getKlines`              |

**Refutación considerada y descartada:** "el sistema opera mayormente en SANDBOX, evaluar contra precio
real no dice nada". No aplica — el precio de mercado es el mismo en SANDBOX, TESTNET y LIVE; lo que
cambia es la ejecución, no el mercado. La evaluación mide la **decisión**, no el fill.

### 4.2 Momento exacto de `scheduleEvaluation`

Hay **dos** puntos de persistencia de `AgentDecision`, no uno (el brief menciona solo el primero):

| Punto                            | Contexto                                   | Acción                                                                 |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `trading.processor.ts:329`       | ciclo automático del bot                   | `scheduleEvaluation(savedDecision.id)` inmediatamente después del `create`, antes del `emitToUser` |
| `trading.service.ts:996`         | análisis manual (`manualTrigger: true`)    | idem — capturar el retorno del `create` (hoy se descarta)              |

Contrato de la llamada — **fire-and-forget con log, nunca bloqueante**: si Redis está caído, el ciclo de
trading no puede fallar por telemetría.

```ts
this.evaluationService
  .scheduleEvaluation(savedDecision.id)
  .catch((err) => this.logger.warn(`scheduleEvaluation failed for ${savedDecision.id}: ${msg(err)}`));
```

`TradingModule` agrega `EvaluationModule` a sus `imports` (`EvaluationModule` ya exporta
`EvaluationService`; solo importa `BullModule` + `PrismaModule`, no hay ciclo).

### 4.3 Jobs

Cola: `agent-evaluation` (`EVALUATION_QUEUE`, ya registrada). Horizontes: **15, 60, 240, 1440 minutos**
(sin cambios).

```ts
// EvaluationService.scheduleEvaluation — firma sin cambios, idempotencia nueva
await this.evaluationQueue.add(
  'evaluate',
  { decisionId, horizonMinutes },
  {
    delay: horizonMinutes * 60_000,
    jobId: `eval:${decisionId}:${horizonMinutes}`,   // ← dedupe en Bull
    removeOnComplete: true,
  },
);
```

| Job                    | Disparador                                                                                                    | Qué hace                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `evaluate`             | delayed, encolado por `scheduleEvaluation` o por el sweep                                                     | evalúa una decisión a un horizonte                                             |
| `schedule-evaluations` | **repetible, `cron: '*/15 * * * *'`, `jobId: 'evaluation-sweep'`**, registrado en `EvaluationService.onModuleInit` | red de seguridad: re-encola horizontes faltantes de las últimas 25 h (Redis se reinicia y pierde los delayed) |
| `cleanup`              | **repetible, `cron: '30 3 * * *'`, `jobId: 'evaluation-cleanup'`**, mismo `onModuleInit`                      | `EvaluationService.cleanup()` — hoy también huérfano; necesita un `@Process('cleanup')` en el processor |

`onModuleInit` usa `jobId` fijo + `queue.removeRepeatable` previo por seguridad, de modo que N réplicas
del proceso no multipliquen el sweep.

### 4.4 Fuente del precio real de mercado

Nuevo método en `MarketService` (apps/api), apoyado en el `BinanceRestClient` público que ya tiene:

```ts
// apps/api/src/market/market.service.ts
/**
 * Precio de cierre de mercado en un instante dado.
 * Devuelve null si el proveedor no tiene vela para esa ventana (gap de datos).
 */
async getPriceAt(symbol: string, at: Date): Promise<number | null>;
```

Algoritmo:

1. Si `Date.now() - at.getTime() < 60_000` (el minuto de `at` aún no cerró) → `binance.getTickerPrice(symbol)`.
2. Si no → `binance.getKlines(symbol, '1m', 3, { startTime: at.getTime() - 60_000, endTime: at.getTime() + 60_000 })`
   y se toma el `close` de la vela con `openTime <= at <= closeTime`.
3. Sin vela que contenga `at`, o error del proveedor → `null` (se loguea `warn`, no se lanza).

Para (2) se agrega a `BinanceRestClient.getKlines` un **cuarto parámetro opcional**
`range?: { startTime?: number; endTime?: number }` que se pasa tal cual a `/api/v3/klines`. Es aditivo:
las 3 llamadas existentes (`getOhlcv`, `getSnapshot`, y la del trading engine) no cambian de firma ni de
comportamiento. Único cambio en `libs/data-fetcher` de este ciclo.

**Símbolo:** `` `${decision.asset}${decision.pair}` `` (ej. `BTCUSDT`) — `AgentDecision` tiene ambas
columnas tipadas; no hace falta consultar `TradingConfig`.

### 4.5 Contrato del `EvaluationProcessor.evaluate`

```
entrada: { decisionId, horizonMinutes }

1. decision = agentDecision.findUnique(decisionId)        → si no existe: log + return (sin fila)
2. si ya existe evaluación (decisionId, horizonMinutes)   → return (idempotencia)
3. priceAtDecision = indicators.currentPrice ?? indicators.price ?? indicators.close
   si no es > 0                                           → fila NOT_EVALUABLE, priceAtEvaluation = null
4. evaluatedAtTarget = decision.createdAt + horizonMinutes
   priceAtEvaluation = marketService.getPriceAt(symbol, evaluatedAtTarget)
   si null                                                → fila NOT_EVALUABLE, priceAtEvaluation = null  (CE-01)
5. priceChange = (priceAtEvaluation - priceAtDecision) / priceAtDecision
6. calculateOutcome(decision.decision, priceChange, priceAtDecision)   ← sin cambios, ya está testeado
7. calculateMarketRegime(priceChange)                                  ← sin cambios
8. create fila con status/pnl/regime/evaluatedAt = now()
```

Lo que se **borra** del processor: el bloque `trade.findFirst(...)` +
`priceAtEvaluation = trade?.price ?? priceAtDecision` (l. 50-54) — el placeholder que comparaba contra el
último trade de cualquier par del usuario (RN-05).

### 4.6 Semántica de estados (HU-01-02)

| Estado                                            | Cuenta en el scorecard | Significado                                            |
| ------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `PENDING`                                         | ❌ (excluido)          | horizonte no vencido — **CA-008: visible como pendiente** |
| `NOT_EVALUABLE` *(nuevo)*                         | ❌ (excluido)          | horizonte vencido pero sin precio de mercado — **CE-01** |
| `WIN` / `LOSS` / `NEUTRAL` / `MISSED_OPPORTUNITY` / `AVOIDED_LOSS` | ✅  | evaluadas                                              |

- `EvaluationService.buildEvalWhere` pasa de `status: { not: 'PENDING' }` a
  `status: { notIn: ['PENDING', 'NOT_EVALUABLE'] }`.
- `EvaluationService.cleanup()` cambia el destino de las `PENDING` de más de 48 h: `NOT_EVALUABLE` en
  lugar de `NEUTRAL` (hoy las contamina el win rate como si fueran resultado real).
- `getScorecard`/`getSummary` agregan al response `pendingCount` y `notEvaluableCount` para que la
  pantalla pueda mostrar CA-008 sin una segunda llamada (ver §9, EP-001/EP-002).

---

## 5. D4 — Pricing en vivo de OpenRouter → `LLMUsageService.log`

### 5.1 Por qué hoy da $0

`log()` hace `MODEL_PRICING[params.model]` y, si no hay entrada, `costUsd = 0` sin dejar rastro
(`llm-usage.service.ts:63-67`). `model-pricing.ts:242-244` declara explícitamente que no tiene entradas
OpenRouter. Como el preset por defecto es OpenRouter (`PRESET_FREE`), casi todo el tráfico se persiste
con costo 0 y es **indistinguible** de un costo genuinamente 0.

### 5.2 Servicio nuevo

```ts
// apps/api/src/llm/model-pricing.service.ts

export type PricingSourceValue = 'LIVE_OPENROUTER' | 'STALE_CACHE' | 'STATIC_TABLE' | 'UNPRICED';

export interface ResolvedPricing {
  /** USD por millón de tokens de entrada */
  inputPerMTok: number;
  /** USD por millón de tokens de salida */
  outputPerMTok: number;
  source: PricingSourceValue;
}

@Injectable()
export class ModelPricingService {
  constructor(private readonly openRouterModels: OpenRouterModelsApiService) {}

  /** Nunca lanza. Ante cualquier fallo devuelve el mejor fallback disponible. */
  resolve(provider: LLMProvider, model: string): Promise<ResolvedPricing>;

  computeCostUsd(pricing: ResolvedPricing, usage: { inputTokens: number; outputTokens: number }): number;
}
```

**Cascada de resolución (CE-01 / CA-004):**

| Paso | Condición                                                                                       | `source`          |
| ---- | ----------------------------------------------------------------------------------------------- | ----------------- |
| 1    | `provider === OPENROUTER` y el catálogo devuelve el modelo                                        | `LIVE_OPENROUTER` |
| 2    | catálogo vacío/timeout, pero hay snapshot en memoria de una lectura previa del mismo modelo       | `STALE_CACHE`     |
| 3    | `MODEL_PRICING[model]` existe (camino normal de CLAUDE/OPENAI/GROQ/GEMINI/MISTRAL/**TOGETHER**)   | `STATIC_TABLE`    |
| 4    | nada resolvió                                                                                     | `UNPRICED` (costo 0, **marcado**) |

- **Caché:** no se agrega ninguno nuevo. `OpenRouterModelsService` ya cachea el catálogo completo con
  TTL 15 min (`OPENROUTER_DEFAULT_CACHE_TTL`) y `OpenRouterModelsApiService.getModels` ya atrapa el error
  y devuelve `[]`. `ModelPricingService` mantiene además un `Map<modelId, {inputPerMTok, outputPerMTok}>`
  **last-good sin expiración**, que solo se lee en el paso 2: una tarifa de hace una hora es
  infinitamente mejor que un 0.
- **Modelo efectivo:** se resuelve contra `actualModel ?? model`. Con `fallbackModels` de OpenRouter el
  modelo servido puede no ser el pedido, y el costo debe corresponder al servido.
- **Unidades:** `OpenRouterModelInfo.pricing.{prompt,completion}` ya viene multiplicado por `1_000_000`
  en `openrouter-models.service.ts:46-47` — misma unidad que `MODEL_PRICING`. No hay conversión.
- `MODEL_PRICING` **se conserva**: es el pricing correcto de los 6 proveedores directos y la fuente de
  `label` en `getStats`. No se le agregan entradas OpenRouter (serían una tabla estática de un catálogo
  de miles de modelos que cambia solo).

### 5.3 Cambios en `LLMUsageService`

```ts
async log(params: LLMUsageLogParams): Promise<void> {
  const pricing = await this.modelPricing.resolve(params.provider, params.actualModel ?? params.model);
  const costUsd = this.modelPricing.computeCostUsd(pricing, params.usage);
  // ...create({ ..., costUsd, pricingSource: pricing.source })
}
```

- El `try/catch` que ya envuelve el `create` se extiende para cubrir también el `resolve` — **CA-004: el
  registro de uso nunca se pierde ni rompe la llamada LLM**. Los tres llamadores
  (`sub-agent.service.ts:585`, `chat.service.ts:621`, `market.service.ts:396`) ya invocan con
  `.catch(...)` fire-and-forget; ninguno cambia.
- `PROVIDER_DISPLAY` (l. 49-55) suma `OPENROUTER: 'OpenRouter'` y `TOGETHER: 'Together AI'` — **RN-02/CA-003**.
- `getStats` suma por proveedor `unpricedCallCount` (llamadas con `pricingSource === 'UNPRICED'` o
  `null`), para que el dashboard pueda advertir "hay tráfico sin tarifa" en lugar de mostrar un total que
  parece completo (ver §9, EP-003).

### 5.4 Advertencia obligatoria para el Reviewer sobre CA-001

**El preset por defecto son modelos `:free` de OpenRouter** (`agent-presets.ts` →
`nvidia/nemotron-3-super-120b-a12b:free` para los 8 slots). Para esos modelos el catálogo devuelve
`pricing.prompt === 0` y el costo correcto **es** $0. Es decir: con la configuración por defecto,
CA-001 ("costo > $0 para tráfico OpenRouter") **no puede cumplirse, y eso no es un bug**.

La verificación de CA-001 debe hacerse con **un modelo OpenRouter de pago** (usuario con `AgentConfig` o
`AdminAgentConfig` apuntando a un modelo no `:free`), y el criterio realmente ejecutable es el que hace
la distinción imposible hoy:

> Toda fila de `llm_usage_logs` de tráfico OpenRouter tiene `pricingSource` no nulo; `costUsd = 0` con
> `pricingSource = 'LIVE_OPENROUTER'` significa "modelo gratis" y `pricingSource = 'UNPRICED'` significa
> "no se pudo tarifar" — nunca más un 0 ambiguo.

El Planner debería incluir esta comprobación como criterio de done de la task de pricing.

---

## 6. D5 — Fuente única de system prompts

### 6.1 Verificación del seed (CA-011) — **cubierto**

`AGENT_SEEDS` (`apps/api/prisma/seed/agents.ts:333-414`) define exactamente los ids
`orchestrator`, `platform`, `operations`, `market`, `blockchain`, `risk`, con `systemPrompt` no vacío e
`isActive: true`. Ese conjunto es **idéntico** al union `SubAgentId` de `sub-agent.service.ts:19-25`, o
sea, a las 6 claves de `AGENT_SYSTEM_PROMPTS`. `prisma/seed.ts` los inserta con `upsert` → es idempotente
y puede correrse en cada deploy. **No falta ninguno: el hardcode se puede borrar sin pérdida de
cobertura.**

Diferencia real entre ambas fuentes (documentada en el header del seed): los prompts del seed son
*superset* — incluyen las secciones de chat (`quickActions`, `inlineOptions`) que el hardcode no tiene.
Borrar el hardcode **mejora** los prompts del camino de trading; no los degrada. El comentario
"Keep both in sync when updating agent prompts" del seed se elimina junto con el hardcode.

### 6.2 Servicio

```ts
// apps/api/src/agents/agent-prompt.service.ts

export class AgentPromptUnavailableError extends Error {}

@Injectable()
export class AgentPromptService implements OnModuleInit {
  /** Fail-fast: verifica al arranque que los 6 PERSONA_AGENT_IDS existen, activos y con prompt no vacío. */
  async onModuleInit(): Promise<void>;

  /** @throws AgentPromptUnavailableError si falta, está inactivo o tiene systemPrompt vacío. */
  getSystemPrompt(agentId: PersonaAgentId): Promise<string>;

  /** Invalida el caché de uno o de todos. La llama AdminAgentsService al actualizar un prompt. */
  invalidate(agentId?: PersonaAgentId): void;
}
```

- **Caché:** `Map<PersonaAgentId, { prompt: string; fetchedAt: number }>` con TTL 60 s **más**
  invalidación explícita desde `AdminAgentsService.updateAgent` (`admin-agents.service.ts:62-78`), que
  pasa a inyectar `AgentPromptService`. Con la invalidación, **CA-009 se cumple en la siguiente
  ejecución del agente**, no en 60 s; el TTL es solo la red por si alguien escribe la tabla por fuera.
- Vive en `AgentConfigModule` (junto al resolver, que es su vecino natural) y se exporta;
  `OrchestratorModule` ya importa `AgentConfigModule`, así que `SubAgentService` lo inyecta sin wiring nuevo.

### 6.3 Política ante `AgentDefinition` faltante (CE-02/CE-03) — **fail-fast + fail-closed**

| Momento          | Comportamiento                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Boot**         | `onModuleInit` consulta los 6 ids. Si falta alguno / está inactivo / tiene prompt vacío → `Error` con la lista de ids faltantes y **el arranque falla**. Mensaje accionable: `Missing AgentDefinition rows: [...]. Run 'pnpm db:seed'.` |
| **Runtime**      | `getSystemPrompt` lanza `AgentPromptUnavailableError` si la fila desapareció. `SubAgentService.call` deja propagar: el orchestrator ya degrada un sub-agente que falla, exactamente igual que ante un error del LLM |
| **Tabla ausente**| Si la consulta falla porque la tabla no existe (migración pendiente), el error se propaga igual — la app **no** debe arrancar con el schema desactualizado |

Se elimina así el `try { } catch { /* DB not available */ }` de `resolveSystemPrompt`
(l. 503-516), que hoy convierte cualquier fallo de BD en "usar el prompt viejo hardcodeado" en silencio:
es exactamente el modo de fallo que CE-02 prohíbe.

**Requisito operativo derivado:** el seed pasa a ser parte del arranque de cualquier entorno nuevo
(dev, CI, e2e). El Planner debe incluir una task para verificar/ajustar el bootstrap de tests e2e
(`pnpm db:seed` antes de levantar la app) — sin eso, el fail-fast rompe la suite.

### 6.4 Qué se borra

`AGENT_SYSTEM_PROMPTS` (`sub-agent.service.ts:41-336`, ~295 líneas) y `resolveSystemPrompt`
(l. 503-516). `SubAgentService.call` pasa a `await this.agentPromptService.getSystemPrompt(agentId)`.
La inyección de contexto RAG sobre el prompt (l. 519-536) **no cambia**.

---

## 7. D6 — Destino del enum `AgentId`: **conservar los 8 valores, aislar la indirección**

### 7.1 El enum no tiene 8 valores para 6 agentes: tiene dos ejes superpuestos

| Eje                      | Valores                                                                | Dónde se usa                                                                                  |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Identidad/prompt** (6) | `orchestrator, platform, operations, market, blockchain, risk`         | PK de `AgentDefinition`; FK de `AgentDocument`, `AgentDocumentChunk`; prompt de cada persona   |
| **Slot de modelo** (7)   | `routing, synthesis, platform, operations, market, blockchain, risk`   | `AgentConfig.agentId`, `AdminAgentConfig.agentId`, `AgentModelPolicy.agentId`, `LlmUsageLog.agentId` |

`orchestrator` pertenece solo al primer eje (`agent-config.service.ts:46-50` lo rechaza explícitamente
como configurable); `routing` y `synthesis` solo al segundo. La intersección son las 5 personas
configurables. **8 = 6 ∪ 7.**

### 7.2 Por qué no se colapsa

1. **`routing`/`synthesis` YA SON el modelo objetivo de la spec.** La spec pide "colapsar a KRYPTO con
   dos velocidades": eso es precisamente un slot barato de clasificación (`routing`) y uno potente de
   síntesis (`synthesis`) para la misma persona KRYPTO. Colapsarlos a un solo `orchestrator` **eliminaría
   la capacidad de dos velocidades** que el cycle-03 necesita para bajar el costo por decisión. Sería
   caminar hacia atrás.
2. **Costo de migración real, beneficio funcional nulo.** En PostgreSQL, quitar valores de un enum exige
   crear un tipo nuevo, reescribir **5 columnas** (`agent_configs`, `admin_agent_configs`,
   `agent_model_policies`, `llm_usage_logs`, y las FK de documentos), backfillar filas de usuarios y de
   admin que hoy apuntan a `routing`/`synthesis` (son configuración deliberada, no basura), reescribir el
   histórico de `llm_usage_logs` (que rompería la atribución de costo por agente — justo la observabilidad
   que este ciclo construye) y tocar la UI de configuración de agentes. Todo eso para no cambiar ni un
   comportamiento.
3. El ciclo declara **diff neto negativo** como criterio; una migración de enum lo empuja al alza sin
   contrapartida.

CA-019 contempla exactamente esta salida: *"si se documenta que migrar el enum en BD no se justifica, la
indirección queda documentada y concentrada en un único punto del código"*. Es lo que se hace.

### 7.3 Punto único de la indirección

```ts
// apps/api/src/agents/agent-identity.ts   ← ÚNICO archivo que conoce el mapeo

/** Agentes con identidad propia y AgentDefinition (prompt). */
export const PERSONA_AGENT_IDS = ['orchestrator','platform','operations','market','blockchain','risk'] as const;
export type PersonaAgentId = (typeof PERSONA_AGENT_IDS)[number];

/** Slots configurables de modelo. 'orchestrator' NO es configurable: usa routing/synthesis. */
export const MODEL_SLOT_IDS = ['routing','synthesis','platform','operations','market','blockchain','risk'] as const;
export type ModelSlotId = (typeof MODEL_SLOT_IDS)[number];

/**
 * KRYPTO tiene dos velocidades: 'routing' (clasificación barata) y 'synthesis' (decisión).
 * El resto de las personas usa su propio slot homónimo.
 */
export function resolveModelSlot(agentId: PersonaAgentId, task: AgentTask, preferCheap: boolean): ModelSlotId;

export function isPersonaAgent(value: string): value is PersonaAgentId;
export function isModelSlot(value: string): value is ModelSlotId;
```

Los tres sitios que hoy conocen el mapeo pasan a consumir este archivo y dejan de razonarlo:

| Sitio actual                                      | Después                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `sub-agent.service.ts:620-632` `resolveConfigAgentId` | borrado → `resolveModelSlot(...)`                                   |
| `agent-config-resolver.service.ts:88-97` filtro `id !== AgentId.orchestrator` | `MODEL_SLOT_IDS`                            |
| `agent-config.service.ts:45-50` guarda contra `orchestrator`   | `isModelSlot(agentId)`                                  |

El archivo lleva el único comentario permitido del ciclo (regla global de cero comentarios): una línea
que explica por qué el enum de BD tiene 8 valores y remite a esta sección.

### 7.4 Objetos de BD que quedan huérfanos tras la poda — **no se borran en este ciclo**

| Objeto                                   | Último escritor/lector                                        | Decisión                                                                  |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| tabla `agent_tool_invocations` + enum `AgentToolName` | `agent-tool-registry.ts:146` (se borra)                        | queda sin escritores; **no se dropea** (destructivo, y el cycle-03 puede reusar la tabla para telemetría de costo) |
| tabla `agent_model_policies`             | `model-router.service.ts:86` (se borra)                        | idem                                                                      |
| tabla `agent_budget_policies`            | `risk-budget.tool.ts` → **pasa a `RiskBudgetService`**         | **sigue viva**, la usa el servicio rescatado                              |

Quedan documentadas aquí como candidatas a deprecación, **sin entrada en `sdd/schema.json`**: el ciclo no
las modifica y registrar como "deprecated" algo que sigue existiendo en la BD sería falsear el registro.
El drop, si se hace, es una decisión del cycle-02/03 con su propia migración y su propia entrada. Borrar
tablas para ganar líneas de diff sería cambiar riesgo de datos por estética.

---

## 8. Impacto en el schema de datos (Prisma)

Una sola migración, **toda aditiva, sin backfill y sin downtime**:
`apps/api/prisma/migrations/20260817xxxxxx_add_pricing_source_and_not_evaluable/migration.sql`.

```prisma
enum PricingSource {
  LIVE_OPENROUTER   // tarifa del catálogo en vivo de OpenRouter al momento de la llamada
  STALE_CACHE       // último precio conocido: el catálogo no respondió
  STATIC_TABLE      // MODEL_PRICING (proveedores directos)
  UNPRICED          // no se pudo tarifar — costUsd = 0 NO es un costo real
}

enum AgentOutcomeStatus {
  PENDING
  WIN
  LOSS
  NEUTRAL
  MISSED_OPPORTUNITY
  AVOIDED_LOSS
  NOT_EVALUABLE     // ← nuevo: horizonte vencido sin precio de mercado disponible (CE-01)
}

model LlmUsageLog {
  // ... columnas existentes sin cambios ...
  pricingSource PricingSource?   // ← nuevo. null = fila anterior a este ciclo
  // ... índices existentes sin cambios ...
}

model AgentDecisionEvaluation {
  // ... columnas existentes sin cambios ...
  @@unique([decisionId, horizonMinutes])   // ← nuevo: una evaluación por (decisión, horizonte)
  @@index([userId, decisionId])
  @@index([status, createdAt])
  @@map("agent_decision_evaluations")
}
```

Notas de seguridad de la migración:

- `pricingSource` es **nullable**: las filas históricas quedan en `null`, que el dashboard interpreta como
  "origen desconocido (pre cycle-01)". No se backfillea nada — inventar el origen de un costo pasado sería
  falsificar telemetría.
- `ALTER TYPE ... ADD VALUE 'NOT_EVALUABLE'` es aditivo y no reescribe filas.
- El índice UNIQUE **no requiere deduplicar**: `agent_decision_evaluations` está vacía en todos los
  entornos (§4.1). El implementador debe verificarlo (`SELECT count(*)`) antes de aplicar; si por lo que
  sea hubiera filas duplicadas, se deduplica en la misma migración conservando la de `evaluatedAt` más
  reciente.
- Ninguna tabla se crea, se dropea ni se renombra. `AgentDecision`, `AgentDefinition`, `AgentConfig`,
  `AdminAgentConfig`, `LLMCredential`, `PlatformLLMProvider`, `TradingConfig`, `Trade`, `Position`:
  **sin cambios**.

---

## 9. Impacto en los contratos de API

Ningún endpoint nuevo y ninguna ruta modificada. Cambian **tres responses**, todos por adición de campos
(retrocompatible con el frontend actual: `use-agent-scorecard.ts` y `ai-usage-dashboard.tsx` leen campos
por nombre, no posicionalmente).

### EP-001 · `GET /agents/scorecard`

Auth: `Authorization: Bearer <jwt>` (`JwtAuthGuard`).
Query: `agentId, model, provider, symbol, mode, riskProfile, marketRegime, from, to` (todos opcionales).

```jsonc
// 200 — campos nuevos marcados
{
  "totalDecisions": 128,
  "winRate": 0.53,
  "avgPnlUsd": 12.4,
  "avgCostUsd": 0.021,
  "netValueUsd": 1584.3,
  "pendingCount": 14,        // NUEVO — horizonte no vencido (CA-008)
  "notEvaluableCount": 3,    // NUEVO — vencido sin precio de mercado (CE-01)
  "byMarketRegime": [{ "regime": "TRENDING_UP", "count": 40, "winRate": 0.6 }]
}
```

`totalDecisions`, `winRate` y los agregados **excluyen** `PENDING` y `NOT_EVALUABLE`.

### EP-002 · `GET /agents/scorecard/summary`

Mismos auth y query. Suma `pendingCount` y `notEvaluableCount` con idéntica semántica; el resto del
contrato (`totalEvaluated, winRate, lossRate, avgPnlPerDecision, totalCostUsd, roi`) no cambia.

### EP-003 · `GET /users/me/llm/usage`

Auth: `Authorization: Bearer <jwt>`. Query: `period` (`7d|30d|90d|all`, default `30d`).

```jsonc
// 200 — cambios dentro de byProvider[]
{
  "byProvider": [
    {
      "provider": "OPENROUTER",
      "label": "OpenRouter",     // antes caía al literal 'OPENROUTER' (CA-003)
      "costUsd": 3.42,           // antes 0 para todo el tráfico OpenRouter (CA-001)
      "unpricedCallCount": 0,    // NUEVO — llamadas con pricingSource UNPRICED o null
      "byModel": [ /* sin cambios estructurales */ ]
    }
  ]
  // totalCostUsd, dailySeries, totalInputTokens, totalOutputTokens: sin cambios de forma
}
```

Ambos endpoints ya existen en el código pero **no estaban registrados** en `sdd/api.json` (repo
pre-existente adoptado por el arnés). Se registran ahora con `status: "defined"` y el contrato
**post-ciclo**; el implementador los pasa a `implemented`.

---

## 10. Secuencia recomendada al Planner (orden de riesgo)

El orden importa: rescatar y verificar **antes** de borrar (RN-09), y unificar antes de podar lo que la
unificación deja sin uso.

1. **Rescate** — `simulateTrade` + `RiskBudgetService` + `PortfolioContextService` + `AgentDomainModule` + tests (CA-012/013). *No borra nada.*
2. **`agent-identity.ts`** — punto único de la indirección; los 3 sitios pasan a consumirlo (D6).
3. **Resolver único** — `resolveClient` en `AgentConfigResolverService`; `SubAgentService.getProvider` fuera (D2).
4. **Prompts** — `AgentPromptService` + fail-fast + invalidación desde admin; fuera `AGENT_SYSTEM_PROMPTS` y `resolveSystemPrompt` (D5). Ajustar bootstrap de e2e con `db:seed`.
5. **Migración Prisma** — `PricingSource`, `NOT_EVALUABLE`, unique de evaluaciones (§8). Bloquea 6 y 7.
6. **Pricing** — `ModelPricingService` + `log()` async + `PROVIDER_DISPLAY` + `unpricedCallCount` (D4).
7. **Evaluación** — `getPriceAt` + `getKlines(range)` + processor contra precio real + `scheduleEvaluation` en los 2 call sites + repetibles sweep/cleanup (D3).
8. **Poda** — `agents/tools/` completo, `context-planner`, `model-router` (+ su spec), `llm-analyzer` (+ barrel de `libs/analysis` + `llm.spec.ts`), `buildNewsAggregator_unused`, y los registros DI en `app.module.ts`.

Solo después del paso 8 se puede medir el criterio de diff neto negativo.

---

## 11. Riesgos técnicos que el ciclo introduce

| Riesgo                                                                                                   | Mitigación                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| El fail-fast de prompts rompe entornos sin seed (CI, e2e, dev nuevo)                                      | `pnpm db:seed` en el bootstrap de e2e; mensaje de error que nombra el comando exacto              |
| `scheduleEvaluation` encola 4 jobs por decisión: con N bots a 5 min, la cola crece                        | `removeOnComplete: true` (ya presente), `jobId` determinista y unique en BD → sin duplicados      |
| `getPriceAt` agrega llamadas a Binance (peso de rate limit)                                               | `BinanceRestClient` ya tiene rate limiter por baseURL y caché de ticker de 8 s; 4 llamadas por decisión, espaciadas por los horizontes |
| `log()` pasa a ser async con posible I/O de red (catálogo)                                                | El catálogo está cacheado 15 min y todos los llamadores ya son fire-and-forget con `.catch`       |
| `AgentConfigModule → LlmModule`: ciclo de módulos si alguien luego hace `LlmModule → AgentConfigModule`  | Documentado aquí; `LlmModule` hoy solo importa `PrismaModule` y `NotificationsModule`             |
| Borrar `llm-analyzer.ts` rompe `libs/analysis/src/lib/llm/index.ts` y `llm.spec.ts`                       | La task 8 incluye barrel y spec; `LLMAnalyzerConfig` en `llm-types.ts` se va con él si no queda consumidor |

---

## 12. Fuera del alcance de este diseño (confirmación explícita)

No se diseña ni se toca: sizing real, política de SELL/`minProfitPct`, verdict `REDUCE`, SL/TP, trailing
stop, ventas parciales, límites agregados, FK `Trade.decisionId`, override por regex del BLOCK de AEGIS,
órdenes LIMIT/STOP_LOSS_LIMIT/OCO, gate determinista pre-LLM, caché por `(asset, pair, timeframe)`,
prompt caching de proveedor, `max_tokens` por tarea, `BinanceWsClient`. **RF-07/RN-12 se cumple: ante el
mismo `AgentDecision` y los mismos indicadores, el sistema decide y opera exactamente igual antes y
después de este ciclo.** El único cambio en `libs/data-fetcher` es el parámetro opcional `range` de
`getKlines`, que no altera ninguna llamada existente.

---

## 13. Registros SDD actualizados

| Registro          | Cambio                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `sdd/schema.json` | app-key `apps/api`: `llm_usage_logs` y `agent_decision_evaluations` (`status: defined`, `created_in_cycle: 1`) con las columnas y el índice de §8 |
| `sdd/api.json`    | app-key `apps/api`: `EP-001`, `EP-002`, `EP-003` (`status: defined`, `created_in_cycle: 1`) con los contratos de §9      |
| `pnpm sdd:validate` | verde                                                                                                                 |
