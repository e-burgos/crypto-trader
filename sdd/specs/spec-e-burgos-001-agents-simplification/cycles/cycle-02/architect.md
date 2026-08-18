# Architect — Cycle 02: Venta inteligente y gestión activa de riesgo

> **Input:** brief.yaml · functional.md (11 HUs / 37 CAs) · spec-e-burgos-001 §3 Cycle-02, §5 Riesgos
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect
> **Fecha:** 2026-08-17
> **Stack (de `sdd/context/apps/api/constitution.md`, `libs/trading-engine`, `libs/data-fetcher` y del código real):**
> NestJS 11 + Prisma 7 (PostgreSQL 16, cliente en `apps/api/generated/prisma`) + Bull 4 + Socket.io.
> Schema en Prisma; migraciones **escritas a mano en SQL** (no hay BD — `environment_constraints`).
> `zod@4` ya es dependencia del repo (`libs/providers/src/lib/schemas/*`): es la herramienta de validación
> del payload de AEGIS. Cero comentarios en el código: todo el "por qué" vive en este documento.

---

## 0. Resumen de decisiones

| #       | Decisión                                                                                                                                                                                                                        | Impacto en BD                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **D1**  | 15 columnas nuevas en `TradingConfig` (política de SELL, sizing, protección nativa, trailing, TP parcial, salida por tiempo) — **todas con default que reproduce el comportamiento actual**                                     | `trading_configs` +15 col                 |
| **D2**  | Los límites **agregados por usuario** NO van en `TradingConfig` ni en `AgentBudgetPolicy`: tabla nueva `user_risk_policies` (1:1 con `User`). Sin fila → sin límites → sin cambio de conducta                                   | tabla nueva + 2 endpoints                 |
| **D3**  | Órdenes nativas: `placeLimitOrder` / `placeStopLossLimitOrder` / `placeOcoSellOrder` sobre `/api/v3/order` y `/api/v3/orderList/oco`, con validación **local** de LOT_SIZE / PRICE_FILTER / NOTIONAL antes de firmar            | Ninguno                                   |
| **D4**  | Caso crítico (compra OK + protección rechazada): **retry 3× con backoff → `protectionStatus = UNPROTECTED` + notificación + reintento en la reconciliación del próximo ciclo**. NO se cierra la posición salvo opt-in explícito | `positions.protection_status` y 6 col más |
| **D5**  | Reconciliación al inicio del ciclo, **antes del LLM**, idempotente por transición condicional de estado (`updateMany` con status esperado), nunca por conteo de trades                                                          | Ninguno                                   |
| **D6**  | Sizing: función **pura** nueva en `libs/trading-engine`. `factor = min(aegis × verdict, forge)`, `factor ∈ [0,1]` ⇒ el techo `balance × maxTradePct` es matemáticamente inviolable                                              | Ninguno                                   |
| **D7**  | `AegisVerdict.blockReasons: AegisBlockReason[]` tipado + regla estructurada **fail-closed**; el regex `isFalseConcentrationBlock` se borra. Contrato en el **user prompt (código)**, no solo en el seed de BD                   | Ninguno                                   |
| **D8**  | Máquina de estados de la posición (trailing / parcial / tiempo) persistida en 7 columnas de `Position` y evaluada en `checkOpenPositions` con **orden de prioridad fijo**                                                       | (incluido en D4)                          |
| **D9**  | `Trade.decisionId` nullable con FK `ON DELETE SET NULL`, sin backfill                                                                                                                                                           | `trades.decision_id` + FK + índice        |
| **D10** | Tablas huérfanas: **se dropean** `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies`. Reverse SQL completo en §11.3                                                                                      | 2 tablas y 1 enum eliminados              |
| **D11** | Fusión `ResolvedAgentConfig`/`ResolvedAgentClient` → `ResolvedAgentModel` + `toAgentId(slot)` en `agent-identity.ts` (mapa, no cast)                                                                                            | Ninguno                                   |

**Total de cambios de BD: 5 migraciones** (4 aditivas + 1 de limpieza). Ninguna hace backfill de datos.

### 0.1 Invariante rector del ciclo

> **Una instalación existente que despliegue este ciclo y no toque su configuración debe producir,
> ciclo a ciclo, exactamente las mismas órdenes que producía antes.**

Se cumple porque los 6 interruptores nuevos (`lossCutEnabled`, `smartSizingEnabled`,
`nativeProtectionEnabled`, `trailingStopEnabled`, `partialTpEnabled`, `maxPositionHoldMinutes`)
nacen apagados y `user_risk_policies` nace **sin fila**. Es la condición de CA-003, CA-017,
CA-021 y CA-025, y el Reviewer debe poder verificarla leyendo únicamente los `DEFAULT` del SQL.

---

## 1. Evidencia leída antes de decidir

| Archivo                                                          | Líneas | Qué se verificó                                                                                                                                                                     |
| ---------------------------------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/trading/trading.processor.ts`                      |   1150 | Veto SELL en 879-889; `executeBuy` 646-819 (2 ramas: SANDBOX / LIVE-TESTNET); `checkOpenPositions` 977-1136; **4 puntos de creación de `Trade`**, ninguno con `decisionId`          |
| `apps/api/src/trading/trading.service.ts`                        |   1044 | `updateConfig` hace `data: {...dto}` — cualquier campo del DTO llega a Prisma sin whitelist propia; la whitelist es el `ValidationPipe` global                                      |
| `libs/trading-engine/src/lib/order-executor.ts`                  |    196 | `OrderExecutorPort` = 3 métodos; `calculateTradeQuantity` (164-173) es `balance × maxTradePct / price` con floor a 8 decimales; `SandboxOrderExecutor` mantiene balances en memoria |
| `libs/trading-engine/src/lib/position-manager.ts`                |    113 | `closePosition` asume **salida total**; `shouldStopLoss/shouldTakeProfit` son puros sobre `entryPrice`                                                                              |
| `libs/trading-engine/src/lib/risk/trade-simulation.ts`           |     78 | `simulateTrade` devuelve `downsideUsd = notional×stopLossPct + fees + slippage`; con `stopLossPct = 0` el `downsideUsd` **es exactamente la fricción de salida**                    |
| `libs/data-fetcher/src/lib/binance/binance-rest.client.ts`       |    364 | Solo MARKET; `ENDPOINT_WEIGHTS` (15-27); `signedRequest` firma `URLSearchParams` con `recvWindow: 60000`; `getLotSizeFilter` cachea **solo LOT_SIZE**                               |
| `apps/api/src/orchestrator/orchestrator.service.ts`              |    731 | Regex 458-461; `aegisVerdict` se parsea (450) y se **descarta** salvo `verdict === 'BLOCK'`; `positionSizeMultiplier` no sale nunca del método                                      |
| `apps/api/src/orchestrator/dto/decision-synthesis.dto.ts`        |      — | `AegisVerdict` y `DecisionPayload` — `DecisionPayload` no transporta ni riesgo ni sizing                                                                                            |
| `apps/api/src/orchestrator/sub-agent.service.ts`                 |   ~750 | `buildTaskUserPrompt('risk_gate')` y `('sizing_suggestion')` — el contrato JSON de FORGE está **en código**; el de AEGIS solo en el system prompt de BD                             |
| `apps/api/prisma/seed/agents.ts`                                 |    414 | `RISK_SYSTEM_PROMPT` l. 283-330; formato JSON de AEGIS en l. 328                                                                                                                    |
| `apps/api/src/agents/domain/risk-budget.service.ts` + spec       |    178 | `assess()` es **per-config**; usa `agentBudgetPolicy.dailyUsdBudget` (presupuesto **de LLM**) como límite de pérdida y `MAX_DRAWDOWN_PCT = 0.1` **constante**                       |
| `apps/api/src/agents/domain/portfolio-context.service.ts` + spec |    178 | `build()` ya agrega **entre configs** cuando `configId` se omite; `notionalAtEntryUsd`, `wallets`, `realizedPnlUsd` ya calculados y testeados                                       |
| `apps/api/src/agents/agent-config-resolver.service.ts`           |   ~250 | `ResolvedAgentConfig.agentId: AgentId` vs `ResolvedAgentClient.slot: ModelSlotId`; casts en l. 124 y 202                                                                            |
| `apps/api/src/agents/evaluation/evaluation.processor.ts`         |   ~190 | `findUnique` + `create` sin transacción (l. 44-53 y el create posterior) → ventana P2002 real                                                                                       |
| `apps/api/prisma/schema.prisma`                                  |    756 | `TradingConfig` 251-279, `Position` 281-304, `Trade` 306-324, `AgentDecision` 326-352, `AgentModelPolicy` 686-706, `AgentToolInvocation` 708-731                                    |
| `apps/api/src/prisma/prisma.service.ts`                          |      — | Getters explícitos por modelo: dropear un modelo obliga a borrar su getter                                                                                                          |
| `apps/api/src/main.ts`                                           |      — | `setGlobalPrefix('api')` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`                                                                                        |

### 1.1 Hallazgos que condicionan el diseño (no estaban en el brief)

1. **`ValidationPipe` con `forbidNonWhitelisted: true`.** Un campo nuevo de `TradingConfig` que no
   esté declarado en `CreateTradingConfigDto`/`UpdateTradingConfigDto` hace que el request entero
   responda **400**, no que se ignore el campo. Los DTO son parte obligatoria de la task de schema,
   aunque la UI quede fuera de alcance.
2. **`RiskBudgetService.assess()` confunde dos presupuestos.** Usa `AgentBudgetPolicy.dailyUsdBudget`
   —que es el presupuesto de **gasto de LLM** (default $5)— como límite de **pérdida de trading**.
   Es la razón principal de D2: el límite agregado no puede vivir ahí. `assess()` **no se toca**
   (sus tests son el contrato vigente): se agrega `assessAggregate()`.
3. **Una OCO bloquea el balance base.** Con protección nativa activa, la cantidad de la posición
   queda `locked` en Binance; un `placeMarketOrder(SELL)` posterior fallaría por saldo insuficiente.
   ⇒ **todo camino de salida debe cancelar la protección antes de vender** (§5.4). Esto no está en
   ninguna HU y es el modo de falla más probable del ciclo si se omite.
4. **El `SandboxOrderExecutor` se construye nuevo en cada ciclo** (`trading.processor.ts:999`), así
   que no puede sostener estado de órdenes entre ciclos. ⇒ la protección nativa es **solo LIVE/TESTNET**;
   en SANDBOX la protección sigue siendo el polling de `checkOpenPositions` (§5.6).
5. **El system prompt de AEGIS vive en BD** (`AgentDefinition`, servido por `AgentPromptService`).
   Cambiar el seed **no** cambia el prompt de una instalación ya seedeada. ⇒ el contrato de
   `blockReasons` se declara además en el **user prompt** que se construye en código (§7.3).

