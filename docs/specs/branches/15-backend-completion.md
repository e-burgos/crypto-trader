# Spec 15 — Backend Completion

**Fecha:** 2026-04-01
**Versión:** 1.0
**Estado:** Aprobado
**Branch:** `feature/backend-completion`

---

## Resumen ejecutivo

La auditoría del backend revela que las **libs** y los módulos base están implementados y funcionales. Lo que falta es exclusivamente la **capa de aplicación** (NestJS modules/controllers/services) que conecta las libs y expone los endpoints del spec.

El bloqueo central es: **`TradingModule` no existe**. Es el corazón del sistema (el agente autónomo) y bloquea el kill-switch real del AdminModule y los eventos WebSocket del Gateway.

---

## 1. Estado actual — Inventario completo

### 1.1 Libs (todas completas ✅)

| Lib                             | Archivos                                                                                              | Estado      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `@crypto-trader/shared`         | tipos, DTOs, constants, utils                                                                         | ✅ Completo |
| `@crypto-trader/data-fetcher`   | `BinanceRestClient`, `BinanceWsClient`, `BinanceRateLimiter`, 4 news fetchers, `NewsAggregator`       | ✅ Completo |
| `@crypto-trader/analysis`       | todos los indicadores técnicos, `LLMAnalyzer`, 3 providers (Claude/OpenAI/Groq), `LLMProviderFactory` | ✅ Completo |
| `@crypto-trader/trading-engine` | `SandboxOrderExecutor`, `LiveOrderExecutor`, `PositionManager`                                        | ✅ Completo |

### 1.2 Módulos NestJS (`apps/api/src/`)

| Módulo                  | Endpoints                                             | Estado           | Gaps                                                                                  |
| ----------------------- | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| **AuthModule**          | register, login, refresh, logout, me                  | ✅ Completo      | Logout no invalida en Redis (stateless — aceptable para v1)                           |
| **UsersModule**         | profile, binance-keys, llm-keys, admin/users          | ✅ Completo      | —                                                                                     |
| **NotificationsModule** | CRUD notifications + WebSocket delivery               | ✅ Completo      | —                                                                                     |
| **GatewayModule**       | WebSocket auth, rooms por usuario, price subscription | ✅ Completo      | Faltan emits de `agent:killed` y `position:updated` (dependen de TradingModule)       |
| **AdminModule**         | stats, kill-switch (DB), audit-log                    | ⚠️ Parcial       | Kill-switch solo actualiza DB, no cancela Bull jobs; falta `GET /admin/agents/status` |
| **AnalyticsModule**     | portfolio, trades, decisions                          | ⚠️ Parcial       | Faltan: `summary` (Sharpe/drawdown), `pnl-chart`, `asset-breakdown`                   |
| **TradingModule**       | —                                                     | ❌ **No existe** | Todo el módulo - 8 endpoints + agente loop                                            |
| **MarketModule**        | —                                                     | ❌ **No existe** | `GET /market/ohlcv/:asset/:interval` y `GET /market/news`                             |

---

## 2. Gaps detallados

---

### Gap A — TradingModule (CRÍTICO 🔴)

**Tarea de referencia:** Task 11 del plan de implementación.

**Archivos a crear:** `apps/api/src/trading/`

El módulo no existe en absoluto. Debe implementar:

#### 2.A.1 Endpoints del controller

| Método | Ruta                 | Descripción                                                              |
| ------ | -------------------- | ------------------------------------------------------------------------ |
| `GET`  | `/trading/config`    | Configuración del agente del usuario (o lista de configs por asset/pair) |
| `PUT`  | `/trading/config`    | Crear/actualizar configuración de trading                                |
| `POST` | `/trading/start`     | Arrancar el agente para el usuario autenticado                           |
| `POST` | `/trading/stop`      | Detener el agente                                                        |
| `GET`  | `/trading/status`    | Estado actual del agente + próxima ejecución                             |
| `GET`  | `/trading/positions` | Posiciones abiertas del usuario (paginado)                               |
| `GET`  | `/trading/history`   | Historial de trades (paginado, filtrable por asset/mode/date)            |
| `GET`  | `/trading/decisions` | Log de decisiones del agente IA (paginado)                               |

#### 2.A.2 El agente loop (Bull queue)

El job se ejecuta por usuario. Flujo completo:

