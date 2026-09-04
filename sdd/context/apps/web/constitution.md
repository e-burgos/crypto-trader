# Constitución — apps/web

> Versión 1.3 | Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-008 cycle-02 (2026-09-01) + spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Frontend SPA de la plataforma: landing pública, auth, onboarding de 3 pasos y dashboard completo (overview, chart, posiciones, análisis del bot, noticias, config, settings, notificaciones, analytics, help, admin).

## 2. Stack tecnológico

- **React 19** + **Vite 8**, **React Router DOM 6**, **TanStack Query 5** (server state), **Zustand 5** (auth/market/sidebar/theme/chat), **React Hook Form 7** + **Zod 4**, **Tailwind CSS 3**, **GSAP 3**, **Socket.io-client**, **lightweight-charts**, **Recharts**, **react-i18next** (ES/EN ~1400 claves), **axios**, **Sonner**.
- **Deploy: la SPA se sirve desde el mismo VPS propio (Hetzner) que `apps/api`** (spec-e-burgos-008 cycle-02), no desde un hosting estático externo (Cloudflare Pages quedó descartado — DEC-PAGES). Vive en `/` y la API en `/api`, **mismo origen, detrás del mismo nginx**: ver §3.1.

## 3. Estructura y patrones

- Patrón Container/Presenter: `libs/ui` = presenters stateless; `apps/web/src/containers/` = containers con hooks/stores/i18n.
- `src/pages/` por ruta, `src/hooks/` un hook por dominio (use-auth, use-trading, use-market, ...), `src/stores/` Zustand, `src/locales/es.ts|en.ts`.
- Consume el API solo por HTTP/WebSocket — nunca importa `apps/api`.
- Tipos del wire del backend (agentes, data sources, etc.) se importan de `@crypto-trader/shared` — **nunca** se redeclaran localmente. Fue una interfaz local del wire de agentes la que dejó pasar sin error de typecheck un renombre del backend (`agentId`→`slot`) hasta romper producción; ver `libs/shared/constitution.md` §3.

### 3.1 Despliegue same-origin con la API (spec-e-burgos-008 cycle-02)

Servir la SPA desde el mismo VPS que `apps/api`, en el mismo origen, **elimina CORS por completo**,
deja un solo certificado TLS que renovar y hace que el WebSocket sea same-origin — una cosa menos
que pueda fallar.

- **`src/hooks/use-websocket.ts` — `VITE_API_URL` se usaba con dos significados contradictorios**:
  `lib/api.ts`/`use-chat.ts` lo esperan **con** el prefijo `/api`; `use-websocket.ts` lo esperaba
  **sin** él. Con un único valor el cliente negociaba el namespace `/api/ws` (que el gateway no
  sirve) y **el socket conectaba y fallaba en silencio** — la peor forma de fallar. El hook ahora
  deriva el origen quitando el sufijo `/api` de la base REST, con `VITE_WS_URL` como escape por si el
  gateway alguna vez vive en otro origen. Seis tests cubren la resolución, incluido que un `/api` que
  **no** es el último segmento no se toca.
  - El gateway está en el namespace `/ws` con path `/socket.io/`. Nginx rutea `/socket.io/` a la API
    **antes** que `/`, y sin `proxy_set_header Upgrade`/`Connection` el handshake entra por el
    location genérico y muere.
- **`Dockerfile` estaba roto de antes**: hacía `COPY apps/web/package.json`, archivo que **no existe**
  en este monorepo — las dependencias viven en la raíz, como el `Dockerfile` de `apps/api` ya
  documentaba. Ningún workflow construía esta imagen, por eso nunca se detectó. La imagen se
  construye con `VITE_API_URL=/api` — relativo, para que el mismo origen funcione sin hardcodear el
  host.
- El fallback de rutas es del nginx del contenedor (`try_files → index.html`): una ruta inexistente
  renderiza la landing en vez de un 404 propio. Aceptable para una SPA, pero es lo que quedó, no una
  decisión tomada.

### 3.2 Configuración avanzada del agente (spec-e-burgos-009 cycle-01)

La SPA expone los **40 campos** de `TradingConfig` (antes 11). Los 25 avanzados viven en cuatro
secciones —**Protección**, **Señal y tamaño**, **Loop reactivo**, **Entrada**— en el alta (paso
`advanced` entre `timing` y `review`, colapsado y todo apagado), en la edición (precargadas con el
estado real) y en el detalle (solo lectura). El POST del alta por default es byte a byte el de antes
(CA-002, test congelado); el PUT envía sólo lo cambiado (CA-003).

- `src/components/config/advanced/`: `advanced-fields.ts` (catálogo `ADVANCED_FIELDS` de los 25
  campos: control, rango, default, sección, dependencia, clave i18n; `fieldsBySection`),
  `advanced-draft.ts` (`AdvancedDraft`, `DEFAULT_ADVANCED_DRAFT`, `toAdvancedDraft`, `isFieldEnabled`,
  `clampToRange`, `diffToCreateInput`, `diffToUpdatePayload`), `use-advanced-draft.ts` (un solo hook
  para alta y edición), `advanced-field-control.tsx` (switch/slider/select según el catálogo, clamp,
  interruptores sintéticos para `maxPositionHoldMinutes` = "Sin límite" y `entryTrailingDeltaBips` =
  "Nivel fijo", callout de SANDBOX para `entryOrderMode`), `advanced-section.tsx`,
  `advanced-config-sections.tsx` (contenedor; `defaultOpen` por `surface`),
  `agent-advanced-summary.tsx` (solo lectura; valores fuera del wire degradan a "Unknown"), `fixtures.ts`.
