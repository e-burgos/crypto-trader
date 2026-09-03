# Planner — Cycle 2: Entradas descansando en el dashboard

> **Input:** `sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-02/brief.yaml` +
> `functional.md`
> **Output:** este archivo y `tasks.json`
> **Generado por:** sdd-planner

> ⚠️ El sdd-architect escribe `architect.md` en paralelo con este documento y yo no lo veo. Toda
> vez que una task depende de un nombre que el architect fija (el tipo del wire de `EP-017` en
> `libs/shared`, el nombre del hook de `apps/web`, el nombre/carpeta de los componentes de la
> vista, el mecanismo del tab/deep-link — D1/D3 —, y la granularidad de invalidación en tiempo
> real — D2), esta descripción dice **"el nombre/mecanismo que fije architect.md §X"** en lugar de
> inventarlo. El orquestador reconcilia `planner.md`/`tasks.json` contra la versión final de
> `architect.md` antes de habilitar al implementador.

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 2 |
| Módulo | agent-advanced-config-ui |
| Fase | resting-entries-view |
| Apps | `apps/web`, `libs/shared` (wire nuevo), `apps/api` (solo twin test, sin endpoints/comportamiento nuevo), `libs/ui` (solo si una composición nueva lo exige, `frontend-component-rules` regla 3) |
| Tasks (filas en `tasks.json`) | 19 |
| Horas de trabajo estimadas | **66h** |
| Story points estimados | **81** |
| Duración estimada (serial) | ~8.5 días hábiles (66h a 8h/día) |
| Duración estimada (explotando carriles paralelos, 3–4 implementadores) | ~4 días hábiles |
| HUs cubiertas | US-2-001 .. US-2-012 (12/12) |
| CAs de la spec cubiertos | CA-005, CA-006, CA-007, CA-008 (CA-001..004 son de cycle-01, ya cerrado) |

**Regla no negociable heredada:** el estado de una fila (`status`, `cancelReason`, `filledLeg`)
siempre es el que devuelve el backend — ninguna task de este ciclo calcula, infiere ni corrige ese
estado en el cliente (RN-1 del functional). Esta spec no cambia ni un endpoint, DTO ni evento del
backend (RN-19, `out_of_scope` del brief): si algo del wire de `EP-017` resulta ininteligible para
la UI, se registra como fix, nunca se cambia en este ciclo.

---

## Orden de las capas / carriles (regla no negociable, heredada del brief)

1. **`libs/shared`** primero (TASK-001) — el wire de `EP-017` (`EntryOrder`/`EntryOrdersResponse`
   o el nombre que fije architect.md §wire) no depende de nada y todo lo demás lo importa.
2. **`apps/api` twin test** (TASK-002) — ata la respuesta real de `listEntryOrders`
   (`trading.service.ts`) al tipo publicado en TASK-001, sin tocar el controller ni el service:
   corre en paralelo a todo lo demás desde que TASK-001 cierra.
3. **Tres carriles en paralelo, todos dependiendo solo de TASK-001:**
   - **Hook de `apps/web` sobre `EP-017`** (TASK-003) → **WebSocket** (TASK-004, depende de
     TASK-003 porque invalida su query).
   - **Locales `es`/`en`** (TASK-005) — los nombres de columna/estado/motivo salen del wire, no de
     ningún componente.
   - (El form-state de cycle-01 no aplica acá: esta vista es de solo lectura.)
4. **Badge de estado + leyenda de `cancelReason`** (TASK-006) depende de TASK-001 (tipos) y
   TASK-005 (claves i18n) — es el primer componente presentacional, lo usan TASK-007 y TASK-012.
5. **Fila/tabla** (TASK-007) depende de TASK-001, TASK-003 (shape de dato real), TASK-005 y
   TASK-006 (badge/leyenda) — es la pieza más pesada del ciclo (nivel `LIMIT_MAKER` vs `OCO`,
   notional, fill).
6. **Filtros** (TASK-008), **paginado "cargar más"** (TASK-009) y **estados vacío/carga/error**
   (TASK-010) dependen solo de TASK-003 (hook) y TASK-005 (i18n) — **tres carriles paralelos**,
   archivos propios, sin dependencia entre sí ni con TASK-007.
7. **Integración como tercera pestaña en Posiciones** (TASK-011, D1) depende de TASK-004, TASK-007,
   TASK-008, TASK-009 y TASK-010 — es donde convergen fila, filtros, paginado y estados.
8. **Detalle del agente** (TASK-012) depende sólo de TASK-001, TASK-003, TASK-006 — **corre en
   paralelo** a TASK-011 (archivo distinto, de solo lectura, no necesita la tabla completa).
9. **Notificaciones** (TASK-013, D3) depende de TASK-011 porque necesita la ruta/query param que
   fija la integración de la pestaña.
10. **Tests de comportamiento** (TASK-014 CA-005, TASK-015 CA-006, TASK-016 CA-007) y **E2E**
    (TASK-017 CA-008) van después de sus dependencias directas (ver tabla de cada task) — no
    esperan al cierre del resto del ciclo salvo TASK-017, que sí necesita la pestaña integrada, el
    detalle del agente y el enlace de notificación funcionando juntos.
11. **Cierre** (TASK-018 fragmento de `libs/shared`, TASK-019 fragmento de `apps/web` + journal +
    usage) va al final.

