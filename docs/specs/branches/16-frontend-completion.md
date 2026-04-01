# Spec 16 — Frontend Completion

**Fecha:** 2026-04-01
**Versión:** 1.0
**Estado:** Aprobado
**Branch:** `feature/frontend-completion`

---

## Objetivo

Completar el frontend de la plataforma de trading alineándolo al 100% con:

1. El spec original (v1.2) — funcionalidad planificada
2. El backend actual — endpoints, DTOs y eventos WebSocket disponibles
3. El estado real del código — corrigiendo rutas rotas, campos incorrectos y páginas vacías

---

## 1. Auditoría — Estado actual vs lo que debería ser

### 1.1 Hooks con rutas incorrectas ❌

| Archivo                 | Ruta actual                      | Ruta correcta                                                    |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `use-trading-config.ts` | `GET /trading-config`            | `GET /trading/config`                                            |
| `use-trading-config.ts` | `POST /trading-config`           | `PUT /trading/config`                                            |
| `use-trading-config.ts` | `POST /trading-config/:id/start` | `POST /trading/start`                                            |
| `use-trading-config.ts` | `POST /trading-config/:id/stop`  | `POST /trading/stop`                                             |
| `use-user.ts`           | `PATCH /users/:id/status`        | `PUT /users/me`                                                  |
| `use-notifications.ts`  | Sin mutaciones                   | `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` |

### 1.2 Formularios con campos incorrectos ❌

**`config.tsx` (`ConfigPage`):**

| Campo actual                      | Problema            | Campo backend                                     |
| --------------------------------- | ------------------- | ------------------------------------------------- |
| `capitalUsdt`                     | No existe en el DTO | — (eliminarlo)                                    |
| `maxDailyLossPct`                 | No existe en el DTO | — (eliminarlo)                                    |
| `maxPositionPct`                  | Nombre incorrecto   | `maxTradePct`                                     |
| Pairs: BNB/SOL/ADA/DOT/AVAX/MATIC | No soportados       | Solo `BTC/ETH` × `USDT/USDC`                      |
| `PAPER` como modo                 | Incorrecto          | `SANDBOX` (backend usa `TradingModeEnum.SANDBOX`) |
| Endpoint POST `/trading-config`   | Incorrecto          | `PUT /trading/config`                             |

### 1.3 Páginas vacías / placeholder ❌

| Página             | Estado                            | Requiere                                                          |
| ------------------ | --------------------------------- | ----------------------------------------------------------------- |
| `settings.tsx`     | Placeholder — "coming in Spec 10" | Gestión Binance keys + LLM keys                                   |
| `price-ticker.tsx` | Datos mock hardcodeados           | Datos reales vía WebSocket `price:tick` o polling `/market/ohlcv` |
| `live-chart.tsx`   | Datos mock ("demo data")          | Real data vía `GET /market/ohlcv/:asset/:interval`                |

### 1.4 Páginas faltantes ❌

| Página              | Spec ref | Backend endpoint(s)                                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Open Positions      | §5.7     | `GET /trading/positions`                                                                             |
| News Feed           | §5.7     | `GET /market/news`                                                                                   |
| Admin Panel         | §5.7     | `GET /admin/stats`, `/admin/users`, `/admin/kill-switch`, `/admin/audit-log`, `/admin/agents/status` |
| Notifications Panel | §5.8     | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`               |

### 1.5 API client incompleto ❌

`apps/web/src/lib/api.ts` — Solo tiene `post`, `get`, `patch`. Faltan:

- `put` — para `/trading/config`, `/users/me`
- `delete` — para `/users/me/binance-keys`, `/users/me/llm-keys/:provider`
- Interceptor de token refresh (401 → `POST /auth/refresh` → retry)

### 1.6 WebSocket incompleto ❌

`apps/web/src/hooks/use-websocket.ts` — Faltan handlers para:

- `agent:decision` → invalidar `['analytics', 'decisions']` + toast info
- `price:tick` → actualizar precios en vivo en el ticker y la página de chart
- `position:updated` → invalidar `['trading', 'positions']`
- `agent:killed` → toast warning + invalidar configs

### 1.7 Navbar sin estado autenticado ❌

`apps/web/src/components/navbar.tsx` — No detecta si el usuario está logueado. Siempre muestra "Sign In" y "Get Started".

---

## 2. Hooks nuevos requeridos

| Hook file                      | Propósito                                        | Endpoints                                                                                                                                      |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-market.ts`                | OHLCV + noticias                                 | `GET /market/ohlcv/:asset/:interval`, `GET /market/news`                                                                                       |
| `use-trading.ts`               | Posiciones, historial, estado agente, start/stop | `GET /trading/positions`, `GET /trading/history`, `GET /trading/status`, `POST /trading/start`, `POST /trading/stop`, `GET /trading/decisions` |
| Ampliar `use-analytics.ts`     | P&L chart + summary + asset breakdown            | `GET /analytics/summary`, `GET /analytics/pnl-chart`, `GET /analytics/asset-breakdown`                                                         |
| Ampliar `use-notifications.ts` | Mutaciones de lectura                            | `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`                                                                               |