- Reglas visibles: `entryOrderMode` deshabilitado con explicación en SANDBOX; `entryTrailingDeltaBips`
  sólo con `OCO`; el modo resuelto del bot llega por prop. Los dos puntos de exhaustividad
  (`ADVANCED_FIELDS: Record<TradingConfigAdvancedField, …>` y `DEFAULT_ADVANCED_DRAFT`) hacen fallar
  el build si el wire suma un campo avanzado.
- `constants.tsx`: `StepId` suma `advanced`; `STEPS` tiene 7 pasos. Los helpers de E2E que navegan el
  stepper contemplan el paso extra.
- i18n: namespace `config.advanced.*` y `notificationMessages.entryOrderPlaced/Filled/Missing`;
  `locales-parity.spec.ts` garantiza la paridad es/en de todo el árbol.

### 3.3 Vista de entradas descansando (spec-e-burgos-009 cycle-02)

Tercera pestaña **Entradas** en Posiciones sobre EP-017 (`GET /trading/entry-orders`), con la **URL
como fuente de verdad** (`?tab=entries&status=…&configId=…&entryOrderId=…`), filtros por estado y
por bot, "cargar más" por cursor, estados de carga/vacío/error y degradación a neutro de cualquier
estado, motivo o modo fuera del wire. La paginación por número de Open/Closed sólo se renderiza
fuera de la pestaña Entradas.

- `src/hooks/use-entry-orders.ts`: `useEntryOrders(filters)` (`useInfiniteQuery`, cursor,
  `dedupeEntryOrders` por `id`, guarda anti-bucle si el cursor se repite), `useRestingEntries(configId)`,
  claves `entryOrdersListKey`/`restingEntriesKey` bajo `ENTRY_ORDERS_QUERY_ROOT`, `buildEntryOrdersQuery`.
- `src/components/positions/entry-orders/`: `entry-order-labels.ts` (mapeos exhaustivos estado → badge,
  motivo → leyenda, modo/pierna → etiqueta, formateadores), `entry-order-status-badge.tsx`,
  `entry-order-cancel-reason-legend.tsx`, `entry-order-level-cell.tsx` (LIMIT_MAKER: límite; OCO: límite
  + stop o trailing BIPS), `entry-order-outcome-cell.tsx`, `entry-orders-table.tsx`,
  `entry-orders-filters.tsx`, `entry-orders-panel.tsx` (compone todo; props `filters`, `onFiltersChange`,
  `highlightEntryOrderId`), `agent-resting-entries.tsx` (bloque del detalle del agente con enlace a la
  pestaña filtrada por bot), `fixtures.ts`.
- **Tiempo real**: `src/hooks/use-websocket.ts` registra los handlers desde `ENTRY_ORDER_WS_EVENTS`
  (exhaustivo); los seis eventos `entry-order:*` invalidan por prefijo `['trading','entry-orders']`;
  `entry-order:filled` invalida además `['trading','positions']` porque el fill crea la posición sin
  emitir evento de posiciones.
- `src/components/notifications/notification-utils.ts` es el **único** `getNotificationRoute` (la copia
  de `containers/notifications-dropdown.tsx` se eliminó); `routeLabel` deriva del pathname y nunca
  muestra la query string. Las notificaciones `entryOrderPlaced/Filled/Missing` enlazan a la pestaña
  filtrada por estado, con `configId`/`entryOrderId` cuando el payload los trae (FIX-e-burgos-028).
- i18n: `positions.tabEntries` y el árbol `positions.entries.*`, con paridad afirmada por test.
- Tests: 493 en `apps/web` (34 archivos; eran 59 antes de la spec 009): equivalencia CA-002, diff del
  PUT, propiedad sobre las reglas de habilitación generadas desde el catálogo y sobre 64 combinaciones
  estado × modo × motivo/pierna, invalidación por igualdad de conjunto de eventos, paridad de rutas.

## 4. Convenciones propias

- Todo dato del servidor vía TanStack Query (no useState+useEffect). Zustand solo para estado global cross-componente.
- Todo texto visible pasa por `t('clave')` — convención `seccion.componente.elemento`. Nunca hardcodear texto.
- Tailwind para estilos (sin CSS modules/styled-components). Animaciones ≤300ms, respetar `prefers-reduced-motion`.
- Correr: `pnpm dev:web` (localhost:4200). Tests: `pnpm nx test web` (Vitest).
- El criterio de done de una pantalla que consume un wire compartido es **test de comportamiento en verde sobre un fixture del wire real**, no solo `tsc` — el typecheck no detecta un desalineamiento si ambos lados comparten los mismos tipos por casualidad de forma, no por importarlos de la misma fuente.
- Un valor de wire fuera del union esperado (ej. `source` en `ResolutionSource`) debe degradar esa fila/elemento a un estado neutro (`unknown`), nunca romper el render de la pantalla entera.
- Todo mapeo de un union del wire a UI (badge, etiqueta, leyenda, catálogo de campos) se tipa como `Record<UnionDelWire, …>` derivado de `@crypto-trader/shared`: un valor nuevo en el wire rompe el typecheck del front en vez de pasar en silencio.
- El estado de una vista filtrable/paginada vive en la **URL** (query params), no en `useState`: deep-links y notificaciones enlazan a un estado exacto de la pantalla.
- Una sola fuente para derivar rutas desde notificaciones (`notification-utils.ts`); nunca duplicar `getNotificationRoute` en un container.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