---

## Tasks

### Carril 1 — `libs/shared` (wire de EP-017) ‖ `apps/api` (twin test)

#### TASK-001: Wire de `EP-017` en `libs/shared` (aditivo)

**Historias:** US-2-001
**App:** libs/shared
**Descripción:** Publicar en `libs/shared/src/types/` (mismo patrón que
`trading-config-wire.ts` de cycle-01, ver ese archivo como estilo a imitar) el tipo completo del
wire de `EP-017 GET /trading/entry-orders`: cada campo de una entrada (`id`, `configId`, `symbol`,
`mode`, `entryMode`, `status`, `quantity`, `limitPrice`, `stopPrice`, `stopLimitPrice`,
`trailingDeltaBips`, `referencePrice`, `plannedNotionalUsd`, `clientOrderId`, `orderListId`,
`orderId`, `placedAt`, `expiresAt`, `filledLeg`, `executedPrice`, `executedQuantity`, `positionId`,
`cancelReason`, `settledAt`) y el envelope de la respuesta (`items`, `nextCursor`) — nombres
exactos de `architect.md §wire`. Publicar también los literales del union de `status`
(`RESTING | FILLED | CANCELLED | EXPIRED | MISSING`), de `filledLeg` (`LIMIT | STOP`) y de
`cancelReason` (los ocho valores de `functional.md` US-2-003) como tipos exportados — sin
redeclarar `EntryOrderMode`, que ya existe en `interfaces.ts:281` (reusarlo tal cual). **Ojo:**
`interfaces.ts` ya tiene `EntryOrderExchangeState` (`interfaces.ts:316`, `'RESTING' | 'FILLED' |
'CANCELLED' | 'MISSING'`, **sin `EXPIRED`**) y `EntryOrderExchangeStatus`/`EntryOrderResult`/
`EntryOrderRef` — son tipos internos del ciclo de colocación de la entrada (usados por
`entry-order.service.ts`), no el wire de listado de `EP-017`: el union de `status` de esta task se
declara aparte (con los cinco valores reales, `EXPIRED` incluido) y no reemplaza ni extiende esos
tipos existentes, para no acoplar el wire de lectura a una semántica interna que puede divergir.
Todo exportado por el barrel existente (`export * from './types'`) sin tocar ningún tipo de
cycle-01 ni los tipos internos citados arriba.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El tipo nuevo compila y queda exportado desde `@crypto-trader/shared` (import de smoke desde
      un archivo temporal en `apps/web` y en `apps/api`).
- [ ] Los 23 campos de una entrada y el envelope `{ items, nextCursor }` están tipados campo a
      campo contra `verified_facts` del brief — ninguno queda como `any`/`unknown` sin razón.
- [ ] `EntryOrderMode` no se redeclara: el tipo de entrada la importa desde su ubicación actual en
      `interfaces.ts`.
- [ ] `nx run shared:build` (o el target de typecheck del subproyecto) pasa en verde.

---

#### TASK-002: `apps/api` — twin test que ata `listEntryOrders` al wire de `libs/shared`

**Historias:** US-2-001
**App:** apps/api
**Descripción:** Sin tocar `apps/api/src/trading/entry-order.service.ts` ni
`apps/api/src/trading/trading.controller.ts` (`getEntryOrders`, `@Get('entry-orders')`) ni
`apps/api/src/trading/dto/list-entry-orders.dto.ts` (query params `configId?`, `status?`
`EntryOrderStatusEnum`, `since?`, `limit?`, `cursor?`), agregar un test que compara el shape del
objeto devuelto por `trading.service.ts` → `listEntryOrders` (o un fixture congelado de su response
real) contra las claves del tipo publicado en TASK-001 — mismo mecanismo (`implements`/
`satisfies`/test de igualdad de claves) que `architect.md §D2` de cycle-01 si aplica, o el que fije
`architect.md` de este ciclo. Cero cambio de comportamiento: esta task no agrega, quita ni modifica
un endpoint, DTO ni decorador.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] Agregar un campo de prueba temporal al tipo de `libs/shared` sin agregarlo al lado de
      `apps/api` (o viceversa) hace fallar el test — verificado y revertido antes de cerrar.
- [ ] Ningún archivo de `entry-order.service.ts` ni del controller de `EP-017` cambió de
      comportamiento observable (diff limitado al test nuevo y, si el mecanismo lo exige, a una
      anotación de tipo no funcional).
- [ ] La suite existente de `apps/api` sobre `EP-017`/`entry-order.service.ts` sigue en verde.

---

### Carril 2 — Hook de `apps/web` ‖ Locales (ambos dependen solo de TASK-001)

#### TASK-003: Hook de `apps/web` sobre `EP-017` con paginado por cursor (TanStack Query)

**Historias:** US-2-001, US-2-005, US-2-006
**App:** apps/web
**Descripción:** Hook nuevo (nombre y ubicación de `architect.md §hook`, ej.
`apps/web/src/hooks/use-entry-orders.ts`) que envuelve `EP-017` con TanStack Query, tipado contra
`@crypto-trader/shared` (TASK-001), aceptando como parámetros los filtros de `status` y `configId`
(US-2-005) y exponiendo el mecanismo de "página siguiente" sobre `cursor`/`nextCursor` (query keys
y si usa `useInfiniteQuery` o un estado de cursor propio lo fija `architect.md`). Cambiar cualquiera
de los dos filtros invalida/reinicia la paginación al cursor inicial (US-2-005, cuarto criterio). No
calcula ni expone ningún total: el wire no lo tiene (RN-10).
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] El hook tipa su respuesta contra el envelope de TASK-001 — cero `interface`/`type` local que
      redeclare el shape del wire de entradas.