---

## 2. D1 — Campos nuevos de `TradingConfig`

Todos `NOT NULL` con `DEFAULT`, salvo `maxPositionHoldMinutes` (nullable = apagado).

### 2.1 Política de SELL (RF-01, HU-02-01)

| Campo                        | Tipo Prisma | Default | Semántica                                                                             |
| ---------------------------- | ----------- | ------: | ------------------------------------------------------------------------------------- |
| `lossCutEnabled`             | `Boolean`   | `false` | Interruptor maestro del corte de pérdida por señal. **`false` = veto actual intacto** |
| `lossCutConfidenceThreshold` | `Float`     |  `0.85` | Confianza mínima (0..1) del agente para habilitar la venta en pérdida                 |
| `lossCutMinLossPct`          | `Float`     | `0.005` | Pérdida mínima (fracción) para considerar el corte — evita churn por ruido            |
| `lossCutMinEdgeRatio`        | `Float`     |     `2` | Múltiplo de fricción de salida que la pérdida evitada debe superar (§4.2)             |

### 2.2 Sizing (RF-02, HU-02-02)

| Campo                | Tipo      | Default | Semántica                                                                                       |
| -------------------- | --------- | ------: | ----------------------------------------------------------------------------------------------- |
| `smartSizingEnabled` | `Boolean` | `false` | `false` ⇒ `executeBuy` usa `calculateTradeQuantity` tal cual hoy (factor 1, sin AEGIS ni FORGE) |
| `reduceSizeFactor`   | `Float`   |   `0.5` | Factor aplicado cuando el verdict de AEGIS es `REDUCE`                                          |

### 2.3 Protección nativa (RF-03, HU-02-03)

| Campo                      | Tipo      | Default | Semántica                                                                                                                 |
| -------------------------- | --------- | ------: | ------------------------------------------------------------------------------------------------------------------------- |
| `nativeProtectionEnabled`  | `Boolean` | `false` | Coloca OCO real al abrir posición (solo LIVE/TESTNET)                                                                     |
| `closeOnProtectionFailure` | `Boolean` | `false` | Opt-in agresivo: cerrar a mercado si la protección no se logra colocar tras los reintentos (§5.3)                         |
| `stopLimitOffsetPct`       | `Float`   | `0.002` | Distancia entre `stopPrice` y el `price` límite de la pierna STOP_LOSS_LIMIT (0.2%), para que llene en un hueco de precio |

### 2.4 Herramientas de ganancia (RF-05, HU-02-05)

| Campo                             | Tipo      | Default | Semántica                                                                         |
| --------------------------------- | --------- | ------: | --------------------------------------------------------------------------------- |
| `trailingStopEnabled`             | `Boolean` | `false` | Activa el trailing. **Mientras esté activo, el TP fijo queda desactivado** (§8.2) |
| `trailingStopPct`                 | `Float`   |  `0.02` | Distancia del stop bajo el máximo visto                                           |
| `trailingActivationPct`           | `Float`   |  `0.01` | Ganancia no realizada mínima para empezar a trailear                              |
| `partialTpEnabled`                | `Boolean` | `false` | Activa la venta parcial escalonada                                                |
| `partialTpTriggerPct`             | `Float`   |  `0.02` | Ganancia que dispara el parcial                                                   |
| `partialTpSellPct`                | `Float`   |   `0.5` | Fracción de la posición que se vende en el parcial                                |
| `moveStopToBreakevenAfterPartial` | `Boolean` |  `true` | Tras el parcial, sube el stop a breakeven **neto de fees** (§8.3)                 |
| `maxPositionHoldMinutes`          | `Int?`    |  `null` | `null` = salida por tiempo apagada                                                |

> `moveStopToBreakevenAfterPartial` es `true` por default y **no viola el invariante 0.1**: solo se
> evalúa dentro de la rama `partialTpEnabled`, que nace en `false`.

### 2.5 Rangos de validación en los DTO (obligatorio por `forbidNonWhitelisted`)

Ambos DTO (`CreateTradingConfigDto`, `UpdateTradingConfigDto`) reciben los 15 campos como
`@IsOptional()` con:

| Campo                                                                                                                                                                       | Validadores                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `lossCutEnabled`, `smartSizingEnabled`, `nativeProtectionEnabled`, `closeOnProtectionFailure`, `trailingStopEnabled`, `partialTpEnabled`, `moveStopToBreakevenAfterPartial` | `@IsBoolean()`                    |
| `lossCutConfidenceThreshold`                                                                                                                                                | `@IsNumber() @Min(0) @Max(1)`     |
| `lossCutMinLossPct`                                                                                                                                                         | `@IsNumber() @Min(0) @Max(0.5)`   |
| `lossCutMinEdgeRatio`                                                                                                                                                       | `@IsNumber() @Min(0) @Max(100)`   |
| `reduceSizeFactor`, `partialTpSellPct`                                                                                                                                      | `@IsNumber() @Min(0.05) @Max(1)`  |
| `stopLimitOffsetPct`                                                                                                                                                        | `@IsNumber() @Min(0) @Max(0.05)`  |
| `trailingStopPct`, `trailingActivationPct`, `partialTpTriggerPct`                                                                                                           | `@IsNumber() @Min(0.001) @Max(1)` |
| `maxPositionHoldMinutes`                                                                                                                                                    | `@IsInt() @Min(5) @Max(43200)`    |

---

## 3. D2 — `user_risk_policies`: por qué tabla nueva y no `TradingConfig`

**Descartado — `TradingConfig`:** el límite es _entre_ configs; ponerlo en cada config obliga a
elegir cuál gana cuando dos difieren, y a mantenerlas sincronizadas.
**Descartado — `AgentBudgetPolicy`:** es el presupuesto de **costo de LLM** (tokens/USD/decisión).
`RiskBudgetService` ya lo usa mal como límite de pérdida (hallazgo 1.1-2); reforzar esa confusión
haría inseparables "gasté $5 en modelos" y "perdí $5 operando".

**Tabla nueva `user_risk_policies`, 1:1 con `User`.** Sin fila ⇒ límites inactivos ⇒ CA-025.

| Columna                 | Tipo              | Default | Semántica                                                                                  |
| ----------------------- | ----------------- | ------: | ------------------------------------------------------------------------------------------ |
| `id`                    | `String @id cuid` |       — |                                                                                            |
| `userId`                | `String @unique`  |       — | FK `users(id) ON DELETE CASCADE`                                                           |
| `enabled`               | `Boolean`         | `false` | Interruptor maestro; `false` ⇒ el gate resuelve `allowed` sin consultar nada más           |
| `maxAssetExposureUsd`   | `Float?`          |  `null` | Techo de exposición nocional por activo sumada entre todas las configs del usuario         |
| `maxAssetExposurePct`   | `Float?`          |  `null` | Ídem en fracción del equity (wallets + exposición). Se evalúan ambos; gana el más estricto |
| `maxDailyLossUsd`       | `Float?`          |  `null` | Pérdida realizada máxima del **día UTC** en toda la cuenta                                 |
| `maxDrawdownPct`        | `Float?`          |  `null` | Drawdown del día sobre el equity de inicio de día que dispara la pausa                     |
| `pauseAgentsOnDrawdown` | `Boolean`         |  `true` | Si el drawdown cruza, `isRunning = false` en **todas** las configs del usuario             |
| `pausedAt`              | `DateTime?`       |  `null` | Marca de la última pausa automática (observabilidad + evita re-notificar)                  |
| `pausedReason`          | `String?`         |  `null` | `DRAWDOWN` \| `DAILY_LOSS`                                                                 |
| `createdAt`/`updatedAt` | `DateTime`        |       — |                                                                                            |

> `pauseAgentsOnDrawdown = true` no viola el invariante: solo se lee si `enabled = true` **y**
> `maxDrawdownPct != null`, y la fila no existe por default.

---

## 4. D3+D6 — Política de SELL y sizing: funciones puras en `libs/trading-engine`

Ambas piezas son **aritmética determinista sin Prisma, sin Nest y sin LLM** ⇒ van a la lib, no al
processor. Es lo que hace que CA-001…CA-009 sean tests unitarios sin BD.

### 4.1 Archivo nuevo `libs/trading-engine/src/lib/sizing.ts` (exportado por el barrel)

```ts
export type AegisVerdictValue = 'PASS' | 'REDUCE' | 'BLOCK';

export interface TradeSizingInput {
  balance: number;
  price: number;
  maxTradePct: number;
  verdict?: AegisVerdictValue;
  positionSizeMultiplier?: number;
  forgeMaxTradePct?: number | null;
  forgeRecommendation?: 'proceed' | 'skip';
  reduceSizeFactor?: number;
}

export interface TradeSizingResult {
  quantity: number;
  ceilingQuantity: number;
  effectiveFactor: number;
  factors: { aegis: number; verdict: number; forge: number };
  blockedBy: 'AEGIS_BLOCK' | 'FORGE_SKIP' | 'ZERO_SIZE' | null;
}

export function resolveTradeQuantity(
  input: TradeSizingInput,
): TradeSizingResult;
```

**Fórmula exacta:**

```
ceilingQuantity = calculateTradeQuantity(balance, price, maxTradePct)      // función existente, sin tocar

aegis   = clamp(positionSizeMultiplier ?? 1, 0, 1)
verdict = verdict === 'REDUCE' ? clamp(reduceSizeFactor ?? 0.5, 0, 1) : 1
forge   = forgeRecommendation === 'skip' ? 0
        : forgeMaxTradePct == null ? 1
        : clamp(forgeMaxTradePct / maxTradePct, 0, 1)

effectiveFactor = min(aegis * verdict, forge)
quantity        = floor8(ceilingQuantity * effectiveFactor)

blockedBy = verdict === 'BLOCK' ? 'AEGIS_BLOCK'
          : forge === 0        ? 'FORGE_SKIP'
          : quantity <= 0      ? 'ZERO_SIZE' : null
```

**Por qué así, y qué queda decidido (el implementor no elige nada de esto):**

- `clamp(·, 0, 1)` en **cada** factor ⇒ `effectiveFactor ∈ [0,1]` ⇒ `quantity ≤ ceilingQuantity`
  para **cualquier** entrada, incluidos `positionSizeMultiplier = 3` o `forgeMaxTradePct = 0.9`
  con `maxTradePct = 0.05`. Eso es CA-009, y se demuestra por construcción, no por casos.
- **Contradicción AEGIS vs FORGE ⇒ gana el más conservador**: `min`, no promedio ni producto.
  CA-007 pide literalmente "nunca supera el menor de los dos valores".
- **`REDUCE` reduce, no bloquea** (RN-04): entra como factor `0.5`, no como corte. CA-008 se
  verifica comparando `resolveTradeQuantity` con y sin `verdict: 'REDUCE'`.