---

## 3. Tareas de implementación

---

### Tarea 1 — Completar el API client (`api.ts`)

**Archivo:** `apps/web/src/lib/api.ts`

**Cambios:**

1. Añadir métodos `put` y `delete`
2. Añadir interceptor de refresh token: si la respuesta es 401 y existe `refreshToken` en localStorage, llamar `POST /auth/refresh`, guardar nuevo `accessToken` y reintentar la request original una vez. Si el refresh también falla, llamar `logout()` del store.

**Criterio de aceptación:** Las llamadas con token expirado se renuevan automáticamente sin redirigir al login.

---

### Tarea 2 — Reescribir `use-trading-config.ts` → `use-trading.ts`

**Archivo:** `apps/web/src/hooks/use-trading.ts` (nuevo, reemplaza `use-trading-config.ts`)

**Hooks a exportar:**

```typescript
useTradingConfigs()         // GET /trading/config
useUpsertConfig()           // PUT /trading/config
useUpdateConfig(id)         // PUT /trading/config/:id
useStartAgent()             // POST /trading/start  — body: { asset, pair }
useStopAgent()              // POST /trading/stop   — body: { asset, pair }
useAgentStatus()            // GET /trading/status
useOpenPositions(page?, limit?) // GET /trading/positions
useTradingHistory(page?, limit?, filters?) // GET /trading/history
useTradingDecisions(page?, limit?) // GET /trading/decisions
```

**Criterio de aceptación:** Todos los hooks usan las rutas `/trading/*` correctas. `use-trading-config.ts` eliminado.

---

### Tarea 3 — Ampliar `use-analytics.ts`

**Archivo:** `apps/web/src/hooks/use-analytics.ts`

**Añadir:**

```typescript
export interface AnalyticsSummary {
  winRate: number; // 0–1
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  sharpeRatio: number;
  currentDrawdown: number;
}

export interface PnlChartPoint {
  date: string; // 'YYYY-MM-DD'
  pnl: number;
}

export interface AssetBreakdown {
  asset: string;
  totalPnl: number;
  tradeCount: number;
}

useAnalyticsSummary(); // GET /analytics/summary
usePnlChart(); // GET /analytics/pnl-chart
useAssetBreakdown(); // GET /analytics/asset-breakdown
```

**Criterio de aceptación:** Los tres endpoints nuevos están disponibles como hooks con `queryKey` únicos.

---

### Tarea 4 — Nuevo `use-market.ts`

**Archivo:** `apps/web/src/hooks/use-market.ts`

```typescript
export interface OhlcvCandle {
  time: number;     // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  source: string;
  headline: string;
  url: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  publishedAt: string;
}

useOhlcv(asset: string, interval: string, limit?: number) // GET /market/ohlcv/:asset/:interval
useMarketNews(limit?: number)  // GET /market/news
```

**Criterio de aceptación:** `useOhlcv('BTC', '1h', 200)` retorna array de velas; `useMarketNews(20)` retorna array de artículos.

---

### Tarea 5 — Ampliar `use-notifications.ts`

**Archivo:** `apps/web/src/hooks/use-notifications.ts`