- [ ] Cambiar `status` o `configId` reinicia el cursor (test de comportamiento sobre el hook, no
      sólo inspección visual).
- [ ] Pedir "página siguiente" pasa exactamente el `nextCursor` recibido como `cursor` del pedido
      siguiente (US-2-006, primer criterio).
- [ ] El hook no expone ningún campo de total/cantidad de páginas.

---

#### TASK-004: `use-websocket.ts` invalida la consulta de entradas ante los seis eventos `entry-order:*`

**Historias:** US-2-008
**App:** apps/web
**Descripción:** Extender `apps/web/src/hooks/use-websocket.ts` (que hoy registra un `socket.on(
'<event>', handler)` por evento e invalida vía `queryClient.invalidateQueries({ queryKey: [...] })`
— `notification:new` → `['notifications']`, `trade:executed`/`position:closed` → `['analytics']` +
`['trading', 'positions']`, `position:updated` → `['trading', 'positions']`, `wallet:updated` →
`['trading', 'sandbox-wallet']`, `agent:killed` → `['trading']`; ninguno de estos seis casos se
toca) agregar seis `socket.on` nuevos para `entry-order:placed|filled|skipped|missing|expired|
cancelled` que invalidan la query key del hook de TASK-003 (ej. `['trading', 'entry-orders']` o la
que fije `architect.md`, siguiendo la misma convención de namespace `'trading'` que ya usan
`positions`/`config`/`sandbox-wallet`), con la granularidad que fije `architect.md §D2`
(invalidación completa de la lista vs. actualización por `entryOrderId` — cualquiera de las dos es
válida para los criterios del functional, pero `entry-order:skipped` nunca debe producir una fila
fantasma, ver US-2-008 último criterio de la tabla; el payload real de `skipped`
—`{ configId, symbol, entryMode, reason }`— no trae `entryOrderId`, confirmado contra
`entry-order.service.ts:379`). Ninguna de las seis reacciones dispara `window.location.reload` ni
equivalente.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-003
**Criterio de done:**

- [ ] Los seis eventos están cableados (test parametrizado por la lista real de eventos emitidos
      por `apps/api/src/trading/entry-order.service.ts`, no un test hardcodeado evento por evento).
- [ ] Un evento simulado `entry-order:skipped` no crea ni modifica ninguna fila visible (verificado
      sobre el hook/consulta, aunque dispare la misma invalidación que los demás, según D2).
- [ ] Ninguno de los seis casos nuevos llama a `window.location.reload` ni recarga la página.
- [ ] Los seis casos existentes (`notification:new`, `trade:executed`, `position:closed`,
      `position:updated`, `wallet:updated`, `agent:killed`) no cambiaron de comportamiento —
      verificado con la suite existente de `use-websocket.ts` en verde sin modificar sus tests.

---

#### TASK-005: Locales `es`/`en` de la vista de entradas + extensión del test de paridad

**Historias:** US-2-001, US-2-002, US-2-003
**App:** apps/web
**Descripción:** Agregar en `apps/web/src/locales/es.ts` y `en.ts` todas las claves de la vista con
la convención `seccion.componente.elemento` (namespace exacto de `architect.md §i18n`, ej.
`positions.entries.*`): labels de columna (US-2-001), los cinco textos de badge de estado más el
texto neutro "desconocido" (US-2-002), las ocho leyendas de `cancelReason` más la leyenda neutra
genérica para un noveno valor inventado (US-2-003), textos de filtro (US-2-005), de "cargar más"
(US-2-006) y de los tres estados vacío/carga/error (US-2-007). Extender
`locales-parity.spec.ts` (creado en cycle-01) para que cubra también el árbol de claves nuevo —
mismo test, no uno nuevo en paralelo.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] Toda clave nueva de esta vista existe en ambos locales, sin valores vacíos.
- [ ] `locales-parity.spec.ts` extendido confirma paridad exacta de conjunto de keys entre `es.ts`
      y `en.ts` incluyendo el árbol nuevo (no un spec nuevo separado).
- [ ] Ninguna clave existente de cycle-01 (incluidas `notificationMessages.entryOrderPlaced/Filled/
      Missing`) cambia de valor — el diff de esta task es sólo adición.

---

### Carril 3 — Componentes presentacionales (dependen de TASK-001/003/005)

#### TASK-006: Badge de estado + leyenda de `cancelReason` (degradación a neutro)

**Historias:** US-2-002, US-2-003, US-2-011
**App:** apps/web
**Descripción:** Dos componentes chicos y propios en `apps/web/src/components/positions/` (o la
subcarpeta que fije `architect.md §componentes`), construidos sobre el `badge` de `libs/ui`: uno
mapea `status` a texto/tono (`RESTING` informativo, `FILLED` éxito, `CANCELLED` neutro, `EXPIRED`
advertencia, `MISSING` alerta, cualquier otro valor → neutro "desconocido") y otro mapea
`cancelReason` a su leyenda (los ocho valores documentados, `null` → sin leyenda, cualquier noveno
valor → leyenda neutra genérica). Ambos leen sus textos de las claves de TASK-005, nunca el string
crudo del wire.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-005
**Criterio de done:**