- **FORGE `skip` ⇒ factor 0 ⇒ no hay orden** (`blockedBy: 'FORGE_SKIP'`). Honrar `maxTradeSize` de
  FORGE e ignorar su `recommendation` es incoherente: el campo existe para eso. No es un "BLOCK"
  de AEGIS: es tamaño cero, y el processor lo registra distinto en el log.
- `floor8` = `Math.floor(q * 1e8) / 1e8`, idéntico al redondeo de `calculateTradeQuantity`.
- **Dónde vive la modulación:** en la lib (pura). El processor solo **provee** las entradas y aplica
  el resultado; no reimplementa ninguna parte del cálculo.

### 4.2 Archivo nuevo `libs/trading-engine/src/lib/sell-policy.ts`

```ts
export type SellPath = 'TAKE_PROFIT' | 'LOSS_CUT' | 'NONE';

export interface SellPolicyConfig {
  minProfitPct: number;
  lossCutEnabled: boolean;
  lossCutConfidenceThreshold: number;
  lossCutMinLossPct: number;
  lossCutMinEdgeRatio: number;
}

export interface SellPolicyInput {
  asset: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLossPct: number;
  signalConfidence: number | null | undefined;
  config: SellPolicyConfig;
}

export interface SellPolicyDecision {
  allow: boolean;
  path: SellPath;
  profitPct: number;
  avoidedLossUsd: number;
  exitFrictionUsd: number;
  edgeRatio: number;
  reason: string;
}

export function evaluateSellPolicy(input: SellPolicyInput): SellPolicyDecision;
```

**Algoritmo (dos caminos independientes — RN-01):**

```
profitPct = (currentPrice - entryPrice) / entryPrice

1) TOMA DE GANANCIA
   if (profitPct >= config.minProfitPct) -> { allow: true, path: 'TAKE_PROFIT' }
   // idéntico al comportamiento actual  → CA-004 (profit positivo bajo el piso sigue rechazado)

2) CORTE DE PÉRDIDA POR SEÑAL   (solo si el camino 1 no aplicó)
   if (!config.lossCutEnabled)                                  -> NONE   // CA-003
   if (!Number.isFinite(signalConfidence) ||
        signalConfidence < 0 || signalConfidence > 1)           -> NONE   // CE-01, fail-closed
   if (profitPct >= 0)                                          -> NONE
   if (Math.abs(profitPct) < config.lossCutMinLossPct)          -> NONE
   if (signalConfidence < config.lossCutConfidenceThreshold)    -> NONE   // CA-001

   stopPrice       = entryPrice * (1 - stopLossPct)
   avoidedLossUsd  = Math.max(0, (currentPrice - stopPrice) * quantity)
   exitFrictionUsd = simulateTrade({ asset, side: 'SELL', price: currentPrice,
                                     quantity, stopLossPct: 0, takeProfitPct: 0 }).downsideUsd
   edgeRatio       = exitFrictionUsd > 0 ? avoidedLossUsd / exitFrictionUsd : 0

   if (edgeRatio < config.lossCutMinEdgeRatio)                  -> NONE
   -> { allow: true, path: 'LOSS_CUT' }                                    // CA-002
```

**Por qué el `riskRewardRatio` de `simulateTrade` entra por acá y no como "rr de seguir sosteniendo":**
con `stopLossPct = 0`, `simulateTrade` devuelve `downsideUsd = feesUsd + slippageUsd`, es decir **el
costo exacto de salirse ahora** (fee 0.1% + slippage por activo de `SLIPPAGE_PCT_BY_ASSET`). La
alternativa evaluada —`riskRewardRatio` del tramo que resta hasta TP/SL— fue **descartada** porque
tiende a infinito a medida que el precio se acerca al stop (el downside restante tiende a 0), o sea
recomendaría sostener justo cuando el corte importa. La regla adoptada dice algo defendible en una
línea: _cortar antes del stop solo si lo que ahorro supera al menos N veces lo que me cuesta salir_.

**Números de referencia para los fixtures de CA-002 / CA-001** (BTC, fee 0.1%, slippage 0.05%):

| entry | stop (3%) | precio actual | avoidedLoss |  fricción | edgeRatio | Con `confidence 0.9 / thr 0.85`    |
| ----: | --------: | ------------: | ----------: | --------: | --------: | ---------------------------------- |
|   100 |        97 |            98 |  1.00 × qty | 0.147×qty |      6.80 | **LOSS_CUT** (CA-002)              |
|   100 |        97 |          97.1 |  0.10 × qty | 0.146×qty |      0.69 | NONE (el stop ya está encima)      |
|   100 |        97 |            98 |  1.00 × qty | 0.147×qty |      6.80 | NONE con `confidence 0.5` (CA-001) |

### 4.3 Reemplazo exacto en `trading.processor.ts`

`executeLLMSell`, líneas 879-889 — el bloque

```ts
const minProfitPct: number = config.minProfitPct ?? 0.003;
if (profitPct < minProfitPct) { ...; continue; }
```

se sustituye por una llamada a `evaluateSellPolicy(...)` con `signalConfidence = decision.confidence`
(el `0..1` que ya viaja en `DecisionPayload`; **no** el `confidencePct` del threshold). Si
`!allow` ⇒ `continue` con el `reason` en el log. Si `allow` ⇒ ruta de venta, con
`Position.exitReason = LLM_SIGNAL` para `TAKE_PROFIT` y `LOSS_CUT` para el corte.

`executeLLMSell` recibe dos parámetros nuevos: `decisionId: string` y `signalConfidence: number`.

---

## 5. D3 — Órdenes nativas de Binance spot

### 5.1 Contrato nuevo de `BinanceRestClient` (`libs/data-fetcher`)

```ts
export interface SymbolFilters {
  lotSize:  { minQty: number; maxQty: number; stepSize: number };
  price:    { minPrice: number; maxPrice: number; tickSize: number };
  notional: { minNotional: number; applyToMarket: boolean };
}

export type OrderValidationCode =
  | 'LOT_SIZE' | 'PRICE_FILTER' | 'MIN_NOTIONAL' | 'PRICE_CROSSES_MARKET';

export class OrderValidationError extends Error {
  constructor(readonly code: OrderValidationCode, message: string);
}

export interface OcoOrderResult {
  orderListId: string;
  listClientOrderId: string;
  stopOrderId: string;
  limitOrderId: string;
  symbol: string;
  quantity: number;
  placedAt: Date;
}

export type ExchangeOrderState = 'ACTIVE' | 'FILLED' | 'CANCELLED' | 'MISSING';

export interface ExchangeOrderStatus {
  state: ExchangeOrderState;
  filledLeg: 'STOP' | 'TAKE_PROFIT' | null;
  executedPrice: number | null;
  executedQuantity: number | null;
  orderId: string | null;
}

class BinanceRestClient {
  getSymbolFilters(symbol: string): Promise<SymbolFilters>;
  placeLimitOrder(symbol, side: 'BUY'|'SELL', quantity, price,
                  opts?: { timeInForce?: 'GTC'|'IOC'|'FOK'; clientOrderId?: string }): Promise<OrderResult>;
  placeStopLossLimitOrder(symbol, side: 'BUY'|'SELL', quantity, stopPrice, limitPrice,
                  opts?: { clientOrderId?: string }): Promise<OrderResult>;
  placeOcoSellOrder(symbol, params: {
    quantity: number; takeProfitPrice: number; stopPrice: number;
    stopLimitPrice: number; listClientOrderId?: string; referencePrice?: number;
  }): Promise<OcoOrderResult>;
  getOrderStatus(symbol: string, orderId: string): Promise<ExchangeOrderStatus>;
  getOcoStatus(symbol: string, orderListId: string): Promise<ExchangeOrderStatus>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  cancelOcoOrderList(symbol: string, orderListId: string): Promise<void>;
  getOpenOrders(symbol: string): Promise<Array<{ orderId: string; clientOrderId: string; orderListId: string | null }>>;
}
```

### 5.2 Endpoints, params y pesos (spot real)

| Método                    | Endpoint                     | Params firmados (además de `timestamp`, `recvWindow`, `signature`)                                                                                                                                               | Peso |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: |
| `placeLimitOrder`         | `POST /api/v3/order`         | `symbol`, `side`, `type=LIMIT`, `timeInForce=GTC`, `quantity`, `price`, `newClientOrderId?`                                                                                                                      |    1 |
| `placeStopLossLimitOrder` | `POST /api/v3/order`         | `symbol`, `side`, `type=STOP_LOSS_LIMIT`, `timeInForce=GTC`, `quantity`, `price`, `stopPrice`, `newClientOrderId?`                                                                                               |    1 |
| `placeOcoSellOrder`       | `POST /api/v3/orderList/oco` | `symbol`, `side=SELL`, `quantity`, `aboveType=LIMIT_MAKER`, `abovePrice`(=TP), `belowType=STOP_LOSS_LIMIT`, `belowStopPrice`, `belowPrice`, `belowTimeInForce=GTC`, `listClientOrderId`, `newOrderRespType=FULL` |    1 |
| `getOrderStatus`          | `GET /api/v3/order`          | `symbol`, `orderId`                                                                                                                                                                                              |    4 |
| `getOcoStatus`            | `GET /api/v3/orderList`      | `orderListId`                                                                                                                                                                                                    |    4 |
| `cancelOrder`             | `DELETE /api/v3/order`       | `symbol`, `orderId`                                                                                                                                                                                              |    1 |
| `cancelOcoOrderList`      | `DELETE /api/v3/orderList`   | `symbol`, `orderListId`                                                                                                                                                                                          |    1 |
| `getOpenOrders`           | `GET /api/v3/openOrders`     | `symbol` (**siempre con símbolo**: sin él el peso salta a 80)                                                                                                                                                    |    6 |

Estos pesos se agregan a `ENDPOINT_WEIGHTS`; `/api/v3/orderList` necesita entradas separadas por
método porque GET pesa 4 y DELETE 1. La firma reutiliza `signedRequest` **sin cambios** (mismo
HMAC-SHA256 sobre el query string con `recvWindow: 60000`).

> Se usa `/api/v3/orderList/oco` (API vigente, `aboveType`/`belowType`), **no** el legacy
> `/api/v3/order/oco` con `stopPrice`/`stopLimitPrice`/`price`. `LIMIT_MAKER` para la pierna de TP es
> lo que garantiza que la OCO no pague fee taker si el precio salta.

### 5.3 Validación local previa (CA-011) — se rechaza **antes** de firmar

`getSymbolFilters` extiende el caché estático actual (que hoy guarda solo `LOT_SIZE`) para leer
también `PRICE_FILTER` y `NOTIONAL`/`MIN_NOTIONAL` de `/api/v3/exchangeInfo?symbol=…`.
Fallback cuando el filtro no existe: `stepSize/tickSize = 1e-8`, `minQty/minPrice = 0`,
`minNotional = 0` (mismo criterio permisivo que el `getLotSizeFilter` actual).