**Añadir mutaciones:**

```typescript
useMarkAllRead(); // PATCH /notifications/read-all
useMarkRead(); // PATCH /notifications/:id/read
```

Ambas invalidan `['notifications']` en onSuccess.

---

### Tarea 6 — Ampliar WebSocket (`use-websocket.ts`)

**Archivo:** `apps/web/src/hooks/use-websocket.ts`

**Añadir handlers:**

```typescript
// price:tick — { symbol: string, price: number, change24h: number }
socket.on('price:tick', (data) => {
  queryClient.setQueryData(['market', 'prices'], ...); // merge price
});

// agent:decision — { userId, asset, decision, confidence }
socket.on('agent:decision', () => {
  queryClient.invalidateQueries({ queryKey: ['trading', 'decisions'] });
  toast.info(`Agent decision: ${data.decision} ${data.asset} (${data.confidence}%)`);
});

// position:updated — position data
socket.on('position:updated', () => {
  queryClient.invalidateQueries({ queryKey: ['trading', 'positions'] });
});

// agent:killed — admin kill-switch
socket.on('agent:killed', () => {
  queryClient.invalidateQueries({ queryKey: ['trading'] });
  toast.warning('All agents stopped by admin', { duration: 8000 });
});
```

---

### Tarea 7 — Actualizar Navbar (estado autenticado)

**Archivo:** `apps/web/src/components/navbar.tsx`

**Cambios:**

- Leer `isAuthenticated` y `user` del `useAuthStore`
- Si autenticado: mostrar avatar/inicial del usuario, link al `/dashboard`, botón logout, badge con `useUnreadCount()`
- Si no autenticado: mantener Sign In / Get Started
- Icono de notificaciones con badge numérico (rojo si > 0) que abre `NotificationsDropdown`

---

### Tarea 8 — Nuevo componente `NotificationsDropdown`

**Archivo:** `apps/web/src/components/notifications-dropdown.tsx`

**UI:**

- Dropdown/popover activado por el icono de campana en el navbar
- Lista de las últimas 10 notificaciones (`useNotifications()`)
- Cada item: ícono por tipo, mensaje, tiempo relativo, indicador visual si no leída
- Botón "Mark all read" en el header → `useMarkAllRead()`
- Click en item → `useMarkRead(id)` + marca visual
- Badge desaparece al marcar todas como leídas

---

### Tarea 9 — Corregir `ConfigPage` (`config.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/config.tsx`

**Cambios:**

1. Reemplazar `useCreateConfig` / `useToggleConfig` por hooks del nuevo `use-trading.ts`
2. Corregir campos del formulario:
   - `asset`: selector `BTC | ETH` (solo estas dos)
   - `pair`: selector `USDT | USDC`
   - `mode`: `SANDBOX | LIVE` (no `PAPER`)
   - Eliminar `capitalUsdt`, `maxDailyLossPct`
   - Renombrar `maxPositionPct` → `maxTradePct`
   - Añadir `buyThreshold`, `sellThreshold` (0–100, sliders)
   - Añadir `maxConcurrentPositions` (1–10)
   - Añadir `minIntervalMinutes` (1–1440)
3. Formulario con `useUpsertConfig()` → `PUT /trading/config`
4. Sección "Active Agents" debajo del formulario: lista de configs con estado (badge running/stopped) y botones start/stop usando `useStartAgent()` / `useStopAgent()`
5. `useAgentStatus()` para mostrar estado real de cada agente

**Criterio de aceptación:** El formulario guarda correctamente en el backend. Los botones start/stop funcionan.

---

### Tarea 10 — Corregir `LiveChartPage` (`live-chart.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/live-chart.tsx`

**Cambios:**

1. Estado local: `asset` ('BTC' | 'ETH'), `interval` ('1m' | '5m' | '15m' | '1h' | '4h' | '1d') — por defecto `BTC`, `1h`
2. Usar `useOhlcv(asset, interval, 200)` del nuevo `use-market.ts`
3. Eliminiar `generateMockCandles()`
4. Mapear la respuesta al formato que espera `lightweight-charts` (el backend devuelve candles con `time` en ms, convertir a segundos)
5. Selector de asset (BTC/ETH) — tab o toggle
6. Loading skeleton mientras carga
7. WebSocket: suscribirse a `price:tick` para actualizar el último precio en tiempo real (badge encima del gráfico)

