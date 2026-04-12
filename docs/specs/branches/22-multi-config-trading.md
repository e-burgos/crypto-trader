# Spec 22 — Multi-Config de Trading, Campos Extendidos y Strategy Presets

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/multi-config-trading`
**Dependencias:** Spec 15 (backend-completion), Spec 16 (frontend-completion)

---

## 1. Resumen ejecutivo

Se expande el modelo de `TradingConfig` más allá de lo definido en el spec original (v1.2). Los cambios clave son:

1. **Multi-config**: el usuario puede tener múltiples configuraciones simultáneas (una por par asset/quote).
2. **Nuevos campos**: `name`, `minProfitPct`, `orderPriceOffsetPct`, `intervalMode`, `isActive`, `isRunning`.
3. **IntervalMode**: el usuario puede elegir que el agente controle el intervalo automáticamente (`AGENT`) o fijarlo manualmente (`CUSTOM`).
4. **Strategy Presets**: tres presets predefinidos (conservative/balanced/aggressive) para configuración rápida.
5. **Agent intelligence components**: componentes de UI que explican el flujo de decisión del agente.

---

## 2. Cambios en el modelo Prisma

### `TradingConfig` — campos extendidos

```prisma
model TradingConfig {
  -- Campos originales (spec v1.2)
  id                      String       @id @default(cuid())
  userId                  String
  asset                   String       -- "BTC" | "ETH"
  pair                    String       -- "USDT" | "USDC"
  mode                    TradingMode
  buyThreshold            Float        @default(0.7)
  sellThreshold           Float        @default(0.7)
  stopLossPct             Float        @default(0.03)
  takeProfitPct           Float        @default(0.05)
  maxTradePct             Float        @default(0.1)
  maxConcurrentPositions  Int          @default(2)
  minIntervalMinutes      Int          @default(60)

  -- Campos nuevos (spec 22)
  name                    String?      @db.VarChar(50)    -- nombre descriptivo del agente
  minProfitPct            Float        @default(0.003)   -- ganancia mínima para cerrar posición
  orderPriceOffsetPct     Float        @default(0)       -- offset de precio para órdenes limit (%)
  intervalMode            IntervalMode @default(AGENT)   -- AGENT = el LLM sugiere; CUSTOM = minIntervalMinutes fijo
  isActive                Boolean      @default(true)    -- config activa (no archivada)
  isRunning               Boolean      @default(false)   -- agente corriendo actualmente

  -- Relaciones
  user                    User         @relation(fields: [userId], references: [id])
  positions               Position[]
  decisions               AgentDecision[]
  createdAt               DateTime     @default(now())
  updatedAt               DateTime     @updatedAt

  @@unique([userId, asset, pair, mode])  -- un agente por combinación única
}

enum IntervalMode {
  AGENT   -- el campo suggested_wait_minutes del LLM determina el próximo análisis
  CUSTOM  -- se usa siempre minIntervalMinutes fijo
}
```

---

## 3. Cambios en el DTO

### `CreateTradingConfigDto` y `UpdateTradingConfigDto`

Campos añadidos:

| Campo | Tipo | Validación | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `name` | `string?` | max 50 chars | — | Nombre del agente |
| `minProfitPct` | `number?` | 0–100 | 0.003 | Ganancia mínima para cerrar posición (fracción) |
| `orderPriceOffsetPct` | `number?` | -5 a 5 | 0 | Offset de precio en % para órdenes limit. Negativo = más barato (mejor para BUY), positivo = más caro (peor para BUY, mejor para SELL) |
| `intervalMode` | `IntervalModeEnum?` | enum | `AGENT` | Modo de control del intervalo |

### Endpoint de CRUD

El endpoint cambia de `PUT /trading/config` (un solo config) a:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/trading/config` | Lista todas las configs del usuario |
| `POST` | `/trading/config` | Crea nueva config (400 si ya existe mismo asset/pair/mode activo) |
| `PUT` | `/trading/config/:id` | Actualiza config por ID |
| `DELETE` | `/trading/config/:id` | Elimina config y detiene su agente |

---

## 4. Lógica extendida del Agente

### IntervalMode.AGENT
- El LLM devuelve `suggested_wait_minutes` en su respuesta JSON.
- El siguiente análisis se programa con ese delay.
- Si el LLM no devuelve el campo, se usa `minIntervalMinutes` como fallback.

### IntervalMode.CUSTOM
- `suggested_wait_minutes` del LLM se ignora.
- Siempre se usa `minIntervalMinutes` fijo.

### minProfitPct
- El agente no ejecuta SELL (basado en señal LLM) a menos que la posición tenga al menos `minProfitPct` × `entryPrice` de ganancia.
- `stop_loss` y `take_profit` funcionan independientemente de este campo.
- Evita cierres prematuros en mercados con alta volatilidad de ruido.