| Regla                          | Ajuste                                                                                 | Error si no se puede cumplir                   |
| ------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Cantidad                       | `floor` al `stepSize`; debe quedar en `[minQty, maxQty]`                               | `OrderValidationError('LOT_SIZE')`             |
| Precio de venta TP             | `ceil` al `tickSize` (redondear hacia arriba mantiene el LIMIT_MAKER sobre el mercado) | `OrderValidationError('PRICE_FILTER')`         |
| `stopPrice` y `stopLimitPrice` | `floor` al `tickSize`                                                                  | `OrderValidationError('PRICE_FILTER')`         |
| Notional                       | `price × quantity ≥ minNotional` en **ambas** piernas                                  | `OrderValidationError('MIN_NOTIONAL')`         |
| Cruce de mercado               | con `referencePrice`: exige `takeProfitPrice > referencePrice > stopPrice`             | `OrderValidationError('PRICE_CROSSES_MARKET')` |

La última regla evita el `-2010 Order would trigger immediately` del exchange, que es el rechazo más
común al colocar OCO justo después de una compra en un mercado que se movió.

Códigos de Binance que el cliente debe distinguir al parsear el error (`error.response.data.code`):

| Código          | Significado                      | ¿Reintentable?                                            |
| --------------- | -------------------------------- | --------------------------------------------------------- |
| `-1021`         | timestamp fuera de `recvWindow`  | **sí**                                                    |
| `-1001`/`-1000` | error interno / desconocido      | **sí**                                                    |
| `429` / `-1003` | rate limit                       | **sí** (respeta `Retry-After`, tope 5 s dentro del ciclo) |
| `-1013`         | filtro (LOT_SIZE/PRICE/NOTIONAL) | no                                                        |
| `-2010`         | orden rechazada (saldo, cruce)   | no                                                        |
| `-2011`         | cancelación rechazada            | no                                                        |
| `-2013`         | la orden no existe               | no (⇒ `MISSING` en reconciliación)                        |

### 5.4 Extensión de `OrderExecutorPort`

```ts
export interface ProtectionOrderRequest {
  symbol: string;
  quantity: number;
  stopPrice: number;
  stopLimitPrice: number;
  takeProfitPrice: number;
  referencePrice: number;
  clientOrderId?: string;
}

export interface ProtectionOrderRef {
  orderListId?: string | null;
  stopOrderId?: string | null;
}

export interface ProtectionOrderResult {
  kind: 'OCO' | 'SIMULATED';
  orderListId: string | null;
  stopOrderId: string | null;
  limitOrderId: string | null;
  placedAt: Date;
}

export interface OrderExecutorPort {
  placeMarketOrder(symbol, side: TradeType, quantity): Promise<OrderResult>;
  getBalance(asset: string): Promise<Balance>;
  getPrice(symbol: string): Promise<number>;
  placeLimitOrder(
    symbol,
    side: TradeType,
    quantity,
    price,
  ): Promise<OrderResult>;
  placeStopLossLimitOrder(
    symbol,
    side: TradeType,
    quantity,
    stopPrice,
    limitPrice,
  ): Promise<OrderResult>;
  placeProtectionOrder(
    req: ProtectionOrderRequest,
  ): Promise<ProtectionOrderResult>;
  getProtectionOrderStatus(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<ExchangeOrderStatus>;
  cancelProtectionOrder(symbol: string, ref: ProtectionOrderRef): Promise<void>;
}
```

> **Regla no negociable (hallazgo 1.1-3):** todo camino que ejecute un `placeMarketOrder(SELL)` sobre
> una posición con `protectionStatus = PROTECTED` llama primero a `cancelProtectionOrder` y deja
> `protectionStatus = RELEASED`. Aplica a `executeLLMSell`, a la salida por stop/TP/trailing/tiempo de
> `checkOpenPositions`, al parcial de TP y a `closePositionManually` de `TradingService`. Sin esto la
> venta falla con `-2010` por saldo bloqueado en la OCO.

### 5.5 `LiveOrderExecutor`

Delega 1:1 en el cliente. Su constructor tipa hoy un objeto estructural con 3 métodos; se amplía a
los 8 (o se tipa directamente contra `BinanceRestClient`). `placeProtectionOrder` llama a
`placeOcoSellOrder` y mapea `OcoOrderResult → ProtectionOrderResult{ kind: 'OCO' }`.

### 5.6 `SandboxOrderExecutor` — simulación local documentada

No hay exchange: la protección se simula **en memoria** dentro del executor.

- `placeProtectionOrder`: guarda `{ id: 'sandbox-oco-<n>', stopPrice, takeProfitPrice, quantity }` en
  un `Map`, mueve `quantity` del `free` al `locked` del activo base y devuelve `kind: 'SIMULATED'`.
- `getProtectionOrderStatus`: compara el precio de `setPrice(symbol, …)` contra los niveles
  guardados → `FILLED` con `filledLeg: 'STOP'` si `price ≤ stopPrice`, `'TAKE_PROFIT'` si
  `price ≥ takeProfitPrice`, `ACTIVE` en otro caso, `MISSING` si el id no está en el `Map`.
- `cancelProtectionOrder`: borra la entrada y devuelve `locked → free`.

**Alcance real de SANDBOX:** como el executor se instancia por ciclo (`trading.processor.ts:999`), el
`Map` no sobrevive entre ciclos. Por eso `nativeProtectionEnabled` **se ignora en modo SANDBOX**: las
posiciones SANDBOX quedan con `protectionStatus = NONE` y siguen protegidas por el polling de
`checkOpenPositions`, igual que hoy. La simulación existe para testear el contrato del port sin red
(CA-010/CA-012), no para dar protección persistente en papel.

---

## 6. D4 — Caso crítico: compra ejecutada + protección rechazada

Secuencia exacta de `executeBuy` (LIVE/TESTNET con `nativeProtectionEnabled`):

```
1. placeMarketOrder(BUY)                       → order FILLED
2. prisma.position.create(... protectionStatus: PENDING,
                              stopPrice: order.price*(1-stopLossPct),
                              takeProfitPrice: order.price*(1+takeProfitPct),
                              highWaterPrice: order.price,
                              initialQuantity: order.quantity)
   prisma.trade.create(... decisionId)         → la compra queda registrada SIEMPRE, protegida o no
3. placeProtectionOrder(...) con reintentos:
     intentos = 3, backoff 250ms → 1000ms → 3000ms (jitter ±20%)
     solo se reintenta ante códigos reintentables (§5.3); un -1013/-2010 corta al primer intento
     listClientOrderId = `prot-{positionId}-{attempt}`   ← attempt = protectionFailureCount + 1,
                                                            persistido ANTES de cada llamada
4a. éxito  → protectionStatus: PROTECTED, protectionOrderListId/StopOrderId/LimitOrderId,
             protectionPlacedAt = now, protectionLastError = null
4b. agotado→ protectionStatus: UNPROTECTED, protectionFailureCount += 1,
             protectionLastError = `${code}:${msg}`.slice(0,180)
             notificación AGENT_ERROR  key `positionUnprotected`
             gateway.emitToUser(userId, 'position:unprotected', { positionId, error })
             si config.closeOnProtectionFailure === true:
                 placeMarketOrder(SELL, quantity) → cierre inmediato,
                 exitReason = PROTECTION_FAILURE, notificación STOP_LOSS_TRIGGERED
5. La reconciliación del ciclo siguiente reintenta la colocación de toda posición OPEN
   con protectionStatus ∈ {PENDING, UNPROTECTED} (§7).
```

**Decisión y justificación (el brief exige elegir):** el default **no cierra** la posición.
Cerrar a mercado por un timeout de red realiza una pérdida provocada por la infraestructura, no por
el mercado; y una posición sin OCO **no está menos protegida que hoy** — el polling de
`checkOpenPositions` sigue corriendo cada ciclo y es exactamente la protección que existía antes de
este ciclo. Lo que sí se elimina es la **ambigüedad**: `UNPROTECTED` es un estado explícito,
notificado, visible por WebSocket y reintentado en cada ciclo (RN-06, CA-013, CE-02). Para el usuario
que prefiere la postura agresiva está `closeOnProtectionFailure` (default `false`).

`listClientOrderId` determinista por intento cumple la doble función: **dedupe** dentro de un intento
(si el POST llegó pero la respuesta se perdió, el reintento choca contra "Duplicate order sent" y la
reconciliación lo encuentra vivo) y **habilita** la re-colocación en el intento siguiente.

---

## 7. D5 — Reconciliación al inicio de ciclo

**Ubicación:** servicio nuevo `apps/api/src/trading/reconciliation.service.ts`, invocado como
**paso 0 de `runCycle`**, antes del health check del LLM y de cualquier llamada al modelo (RN-07).
Se ejecuta solo para `mode ∈ {LIVE, TESTNET}` y con credenciales presentes; en SANDBOX es un no-op.

```ts
export interface ReconciliationOutcome {
  checked: number;
  closedByExchange: number;
  reprotected: number;
  stillUnprotected: number;
  orphanOrdersCancelled: number;
}

reconcile(input: {
  userId: string; config: TradingConfig; symbol: string;
  executor: OrderExecutorPort;
}): Promise<ReconciliationOutcome>;
```

### 7.1 Qué se compara y cómo se resuelve