**Criterio de aceptación:** El gráfico muestra velas reales de Binance. No hay `generateMockCandles`.

---

### Tarea 11 — Corregir `AnalyticsPage` (`analytics.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/analytics.tsx`

**Cambios:**

1. Reemplazar el cálculo manual de win rate por datos de `useAnalyticsSummary()`
2. Añadir sección "P&L Chart" — `LineChart` de Recharts con datos de `usePnlChart()` (últimos 30 días)
3. Añadir sección "Asset Breakdown" — `BarChart` de Recharts con datos de `useAssetBreakdown()`
4. Métricas nuevas: Sharpe ratio, drawdown, bestTrade, worstTrade
5. Animaciones GSAP en entrada de los cards (ya existe patron en `overview.tsx`)

**Criterio de aceptación:** Analytics muestra gráfico de PnL real y breakdown por asset.

---

### Tarea 12 — Corregir `SettingsPage` (`settings.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/settings.tsx`

**Cambios:** Implementar las siguientes secciones:

**Sección 1 — Perfil:**

- Formulario con `email` → `PUT /users/me` via `useUpdateProfile()` (corregida para usar `PUT /users/me`)
- Cambio de contraseña (campo `password`) — mismo endpoint

**Sección 2 — Binance API Keys:**

- Status badge (conectado/desconectado) vía `useBinanceKeyStatus()`
- Formulario para ingresar `apiKey` + `apiSecret` → `useSetBinanceKeys()`
- Botón "Disconnect" → `DELETE /users/me/binance-keys` (añadir `useDeleteBinanceKeys()` en `use-user.ts`)
- Tip con link a cómo crear API keys en Binance

**Sección 3 — LLM API Keys:**

- Tabla/cards de proveedores: Claude, OpenAI, Groq
- Badge estado por proveedor vía `useLLMKeyStatus()` (corregir endpoint de `/users/me/llm-keys` → existe como `/users/me/llm-keys/status`)
- Por cada proveedor: formulario `apiKey` + selector de modelo → `useSetLLMKey()`
- Botón "Remove" → `DELETE /users/me/llm-keys/:provider` (añadir `useDeleteLLMKey()`)

---

### Tarea 13 — Nueva página: Open Positions (`positions.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/positions.tsx`

**UI:**

- Tabla de posiciones abiertas: asset, pair, modo, precio entrada, cantidad, P&L no realizado, fecha entrada
- `useOpenPositions()` con paginación (page, limit)
- Badge de modo `LIVE` / `SANDBOX`
- Estado vacío si no hay posiciones abiertas
- Animaciones de entrada de filas (GSAP, stagger)

**Route:** Añadir a `app.tsx`: `/dashboard/positions`
**Sidebar:** Añadir enlace "Positions" en `sidebar.tsx`

---

### Tarea 14 — Nueva página: News Feed (`news-feed.tsx`)

**Archivo:** `apps/web/src/pages/dashboard/news-feed.tsx`

**UI:**

- Grid de cards de noticias usando `useMarketNews(30)`
- Cada card: titular, fuente, tiempo relativo, badge de sentimiento (verde/rojo/gris)
- Filtros por sentimiento: All / Positive / Negative / Neutral
- Link externo a la noticia original
- Animación GSAP stagger en carga de cards

**Route:** `/dashboard/news`
**Sidebar:** Añadir enlace "News" en `sidebar.tsx`

---

### Tarea 15 — Nueva página: Admin Panel (`admin/`)

**Archivos:**

- `apps/web/src/pages/admin/index.tsx` — layout de admin
- `apps/web/src/pages/admin/users.tsx` — tabla de usuarios
- `apps/web/src/pages/admin/stats.tsx` — dashboard de stats

**Protección de ruta:** Solo usuarios con `role === 'ADMIN'` acceden. Redirigir al `/dashboard` si no.

