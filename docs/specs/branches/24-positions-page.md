# Spec 24 — Positions Management Page

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/positions-page`
**Dependencias:** Spec 15 (trading module), Spec 16 (frontend-completion)

---

## 1. Resumen ejecutivo

El spec original agrupaba posiciones abiertas en el `Overview`. La implementación introdujo una página dedicada para la gestión de posiciones (`/dashboard/positions`) que incluye:

- Vista de posiciones **abiertas** con P&L en tiempo real
- Vista de posiciones **cerradas** con historial paginado
- Modal de detalle con el historial de trades por posición
- Acción de **cierre manual** de posiciones abiertas
- P&L no realizado calculado con precio actual de mercado

---

## 2. Modelo de datos

### `TradingPosition` (frontend)

```typescript
interface TradingPosition {
  id: string;
  asset: string;           // "BTC" | "ETH"
  pair: string;            // "USDT" | "USDC"
  mode: TradingMode;       // "SANDBOX" | "TESTNET" | "LIVE"
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryAt: string;         // ISO 8601
  exitAt: string | null;
  fees: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number | null;      // P&L realizado (solo CLOSED)
  config?: {               // snapshot de config al momento de la posición
    stopLossPct: number;
    takeProfitPct: number;
    maxTradePct: number;
    buyThreshold: number;
    sellThreshold: number;
    minIntervalMinutes: number;
    orderPriceOffsetPct: number;
    maxConcurrentPositions: number;
  };
  trades?: Array<{         // trades BUY/SELL que componen la posición
    id: string;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    fee: number;
    executedAt: string;
    binanceOrderId?: string | null;
  }>;
}
```

### P&L no realizado (posiciones abiertas)

Calculado en frontend con la función `calcUnrealizedPnl` de `use-live-prices.ts`:

```typescript
function calcUnrealizedPnl(position: TradingPosition, currentPrice: number): number {
  const grossValue = position.quantity * currentPrice;
  const entryValue = position.quantity * position.entryPrice;
  return grossValue - entryValue - position.fees;
}
```

Los precios en tiempo real provienen del hook `useLivePrices()` que hace polling al WebSocket price:tick o a `/market/ohlcv`.

---

## 3. Endpoints usados

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/trading/positions?page=1&limit=20&status=OPEN` | Posiciones del usuario (paginado) |
| `POST` | `/trading/positions/:id/close` | Cierre manual de posición abierta |

### Parámetros del GET /trading/positions

| Query param | Tipo | Default | Descripción |
|-------------|------|---------|-------------|
| `page` | number | 1 | Página actual |
| `limit` | number | 20 | Items por página |
| `status` | 'OPEN' \| 'CLOSED' | — (todas) | Filtrar por estado |

---

## 4. Estructura de la página

### 4.1 Tabs de estado

La página tiene dos tabs:
- **OPEN** (Posiciones Abiertas) — se muestra por defecto
- **CLOSED** (Posiciones Cerradas)

El tab activo se mantiene en el estado local del componente.

### 4.2 Paginación

- `PAGE_SIZE = 20` items por página
- Controles: botón "Anterior" y "Siguiente" con estado de página actual
- Botones deshabilitados en el primer/último página

### 4.3 Tabla de posiciones

Columnas mostradas:

| Columna | Descripción |
|---------|-------------|
| Asset | Badge con BTC/ETH + par (USDT/USDC) |
| Modo | Badge SANDBOX/TESTNET/LIVE con colores diferenciados |
| Precio entrada | Precio de compra |
| Precio actual / Precio cierre | Precio en tiempo real (OPEN) o precio de cierre (CLOSED) |
| Cantidad | Unidades del asset |
| P&L no realizado (OPEN) | Valor en USD + porcentaje, actualizado en tiempo real |
| P&L realizado (CLOSED) | Valor en USD + porcentaje |
| Fecha entrada | Timestamp formateado |
| Fecha cierre (CLOSED) | Timestamp formateado |
| Acciones | Botón "Ver detalle" + Botón "Cerrar" (solo OPEN) |

### 4.4 Indicadores de P&L