| Estado local                                     | Estado en el exchange             | Resolución                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPEN` + `PROTECTED`                             | `ACTIVE`                          | no-op                                                                                                                                                                                         |
| `OPEN` + `PROTECTED`                             | `FILLED` (leg STOP o TAKE_PROFIT) | cierre local con el precio y la cantidad ejecutados; `exitReason = EXCHANGE_STOP`/`EXCHANGE_TAKE_PROFIT`; `Trade` SELL con `binanceOrderId` de la pierna llena y `decisionId = null` (CA-014) |
| `OPEN` + `PROTECTED`                             | `CANCELLED` / `MISSING`           | `protectionStatus = UNPROTECTED` → reintento de colocación (§6 pasos 3-4); si vuelve a fallar, queda `UNPROTECTED` + notificación (CA-015)                                                    |
| `OPEN` + `PENDING` / `UNPROTECTED`               | —                                 | intento de colocación con la política de §6                                                                                                                                                   |
| `CLOSED` (o inexistente) con orden `prot-…` viva | orden abierta                     | `cancelOrder`/`cancelOcoOrderList` — evita que una OCO zombie venda activos después (barrido por `getOpenOrders(symbol)`, filtrando `clientOrderId` que empiece con `prot-`)                  |
| `OPEN` + `NONE`                                  | —                                 | no-op (bot sin protección nativa: es el camino de hoy)                                                                                                                                        |

### 7.2 Idempotencia (CA-016) — transición condicional, no conteo

Todo cierre disparado por la reconciliación se hace con una **transición condicional** que actúa como
token de exclusión:

```ts
const claimed = await prisma.position.updateMany({
  where: { id: position.id, status: 'OPEN' },
  data: { status: 'CLOSED', exitPrice, exitAt, pnl, fees, exitReason,
          protectionStatus: 'RELEASED' },
});
if (claimed.count === 0) return;          // otra corrida ya la cerró → no se crea el Trade
await prisma.trade.create({ ... });
```

La segunda corrida sobre el mismo estado simulado obtiene `count = 0` y sale antes de crear el
`Trade` ⇒ mismo resultado, cero trades duplicados. **No** se usa un `UNIQUE` sobre
`binanceOrderId`: no hay BD para verificar si el histórico tiene colisiones y un índice único que
falla al aplicarse dejaría la migración en rojo en producción.

La colocación de protección es idempotente por `listClientOrderId` (§6) y porque el estado destino
(`PROTECTED` con ids) hace que la segunda pasada caiga en la rama `ACTIVE` → no-op.

### 7.3 Reescritura ejecutable del CA "OCO colocada en testnet"

La spec pedía verificación contra testnet; no hay credenciales. **El criterio equivalente y
ejecutable en CI** (precedente CA-001 del cycle-01) es, sobre mocks de la capa HTTP (`axios`) y de
Prisma:

1. `placeOcoSellOrder` emite `POST /api/v3/orderList/oco` con **exactamente** los params de §5.2, con
   `signature` presente y consistente con el query string firmado, y `quantity`/precios ya ajustados a
   los filtros del símbolo (fixture de `exchangeInfo`).
2. Cantidades o precios fuera de filtro producen `OrderValidationError` **sin** llamada HTTP
   (assert: el mock de `axios.request` no fue invocado).
3. En el flujo de apertura, `placeProtectionOrder` se invoca **después** de que `placeMarketOrder`
   resolvió `FILLED` (assert de orden de llamadas sobre el mismo mock).
4. Con el mock devolviendo `{code:-2010}`, la posición termina en `protectionStatus = UNPROTECTED`,
   con notificación emitida, y el `Trade` de la compra **existe igual**.
5. Con el mock fallando por timeout en los 3 intentos, mismo resultado que (4) — nunca `PROTECTED`.

El Reviewer valida contra esta reinterpretación, no contra la letra.

---

## 8. D8 — Máquina de estados de la posición

### 8.1 Estado persistido (columnas nuevas de `positions`)

| Columna                  | Tipo                       | Default | Para qué                                                          |
| ------------------------ | -------------------------- | ------- | ----------------------------------------------------------------- |
| `protectionStatus`       | `PositionProtectionStatus` | `NONE`  | `NONE`\|`PENDING`\|`PROTECTED`\|`UNPROTECTED`\|`RELEASED`         |
| `protectionOrderListId`  | `String?`                  | `null`  | `orderListId` de la OCO                                           |
| `protectionStopOrderId`  | `String?`                  | `null`  | pierna STOP_LOSS_LIMIT                                            |
| `protectionLimitOrderId` | `String?`                  | `null`  | pierna LIMIT_MAKER                                                |
| `protectionPlacedAt`     | `DateTime?`                | `null`  | observabilidad                                                    |
| `protectionFailureCount` | `Int`                      | `0`     | nº de intento (entra en `listClientOrderId`)                      |
| `protectionLastError`    | `String?`                  | `null`  | `code:msg` recortado a 180                                        |
| `stopPrice`              | `Float?`                   | `null`  | **stop efectivo vigente** (lo mueve el trailing y el breakeven)   |
| `takeProfitPrice`        | `Float?`                   | `null`  | TP vigente                                                        |
| `highWaterPrice`         | `Float?`                   | `null`  | máximo visto desde la entrada (trailing)                          |
| `trailingActive`         | `Boolean`                  | `false` | el trailing ya se activó                                          |
| `initialQuantity`        | `Float?`                   | `null`  | cantidad original; `null` en filas históricas ⇒ se lee `quantity` |
| `partialExitCount`       | `Int`                      | `0`     | escalones de TP ya ejecutados (cycle-02 usa 1)                    |
| `realizedPnl`            | `Float`                    | `0`     | P&L acumulado de salidas parciales                                |
| `exitReason`             | `PositionExitReason?`      | `null`  | auditoría del cierre                                              |

`enum PositionProtectionStatus { NONE PENDING PROTECTED UNPROTECTED RELEASED }`
`enum PositionExitReason { LLM_SIGNAL LOSS_CUT STOP_LOSS TAKE_PROFIT TRAILING_STOP TIME_EXIT PARTIAL_TP EXCHANGE_STOP EXCHANGE_TAKE_PROFIT PROTECTION_FAILURE MANUAL }`

`Position.quantity` pasa a significar **cantidad abierta remanente**; tras un parcial se decrementa.
`initialQuantity` conserva la original. Filas previas: `initialQuantity = null` ⇒ los cálculos leen
`initialQuantity ?? quantity`, así que nada histórico cambia de valor.

### 8.2 Orden de evaluación en `checkOpenPositions` (primero que matchea, gana)

```
por cada posición OPEN:
  0. refrescar trailing:  highWaterPrice = max(highWaterPrice ?? entryPrice, currentPrice)
  1. TIME_EXIT      maxPositionHoldMinutes != null && now - entryAt >= maxPositionHoldMinutes  → cierre total
  2. STOP           currentPrice <= effectiveStop                                              → cierre total
                    effectiveStop = max(stopPrice ?? entryPrice*(1-stopLossPct), trailingLevel)
                    exitReason = TRAILING_STOP si el stop lo movió el trailing, si no STOP_LOSS
  3. PARTIAL_TP     partialTpEnabled && partialExitCount == 0
                    && currentPrice >= entryPrice*(1+partialTpTriggerPct)                      → venta parcial
  4. TAKE_PROFIT    !trailingStopEnabled && currentPrice >= entryPrice*(1+takeProfitPct)        → cierre total
  5. (sin salida)   persistir trailing/estado
```

**Decisión explícita:** con `trailingStopEnabled = true` el TP fijo **queda deshabilitado** — el
trailing lo reemplaza; si no, se cerraría siempre en el TP y el trailing nunca actuaría. Con el
default (`false`) el paso 4 es idéntico a `shouldTakeProfit` de hoy ⇒ CA-017/CA-021.

### 8.3 Funciones puras nuevas en `libs/trading-engine/src/lib/position-manager.ts`

```ts
export interface TrailingConfig {
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
}
export interface TrailingState {
  entryPrice: number;
  stopPrice: number | null;
  highWaterPrice: number | null;
  trailingActive: boolean;
}

export function updateTrailingStop(
  state: TrailingState,
  currentPrice: number,
  cfg: TrailingConfig,
  baseStopLossPct: number,
): TrailingState;

export function shouldExitByTime(
  entryAt: Date,
  now: Date,
  maxHoldMinutes: number | null,
): boolean;

export function resolvePartialTakeProfit(input: {
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  partialExitCount: number;
  cfg: {
    partialTpEnabled: boolean;
    partialTpTriggerPct: number;
    partialTpSellPct: number;
    moveStopToBreakevenAfterPartial: boolean;
  };
  lotStep: number;
  minNotional: number;
}): { sellQuantity: number; newStopPrice: number | null } | null;

export function applyPartialExit(
  position: PositionData,
  exitPrice: number,
  sellQuantity: number,
): { quantity: number; realizedPnlDelta: number; fees: number };
```

Reglas dentro de esas funciones:

- **`updateTrailingStop`** — `highWater = max(highWater ?? entry, current)`;
  `trailingActive ||= (highWater - entry)/entry >= trailingActivationPct`;
  si `trailingActive`: `candidate = highWater * (1 - trailingStopPct)` y
  **`stopPrice = max(stopPrice ?? entry*(1-baseStopLossPct), candidate)`** — el `max` es lo que
  garantiza RN-10/CA-018: el stop **nunca** retrocede, ni siquiera si el precio cae.
- **`resolvePartialTakeProfit`** — `sellQuantity = floorToStep(quantity * partialTpSellPct, lotStep)`;
  devuelve `null` (parcial omitido, se sigue de largo) si `sellQuantity <= 0` o si
  `sellQuantity * currentPrice < minNotional`, o si el remanente
  `(quantity - sellQuantity) * currentPrice < minNotional` — vender un parcial que deja un resto
  invendible es peor que no vender. `newStopPrice = max(stopPrice, entryPrice * (1 + 2*TRADE_FEE_PCT))`
  cuando `moveStopToBreakevenAfterPartial`: breakeven **neto de las dos comisiones**, no el entry pelado.
- **`applyPartialExit`** — no cierra la posición: baja `quantity`, acumula `realizedPnlDelta` en
  `realizedPnl` y suma el fee a `fees`. El `Trade` del parcial se crea con
  `exitReason` reflejado en la notificación, y **con `decisionId` de la decisión del ciclo**.
- Al cerrar del todo, `Position.pnl = realizedPnl + pnl(remanente)`; `PositionManager.closePosition`
  se mantiene intacto para el remanente y el processor suma el acumulado.
- Con protección nativa activa, cualquier movimiento del stop (trailing o breakeven) mayor a
  **0.1 % del stop vigente** dispara `cancelProtectionOrder` + `placeProtectionOrder` con los nuevos
  niveles y la cantidad remanente. El umbral evita cancelar/recolocar la OCO en cada tick.

---

## 9. D2 (cableado) — Riesgo agregado por usuario

### 9.1 Servicio nuevo `apps/api/src/agents/domain/aggregate-risk.service.ts`

Provisto por `AgentDomainModule` (que ya existe y ya exporta los otros dos); `TradingModule` lo importa.
Compone **los servicios del cycle-01 sin re-especificarlos**:

```ts
export type AggregateBlockReason = 'ASSET_EXPOSURE' | 'DAILY_LOSS' | 'DRAWDOWN';

export interface AggregateRiskDecision {
  allowed: boolean;
  blockedBy: AggregateBlockReason | null;
  detail: string | null;
  assetExposureUsd: number;
  plannedNotionalUsd: number;
  equityUsd: number;
  realizedPnlTodayUsd: number;
  drawdownPct: number;
  agentsPaused: boolean;
}

assertBuyAllowed(input: {
  userId: string; asset: Asset; mode: TradingMode; plannedNotionalUsd: number;
}): Promise<AggregateRiskDecision>;
```

Algoritmo:

```
policy = prisma.userRiskPolicy.findUnique({ userId })
if (!policy || !policy.enabled) -> { allowed: true, blockedBy: null }      // CA-025

snapshot = portfolioContext.build({ userId, mode })        // SIN configId ⇒ agrega TODAS las configs
assetExposureUsd = Σ p.notionalAtEntryUsd donde p.asset === asset
equityUsd        = Σ wallets.balance + Σ positions.notionalAtEntryUsd