- [ ] **Base de CA-005.** Un fixture con los cinco estados + uno inventado renderiza seis
      badges sin lanzar error, el sexto con el texto/tono neutro.
- [ ] `cancelReason = null` no renderiza ninguna leyenda ni placeholder vacío; un noveno valor
      inventado renderiza la leyenda neutra genérica.
- [ ] Ningún badge ni leyenda muestra el string crudo del enum — siempre pasa por `t()`.
- [ ] Cada badge lleva texto además del color/tono (nunca sólo color), verificado con el mismo
      fixture de los seis estados (US-2-011, tercer criterio).

---

#### TASK-007: Fila/tabla de la vista de entradas (nivel `LIMIT_MAKER` vs `OCO`, notional, fill)

**Historias:** US-2-001, US-2-004
**App:** apps/web
**Descripción:** Componente de tabla propio (sobre el `data-table` de `libs/ui`) en
`apps/web/src/components/positions/` que arma cada fila desde el tipo de TASK-001: columna Bot
(resuelve `configId` contra `useTradingConfigs()` de `use-trading.ts`, o el `configId` crudo si no
matchea — nunca fila vacía), columna Tipo de entrada (`entryMode`), columna Nivel(es)
(`limitPrice` siempre; si `OCO` y `trailingDeltaBips = null`, segunda línea con `stopPrice`→
`stopLimitPrice`; si `OCO` y `trailingDeltaBips` no nulo, segunda línea de "persigue el precio"
con el valor en BIPS en vez de un nivel fijo), columna Notional (`plannedNotionalUsd` tal cual, sin
recalcular), columna Estado (TASK-006), columna Vencimiento/motivo/fill condicional al `status`
(`FILLED` → `filledLeg`+`executedPrice`+`executedQuantity` y, si `positionId` no es nulo, el enlace
a Posiciones que fije `architect.md`; `CANCELLED`/`MISSING` con `cancelReason` no nulo también
puede acompañar a `FILLED` por `PARTIAL_FILL_REMAINDER` — ambas piezas se muestran juntas, nunca se
pisan), columna Colocada (`placedAt` en tiempo relativo). Ningún campo `null`/ausente del wire
produce `null`/`undefined`/`NaN` visible.
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-003, TASK-005, TASK-006
**Criterio de done:**

- [ ] Con un fixture de N entradas de distintos `configId`, la tabla renderiza exactamente N filas,
      cada una resuelta contra `useTradingConfigs()` (US-2-001, primer criterio).
- [ ] `LIMIT_MAKER` muestra sólo `limitPrice`, sin segunda línea ni valores `null` visibles; `OCO`
      con `trailingDeltaBips = null` muestra el par fijo; `OCO` con `trailingDeltaBips` no nulo
      muestra la indicación de persecución de precio, nunca `stopPrice` como nivel fijo (US-2-001,
      tres criterios de nivel).
- [ ] `plannedNotionalUsd` se muestra tal cual, nunca recalculado desde `quantity * limitPrice`.
- [ ] `FILLED` con `filledLeg = LIMIT` y con `filledLeg = STOP` muestran ambos casos con
      `executedPrice`/`executedQuantity`; `positionId` no nulo ofrece el enlace, `positionId = null`
      no lo simula (US-2-004).
- [ ] `FILLED` + `cancelReason = PARTIAL_FILL_REMAINDER` muestra ambas piezas de información a la
      vez (US-2-003, último criterio).
- [ ] Ningún `status` distinto de `FILLED` muestra `filledLeg`/`executedPrice`/`executedQuantity`
      aunque el fixture los traiga poblados (US-2-004, último criterio, defensivo).

---

#### TASK-008: Filtros por estado y por bot (combinables, reinician el cursor)

**Historias:** US-2-005, US-2-011
**App:** apps/web
**Descripción:** Componente de filtros sobre `filter-pills` de `libs/ui`: pastillas de las cinco
opciones de `status` más "todos", y un select/pastillas de bot con la lista de
`useTradingConfigs()` más "todos" (mismo criterio de nombre que la columna Bot de TASK-007).
Combinar ambos filtros pasa las dos condiciones al hook de TASK-003; cambiar cualquiera reinicia el
cursor (verificado ahí, no acá — esta task sólo dispara el cambio de filtro).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-003, TASK-005
**Criterio de done:**

- [ ] Seleccionar una opción de estado pasa exactamente ese `status` al hook (o filtra sobre datos
      ya cargados, según decida `architect.md`), nunca una combinación distinta.
- [ ] Seleccionar un bot filtra por su `configId` exacto.
- [ ] Ambos filtros son combinables sobre un fixture con múltiples combinaciones (US-2-005, tercer
      criterio).
- [ ] Cada pastilla es alcanzable por `Tab`, expone `aria-pressed` (o el atributo equivalente de
      `filter-pills`) y es activable con `Enter`/`Space` (US-2-011, primer criterio).

---

#### TASK-009: Acción "cargar más" (paginado por cursor)