**Contenido `stats.tsx`:**

- Stats cards usando `useAdminStats()`: totalUsers, totalTrades, openPositions, tradesToday, profitToday
- Botón "Kill Switch" con confirmación modal → `useKillSwitch()`
- Audit log table → `useAuditLog()` (últimas 50 acciones)
- Agents status list → nuevo `useAdminAgentsStatus()` (GET `/admin/agents/status`)

**Contenido `users.tsx`:**

- Tabla de todos los usuarios: email, role, isActive, createdAt, N configs
- `GET /admin/users` (endpoint en UsersController)
- Toggle activo/inactivo → `PATCH /admin/users/:id/status`

**Route:** Añadir a `app.tsx`: `/admin` → `AdminLayout` + subrutas

---

### Tarea 16 — Corregir `PriceTicker` (datos reales)

**Archivo:** `apps/web/src/components/price-ticker.tsx`

**Cambios:**

1. Crear state en Zustand (`market.store.ts`) para precios en vivo: `{ [symbol: string]: { price: number, change24h: number } }`
2. El WebSocket `price:tick` actualiza este store (Tarea 6)
3. `PriceTicker` lee del store en lugar de hardcodear. Si el store está vacío, mostrar skeleton mientras se conecta el WS
4. Mostrar solo BTC/USDT y ETH/USDT (los únicos soportados) más los datos que lleguen por WS

---

### Tarea 17 — Corregir Onboarding (`onboarding.tsx`)

**Archivo:** `apps/web/src/pages/onboarding.tsx`

**Bugs a corregir:**

1. Step 3: al finalizar llama `POST /trading-config` → debe ser `PUT /trading/config` con el DTO correcto (`asset`, `pair`, `mode`, valores conservadores por defecto)
2. Campo `initialCapital` no existe en el backend → eliminarlo o mostrarlo solo como UI informativa (sin enviarlo)
3. Modo `PAPER` → `SANDBOX`
4. Al completar el wizard: redirigir a `/dashboard` solo después de que la config se guarde exitosamente

---

### Tarea 18 — Actualizar Sidebar (`sidebar.tsx`)

**Archivo:** `apps/web/src/components/ui/sidebar.tsx`

**Añadir enlaces:**

- Positions (`/dashboard/positions`) — con ícono `Briefcase`
- News Feed (`/dashboard/news`) — con ícono `Newspaper`
- Separador "Admin" (visible solo si `user.role === 'ADMIN'`)
- Admin Panel (`/admin`) — con ícono `Shield`

---

## 4. Resumen de archivos a crear/modificar

### Archivos nuevos

| Archivo                                              | Tarea |
| ---------------------------------------------------- | ----- |
| `apps/web/src/hooks/use-trading.ts`                  | 2     |
| `apps/web/src/hooks/use-market.ts`                   | 4     |
| `apps/web/src/store/market.store.ts`                 | 16    |
| `apps/web/src/components/notifications-dropdown.tsx` | 8     |
| `apps/web/src/pages/dashboard/positions.tsx`         | 13    |
| `apps/web/src/pages/dashboard/news-feed.tsx`         | 14    |
| `apps/web/src/pages/admin/index.tsx`                 | 15    |
| `apps/web/src/pages/admin/stats.tsx`                 | 15    |
| `apps/web/src/pages/admin/users.tsx`                 | 15    |

### Archivos modificados

| Archivo                                       | Tarea          |
| --------------------------------------------- | -------------- |
| `apps/web/src/lib/api.ts`                     | 1              |
| `apps/web/src/hooks/use-analytics.ts`         | 3              |
| `apps/web/src/hooks/use-notifications.ts`     | 5              |
| `apps/web/src/hooks/use-websocket.ts`         | 6              |
| `apps/web/src/hooks/use-user.ts`              | 12             |
| `apps/web/src/components/navbar.tsx`          | 7              |
| `apps/web/src/components/price-ticker.tsx`    | 16             |
| `apps/web/src/components/ui/sidebar.tsx`      | 18             |
| `apps/web/src/pages/dashboard/config.tsx`     | 9              |
| `apps/web/src/pages/dashboard/live-chart.tsx` | 10             |
| `apps/web/src/pages/dashboard/analytics.tsx`  | 11             |
| `apps/web/src/pages/dashboard/settings.tsx`   | 12             |
| `apps/web/src/pages/onboarding.tsx`           | 17             |
| `apps/web/src/app/app.tsx`                    | 13, 14, 15, 18 |