1) EXPOSICIÓN POR ACTIVO   (CA-022)
   if (maxAssetExposureUsd != null && assetExposureUsd + plannedNotionalUsd > maxAssetExposureUsd) BLOCK
   if (maxAssetExposurePct != null && (assetExposureUsd + plannedNotionalUsd) / equityUsd > maxAssetExposurePct) BLOCK

2) PÉRDIDA DIARIA          (CA-023)
   realizedPnlTodayUsd = riskBudget.assessAggregate({ userId, since: startOfUtcDay }).realizedPnlUsd
   if (maxDailyLossUsd != null && realizedPnlTodayUsd <= -maxDailyLossUsd) BLOCK 'DAILY_LOSS'

3) DRAWDOWN + PAUSA        (CA-024)
   equityAtDayStartUsd = equityUsd + max(0, -realizedPnlTodayUsd)
   drawdownPct = equityAtDayStartUsd > 0 ? max(0, -realizedPnlTodayUsd) / equityAtDayStartUsd : 0
   if (maxDrawdownPct != null && drawdownPct >= maxDrawdownPct) {
       if (pauseAgentsOnDrawdown) {
           prisma.tradingConfig.updateMany({ where: { userId, isRunning: true }, data: { isRunning: false } })
           prisma.userRiskPolicy.update({ ... pausedAt: now, pausedReason: 'DRAWDOWN' })
           notifications.create(userId, AGENT_STOPPED, '{"key":"agentsPausedDrawdown"}')
       }
       BLOCK 'DRAWDOWN'
   }
```

- **Ventana de la pérdida diaria: día calendario UTC** (`startOfUtcDay`), no 24 h móviles —
  "no perder más de X por día" es un presupuesto que se renueva, y una ventana móvil nunca lo renueva.
- `RiskBudgetService.assess()` **no se toca** (contrato testeado del cycle-01). Se agrega
  `assessAggregate({ userId, since })` que suma `Position.pnl` de las cerradas del usuario en la
  ventana, **sin `configId`**, y lee `user_risk_policies` en vez de `AgentBudgetPolicy.dailyUsdBudget`.
  Los specs existentes de `RiskBudgetService` siguen pasando sin modificación.

### 9.2 Punto exacto del pipeline

`TradingProcessor.executeBuy`, **después** de calcular `quantity` (§4.1) y **antes** de
`placeMarketOrder`, en las dos ramas (SANDBOX y LIVE/TESTNET):

```
quantity = resolveTradeQuantity(...)         → si blockedBy != null: return
plannedNotionalUsd = quantity * referencePrice
verdict = await aggregateRisk.assertBuyAllowed({ userId, asset, mode, plannedNotionalUsd })
if (!verdict.allowed) { log + notificación AGENT_ERROR key `aggregateRiskBlocked`; return }
placeMarketOrder(BUY, quantity)
```

Es **pre-orden** y no pre-LLM a propósito: el nocional planificado solo existe después del sizing, y
bloquear antes del análisis nos dejaría sin la decisión registrada para auditar por qué no se operó.

---

## 10. D7 — `AegisVerdict` estructurado (adiós al regex)

### 10.1 Tipo y schema zod

En `apps/api/src/orchestrator/dto/decision-synthesis.dto.ts`:

```ts
export const AEGIS_BLOCK_REASONS = [
  'SINGLE_ASSET_CONCENTRATION',
  'PORTFOLIO_EXPOSURE',
  'DRAWDOWN',
  'DAILY_LOSS_LIMIT',
  'MAX_POSITIONS',
  'VOLATILITY',
  'SYSTEMIC_RISK',
  'INSUFFICIENT_BALANCE',
  'OTHER',
] as const;
export type AegisBlockReason = (typeof AEGIS_BLOCK_REASONS)[number];

export interface AegisVerdict {
  riskScore: number;
  verdict: 'PASS' | 'REDUCE' | 'BLOCK';
  positionSizeMultiplier: number;
  blockReasons: AegisBlockReason[];
  reason: string;
  alerts: string[];
}
```

`apps/api/src/orchestrator/dto/aegis-verdict.schema.ts` (zod 4, ya en el repo):

```ts
export const aegisVerdictSchema = z.object({
  riskScore: z.coerce.number().min(0).max(100).catch(50),
  verdict: z.enum(['PASS', 'REDUCE', 'BLOCK']).catch('PASS'),
  positionSizeMultiplier: z.coerce.number().min(0).max(1).catch(1),
  blockReasons: z.array(z.enum(AEGIS_BLOCK_REASONS)).catch([]),
  reason: z.string().catch(''),
  alerts: z.array(z.string()).catch([]),
});

export function parseAegisVerdict(raw: string): AegisVerdict; // safeParseJson + schema.parse
```

`.catch(...)` en cada campo hace que un payload parcial degrade a valores neutros en vez de tirar —
el LLM devuelve texto libre y una excepción acá tumbaría el ciclo. `positionSizeMultiplier` se
**clampea a `[0,1]`** ya en el borde: _modular es reducir_, un multiplicador > 1 no existe.
Valores desconocidos en `blockReasons` se descartan por el `z.enum`; el resultado es un array
posiblemente vacío, que la regla trata como **no anulable**.

### 10.2 Regla estructurada que reemplaza a `isFalseConcentrationBlock`

```ts
const OVERRIDABLE_BLOCK_REASONS: ReadonlySet<AegisBlockReason> = new Set([
  'SINGLE_ASSET_CONCENTRATION',
]);

export function isOverridableBlock(verdict: AegisVerdict): boolean {
  return (
    verdict.verdict === 'BLOCK' &&
    verdict.blockReasons.length > 0 &&
    verdict.blockReasons.every((r) => OVERRIDABLE_BLOCK_REASONS.has(r))
  );
}
```

- **Fail-closed:** sin `blockReasons`, con array vacío o con **cualquier** motivo fuera del conjunto
  anulable, el `BLOCK` se respeta — sin importar el texto de `reason`, incluido un texto que diga
  "concentración" (CA-029, RN-16).
- El override sigue existiendo solo para el falso positivo real y documentado: un bot opera **un**
  par, así que "100 % de concentración en ese activo" no es riesgo (CA-030).
- Las líneas 455-465 de `orchestrator.service.ts` —comentario incluido— y la regex desaparecen
  (CA-031). El grep de CI busca `isFalseConcentrationBlock` y `concentraci` en `apps/api/src`.

### 10.3 Dónde se declara el contrato para el modelo (crítico — hallazgo 1.1-5)

Dos lugares, y **el segundo es el que importa para instalaciones existentes**:

1. `apps/api/prisma/seed/agents.ts`, l. 328 — el formato JSON del system prompt pasa a:

   ```
   { "riskScore": 0, "verdict": "PASS|REDUCE|BLOCK", "positionSizeMultiplier": 1.0,
     "blockReasons": [], "reason": "...", "alerts": [] }

   blockReasons SOLO cuando verdict = BLOCK; array vacío en PASS/REDUCE. Valores permitidos:
   SINGLE_ASSET_CONCENTRATION | PORTFOLIO_EXPOSURE | DRAWDOWN | DAILY_LOSS_LIMIT | MAX_POSITIONS |
   VOLATILITY | SYSTEMIC_RISK | INSUFFICIENT_BALANCE | OTHER.
   positionSizeMultiplier ∈ [0,1] — 1.0 = sin reducción.
   ```

2. `sub-agent.service.ts` → `buildTaskUserPrompt('risk_gate')`: el mismo bloque se **anexa al user
   prompt**, que se construye en código. El system prompt vive en la tabla `AgentDefinition` y una
   instalación ya seedeada **no lo actualiza al desplegar**: sin el punto 2, el modelo no emitiría
   `blockReasons`, la regla fail-closed dejaría de anular el falso positivo de concentración y los
   bots empezarían a comerse BLOCKs espurios. Con el punto 2 el contrato viaja con el código.
   El seed se actualiza igual para que un entorno nuevo quede coherente.

### 10.4 Transporte hacia el processor: `DecisionPayload` tipado

Hoy el multiplicador y el sizing de FORGE mueren dentro de `orchestrateDecision`. Se agregan al
payload, ya parseados y validados **en el único lugar que toca JSON de LLM**:

```ts
export interface ForgeSizingSummary {
  recommendation: 'proceed' | 'skip';
  maxTradePct: number | null;
  reasoning: string;
}

export interface DecisionPayload {
  /* … campos actuales … */
  risk: AegisVerdict; // parseado con parseAegisVerdict
  sizing: ForgeSizingSummary; // parseado con forgeSizingSchema (mismo patrón zod)
}
```

`TradingProcessor` consume `decision.risk.verdict`, `decision.risk.positionSizeMultiplier` y
`decision.sizing.*` y **nunca** vuelve a parsear `subAgentResults`. `forgeSizingSchema` mapea
`maxTradeSize` (nombre que usa el prompt de FORGE) a `maxTradePct`, con `.catch(null)`.

---

## 11. Impacto en el schema de datos

### 11.1 Prisma (`apps/api/prisma/schema.prisma`)

```prisma
enum PositionProtectionStatus {
  NONE
  PENDING
  PROTECTED
  UNPROTECTED
  RELEASED
}

enum PositionExitReason {
  LLM_SIGNAL
  LOSS_CUT
  STOP_LOSS
  TAKE_PROFIT
  TRAILING_STOP
  TIME_EXIT
  PARTIAL_TP
  EXCHANGE_STOP
  EXCHANGE_TAKE_PROFIT
  PROTECTION_FAILURE
  MANUAL
}

model TradingConfig {
  // … campos actuales …
  lossCutEnabled                  Boolean @default(false)
  lossCutConfidenceThreshold      Float   @default(0.85)
  lossCutMinLossPct               Float   @default(0.005)
  lossCutMinEdgeRatio             Float   @default(2)
  smartSizingEnabled              Boolean @default(false)
  reduceSizeFactor                Float   @default(0.5)
  nativeProtectionEnabled         Boolean @default(false)
  closeOnProtectionFailure        Boolean @default(false)
  stopLimitOffsetPct              Float   @default(0.002)
  trailingStopEnabled             Boolean @default(false)
  trailingStopPct                 Float   @default(0.02)
  trailingActivationPct           Float   @default(0.01)
  partialTpEnabled                Boolean @default(false)
  partialTpTriggerPct             Float   @default(0.02)
  partialTpSellPct                Float   @default(0.5)
  moveStopToBreakevenAfterPartial Boolean @default(true)
  maxPositionHoldMinutes          Int?
}