### orderPriceOffsetPct
- Para órdenes BUY limit: `orderPrice = marketPrice × (1 + offsetPct / 100)` — offset negativo logra precio de entrada más bajo.
- Para órdenes SELL limit: el mismo offset se aplica al precio de salida.
- En modo SANDBOX/TESTNET: el offset se aplica al precio de mercado actual (simulado).
- Default 0 = orden al precio de mercado actual (comportamiento original).

---

## 5. Frontend — Config Page (`/dashboard/config`)

### 5.1 Multi-config UI

La página `config.tsx` pasa de gestionar una sola config a una lista de configs:

- **Panel izquierdo**: lista de configs existentes del usuario con estado (running/stopped/inactive)
- **Panel derecho**: formulario de la config seleccionada (editable inline)
- **Botón "Nueva configuración"**: abre formulario vacío con valores de preset aplicados
- **Indicador de estado**: badge verde pulsante = agente running, gris = detenido
- **Botones por config**: play/stop, editar, eliminar (con confirmación)

### 5.2 Formulario extendido

Campos adicionales en el formulario:

| Campo | Control | Descripción |
|-------|---------|-------------|
| `name` | input text | Nombre del agente (ej: "BTC Conservador") |
| `intervalMode` | toggle AGENT/CUSTOM | AGENT = LLM elige; CUSTOM = intervalo fijo |
| `minIntervalMinutes` | slider + input | Solo visible si intervalMode = CUSTOM |
| `minProfitPct` | slider + input | Ganancia mínima para cerrar (ej: 0.3%) |
| `orderPriceOffsetPct` | slider con -5 a +5 | Offset de precio limit |

### 5.3 Validación de TESTNET

En el formulario de config, si el usuario selecciona `mode = TESTNET`:
- Se verifica `useTestnetBinanceKeyStatus()`.
- Si no hay keys testnet configuradas: se muestra un warning inline con enlace a Settings.
- El botón "Guardar" queda deshabilitado hasta que haya keys testnet.

---

## 6. Strategy Presets

### Componente `StrategyPresets`

Ubicado en `apps/web/src/components/agent/strategy-presets.tsx`.

Tres presets predefinidos:

| Preset | buyThreshold | sellThreshold | stopLossPct | takeProfitPct | minProfitPct | maxTradePct | maxConcurrentPositions | minIntervalMinutes | orderPriceOffsetPct |
|--------|-------------|--------------|-------------|--------------|--------------|-------------|----------------------|-------------------|--------------------|
| **Conservative** | 85% | 80% | 2% | 3% | 0.2% | 5% | 1 | 120min | -1% |
| **Balanced** | 72% | 68% | 3% | 5% | 0.3% | 10% | 3 | 60min | 0% |
| **Aggressive** | 60% | 55% | 5% | 10% | 0.1% | 20% | 5 | 30min | +1% |

El componente puede usarse en dos modos:
- **Read-only**: muestra las tarjetas informativas sin botones (en help/explainers)
- **Interactive** (con `onApply` callback): al hacer clic aplica el preset al formulario de config

---

## 7. Agent Intelligence Components

Componentes en `apps/web/src/components/agent/`:

| Componente | Descripción |
|-----------|-------------|
| `decision-flow-diagram.tsx` | Diagrama visual del flujo de decisión: fuentes → LLM → decisión de trading |
| `explain-panel.tsx` | Panel explicativo de un parámetro: muestra nombre, descripción, impacto y rango recomendado |
| `parameter-cards.tsx` | Tarjetas de resumen de todos los parámetros de una config (read-only) |
| `strategy-presets.tsx` | Tarjetas de presets con aplicación rápida |

**DecisionFlowDiagram** muestra tres fuentes de entrada:
1. Market data (200 candles, RSI, MACD, BB)
2. Noticias (fuentes configuradas, sentimiento)
3. Trades recientes (últimos 10, auto-reflexión)

Estas fluyen hacia el LLM (proveedor y modelo del usuario) que produce `BUY | SELL | HOLD` con confianza.

**ExplainPanel** es invocado por `InfoTooltip` en el formulario de config al hacer clic en el ícono de información de cada parámetro.

---

## 8. Criterios de aceptación

- [ ] Un usuario puede tener múltiples configs simultáneas (max 1 por asset/pair/mode)
- [ ] Config con `intervalMode = AGENT` usa `suggested_wait_minutes` del LLM
- [ ] Config con `intervalMode = CUSTOM` siempre usa `minIntervalMinutes`
- [ ] `minProfitPct` impide cerrar posiciones con pérdida por señal LLM (no afecta stop-loss)
- [ ] `orderPriceOffsetPct` ajusta el precio de la orden limit correctamente en todos los modos
- [ ] `POST /trading/config` retorna 400 si ya existe config idéntica (mismo asset/pair/mode)
- [ ] `DELETE /trading/config/:id` detiene el agente si estaba running antes de eliminar
- [ ] Los presets se aplican correctamente al formulario de config
- [ ] La UI muestra estado running/stopped por config con indicadores visuales
- [ ] Warning TESTNET se muestra si no hay keys testnet configuradas

---

**Depende de:** Spec 15, Spec 20 (TESTNET)
**Consumidores:** Config page, Onboarding wizard