### Archivos a eliminar

| Archivo                                    | Razón                            |
| ------------------------------------------ | -------------------------------- |
| `apps/web/src/hooks/use-trading-config.ts` | Reemplazado por `use-trading.ts` |

---

## 5. Nuevas funcionalidades transversales

### 5.1 — i18n EN/ES (`i18next`)

**Instalación:** `pnpm add i18next react-i18next -w`

**Archivos:**

- `apps/web/src/lib/i18n.ts` — configuración i18next, detector de idioma por `localStorage`
- `apps/web/src/locales/en.ts` — traducciones inglés
- `apps/web/src/locales/es.ts` — traducciones español

**Estructura de traducciones:**

```ts
// en.ts
export default {
  nav: { dashboard: 'Dashboard', signIn: 'Sign In', signOut: 'Sign Out', ... },
  dashboard: { overview: 'Overview', liveChart: 'Live Chart', ... },
  trading: { start: 'Start Agent', stop: 'Stop Agent', sandbox: 'Sandbox', live: 'Live', ... },
  analytics: { winRate: 'Win Rate', totalPnl: 'Total P&L', sharpe: 'Sharpe Ratio', ... },
  settings: { profile: 'Profile', binanceKeys: 'Binance API Keys', llmKeys: 'LLM Keys', ... },
  help: { faq: 'FAQ', guide: 'How to Trade', apiKeys: 'API Keys Setup', ... },
  common: { save: 'Save', cancel: 'Cancel', loading: 'Loading...', ... }
}
```

**Selector de idioma:** Toggle EN/ES en la navbar (junto al toggle dark/light). Persiste en `localStorage`.

**Cobertura:** Todos los textos visibles deben usar `t('key')`. Prohibido hardcodear strings en componentes.

### 5.2 — InfoTooltip (`info-tooltip.tsx`)

**Archivo:** `apps/web/src/components/info-tooltip.tsx`

**Propósito:** Componente `<InfoTooltip text="..." />` que renderiza un ícono `?` de `lucide-react` (`Info` o `HelpCircle`) que al hover muestra un tooltip con explicación en lenguaje simple.

**Props:**

```ts
interface InfoTooltipProps {
  text: string;       // Explicación simple del término
  side?: 'top' | 'right' | 'bottom' | 'left'; // default: 'top'
  className?: string;
}
```

**Implementación:** Usar `title` HTML attribute + CSS tooltip custom, o `@radix-ui/react-tooltip` si está disponible.

**Dónde usar:**

| Card / Label | Tooltip text |
|---|---|
| "Win Rate" | "Porcentaje de trades que cerraron con ganancia vs el total" |
| "Sharpe Ratio" | "Mide el retorno ajustado por riesgo. > 1 es bueno, > 2 es excelente" |
| "Drawdown" | "Caída máxima desde el pico más alto de tu portafolio" |
| "P&L" | "Profit and Loss — ganancia o pérdida total en dólares" |
| "SANDBOX mode" | "Modo simulado: el agente opera con lógica real pero sin dinero real" |
| "LIVE mode" | "Modo real: el agente operará con tu dinero en Binance" |
| "Buy Threshold" | "Puntuación mínima que el LLM debe asignar para que el agente compre" |
| "Sell Threshold" | "Puntuación mínima que el LLM debe asignar para que el agente venda" |
| "Stop Loss %" | "Si la posición pierde este porcentaje, el agente la cierra automáticamente" |
| "Take Profit %" | "Si la posición gana este porcentaje, el agente la cierra automáticamente" |
| "Max Trade %" | "Porcentaje máximo de tu capital disponible para usar en un solo trade" |
| "Min Interval (min)" | "Tiempo mínimo entre dos decisiones del agente para el mismo activo" |