- P&L positivo: texto verde + TrendingUp icon
- P&L negativo: texto rojo + TrendingDown icon
- P&L nulo/cero: texto muted + Minus icon

---

## 5. Modal de Detalle de Posición

Al hacer clic en "Ver detalle", se abre un portal modal (`createPortal`) con:

### Información principal
- Asset, par y modo (badge visual)
- Precio de entrada y salida (o precio actual si OPEN)
- Cantidad total del asset
- P&L (realizado o estimado)
- Quote currency (extraída del par)

### Config snapshot
Si la posición tiene `config` en su payload:
- Stop-loss %
- Take-profit %
- Max trade %
- Buy/Sell thresholds
- Min interval minutes
- Order price offset %
- Max concurrent positions

### Historial de trades
Lista de todos los trades (`BUY`/`SELL`) que conforman la posición:
- Tipo (badge BUY=verde/SELL=rojo)
- Precio ejecutado
- Cantidad
- Fee
- Fecha/hora de ejecución
- Binance Order ID (si disponible, en modo LIVE/TESTNET)

---

## 6. Cierre Manual de Posición

### 6.1 Flujo

1. Usuario hace clic en "Cerrar posición"
2. Se muestra confirmación inline (no modal): "¿Confirmar cierre manual a precio de mercado?"
3. Al confirmar: `useClosePosition()` → `POST /trading/positions/:id/close`
4. Éxito: toast "Posición cerrada", la posición desaparece de la tab OPEN y aparece en CLOSED
5. Error: toast de error con mensaje

### 6.2 Backend — `POST /trading/positions/:id/close`

- Verifica que la posición pertenezca al usuario autenticado
- Verifica que el estado sea `OPEN`
- En modo LIVE/TESTNET: ejecuta orden SELL real en Binance
- En modo SANDBOX: cierra la posición virtual
- Actualiza `status = CLOSED`, `exitPrice`, `exitAt`, `pnl`
- Emite evento WebSocket `position:updated` al usuario

---

## 7. Live Prices Integration

### `useLivePrices()`

Hook en `apps/web/src/hooks/use-live-prices.ts`:

```typescript
interface LivePricesState {
  prices: Record<string, number>; // { "BTC": 94500.12, "ETH": 3200.45 }
  lastUpdate: number;
}
```

Fuentes de precio (por orden de prioridad):
1. WebSocket `price:tick` del backend (si conectado)
2. `useBinanceTicker()` — polling a Binance public REST API cada 5s

`calcUnrealizedPnl` se re-calcula automáticamente cuando cambia el precio.

### `useMarketStore`

El precio del asset seleccionado se comparte globalmente a través de `market.store.ts` para que múltiples componentes (ticker, positions, chart) lean el mismo precio sin múltiples fetches paralelos.

---

## 8. Animaciones (GSAP)

- Entrada de la página: fade + slide desde el bottom con stagger por fila
- Las filas de P&L que cambian de valor tienen una animación de highlight (flash amarillo)
- El modal de detalle hace fade-in con scale desde el centro
- Cierre del modal: fade-out + scale out

---

## 9. Criterios de aceptación

- [ ] La tab OPEN muestra posiciones abiertas con P&L no realizado actualizado en tiempo real
- [ ] La tab CLOSED muestra posiciones cerradas con P&L realizado
- [ ] La paginación funciona correctamente en ambas tabs
- [ ] El modal de detalle muestra la config snapshot y el historial de trades
- [ ] El cierre manual funciona en modo SANDBOX (simula cierre)
- [ ] El cierre manual emite la orden real en modos LIVE y TESTNET
- [ ] `binanceOrderId` se muestra cuando está disponible (LIVE/TESTNET)
- [ ] Los precios en tiempo real actualizan el P&L no realizado sin recargar la página
- [ ] Posiciones de diferentes modos (SANDBOX/TESTNET/LIVE) se filtran visualmente con badges
- [ ] El estado loading y error se manejan con UI adecuada

---

**Depende de:** Spec 15 (trading module), Spec 20 (testnet)
**Consumidores:** Overview (resumen de posiciones abiertas), Notifications (stop-loss/take-profit)