model Position {
  // … campos actuales …
  protectionStatus       PositionProtectionStatus @default(NONE)
  protectionOrderListId  String?
  protectionStopOrderId  String?
  protectionLimitOrderId String?
  protectionPlacedAt     DateTime?
  protectionFailureCount Int                      @default(0)
  protectionLastError    String?
  stopPrice              Float?
  takeProfitPrice        Float?
  highWaterPrice         Float?
  trailingActive         Boolean                  @default(false)
  initialQuantity        Float?
  partialExitCount       Int                      @default(0)
  realizedPnl            Float                    @default(0)
  exitReason             PositionExitReason?

  @@index([userId, status, protectionStatus])
}

model Trade {
  // … campos actuales …
  decisionId String?
  decision   AgentDecision? @relation(fields: [decisionId], references: [id], onDelete: SetNull)

  @@index([decisionId])
}

model AgentDecision {
  // … campos actuales …
  trades Trade[]
}

model UserRiskPolicy {
  id                    String    @id @default(cuid())
  userId                String    @unique
  enabled               Boolean   @default(false)
  maxAssetExposureUsd   Float?
  maxAssetExposurePct   Float?
  maxDailyLossUsd       Float?
  maxDrawdownPct        Float?
  pauseAgentsOnDrawdown Boolean   @default(true)
  pausedAt              DateTime?
  pausedReason          String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_risk_policies")
}
```

`model User` suma `riskPolicy UserRiskPolicy?` y pierde `agentModelPolicies` / `agentToolInvocations`
(D10). `PrismaService` suma el getter `userRiskPolicy` y borra `agentModelPolicy` /
`agentToolInvocation`.

### 11.2 Migraciones SQL escritas a mano

Cinco directorios bajo `apps/api/prisma/migrations/`. **No correr `prisma migrate dev`** (no hay BD):
se crean los directorios con su `migration.sql` y se corre `pnpm prisma generate` para el cliente.

**1. `20260817150000_add_trading_config_risk_tools/migration.sql`**

```sql
-- AlterTable
ALTER TABLE "trading_configs"
  ADD COLUMN "lossCutEnabled"                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lossCutConfidenceThreshold"      DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  ADD COLUMN "lossCutMinLossPct"               DOUBLE PRECISION NOT NULL DEFAULT 0.005,
  ADD COLUMN "lossCutMinEdgeRatio"             DOUBLE PRECISION NOT NULL DEFAULT 2,
  ADD COLUMN "smartSizingEnabled"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reduceSizeFactor"                DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "nativeProtectionEnabled"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "closeOnProtectionFailure"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stopLimitOffsetPct"              DOUBLE PRECISION NOT NULL DEFAULT 0.002,
  ADD COLUMN "trailingStopEnabled"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trailingStopPct"                 DOUBLE PRECISION NOT NULL DEFAULT 0.02,
  ADD COLUMN "trailingActivationPct"           DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  ADD COLUMN "partialTpEnabled"                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partialTpTriggerPct"             DOUBLE PRECISION NOT NULL DEFAULT 0.02,
  ADD COLUMN "partialTpSellPct"                DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "moveStopToBreakevenAfterPartial" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "maxPositionHoldMinutes"          INTEGER;
