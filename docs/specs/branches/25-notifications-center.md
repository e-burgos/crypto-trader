# Spec 25 — Notifications Center Page

**Fecha:** 2026-04-12
**Versión:** 1.0
**Estado:** Implementado (retrospec)
**Branch:** `feature/notifications-center`
**Dependencias:** Spec 06 (notifications module), Spec 16 (frontend-completion)

---

## 1. Resumen ejecutivo

El spec original definía un "centro de notificaciones" como componente del dashboard (Spec 06, 11). La implementación añadió una **página dedicada** `/dashboard/notifications` que va más allá del dropdown de notificaciones del header. Incluye:

- Lista paginada de todas las notificaciones
- Navegación directa al recurso relacionado (trade, posición, config)
- Marcado individual y masivo como leídas
- Interpretación de mensajes JSON estructurados para mostrar contenido rico

---

## 2. Tipos de notificaciones

Las notificaciones tienen un `type` (enum `NotificationType`) y un `message` que puede ser texto plano o un **JSON estructurado** con clave `key` para enrutar la navegación.

### Tipos soportados

| Type | key JSON | Mensaje al usuario | Navegación |
|------|----------|--------------------|------------|
| `TRADE_EXECUTED` | `tradeBuy` / `tradeSell` | "Compra/Venta ejecutada" | `/dashboard/history` |
| `TRADE_EXECUTED` | `manualClose` | "Posición cerrada manualmente" | `/dashboard/history` |
| `STOP_LOSS_TRIGGERED` | `stopLoss` | "Stop-loss activado" | `/dashboard/positions` |
| `TAKE_PROFIT_HIT` | `takeProfit` | "Take-profit alcanzado" | `/dashboard/positions` |
| `AGENT_ERROR` | `agentError` | "Error del agente" | `/dashboard/config` |
| `AGENT_ERROR` | `agentNoLLM` | "Sin clave LLM configurada" | `/dashboard/settings?tab=llm` (via config) |
| `AGENT_ERROR` | `agentNoTestnetKeys` | "Sin claves testnet" | `/dashboard/settings?tab=testnet` (via config) |
| `AGENT_ERROR` | `agentNetworkError` | "Error de red del agente" | `/dashboard/config` |
| `AGENT_ERROR` | `agentRateLimit` | "Rate limit del proveedor LLM" | `/dashboard/config` |
| `AGENT_ERROR` | `orderError` | "Error al ejecutar orden" | `/dashboard/config` |

### Función `getNotificationRoute(type, message)`

```typescript
function getNotificationRoute(type: string, message: string): string {
  try {
    const key = JSON.parse(message)?.key ?? '';
    // mapeo por key específico
    if (['tradeBuy', 'tradeSell', 'manualClose'].includes(key)) return '/dashboard/history';
    if (['stopLoss', 'takeProfit'].includes(key)) return '/dashboard/positions';
    if (['agentError', 'agentNoLLM', ...].includes(key)) return '/dashboard/config';
  } catch { /* mensaje no es JSON */ }
  // fallback por tipo genérico
  switch (type) { ... }
}
```

---

## 3. Estructura de la página

### 3.1 Header de la página

- Título "Notificaciones" + icono Bell
- Contador de no leídas (badge): llama a `useUnreadCount()` → `GET /notifications/unread-count`
- Botón "Marcar todas como leídas": llama a `useMarkAllRead()` → `PATCH /notifications/read-all`
- Botón disabled si no hay notificaciones no leídas

### 3.2 Lista de notificaciones (paginada)

- `PAGE_SIZE = 20`
- Controles de paginación: botones Anterior/Siguiente
- Estado vacío: ilustración + texto "No hay notificaciones"
- Estado loading: skeleton cards

### 3.3 Card de notificación

Cada notificación muestra:

| Elemento | Descripción |
|----------|-------------|
| Icono | Ícono según tipo/key (ver tabla de íconos abajo) |
| Título | Tipo formateado (vía i18n) |
| Mensaje | Texto de la notificación (parseado si es JSON) |
| Timestamp | Fecha/hora relativa (ej: "hace 5 minutos") |
| Badge "No leída" | Punto azul si `isRead = false` |
| Botón "→ Ver" | Link que navega al recurso relacionado |

Fondo de la card: ligeramente destacado si no está leída.

### 3.4 Tabla de íconos por tipo/key

| key | Icono | Color |
|-----|-------|-------|
| `tradeBuy` | TrendingUp | verde |
| `tradeSell` | TrendingDown | naranja |
| `manualClose` | XCircle | azul |
| `stopLoss` | ShieldAlert | rojo |
| `takeProfit` | Target | verde |
| `agentError` | AlertTriangle | rojo |
| `agentNoLLM` | BotMessageSquare | naranja |
| genérico `TRADE_EXECUTED` | TrendingUp | verde |
| genérico `STOP_LOSS_TRIGGERED` | ShieldAlert | rojo |
| genérico `TAKE_PROFIT_HIT` | CheckCheck | verde |
| genérico `AGENT_ERROR` | AlertTriangle | rojo |
| default | Bell | muted |

### 3.5 Marcado individual como leído

Al hacer clic en cualquier parte de la card (excepto el botón "→ Ver"):
- Llama a `useMarkRead(notification.id)` → `PATCH /notifications/:id/read`
- La card actualiza visualmente (quita el badge "No leída") sin reload

---

## 4. Endpoints usados

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/notifications` | Lista paginada de notificaciones |
| `GET` | `/notifications/unread-count` | Número de notificaciones no leídas |
| `PATCH` | `/notifications/:id/read` | Marcar una notificación como leída |
| `PATCH` | `/notifications/read-all` | Marcar todas como leídas |

### Parámetros de `GET /notifications`

| Query param | Tipo | Default | Descripción |
|-------------|------|---------|-------------|
| `page` | number | 1 | Página actual |
| `limit` | number | 20 | Items por página |

---

## 5. Hooks en `use-notifications.ts`

```typescript
interface Notification {
  id: string;
  userId: string;
  type: string;           // NotificationType enum
  message: string;        // texto plano o JSON serializado
  isRead: boolean;
  createdAt: string;
}

function useNotifications(page?: number, limit?: number): QueryResult<Notification[]>
function useUnreadCount(): QueryResult<{ count: number }>
function useMarkRead(): MutationResult
function useMarkAllRead(): MutationResult
```

---

## 6. Integración con header (NotificationsDropdown)

El dropdown de notificaciones del header (`components/notifications-dropdown.tsx`) es **distinto** de la página completa. Es un panel flotante que muestra las últimas 5-10 notificaciones con:

- Mini-lista sin paginación
- Link "Ver todas" → `/dashboard/notifications`
- Marcado rápido como leídas

Ambos componentes comparten el mismo `queryKey: ['notifications']` para que un marcado en uno invalide el otro.

---

## 7. Criterios de aceptación

- [ ] La página muestra todas las notificaciones del usuario con paginación de 20 items
- [ ] Las notificaciones no leídas están visualmente diferenciadas
- [ ] "Marcar todas como leídas" actualiza el estado visualmente sin recargar la página
- [ ] El marcado individual de una notificación funciona sin recargar
- [ ] El botón "→ Ver" navega al recurso correcto según el tipo y key de la notificación
- [ ] El contador de no leídas del header se actualiza cuando se marcan desde la página
- [ ] El estado vacío se muestra cuando no hay notificaciones
- [ ] Los íconos correctos se muestran por cada tipo de notificación

---

**Depende de:** Spec 06 (notifications module backend), Spec 11 (frontend-integration)
**Consumidores:** Dashboard header (dropdown), WebSocket events