### 5.3 — Animaciones GSAP + Emil Design

**Stack:** `gsap 3.14`, `@gsap/react 2.1`, `ScrollTrigger` plugin

**Patrones obligatorios:**

1. **Todos los componentes de entrada:** `gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power2.out' })`
2. **Cards con scroll:** `ScrollTrigger` con `start: 'top 80%'` y `once: true`
3. **Hover en botones:** `scale(1.02)` con `cubic-bezier(0.22, 1, 0.36, 1)` vía CSS, NO GSAP
4. **Estado de carga:** Shimmer skeleton con `@keyframes shimmer` antes del `useGSAP`
5. **Gráficos:** Entrada con `opacity: 0 → 1` + `clipPath: 'inset(0 100% 0 0)' → 'inset(0 0% 0 0)'` para efecto de "draw"
6. **Dashboard Overview:** Stagger de cards de métricas con `0.1s` entre cada una
7. **Tablas (Trade History, Positions):** Stagger de filas con `0.05s`

**Emil Design constraints:**
- Nunca `scale(0)` — siempre `scale(0.95)` como estado inicial
- Entradas: más lentas (`0.5-0.7s`), salidas: más rápidas (`0.2-0.3s`)
- `cubic-bezier(0.22, 1, 0.36, 1)` para entradas naturales
- La interfaz debe "responder" al usuario, no "parpadear"

### 5.4 — Light / Dark Mode

**Estado:** Ya existe `theme-provider.tsx` y `theme.store.ts`.