```

**2. `20260817151000_add_position_protection_state/migration.sql`**

```sql
-- CreateEnum
CREATE TYPE "PositionProtectionStatus" AS ENUM ('NONE', 'PENDING', 'PROTECTED', 'UNPROTECTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PositionExitReason" AS ENUM ('LLM_SIGNAL', 'LOSS_CUT', 'STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_STOP', 'TIME_EXIT', 'PARTIAL_TP', 'EXCHANGE_STOP', 'EXCHANGE_TAKE_PROFIT', 'PROTECTION_FAILURE', 'MANUAL');

-- AlterTable
ALTER TABLE "positions"
  ADD COLUMN "protectionStatus"       "PositionProtectionStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "protectionOrderListId"  TEXT,
  ADD COLUMN "protectionStopOrderId"  TEXT,
  ADD COLUMN "protectionLimitOrderId" TEXT,
  ADD COLUMN "protectionPlacedAt"     TIMESTAMP(3),
  ADD COLUMN "protectionFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "protectionLastError"    TEXT,
  ADD COLUMN "stopPrice"              DOUBLE PRECISION,
  ADD COLUMN "takeProfitPrice"        DOUBLE PRECISION,
  ADD COLUMN "highWaterPrice"         DOUBLE PRECISION,
  ADD COLUMN "trailingActive"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "initialQuantity"        DOUBLE PRECISION,
  ADD COLUMN "partialExitCount"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "realizedPnl"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "exitReason"             "PositionExitReason";

-- CreateIndex
CREATE INDEX "positions_userId_status_protectionStatus_idx"
  ON "positions"("userId", "status", "protectionStatus");
```

**3. `20260817152000_add_trade_decision_fk/migration.sql`** (CA-027: nullable, sin `UPDATE` de backfill)

```sql
-- AlterTable
ALTER TABLE "trades" ADD COLUMN "decisionId" TEXT;

-- CreateIndex
CREATE INDEX "trades_decisionId_idx" ON "trades"("decisionId");

-- AddForeignKey
ALTER TABLE "trades"
  ADD CONSTRAINT "trades_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "agent_decisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

> `ON DELETE SET NULL` y no `CASCADE`: borrar el historial de decisiones **jamás** puede borrar el
> historial de operaciones ejecutadas.

**4. `20260817153000_add_user_risk_policies/migration.sql`**

```sql
-- CreateTable
CREATE TABLE "user_risk_policies" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "enabled"               BOOLEAN NOT NULL DEFAULT false,
  "maxAssetExposureUsd"   DOUBLE PRECISION,
  "maxAssetExposurePct"   DOUBLE PRECISION,
  "maxDailyLossUsd"       DOUBLE PRECISION,
  "maxDrawdownPct"        DOUBLE PRECISION,
  "pauseAgentsOnDrawdown" BOOLEAN NOT NULL DEFAULT true,
  "pausedAt"              TIMESTAMP(3),
  "pausedReason"          TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_risk_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_risk_policies_userId_key" ON "user_risk_policies"("userId");

-- AddForeignKey
ALTER TABLE "user_risk_policies"
  ADD CONSTRAINT "user_risk_policies_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

**5. `20260817154000_drop_orphan_agent_tables/migration.sql`**

```sql
-- DropTable
DROP TABLE "agent_tool_invocations";

-- DropTable
DROP TABLE "agent_model_policies";

-- DropEnum
DROP TYPE "AgentToolName";
```

### 11.3 D10 — Destino de las tablas huérfanas: **se dropean** (CA-036/CA-037)

**Decisión: eliminar.** Justificación:

- `agent_tool_invocations` era la telemetría del sistema de tools que el cycle-01 borró: no hay
  escritor **ni lector** desde entonces, y el `AgentToolName` enumera 6 tools de las cuales solo 3
  sobrevivieron, ya sin contrato de tool.
- `agent_model_policies` tenía un único consumidor, `model-router.service.ts`, borrado en el cycle-01.
  La resolución de modelo hoy pasa entera por `AgentConfigResolverService` (constitution §3.1,
  "pieza de una sola puerta"): dejar una tabla que _parece_ política de modelos es una invitación a
  que un ciclo futuro escriba contra ella y rompa la puerta única.
- Conservarlas cuesta: dos modelos en el cliente Prisma generado, dos getters en `PrismaService`,
  dos entradas de tipo en cada autocompletado y una migración pendiente eternamente.

**Reinterpretación del "aditiva y reversible" de CA-037** (mismo precedente que CA-001 del cycle-01):
un `DROP` no puede ser aditivo. Lo que se garantiza y el Reviewer verifica es:
(a) la migración **no toca ninguna tabla viva** — es una migración dedicada, separada de las otras
cuatro, que puede omitirse sin afectar al resto del ciclo; (b) es **reversible con el SQL de reversa
publicado acá**; (c) no hay pérdida de datos con valor operativo (ambas tablas están fuera de todo
camino de lectura desde el cycle-01).

Reverse SQL (si alguna vez hiciera falta restaurar la estructura):

```sql
CREATE TYPE "AgentToolName" AS ENUM ('PORTFOLIO_CONTEXT', 'MARKET_EDGE', 'TRADE_SIMULATION', 'RISK_BUDGET', 'DECISION_MEMORY', 'TOKEN_BUDGET');

CREATE TABLE "agent_model_policies" (
  "id" TEXT NOT NULL, "userId" TEXT, "agentId" "AgentId" NOT NULL,
  "mode" "TradingMode", "riskProfile" "RiskProfile",
  "provider" "LLMProvider" NOT NULL, "model" TEXT NOT NULL,
  "maxInputTokens" INTEGER NOT NULL DEFAULT 8000,
  "maxOutputTokens" INTEGER NOT NULL DEFAULT 768,
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "isPremium" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_model_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_model_policies_userId_agentId_idx" ON "agent_model_policies"("userId", "agentId");
CREATE INDEX "agent_model_policies_agentId_mode_riskProfile_idx" ON "agent_model_policies"("agentId", "mode", "riskProfile");
ALTER TABLE "agent_model_policies" ADD CONSTRAINT "agent_model_policies_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_tool_invocations" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "decisionId" TEXT,
  "agentId" "AgentId" NOT NULL, "toolName" "AgentToolName" NOT NULL,
  "inputHash" TEXT NOT NULL, "outputHash" TEXT, "status" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL, "freshnessMs" INTEGER,
  "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_tool_invocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_tool_invocations_userId_createdAt_idx" ON "agent_tool_invocations"("userId", "createdAt");
CREATE INDEX "agent_tool_invocations_decisionId_idx" ON "agent_tool_invocations"("decisionId");
CREATE INDEX "agent_tool_invocations_agentId_toolName_idx" ON "agent_tool_invocations"("agentId", "toolName");
ALTER TABLE "agent_tool_invocations" ADD CONSTRAINT "agent_tool_invocations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 12. D9 — Trazabilidad `Trade → AgentDecision`

`savedDecision.id` ya existe en `runCycle` (l. 331). Se propaga como parámetro a `executeBuy`,
`executeLLMSell` y `checkOpenPositions`, y se setea en los **4** puntos de creación de `Trade`:

| Punto                              | `decisionId`                                                     |
| ---------------------------------- | ---------------------------------------------------------------- |
| `executeBuy` rama SANDBOX (l. 716) | `savedDecision.id`                                               |
| `executeBuy` rama LIVE (l. 792)    | `savedDecision.id`                                               |
| `executeLLMSell` (l. 920)          | `savedDecision.id`                                               |
| `checkOpenPositions` (l. 1076)     | `savedDecision.id` — la decisión del ciclo que evaluó la salida  |
| Reconciliación (nuevo)             | `null` — la ejecutó el exchange fuera de ciclo, no hubo decisión |
| `closePositionManually` (nuevo)    | `null` — la originó el usuario                                   |

`createTradeRecord` en `libs/trading-engine` suma `decisionId?: string | null` a su salida
(`TradeRecord` en `libs/shared` también). CA-028 sale gratis: la columna es nullable en Prisma y en
SQL, y los dos caminos sin decisión persisten `null` sin fallar.

---

## 13. Follow-ups del cycle-01

### 13.1 P2002 en `EvaluationProcessor.evaluate` (RF-09, CA-032)

El `findUnique` + `create` no es atómico. El `create` se envuelve:

```ts
try {
  await this.prisma.agentDecisionEvaluation.create({ data: { ... } });
} catch (err) {
  if ((err as { code?: string }).code === 'P2002') {
    this.logger.log(`Evaluation already created concurrently for ${decisionId}@${horizonMinutes}m`);
    return;
  }
  throw err;
}
```

El mismo guard va en `createNotEvaluable`. Se detecta por `code` (string) y no por `instanceof
Prisma.PrismaClientKnownRequestError`, para que el test pueda simularlo con un objeto plano
`{ code: 'P2002' }` sin depender del runtime de Prisma.

### 13.2 Fusión `ResolvedAgentConfig` / `ResolvedAgentClient` (RF-10, CA-033/034/035)

```ts
// agent-identity.ts — única puerta de la indirección (constitution §3.1)
const MODEL_SLOT_TO_AGENT_ID: Readonly<Record<ModelSlotId, AgentId>> = {
  routing: AgentId.routing, synthesis: AgentId.synthesis, platform: AgentId.platform,
  operations: AgentId.operations, market: AgentId.market,
  blockchain: AgentId.blockchain, risk: AgentId.risk,
};
export function toAgentId(slot: ModelSlotId): AgentId { return MODEL_SLOT_TO_AGENT_ID[slot]; }

// agent-config-resolver.service.ts — una sola estructura
export interface ResolvedAgentModel {
  slot: ModelSlotId;
  provider: LLMProvider;
  model: string;
  source: ResolutionSource;
}
export interface ResolvedAgentClient extends ResolvedAgentModel { client: LLMProviderClient }

resolveConfig(slot: ModelSlotId, userId: string): Promise<ResolvedAgentModel>
resolveAllConfigs(userId: string): Promise<ResolvedAgentModel[]>
```

- `ResolvedAgentConfig` **desaparece** (una sola definición ⇒ CA-033); `agents/index.ts` exporta
  `ResolvedAgentModel`. Sin alias deprecado: dos nombres para una estructura es exactamente lo que
  este follow-up viene a eliminar.
- Los dos `as unknown as AgentId` (l. 124 y 202) se reemplazan por `toAgentId(slot)` — **mapa
  explícito, no cast** (CA-034). El de `agent-prompt.service.ts` (l. 30 y 60) se migra igual: es
  una línea y deja el árbol sin casts inseguros de identidad.
- `AgentHealthItem.agentId: AgentId` pasa a `slot: ModelSlotId`; consumidor a actualizar:
  `trading.processor.ts:129-131` (`a.agentId` → `a.slot`).
- Los 3 consumidores del brief (`agent-config.controller.ts`, `admin-agent-config.controller.ts`,
  `market.service.ts`) migran a `ModelSlotId` (CA-035).
- Se borra el JSDoc narrativo del archivo (regla de cero comentarios).

---

## 14. Contratos de API (`sdd/api.json`)

Prefijo global `api` (`main.ts:8`); las rutas se registran sin él, igual que EP-001…EP-003.
Todos los endpoints exigen `Authorization: Bearer` (`JwtAuthGuard` + `@Roles('TRADER')`).

### EP-004 · `GET /trading/risk-policy`

Devuelve la política de riesgo agregado del usuario, o los defaults inactivos si no tiene fila.

**Response 200:**

```json
{
  "enabled": false,
  "maxAssetExposureUsd": null,
  "maxAssetExposurePct": null,
  "maxDailyLossUsd": null,
  "maxDrawdownPct": null,
  "pauseAgentsOnDrawdown": true,
  "pausedAt": null,
  "pausedReason": null
}
```

**Errores:** 401.

### EP-005 · `PUT /trading/risk-policy`

Upsert de la política (crea la fila la primera vez). Reactivar agentes pausados sigue siendo la
acción existente `POST /trading/start`; este endpoint solo limpia `pausedAt`/`pausedReason` cuando se
recibe `enabled: false`.

**Request:**

```json
{
  "enabled": true,
  "maxAssetExposureUsd": 500,
  "maxAssetExposurePct": 0.4,
  "maxDailyLossUsd": 50,
  "maxDrawdownPct": 0.1,
  "pauseAgentsOnDrawdown": true
}
```

Validación: `enabled` `@IsBoolean()`; los `*Usd` `@IsNumber() @Min(0)` opcionales y nullable; los
`*Pct` `@IsNumber() @Min(0.001) @Max(1)` opcionales y nullable.

**Response 200:** el mismo cuerpo de EP-004. **Errores:** 400, 401.

### EP-006 · `POST /trading/config` (existente — contrato extendido)

`CreateTradingConfigDto` suma los 15 campos de §2 (todos opcionales, con los validadores de §2.5).
Sin ellos, el comportamiento es idéntico al de hoy. **Response 201** = la config creada, con los 15
campos en su valor por default. **Errores:** 400 (`forbidNonWhitelisted` rechaza campos no
declarados), 401.

### EP-007 · `PUT /trading/config/:id` (existente — contrato extendido)

Ídem con `UpdateTradingConfigDto`. `path_params: ["id"]`. **Errores:** 400, 401, 404.

### EP-008 · `GET /trading/positions` (existente — respuesta extendida)

Cada posición suma `protectionStatus`, `stopPrice`, `takeProfitPrice`, `highWaterPrice`,
`trailingActive`, `initialQuantity`, `partialExitCount`, `realizedPnl` y `exitReason`. Los clientes
existentes ignoran campos que no conocen: el cambio es aditivo.

---

## 15. Dependencias, wiring y archivos

**Sin dependencias externas nuevas.** `zod@4.3.6` ya está en el `package.json` raíz.

| Acción | Archivo                                                                       | Qué                                                                                   |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| nuevo  | `libs/trading-engine/src/lib/sizing.ts` (+ `.spec.ts`)                        | `resolveTradeQuantity`                                                                |
| nuevo  | `libs/trading-engine/src/lib/sell-policy.ts` (+ `.spec.ts`)                   | `evaluateSellPolicy`                                                                  |
| mod    | `libs/trading-engine/src/lib/position-manager.ts` (+ spec)                    | trailing / parcial / tiempo                                                           |
| mod    | `libs/trading-engine/src/lib/order-executor.ts` (+ spec)                      | port extendido, Sandbox simulado, `createTradeRecord` con `decisionId`                |
| mod    | `libs/trading-engine/src/index.ts`                                            | barrel                                                                                |
| mod    | `libs/data-fetcher/src/lib/binance/binance-rest.client.ts` (+ spec)           | 8 métodos, filtros, `OrderValidationError`, pesos                                     |
| mod    | `libs/shared` (`TradeRecord`, `OrderResult`)                                  | `decisionId`, estados de orden                                                        |
| nuevo  | `apps/api/src/trading/reconciliation.service.ts` (+ spec)                     | §7                                                                                    |
| nuevo  | `apps/api/src/agents/domain/aggregate-risk.service.ts` (+ spec)               | §9                                                                                    |
| nuevo  | `apps/api/src/orchestrator/dto/aegis-verdict.schema.ts` (+ spec)              | §10.1                                                                                 |
| nuevo  | `apps/api/src/trading/dto/user-risk-policy.dto.ts`                            | EP-005                                                                                |
| mod    | `apps/api/src/trading/trading.processor.ts`                                   | paso 0 reconciliación, sizing, política SELL, protección, trailing, `decisionId`      |
| mod    | `apps/api/src/trading/{trading.controller,trading.service,trading.module}.ts` | EP-004/005, cancelación de protección en cierre manual, import de `AgentDomainModule` |
| mod    | `apps/api/src/trading/dto/trading-config.dto.ts`                              | 15 campos × 2 DTO                                                                     |
| mod    | `apps/api/src/orchestrator/orchestrator.service.ts`                           | regex fuera, `isOverridableBlock`, `risk`/`sizing` en el payload                      |
| mod    | `apps/api/src/orchestrator/sub-agent.service.ts`                              | contrato `blockReasons` en el user prompt de `risk_gate`                              |
| mod    | `apps/api/prisma/seed/agents.ts`                                              | formato JSON de AEGIS                                                                 |
| mod    | `apps/api/src/agents/{agent-identity,agent-config-resolver,agent-prompt}.ts`  | §13.2                                                                                 |
| mod    | `apps/api/src/agents/evaluation/evaluation.processor.ts`                      | §13.1                                                                                 |
| mod    | `apps/api/src/prisma/prisma.service.ts`                                       | +`userRiskPolicy`, −`agentModelPolicy`, −`agentToolInvocation`                        |
| mod    | `apps/api/prisma/schema.prisma` + 5 migraciones                               | §11                                                                                   |

### 15.1 Orden de riesgo sugerido al Planner

Andamio primero, cableado después: (1) migraciones + DTO + Prisma; (2) `sizing.ts` y
`sell-policy.ts` puros con sus tests; (3) cliente Binance + port + Sandbox; (4) `blockReasons` +
payload tipado; (5) cableado en el processor (sizing → política SELL → protección → reconciliación
→ trailing/parcial/tiempo); (6) riesgo agregado; (7) los 3 follow-ups, independientes entre sí y del
resto.

### 15.2 Trazabilidad CA → dónde se verifica

| CA          | Verificación                                                                |
| ----------- | --------------------------------------------------------------------------- |
| CA-001..004 | `sell-policy.spec.ts` (§4.2, tabla de fixtures)                             |
| CA-005..009 | `sizing.spec.ts` (§4.1; CA-009 con valores extremos)                        |
| CA-010..011 | `binance-rest.client.spec.ts` (§5.2/§5.3)                                   |
| CA-012..013 | `trading.processor` spec con mocks (§6, §7.3 puntos 3-5)                    |
| CA-014..016 | `reconciliation.service.spec.ts` (§7.1, §7.2)                               |
| CA-017..021 | `position-manager.spec.ts` (§8.2, §8.3)                                     |
| CA-022..025 | `aggregate-risk.service.spec.ts` (§9.1)                                     |
| CA-026..028 | spec del processor + inspección del SQL de la migración 3 (§11.2)           |
| CA-029..031 | `orchestrator.service.spec.ts` + grep de CI (§10.2)                         |
| CA-032      | `evaluation.processor.spec.ts` con `{ code: 'P2002' }` (§13.1)              |
| CA-033..035 | typecheck/build + grep de CI (§13.2)                                        |
| CA-036..037 | este documento §11.3 + directorio `20260817154000_drop_orphan_agent_tables` |
