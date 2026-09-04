# spec-e-burgos-009 cycle-02 — 2026-09-03

## Estado

- **Vista de entradas descansando** sobre EP-017: tercera pestaña **Entradas** en Posiciones, con la
  **URL como fuente de verdad** (`?tab=entries&status=…&configId=…&entryOrderId=…`), filtros por
  estado y por bot, "cargar más" por cursor, estados de carga/vacío/error, y degradación a neutro de
  cualquier estado, motivo o modo fuera del wire. La paginación por número de las pestañas Open/Closed
  sólo se renderiza fuera de la pestaña Entradas.
- **Tiempo real**: los seis eventos `entry-order:*` invalidan por prefijo `['trading','entry-orders']`
  (lista y detalle del agente); `entry-order:filled` invalida además `['trading','positions']` porque
  el fill crea la posición sin emitir evento de posiciones.
- **Notificaciones** `entryOrderPlaced/Filled/Missing` enlazan a la pestaña filtrada por estado, con
  `configId`/`entryOrderId` cuando el payload los trae (FIX-e-burgos-028).
- La spec 009 cierra con este ciclo.

## Estructura

- `src/hooks/use-entry-orders.ts`: `useEntryOrders(filters)` (`useInfiniteQuery`, cursor, `dedupeEntryOrders`
  por `id`, guarda anti-bucle si el cursor se repite), `useRestingEntries(configId)`, claves
  `entryOrdersListKey`/`restingEntriesKey` bajo `ENTRY_ORDERS_QUERY_ROOT`, `buildEntryOrdersQuery`.
- `src/components/positions/entry-orders/`: `entry-order-labels.ts` (mapeos exhaustivos estado →
  badge, motivo → leyenda, modo/pierna → etiqueta, formateadores), `entry-order-status-badge.tsx`,
  `entry-order-cancel-reason-legend.tsx`, `entry-order-level-cell.tsx` (LIMIT_MAKER: límite; OCO:
  límite + stop o trailing BIPS), `entry-order-outcome-cell.tsx`, `entry-orders-table.tsx`,
  `entry-orders-filters.tsx`, `entry-orders-panel.tsx` (compone todo; props `filters`,
  `onFiltersChange`, `highlightEntryOrderId`), `agent-resting-entries.tsx` (bloque del detalle del
  agente con enlace a la pestaña filtrada por bot), `fixtures.ts`.
- `src/hooks/use-websocket.ts` registra los handlers desde `ENTRY_ORDER_WS_EVENTS` (exhaustivo).
- `src/components/notifications/notification-utils.ts` es el **único** `getNotificationRoute`
  (la copia de `containers/notifications-dropdown.tsx` se eliminó); `routeLabel` deriva del pathname
  y nunca muestra la query string.
- i18n: `positions.tabEntries` y el árbol `positions.entries.*` en es/en, con paridad afirmada por test.
- `libs/ui`: variante aditiva `info` del `Badge`.
- Tests: 493 en `apps/web` (34 archivos; eran 267 al cerrar cycle-01); propiedad sobre 64 combinaciones estado × modo × motivo/pierna,
  invalidación por igualdad de conjunto de eventos, paridad de rutas de notificación.

## Qué sigue

- Cancelar una entrada desde la UI necesita un endpoint nuevo (spec futura).
- Con un bot TESTNET en LIMIT_MAKER, la primera entrada real aparecerá en la pestaña sin cambios de UI.