**Historias:** US-2-006, US-2-011
**App:** apps/web
**Descripción:** Control de "cargar más" (no un composite de número de página: `EP-017` no expone
`total`) que se muestra habilitado mientras `nextCursor` de TASK-003 no es `null`, y deshabilitado u
oculto cuando lo es. Activarlo pide la página siguiente con `cursor = nextCursor`. El resultado se
acumula o reemplaza según decida `architect.md`, pero nunca duplica un `id` ya visible. **Nota de
precedente:** no existe ningún uso de `useInfiniteQuery` en el repo (`apps/web`/`libs`) — el
mecanismo de acumulación (estado de cursor propio con refetch manual vía TASK-003, o adoptar
`useInfiniteQuery` por primera vez en el monorepo) es una decisión de `architect.md`, no algo que
esta task pueda copiar de un ejemplo existente.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-003, TASK-005
**Criterio de done:**

- [ ] Con `nextCursor` no nulo, la acción está visible/habilitada; con `nextCursor = null`, no se
      muestra o se muestra deshabilitada (US-2-006, primer y segundo criterio).
- [ ] Sobre un fixture con `id` de borde compartido entre "página anterior" y "siguiente", ningún
      `id` se duplica en pantalla (US-2-006, último criterio).
- [ ] El control es un elemento enfocable y activable por teclado, no un `div` con `onClick`
      (US-2-011, segundo criterio).

---

#### TASK-010: Estados de carga, vacío y error (con reintento que preserva filtros/cursor)

**Historias:** US-2-007
**App:** apps/web
**Descripción:** Tres estados explícitos sobre la consulta de TASK-003: esqueleto mientras está en
curso (nunca tabla vacía ni estado "sin entradas"), estado vacío con explicación de dominio cuando
`items` es `[]` (texto distinto si hay o no un filtro activo), y estado de error visualmente
distinguible del vacío ante una respuesta de fallo (red o `401`). El reintento manual desde el error
vuelve a pedir exactamente la misma combinación de filtros y cursor que estaba activa, no la
primera página sin filtros.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-003, TASK-005
**Criterio de done:**

- [ ] Antes de la primera respuesta se muestra el esqueleto, nunca la tabla vacía ni el estado
      "sin entradas" (US-2-007, primer criterio).
- [ ] `items: []` muestra el estado vacío con texto de dominio, nunca una tabla sin filas sin
      explicación (US-2-007, segundo criterio).
- [ ] Un fixture de error de red o `401` muestra el estado de error, distinguible visualmente del
      vacío (US-2-007, tercer criterio).
- [ ] El reintento manual reenvía exactamente los mismos filtros y cursor que estaban activos antes
      del error (US-2-007, último criterio).

---

### Carril 4 — Integración (converge fila + filtros + paginado + estados + tiempo real)

#### TASK-011: Tercera pestaña "Entradas" en `positions.tsx` con deep-link por query params (D1)

**Historias:** US-2-001, US-2-005, US-2-006, US-2-010, US-2-011
**App:** apps/web
**Descripción:** Agregar la pestaña de entradas a `apps/web/src/pages/dashboard/positions.tsx`
junto a `Open`/`Closed` (recomendación del functional D1, salvo que `architect.md` documente una
alternativa) usando el composite `tabs` de `libs/ui` ya en uso. Cablea TASK-007 (tabla), TASK-008
(filtros), TASK-009 (cargar más) y TASK-010 (estados), y consume la invalidación de TASK-004 en
tiempo real. Implementa el mecanismo de deep-link que fije `architect.md §D3` (query params en la
URL, ej. `configId`/`entryOrderId`, y si la pestaña se auto-selecciona al llegar con esos params) —
sin romper el paginado de `Open`/`Closed`, que hoy **no** usa el composite `Pagination` de
`libs/ui` sino botones propios (`Button` + `ChevronLeft`/`ChevronRight`, estado local
`page`/`totalPages`, `positions.tsx:148-171`) sobre `usePositions(page, PAGE_SIZE, tab)`: esta
pestaña nueva convive con ese mecanismo sin tocarlo, porque usa paginado por cursor (TASK-009), no
por número de página. Si la página usa `useGSAP`/stagger sobre `.position-row` (`positions.tsx:
74-89`), la pestaña de entradas no reutiliza ese selector para su propio stagger (evitar que el
efecto de `Open`/`Closed` anime filas de otra pestaña).
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-004, TASK-007, TASK-008, TASK-009, TASK-010
**Criterio de done:**

- [ ] La pestaña "Entradas" convive con `Open`/`Closed` sin alterar su paginado por página
      existente (verificado con la suite existente de `positions.tsx` en verde).
- [ ] Con un query param de deep-link (`configId` como mínimo) en la URL al montar la página, la
      pestaña de entradas queda seleccionada y/o filtrada por ese bot (mecanismo exacto de
      `architect.md §D3`).
- [ ] Ningún evento de tiempo real de esta pestaña dispara `window.location.reload` (US-2-008,
      último criterio, verificado en el contexto de la integración completa).
- [ ] `prefers-reduced-motion: reduce` no ve ninguna transición de apertura de pestaña ni de
      actualización de fila que la ignore o supere 300ms (US-2-011, último criterio).

---