**Tareas:**
1. Verificar que `theme-provider.tsx` aplica clase `dark` al `<html>` — si no, corregir
2. Asegurar que TODOS los componentes usen las clases Tailwind semánticas: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`
3. Toggle en navbar: ícono `Sun` / `Moon` de lucide-react + `useThemeStore()`
4. Verificar contraste AA (4.5:1) en ambos modos para textos importantes
5. Gráficos `lightweight-charts`: pasar tema apropiado según modo activo

### 5.5 — Help Center (`/help`)

**Archivo:** `apps/web/src/pages/help.tsx`

**Ruta:** `/help` (accesible sin autenticación)

**Secciones:**

#### Sección A — FAQ (Preguntas Frecuentes)

| Pregunta | Respuesta |
|---|---|
| ¿Qué es CryptoTrader? | Es una plataforma que usa LLMs (Claude, OpenAI, Groq) para analizar el mercado y ejecutar trades automáticamente en tu cuenta de Binance. |
| ¿El agente maneja mi dinero? | En modo LIVE sí: ejecuta órdenes reales en Binance con tu API Key. En modo SANDBOX simula todo sin dinero real. |
| ¿Es seguro conectar mis Binance Keys? | Las keys se encriptan con AES-256 en el backend. Nunca se exponen en la UI. Recomendamos crear keys con permisos solo de trading (sin retiros). |
| ¿Cómo sé si el agente está operando? | El Agent Log muestra cada decisión con razonamiento. El Ticker muestra precios en tiempo real. Las Posiciones muestran trades abiertos. |
| ¿Puedo perder dinero? | En modo LIVE sí. El agente usa Stop Loss y Take Profit para limitar pérdidas, pero ningún sistema es infalible. Empieza con SANDBOX. |

#### Sección B — Guía: Cómo operar paso a paso

1. **Registro y configuración inicial** → completar el onboarding
2. **Conectar Binance Keys** → Settings → Binance API Keys
3. **Configurar el agente** → Trading Config → elegir asset, par, modo SANDBOX
4. **Iniciar el agente** → botón "Start Agent" en la página Config
5. **Monitorear** → Dashboard, Live Chart, Agent Log
6. **Revisar resultados** → Analytics, Trade History
7. **Modo LIVE** (cuando confíes en los resultados) → cambiar modo a LIVE y reiniciar

#### Sección C — Guía: API Keys necesarias

**Binance API Keys:**
- Ir a [binance.com → Gestión de API](https://www.binance.com/es/my/settings/api-management)
- Crear nueva API Key de tipo "Datos del sistema"
- Habilitar permisos: "Lectura" + "Trading al contado"
- **NO habilitar** "Habilitar retiros"
- Copiar `API Key` y `API Secret` → Settings en CryptoTrader

**LLM API Keys:**
- **Claude:** [console.anthropic.com](https://console.anthropic.com) → Keys → Crear key → Pegar en Settings → LLM Keys → Claude
- **OpenAI:** [platform.openai.com](https://platform.openai.com) → API Keys → Create → Pegar en Settings → LLM Keys → OpenAI
- **Groq:** [console.groq.com](https://console.groq.com) → API Keys → Create → Pegar en Settings → LLM Keys → Groq

**Sidebar:** Añadir enlace "Help" (`/help`) al final del sidebar (accesible siempre)
**Navbar:** Añadir ícono `HelpCircle` que lleva a `/help`

---

## 6. Tarea 19 — Setup i18n

**Archivo:** `apps/web/src/lib/i18n.ts` + `locales/en.ts` + `locales/es.ts`

**Pasos:**

1. `pnpm add i18next react-i18next -w`
2. Crear `i18n.ts` con config: idioma por defecto `en`, detector `localStorage`, recursos `en` y `es`
3. Crear `en.ts` y `es.ts` con traducciones de todas las claves necesarias
4. Importar y llamar `i18n.init()` en `main.tsx` antes de `ReactDOM.createRoot`
5. Envolver la app con `<I18nextProvider i18n={i18n}>` o usar el módulo de integración directo
6. Toggle de idioma en navbar: `{ i18n.changeLanguage(lang) }` + flag emoji o texto `EN | ES`

---

## 7. Tarea 20 — Help Center page

**Archivo:** `apps/web/src/pages/help.tsx`

**Implementar** las secciones A, B y C descritas en §5.5.

**Diseño:** Accordion para FAQ, cards para pasos de la guía, code blocks para las keys.

**Animaciones GSAP:** Entrada de secciones con stagger, accordions con `gsap.to(panel, { height: 'auto' })`.

---

## 8. Criterio de aceptación global

- [ ] `pnpm nx run web:build` — sin errores TypeScript
- [ ] `pnpm nx run web:test` — todos los tests pasando (si existen)
- [ ] El ticker de precios muestra datos en tiempo real (no mock)
- [ ] El gráfico de velas muestra datos reales de Binance
- [ ] La página de config guarda correctamente en el backend con los campos del DTO
- [ ] Start/Stop del agente funciona desde la UI
- [ ] Settings: se pueden guardar y eliminar Binance keys y LLM keys
- [ ] Notifications: el badge se actualiza en tiempo real, se pueden marcar como leídas
- [ ] Admin panel solo accesible para role ADMIN
- [ ] Onboarding completa sin errores y redirige al dashboard
- [ ] Token refresh automático funciona (sin cerrar sesión)

---

## 6. Orden de ejecución recomendado

```
Tarea 1  → API client (base de todo)
Tarea 2  → use-trading.ts (desbloquea Tareas 9, 13)
Tarea 3  → use-analytics.ts extension (desbloquea Tarea 11)
Tarea 4  → use-market.ts (desbloquea Tareas 10, 14)
Tarea 5  → use-notifications.ts mutaciones (desbloquea Tarea 8)
Tarea 6  → WebSocket events (depende de Tarea 4, market.store.ts)
Tarea 16 → market.store.ts + PriceTicker (depende de Tarea 6)
Tarea 7  → Navbar (depende de Tarea 5, 8)
Tarea 8  → NotificationsDropdown (depende de Tarea 5)
Tarea 9  → ConfigPage fix (depende de Tarea 2)
Tarea 10 → LiveChartPage fix (depende de Tarea 4)
Tarea 11 → AnalyticsPage fix (depende de Tarea 3)
Tarea 12 → SettingsPage (depende de Tarea 1)
Tarea 17 → Onboarding fix (depende de Tarea 2)
Tarea 13 → Positions page (depende de Tarea 2)
Tarea 14 → News Feed page (depende de Tarea 4)
Tarea 15 → Admin Panel (independiente)
Tarea 18 → Sidebar update (al final, cuando existen todas las páginas)
```