```
1. Cargar TradingConfig + credenciales (Binance + LLM) del usuario
2. Desencriptar credenciales (usando EncryptionService de UsersModule)
3. Fetch candles del asset configurado (últimas 200, intervalo 1h)
4. Construir IndicatorSnapshot con buildIndicatorSnapshot()
5. Fetch news via NewsAggregator (desde caché o nuevo fetch)
6. Cargar últimos 10 trades del usuario desde DB
7. Llamar LLMAnalyzer.analyze() con el snapshot completo
8. Guardar AgentDecision en DB
9. Emitir agent:decision via WebSocket (AppGateway.emitToUser)
10. Si decision === BUY y confidence >= buyThreshold y hasCapacity():
    a. calculateTradeQuantity() para determinar quantity
    b. Ejecutar orden (SandboxOrderExecutor o LiveOrderExecutor según mode)
    c. Guardar Position + Trade en DB
    d. Crear Notification (TRADE_EXECUTED)
    e. Emitir trade:executed + notification:new via WebSocket
11. Revisar posiciones abiertas del usuario: checkStopLoss + checkTakeProfit
    a. Si se activa: executeSell → actualizar Position → crear Trade
    b. Crear Notification (STOP_LOSS_TRIGGERED / TAKE_PROFIT_HIT)
    c. Emitir trade:executed + position:updated via WebSocket
12. Programar siguiente job: max(suggestedWaitMinutes, minIntervalMinutes) minutos
```

#### 2.A.3 Estado del agente en Redis

```
agent:{userId}:status → {
  running: boolean,
  jobId: string | null,
  lastRun: ISO string | null,
  nextRun: ISO string | null,
  currentInterval: number
}
```

#### 2.A.4 Archivos a crear

```
apps/api/src/trading/
  trading.module.ts          — importa Bull, libs, dependencias
  trading.controller.ts      — 8 endpoints con JwtAuthGuard
  trading.service.ts         — start/stop/status, CRUD config, posiciones, historial
  trading.processor.ts       — @Processor('trading-agent') Bull job handler
  dto/
    trading-config.dto.ts    — TradingConfigDto con class-validator
```

#### 2.A.5 Dependencias de Bull y Redis

El módulo necesita:

```typescript
BullModule.registerQueue({ name: 'trading-agent' });
```

`bull` e `ioredis` ya están en `package.json`. Configurar `BullModule.forRoot` en `AppModule` con `REDIS_URL`.

---

### Gap B — MarketModule (MEDIA 🟡)

**No existe** en `apps/api/src/`. Expone datos de mercado públicos (no requiere auth de Binance del usuario).

**Archivos a crear:** `apps/api/src/market/`

| Método | Ruta                             | Descripción                                                                                                                                                                                            |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/market/ohlcv/:asset/:interval` | OHLCV histórico para el chart. Usa `BinanceRestClient` sin credenciales (endpoint público de Binance). Params: `asset` = BTC\|ETH, `interval` = 1m\|5m\|15m\|1h\|4h\|1d. Query: `limit` (default 200). |
| `GET`  | `/market/news`                   | Últimas noticias del `NewsAggregator`. Query: `limit` (default 20).                                                                                                                                    |

Estos endpoints son `@Public()` (sin auth) o pueden requerir JWT — a criterio de implementación (recomendado: requieren JWT para evitar abuso).

**Archivos a crear:**

```
apps/api/src/market/
  market.module.ts
  market.controller.ts
  market.service.ts
```

---

### Gap C — Analytics extendida (MEDIA 🟡)

**Tarea de referencia:** Task 14 del plan.

Agregar 3 endpoints al `AnalyticsService` y `AnalyticsController` existentes:

#### `GET /analytics/summary`

Respuesta completa de performance:

```typescript
{
  totalTrades: number,
  winRate: number,         // closedPositions con pnl > 0 / total cerradas
  avgPnl: number,          // sum(pnl) / count(closed)
  totalPnl: number,
  bestTrade: { pnl, asset, executedAt },
  worstTrade: { pnl, asset, executedAt },
  currentDrawdown: number, // (peakValue - currentValue) / peakValue
  sharpeRatio: number      // avgDailyReturn / stdDevDailyReturn * sqrt(365)
}
```

#### `GET /analytics/pnl-chart`

P&L diario últimos 30 días:

```typescript
{ date: string, pnl: number }[]
```

Agrupar trades por día (`executedAt`), sumar P&L de positions cerradas ese día.

#### `GET /analytics/asset-breakdown`

P&L desglosado por asset:

```typescript
{ asset: 'BTC' | 'ETH', totalPnl: number, trades: number, winRate: number }[]
```

---

### Gap D — AdminModule: agents/status (BAJA 🟢)

Agregar endpoint `GET /admin/agents/status` al `AdminController` existente.

Requiere `TradingModule` (Gap A) para leer el estado de Redis de todos los agentes activos.

Respuesta:

```typescript
{
  users: {
    userId: string,
    email: string,
    agentStatus: { running: boolean, lastRun: string, nextRun: string, currentInterval: number } | null
  }[]
}
```

---

### Gap E — Kill-switch real (BAJA 🟢, depende de Gap A)

El `AdminService.killSwitch()` actual solo hace `updateMany` en DB. Una vez implementado el TradingModule, debe también:

1. Llamar a `TradingService.stopAllAgents()` — cancela todos los Bull jobs activos
2. Limpiar todas las keys `agent:*:status` en Redis
3. Emitir `agent:killed` a todos los usuarios conectados via `AppGateway.server.emit()`

---

## 3. Orden de implementación recomendado

```
Gap A (TradingModule)       ← PRIMERO — bloquea todo lo demás
  └─ Gap D (agents/status)  ← depende de A
  └─ Gap E (kill-switch)    ← depende de A