#### TASK-012: Detalle del agente — entrada `RESTING` vigente

**Historias:** US-2-009
**App:** apps/web
**Descripción:** `apps/web/src/components/config/advanced/agent-advanced-summary.tsx`
(`AgentAdvancedSummary({ cfg })`, cycle-01) gana un bloque de solo lectura dentro o junto a la
sección `entry` de `ADVANCED_SECTION_IDS` (`advanced-fields.ts:289-294`, la sección ya dedicada a
`entryOrderMode`/`entryOrderTtlMinutes`/`entryTrailingDeltaBips`), consultando `EP-017` filtrado
por el `configId` del agente y `status = RESTING` (reusando el hook de TASK-003 con esos filtros
fijos) y mostrando nivel, notional y vencimiento de cada resultado con `KeyValueRow`/`InfoCard` de
`@crypto-trader/ui` (mismo patrón que el resto de `AgentAdvancedSummary`). `agent-detail-modal.tsx`
ya invoca `<AgentAdvancedSummary cfg={cfg} />` (línea 151) — esta task no cambia ese cableado.
Ningún `PUT`/escritura se dispara desde esta sección (heredado de US-1-011, cycle-01).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-003, TASK-006
**Criterio de done:**

- [ ] Con un fixture de exactamente un elemento `RESTING`, el detalle muestra nivel, notional y
      vencimiento junto a la sección de Entrada (US-2-009, primer criterio).
- [ ] Con un array vacío, se muestra "sin entrada activa", nunca la sección omitida ni un valor
      vacío sin explicación (US-2-009, segundo criterio).
- [ ] Con más de un elemento `RESTING` para el mismo `configId`, se muestran todas las entradas
      devueltas, no sólo la primera (US-2-009, tercer criterio, caso límite).
- [ ] El detalle no muestra entradas `FILLED`/`CANCELLED`/`EXPIRED`/`MISSING` de ese bot (US-2-009,
      cuarto criterio) y ninguna interacción dispara un request de escritura (quinto criterio).

---

### Carril 5 — Notificaciones (depende de la integración, fija el destino real del enlace)

#### TASK-013: `getNotificationRoute` enlaza las tres notificaciones a la vista de entradas (D3)

**Historias:** US-2-010
**App:** apps/web
**Descripción:** En `apps/web/src/components/notifications/notification-utils.ts`, agregar
`entryOrderPlaced`, `entryOrderFilled` y `entryOrderMissing` al primer bloque de
`getNotificationRoute` (líneas 3-40, el que parsea `JSON.parse(message).key` y matchea por clave
antes del `switch` por `type`) y a `iconBg()` (líneas 42-71, mismo patrón de matcheo) apuntando a
la ruta/query params exactos que fijó TASK-011 (`architect.md §D3`) — hoy, al no matchear ninguna
clave, caen al `switch` por `type` (`entryOrderPlaced`/`entryOrderFilled` usan
`NotificationType.TRADE_EXECUTED` → `/dashboard/history`; `entryOrderMissing` usa `AGENT_ERROR` →
`/dashboard/config`), ninguna de las dos correcta. Ningún enlace existente (`tradeBuy`, `stopLoss`,
`agentError`, etc.) cambia de destino.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-011
**Criterio de done:**

- [ ] Las tres claves enlazan a la vista de entradas con, como mínimo, el `configId` de la
      notificación en la URL (US-2-010, primer y segundo criterio).
- [ ] Ninguna clave existente de `getNotificationRoute` cambió de ruta (comparación uno a uno
      contra el comportamiento previo a esta task).

---

### Carril 6 — Tests de comportamiento sobre fixtures del wire (CA-005, CA-006, CA-007)

#### TASK-014: Vitest — fixtures del wire cubren estados, motivos y niveles (CA-005)

**Historias:** US-2-001, US-2-002, US-2-003, US-2-004, US-2-012
**App:** apps/web
**Descripción:** Fixture(s) Vitest construidos a partir del tipo de TASK-001 (nunca un objeto
literal sin tipo) que cubren los cinco estados del union más uno inventado, los ocho valores de
`cancelReason` más `null` y un noveno inventado, `LIMIT_MAKER` vs `OCO` con y sin
`trailingDeltaBips`, y `FILLED` con `filledLeg = LIMIT`/`STOP` y con `PARTIAL_FILL_REMAINDER`. Test
de comportamiento sobre TASK-006/TASK-007 con esos fixtures — **CA-005 de la spec**.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-006, TASK-007
**Criterio de done:**

- [ ] **CA-005.** El fixture de seis estados (cinco + uno inventado) renderiza sin lanzar, el sexto
      con badge/texto neutro.
- [ ] El fixture cubre los ocho `cancelReason` + `null` + un noveno inventado, cada leyenda
      traducida por `t()`.
- [ ] El fixture tipa contra `@crypto-trader/shared`, no un objeto literal sin tipo (US-2-012,
      primer criterio).
- [ ] Ningún test de esta task abre un navegador — corre en jsdom/node.

---

#### TASK-015: Vitest — propiedad de invalidación por los seis eventos `entry-order:*` (CA-006)

**Historias:** US-2-008, US-2-012
**App:** apps/web
**Descripción:** Test de propiedad parametrizado por la lista real de eventos emitidos por
`apps/api/src/trading/entry-order.service.ts` (`placed`, `filled`, `skipped`, `missing`, `expired`,
`cancelled` — leída desde una única fuente de datos del test, no seis asserts sueltos) que confirma
que cada uno invalida/actualiza la consulta de TASK-003 vía TASK-004 — **CA-006 de la spec**.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-004
**Criterio de done:**

- [ ] **CA-006.** Los seis eventos están cubiertos desde una tabla de datos única, no tests
      copiados a mano (US-2-012, segundo criterio).
- [ ] `entry-order:skipped` no produce fila fantasma en el test (consistente con TASK-004).
- [ ] Corre en jsdom/node, sin navegador visible.

---

#### TASK-016: Vitest — paridad de `getNotificationRoute` sobre todas las claves conocidas (CA-007)

**Historias:** US-2-010, US-2-012
**App:** apps/web
**Descripción:** Test de propiedad que recorre todas las claves conocidas de `getNotificationRoute`
(las existentes antes de este ciclo más las tres nuevas) desde una única fuente de datos del test
— **CA-007 de la spec**, verificando que las claves viejas devuelven exactamente la misma ruta que
antes de TASK-013 y las tres nuevas apuntan a la vista de entradas.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-013
**Criterio de done:**

- [ ] El test recorre todas las claves desde una tabla de datos única, no asserts sueltos
      (US-2-012, tercer criterio).
- [ ] Las claves viejas (`tradeBuy`, `stopLoss`, `agentError`, etc.) devuelven la misma ruta que
      antes de este ciclo.
- [ ] Las tres claves nuevas devuelven la ruta de la vista de entradas con su query param.

---

#### TASK-017: E2E headless — filtro, cargar más y deep-link en la vista de entradas (CA-008)

**Historias:** US-2-005, US-2-006, US-2-007, US-2-012
**App:** apps/web
**Descripción:** Spec Playwright nuevo (mismo patrón que `e2e/agent-flow.spec.ts` /
`e2e/agent-advanced-config.spec.ts` de cycle-01) que abre la pestaña de entradas, aplica un filtro,
pide "cargar más" y confirma en el DOM el resultado esperado, más un caso que navega vía deep-link
(query param de notificación simulado) y confirma que la pestaña queda seleccionada/filtrada — **
CA-008 de la spec**. Corre en CI sin `PLAYWRIGHT_HEADED_DEBUG` y sin depender de una clave externa;
el bot TESTNET `LIMIT_MAKER` real de producción no es parte de este test (fixture/seed propio, como
el resto de la suite E2E).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-011, TASK-012, TASK-013
**Criterio de done:**

- [ ] El spec corre headless en el mismo run que la suite E2E existente, sin el proyecto
      `headed-debug`.
- [ ] Filtrar y pedir "cargar más" se confirma en el DOM (US-2-012, cuarto criterio).
- [ ] El caso de deep-link confirma que la pestaña/filtro queda seleccionado según el query param.
- [ ] Ningún spec de esta task abre un navegador visible en la máquina del desarrollador ni depende
      de una clave externa (US-2-012, último criterio).

---

### Cierre

#### TASK-018: Fragmento de contexto aditivo — `libs/shared` (+ `libs/ui` si se tocó)

**Historias:** US-2-001
**App:** libs/shared
**Descripción:** Crear
`sdd/context/libs/shared/updates/2026-09-03-spec-e-burgos-009-cycle-02.md` (patrón append-only)
documentando el wire de `EP-017` publicado en TASK-001 y el twin test de TASK-002. Si TASK-006..010
terminó agregando una primitiva nueva a `libs/ui` (sólo si `frontend-component-rules` regla 3 lo
exigió), crear también `sdd/context/libs/ui/updates/2026-09-03-spec-e-burgos-009-cycle-02.md`. No
editar directamente `constitution.md`/`context_prompt.md` de ninguna de las dos libs.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-001, TASK-002
**Criterio de done:**

- [ ] El fragmento de `libs/shared` existe, corto y solo el delta.
- [ ] `constitution.md`/`context_prompt.md` de `libs/shared` (y `libs/ui` si aplica) no cambiaron
      una línea.
- [ ] Si no se tocó `libs/ui`, no se crea ningún fragmento para esa lib.

---

#### TASK-019: Fragmento de contexto aditivo `apps/web` + journal (si aplica) + usage consolidado + cierre de la spec

**Historias:** US-2-001
**App:** apps/web
**Descripción:** Crear `sdd/context/apps/web/updates/2026-09-03-spec-e-burgos-009-cycle-02.md`
con el delta del ciclo: hook sobre `EP-017`, invalidación en `use-websocket.ts`, componentes de la
vista de entradas, pestaña nueva en `positions.tsx`, sección de detalle del agente, enlace de
notificaciones. Si hubo una lección real (filtro anti-ruido de la sección 🧠 MEMORIA GATE), crear
`sdd/memory/journal/2026-09-03-spec-e-burgos-009-cycle-02.md`. Confirmar que cada task de este
`tasks.json` cerró con `usage.model_tier` registrado. Como este es el **segundo y último ciclo de
la spec**, dejar constancia en el fragmento de que el reviewer debe mover el módulo a
`completed_modules` y la spec a `completed` en `sdd/global.json`/`sdd/specs/index.json` al cerrar
el `cycle.json`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-011, TASK-012, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018
**Criterio de done:**