Gap B (MarketModule)        ← independiente, puede hacerse en paralelo con A
Gap C (Analytics extendida) ← independiente, puede hacerse en paralelo con A
```

---

## 4. DTOs necesarios para TradingModule

```typescript
// trading-config.dto.ts
class CreateTradingConfigDto {
  asset: 'BTC' | 'ETH';
  pair: 'USDT' | 'USDC';
  mode: 'LIVE' | 'SANDBOX';
  buyThreshold?: number; // default 70
  sellThreshold?: number; // default 70
  stopLossPct?: number; // default 0.03
  takeProfitPct?: number; // default 0.05
  maxTradePct?: number; // default 0.05
  maxConcurrentPositions?: number; // default 2
  minIntervalMinutes?: number; // default 5
}

class UpdateTradingConfigDto extends PartialType(CreateTradingConfigDto) {}

class StartAgentDto {
  asset: 'BTC' | 'ETH';
  pair: 'USDT' | 'USDC';
}
```

---

## 5. Integraciones entre módulos

Una vez implementado el TradingModule, el `AppModule` debe registrarlo:

```typescript
// app.module.ts — agregar:
import { TradingModule } from '../trading/trading.module';
import { MarketModule } from '../market/market.module';
import { BullModule } from '@nestjs/bull';

// En imports:
BullModule.forRoot({ redis: process.env.REDIS_URL }),
TradingModule,
MarketModule,
```

Y el `AdminModule` debe tener acceso a `TradingService` para el kill-switch real.

---

## 6. Variables de entorno requeridas (nuevas)

| Variable               | Descripción                  | Ejemplo                  |
| ---------------------- | ---------------------------- | ------------------------ |
| `REDIS_URL`            | Ya en spec pero no usado aún | `redis://localhost:6379` |
| `CRYPTOPANIC_API_KEY`  | Para news fetcher            | `abc123`                 |
| `REDDIT_CLIENT_ID`     | Para Reddit fetcher          | `xyz`                    |
| `REDDIT_CLIENT_SECRET` | Para Reddit fetcher          | `xyz`                    |

---

## 7. Criterios de aceptación globales

- [ ] `POST /api/trading/start` arranca el agente y encola el primer job en Bull
- [ ] El job se ejecuta: fetch candles → indicadores → LLM → decisión guardada en DB
- [ ] Si decisión es BUY: se crea Position + Trade en DB, llega notificación WebSocket
- [ ] `POST /api/trading/stop` cancela el job activo y actualiza estado en Redis
- [ ] `GET /api/trading/status` devuelve el estado actual de Redis
- [ ] `GET /api/market/ohlcv/BTC/1h` devuelve array de candles sin error
- [ ] `GET /api/analytics/summary` devuelve win rate y sharpe ratio calculados correctamente
- [ ] `POST /api/admin/kill-switch` cancela Bull jobs Y actualiza DB Y emite WebSocket
- [ ] `pnpm test:api` pasa sin regresiones
- [ ] `pnpm build:api` compila sin errores TypeScript

---

## 8. Archivos a crear (resumen)

```
apps/api/src/trading/
  trading.module.ts
  trading.controller.ts
  trading.service.ts
  trading.processor.ts
  dto/trading-config.dto.ts

apps/api/src/market/
  market.module.ts
  market.controller.ts
  market.service.ts
```

**Archivos a modificar:**

```
apps/api/src/app/app.module.ts           — registrar TradingModule, MarketModule, BullModule
apps/api/src/admin/admin.service.ts      — mejorar kill-switch + endpoint agents/status
apps/api/src/admin/admin.controller.ts   — añadir GET /admin/agents/status
apps/api/src/analytics/analytics.service.ts   — añadir summary, pnl-chart, asset-breakdown
apps/api/src/analytics/analytics.controller.ts — añadir 3 endpoints
apps/api/src/gateway/app.gateway.ts      — añadir emitToAll para agent:killed
```

---

**Depende de:** 02-auth-users, 04-analysis-engine, 05-trading-engine, 06-backend-support
**Desbloquea:** 14-api-documentation
**Siguiente acción después de este spec:** Implementar en el orden del §3