- [ ] El fragmento de `apps/web` existe, es corto y solo el delta; `constitution.md`/
      `context_prompt.md` de `apps/web` no cambiaron una línea.
- [ ] Si se creó entrada de journal, pasa el filtro anti-ruido — si no hay lección real, no se crea
      ninguna entrada.
- [ ] `pnpm sdd:validate` no reporta ninguna task de este `tasks.json` sin `usage`.

---

## Orden de ejecución

```
Carril 1 (libs/shared)
  TASK-001
       │
       ├─────────────┬───────────────┐
       ▼              ▼               ▼
  TASK-002        TASK-003        TASK-005
  (apps/api,      (hook           (locales,
   twin test —     apps/web —      archivo
   PARALELO)       PARALELO)       propio —
       │                │           PARALELO)
       │                ▼               │
       │           TASK-004             │
       │           (WS invalidation)    │
       │                │               │
       │                └───────┬───────┘
       │                        ▼
       │           TASK-006 (badge + cancelReason)
       │                        │
       │           ┌────────────┼────────────────┬────────────────┐
       │           ▼            ▼                 ▼                 ▼
       │      TASK-007      TASK-008          TASK-009          TASK-010
       │      (tabla)       (filtros)         (cargar más)      (estados)
       │           │            │                 │                 │
       │           └────────────┴────────┬────────┴─────────────────┘
       │                                  ▼
       │                    TASK-011 (pestaña "Entradas", D1/D3,
       │                     depende también de TASK-004)
       │                                  │
       │              ┌───────────────────┼───────────────────┐
       │              ▼                   ▼                   ▼
       │       TASK-012 (detalle    TASK-013            TASK-017 (E2E,
       │        agente — PARALELO    (notificaciones,     también depende
       │        a 011/013, sólo      D3, depende de 011)  de 012/013)
       │        depende de 001/       │
       │        003/006)              ▼
       │              │          TASK-016 (CA-007)
       │              │               │
       │        TASK-014 (CA-005)     │
       │        depende de 006/007    │
       │              │               │
       │        TASK-015 (CA-006)     │
       │        depende de 004        │
       │              │               │
       ▼              ▼               ▼
  TASK-018 ──────────────────────────────────► TASK-019
  (cierre libs,                                 (cierre apps/web,
   depende de 001+002)                           depende de 011+012+013+
                                                  014+015+016+017+018)
```

**Carriles paralelos explícitos (mismo momento, archivos distintos):**

1. Tras TASK-001: **TASK-002 (apps/api twin test)** ‖ **TASK-003 (hook apps/web)** ‖ **TASK-005
   (locales)** — tres implementadores en simultáneo.
2. Tras TASK-006 (que a su vez espera a 003+005): **TASK-007 (tabla)** ‖ **TASK-008 (filtros)** ‖
   **TASK-009 (cargar más)** ‖ **TASK-010 (estados vacío/carga/error)** — cuatro carriles, archivos
   propios, cero coordinación entre sí.
3. Tras TASK-011: **TASK-012 (detalle del agente)** ‖ **TASK-013 (notificaciones)** — dos carriles
   (TASK-012 en rigor sólo depende de 001/003/006, así que puede arrancar antes; se muestra acá
   porque comparte ventana con TASK-013 en la práctica del sprint).
4. Los tests (TASK-014, TASK-015) pueden avanzar tan pronto sus dependencias respectivas cierran,
   sin esperar a TASK-011/012/013.

**Camino crítico (la cadena más larga que ningún paralelismo acorta):**
TASK-001 (4h) → TASK-005 (3h) → TASK-006 (4h) → TASK-007 (6h) → TASK-011 (5h) → TASK-013 (3h) →
TASK-017 (4h) → TASK-019 (2h) = **31h** (~4 días hábiles).
El resto del trabajo (66h totales) cabe en los carriles paralelos sin extender esa cifra con al
menos 3–4 implementadores trabajando el ciclo a la vez.

---

## Notas para el orquestador (reconciliación contra `architect.md`)

- **D1** (dónde vive la pestaña) sólo afecta la forma exacta de TASK-011 — si el architect elige
  una página propia en vez de una tercera pestaña, el resto del plan (TASK-006..010, TASK-012) no
  cambia porque son componentes agnósticos de dónde los monta el padre.
- **D2** (granularidad de invalidación) sólo afecta el tamaño de TASK-004 — invalidación completa
  es la versión más chica; "actualizar sólo la fila" agrega un caso especial para
  `entry-order:skipped` y puede sumar 1–2h a esa task.
- **D3** (ruta/query param del deep-link) es la única decisión que fija el contrato exacto de
  TASK-011 y TASK-013 — si agrega selección puntual por `entryOrderId` (no sólo `configId`),
  ambas tasks ganan alcance pero no cambian de forma, el criterio de done ya lo cubre en términos
  genéricos ("como mínimo `configId`").
- El nombre del hook (TASK-003), la carpeta de componentes (TASK-006..010) y el nombre exacto del
  tipo del wire (TASK-001) son placeholders explícitos ("el nombre que fije architect.md §X") — el
  orquestador los reemplaza por el valor final de `architect.md` antes de habilitar al
  implementador, sin reabrir el planner.
