# Architect — Cycle 2: Entradas descansando en el dashboard

> **Input:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-02/functional.md
> **Output:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-02/architect.md
> **Generado por:** sdd-architect · 2026-09-03

---

## 0. Cómo leer este documento

Este ciclo no crea tablas ni endpoints. Crea **un tipo** (el wire de EP-017 en `libs/shared`), **una
consulta** (cursor + acumulación en TanStack Query), **una superficie** (una tercera pestaña en
Posiciones más un bloque en el detalle del agente) y **un contrato de navegación** (la URL de
Posiciones como fuente de verdad de pestaña, filtros y resaltado, que es a donde apuntan las tres
notificaciones). Todo lo demás es composición sobre lo que ya existe.

Orden de lectura para el implementador: §1 (hallazgos) → §2 (decisiones) → §3 (tipos compartidos) →
§4 (hook y URL) → §5 (componentes) → §6 (mapeos) → §8 (i18n) → §11 (tests). §10 y §12 son para el
orquestador y el reviewer.

### Reparto arquitectónico (invariante del ciclo)

| Capa | Qué le toca | Prohibido |
| --- | --- | --- |
| `libs/shared` | `entry-order-wire.ts`: `EntryOrderWire`, `EntryOrdersPageWire`, `EntryOrderStatusWire`, `EntryOrderCancelReasonWire`, `ListEntryOrdersQuery`, las listas congeladas `ENTRY_ORDER_*` y los chequeos de exhaustividad con los helpers de cycle-01 | React, Nest, cualquier dependencia; importar de `apps/api` |
| `apps/api` | **Nada.** Cero archivos tocados (out_of_scope del brief). Lo que haría falta para atar el select al wire por typecheck queda como recomendación de FIX en §15 | Cambiar el select, el DTO, un evento o una notificación |
| `libs/ui` | Una sola extensión aditiva: la variante `'info'` de `Badge` (§2 D9). Nada más | Archivos nuevos; conocer entradas, trading o i18n |
| `apps/web` | Hook, componentes de la vista, tercera pestaña, contrato de URL, tiempo real en `use-websocket.ts`, bloque del detalle del agente, ruteo y etiqueta de las notificaciones, locales, tests | Redeclarar el wire; inferir estado en el cliente; texto fuera de `t()` |

---

## 1. Hallazgos verificados contra el código (2026-09-03)

Los siete se leyeron en el código, no se infirieron. Ninguno se resuelve tocando `apps/api`
(out_of_scope del brief); los que exigen una decisión distinta a la que suponía el funcional están
marcados y se cierran en §2.

### H1 (cambia D3) — Dos de las tres notificaciones **no traen** `configId` ni `entryOrderId`

Payloads exactos de `NotificationsService.create(...)` en `apps/api/src/trading/entry-order.service.ts`:

| Clave | Línea | JSON que persiste el backend |
| --- | --- | --- |
| `entryOrderPlaced` | 220-231 | `{ key, entryMode, qty, asset, price, mode }` |
| `entryOrderFilled` | 350-360 | `{ key, qty, asset, price, mode }` |
| `entryOrderMissing` | 430-440 | `{ key, entryOrderId, symbol }` |

Es decir: **ninguna** trae `configId`, y sólo `entryOrderMissing` trae un `entryOrderId`. El criterio
de US-2-010 —"el enlace, como mínimo, deja la vista filtrada o resaltada por el bot (`configId`) de
la notificación"— **es inejecutable para dos de las tres claves** con el contrato actual. Reescrito
en §13; el enlace se construye con lo que sí existe (D3) y el `configId` del contrato de URL queda
para el otro productor real (el detalle del agente, D8).

**Recomendación de FIX (no bloqueante, `[IMPROVEMENT]`, `apps/api`, §15):** agregar `configId` a los
tres JSON y `entryOrderId` a `entryOrderPlaced`/`entryOrderFilled`. Es aditivo —`translateMessage`
pasa el JSON entero como parámetros de interpolación y los que sobran se ignoran— y convertiría el
criterio original del funcional en ejecutable sin cambiar una sola clave de i18n.

### H2 (bloqueante para US-2-010) — `getNotificationRoute` está **duplicado**, y la copia es la del camino más usado

`apps/web/src/components/notifications/notification-utils.ts:3` exporta `getNotificationRoute`, y
`apps/web/src/containers/notifications-dropdown.tsx:58` declara **otra función homónima, copia
literal**, que es la que usa la campana del header (`navigate(route)` en las líneas 201 y 234). La
página de notificaciones (`notif-row.tsx`) usa la exportada. Cambiar sólo `notification-utils.ts`
deja las tres notificaciones nuevas yendo a `/dashboard/history` desde la campana y a la vista de
entradas desde la página: dos destinos distintos para la misma notificación. El contrato de este
ciclo **borra la copia** (§12).

`notifications-dropdown.tsx` también duplica `translateMessage` (líneas ~35-49). Hoy se comporta
igual que la exportada; se borra en la misma task por higiene, pero ningún criterio depende de eso.

### H3 — `routeLabel` haría visible la URL cruda en el DOM

`routeLabel(route, t)` (`notification-utils.ts`) es un lookup exacto sobre un mapa de cuatro rutas y
cae a `?? route`. Cualquier ruta con query params —que es exactamente lo que produce D3— devolvería
`"/dashboard/positions?tab=entries&status=RESTING"` y `notif-row.tsx:66` lo pintaría como etiqueta
del enlace. Eso viola la regla "todo texto visible pasa por `t()`" y el criterio de CA-007 de que
ninguna pantalla muestra texto sin traducir. `routeLabel` pasa a normalizar por pathname (D3).

### H4 (cambia D2) — El camino de fill crea la posición y **no emite ningún evento de posiciones**

`settleFilled` (`entry-order.service.ts:300-372`) crea la `Position`, el `Trade`, el `BotAction`,
actualiza `entryOrder.positionId`, coloca la protección nativa y emite **únicamente**
`entry-order:filled`. No emite `trade:executed`, `position:updated` ni `position:closed`. Los tres
handlers que hoy refrescan `['trading','positions']` en `use-websocket.ts` no se disparan nunca por
este camino.

Consecuencia medible: con la pestaña Open abierta, una entrada que se llena abre una posición real
que la tabla de al lado no muestra hasta el `refetchInterval` de 15 s de `usePositions`. Por eso
`entry-order:filled` invalida **también** `['trading','positions']` (D2). No es scope creep: es el
único evento que anuncia esa posición.

### H5 (cambia D1) — En SANDBOX **nunca** existe una fila de entradas, y SANDBOX es el modo por default

`trading.processor.entry-orders.spec.ts:537` es explícito: *"SANDBOX ignores entryOrderMode entirely
and never writes an entry_orders row"*, y los casos parametrizados de las líneas 668-712 lo
confirman para los tres valores de `entryOrderMode`. Del otro lado, `usePlatformMode`
(`use-user.ts:369`) resuelve `profile?.platformOperationMode ?? 'SANDBOX'`.

Consecuencia: la razón 2 de la recomendación D1 del funcional —"reutiliza el filtro por
`platformMode` que ya aplica `positions.tsx`"— **deja la pestaña permanentemente vacía en el modo por
default**, escondiendo justo la información de TESTNET/LIVE que el trader necesita ver. Se descarta
ese filtro (D1b) y el modo se muestra como columna.

### H6 — `positions.tsx` **no** usa el composite `Pagination` de `libs/ui`

El funcional asume que sí (nota de compatibilidad de D1). El código
(`apps/web/src/pages/dashboard/positions.tsx:141-166`) pagina con dos `Button` y un
`{page} / {totalPages}` inline. No cambia la decisión de D1 —el conflicto entre paginado por número y
por cursor es real igual— pero el implementador no va a encontrar el composite ahí, y **este ciclo no
lo migra**: la pestaña de entradas trae su propio "cargar más" y el bloque de paginado existente se
sigue renderizando sólo en las dos pestañas viejas.

### H7 — EP-017 no devuelve `asset` ni `pair`

El `select` de `listEntryOrders` (`trading.service.ts:804-829`) tiene 24 campos y **omite** `asset`,
`pair`, `limitLegOrderId`, `stopLegOrderId`, `decisionId`, `lastError`, `userId` y `updatedAt`, que sí
son columnas del modelo (`schema.prisma:887-930`). La fila del wire tiene `symbol` (`"BTCUSDT"`) y
nada más para identificar el par: la columna Bot se resuelve por `configId` contra
`useTradingConfigs()` (D5) y el símbolo se muestra tal cual viene.

`sdd/api.json` EP-017 documenta exactamente esos 24 campos y los cinco query params: **sin
discrepancias**, no se toca (§10).

---

## 2. Decisiones técnicas

### D1 — Tercera pestaña `Entradas` en Posiciones, con la **URL** como fuente de verdad de pestaña y filtros

**Decisión.** Se adopta la recomendación del funcional: `apps/web/src/pages/dashboard/positions.tsx`
pasa de dos a tres pestañas (`OPEN | CLOSED | ENTRIES`) sobre el mismo composite `Tabs` de
`libs/ui`. Y se agrega lo que el funcional no fijaba: **la pestaña activa y los filtros de entradas
viven en la query string**, no en `useState`.

```
/dashboard/positions                                      → pestaña Open (comportamiento de hoy)
/dashboard/positions?tab=entries                          → pestaña Entradas, sin filtros
/dashboard/positions?tab=entries&status=MISSING           → Entradas filtrada por estado
/dashboard/positions?tab=entries&configId=<id>            → Entradas filtrada por bot
/dashboard/positions?tab=entries&status=MISSING&entryOrderId=<id>  → además resalta esa fila
/dashboard/positions?tab=open&positionId=<id>             → Open, con el detalle de esa posición abierto
```

Contrato exacto de los parámetros:

| Param | Valores | Ausente | Valor inválido |
| --- | --- | --- | --- |
| `tab` | `open` \| `closed` \| `entries` (minúsculas en la URL, mayúsculas en el estado interno) | `open` | degrada a `open`, sin error |
| `status` | los cinco del union | todos | degrada a "todos" (nunca rompe, RN-02) |
| `configId` | id de config | todos los bots | se conserva como filtro y se muestra crudo en el selector (D5) |
| `entryOrderId` | id de entrada | sin resaltado | ninguna fila resalta; **nunca** filtra ni produce error |
| `positionId` | id de posición | — | ninguna modal se abre |

`entryOrderId` **resalta, no filtra**: si esa entrada no está en las páginas cargadas (por el filtro
activo o por estar más atrás en el cursor), simplemente no hay fila resaltada. Filtrar por un `id`
suelto habría exigido un query param que EP-017 no tiene.

**Justificación.**

1. Las tres razones del funcional se sostienen (mismo modelo mental de exposición; nada nuevo en el
   sidebar; una entrada no es un recurso de primer nivel), y la razón 2 se reemplaza por su versión
   correcta en D1b (H5).
2. **La URL es lo que hace ejecutable a D3.** Sin ella, "la notificación abre la vista filtrada" es
   estado en memoria que ningún E2E puede verificar por deep link y que se pierde al recargar.
3. Cambiar un filtro reescribe la URL con `replace: true` ⇒ la pila de navegación no acumula una
   entrada por click de pastilla, y volver atrás sale de Posiciones, no del último filtro.
4. Cambiar un filtro cambia el `queryKey` ⇒ el cursor se reinicia solo (US-2-005, sin código de
   reinicio que mantener).

**Convivencia con el paginado por número de las pestañas hermanas** (la incompatibilidad que el
funcional pedía resolver): no conviven, se **excluyen por pestaña**.

- El bloque de paginado existente (`{totalPages > 1 && …}`) se renderiza sólo con
  `tab !== 'ENTRIES'`. No se toca su markup ni su lógica.
- La pestaña Entradas renderiza su propio "Cargar más" **dentro** de `EntryOrdersPanel`, debajo de la
  tabla. Es un `Button` de `libs/ui`, no un composite de paginado: no hay número de página, no hay
  total, no hay "anterior" —EP-017 no expone `total` y el cursor sólo avanza (RN-10)—.
- `usePositions` gana un cuarto argumento opcional `{ enabled }` y la página lo pasa en `false`
  mientras la pestaña activa es `ENTRIES`: si no, la página seguiría haciendo polling cada 15 s de una
  lista que nadie está mirando. Es aditivo y ningún otro llamador cambia (§12).

**Descartado:** una página propia bajo `/dashboard/entries` (agrega una entrada de sidebar para un
recurso de acompañamiento, y duplica el encabezado y el layout de Posiciones); reusar el bloque de
paginado por número calculando un total falso desde las páginas cargadas (mentira aritmética que el
funcional prohíbe explícitamente, RN-10).

### D1b — La pestaña Entradas **no** filtra por `platformMode`

**Decisión.** A diferencia de `Open`/`Closed`, la pestaña Entradas **no** aplica el filtro
`x.mode === platformMode`. Muestra todas las entradas del usuario y agrega una columna `mode` con el
mismo tratamiento visual que la tabla de posiciones (`LIVE` rojo, `TESTNET` celeste, resto neutro).

**Justificación.**

1. **H5**: en SANDBOX nunca hay una fila; con el filtro, la pestaña estaría vacía para el modo por
   default de todos los usuarios, incluido el trader sembrado de E2E. Sería una pantalla que sólo
   funciona si el trader adivina que tiene que cambiar el modo global primero.
2. EP-017 **no** acepta `mode` como query param: el filtro sería puramente de cliente y, combinado
   con el paginado por cursor, produciría páginas visiblemente vacías con un "cargar más" activo
   (los 50 elementos de la página vienen del servidor sin filtrar y el cliente los descarta).
3. El bot al que pertenece cada entrada ya lleva su modo, y el filtro por bot (D5) resuelve el mismo
   problema de foco sin ninguna de las dos consecuencias.

**Corolario que el reviewer verifica:** cambiar el modo global no altera el contenido de la pestaña
Entradas; el `useEffect` que hace `setPage(1)` ante `platformMode` sigue existiendo y sigue
aplicando sólo a las dos pestañas de posiciones.

### D2 — Los seis eventos invalidan **toda la familia** de consultas de entradas, por prefijo

**Decisión.** En `use-websocket.ts`, un solo registrador para los seis eventos:

```ts
ENTRY_ORDER_WS_EVENTS.forEach((event) => {
  socket.on(event, () => {
    queryClient.invalidateQueries({ queryKey: ENTRY_ORDERS_QUERY_ROOT });
    if (event === 'entry-order:filled') {
      queryClient.invalidateQueries({ queryKey: ['trading', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });
});
```

`ENTRY_ORDERS_QUERY_ROOT = ['trading', 'entry-orders']` es prefijo de las dos consultas del ciclo
—la lista de la vista y la de entradas `RESTING` por config del detalle del agente (§4)— así que
**una sola invalidación cubre las dos**, incluidas todas sus combinaciones de filtros en caché.
Ningún handler emite un toast propio: `entry-order:missing` ya produce una notificación en el
backend que llega por `notification:new` y se muestra una sola vez.

**Justificación de la granularidad (invalidar todo, no parchear la fila).**

1. **Los payloads no alcanzan para construir una fila.** `entry-order:placed` no trae `status`,
   `referencePrice`, `clientOrderId` ni `mode`; `entry-order:filled` no trae `plannedNotionalUsd` ni
   `limitPrice`; `entry-order:cancelled` trae sólo `configId`, `entryOrderId`, `symbol` y
   `cancelReason`. Parchear la caché con eso obliga a inventar los campos faltantes o a construir un
   `EntryOrderWire` parcial: exactamente el "la SPA no calcula ni adivina el estado" que prohíbe
   RN-01. Refetchear es la única forma de que lo mostrado sea lo que el backend tiene.
2. **`entry-order:skipped` no tiene fila que actualizar.** No trae `entryOrderId` porque el backend
   nunca persistió nada (`markSkipped`, `entry-order.service.ts:379`). Cualquier estrategia por fila
   necesita igual un caso especial de "invalidar todo" o "no hacer nada" para este evento; con la
   invalidación por prefijo el caso especial no existe: el refetch devuelve la misma lista y no
   aparece ninguna fila fantasma (criterio de US-2-008).
3. **El volumen lo permite.** Un bot tiene como mucho una entrada `RESTING` por símbolo
   (`findResting(configId, symbol)`), y cada evento es una transición de estado, no un tick de
   mercado. El costo es un `GET` de hasta 50 filas por transición.
4. **El parpadeo que preocupaba al funcional no ocurre.** TanStack Query mantiene los datos previos
   mientras refetchea una query invalidada (`isFetching` sin `isPending`): la tabla no se desmonta,
   no vuelve al esqueleto y no pierde el scroll. El único cambio visible es el de la fila que cambió.
5. **`useInfiniteQuery` refetchea todas las páginas cargadas** en una invalidación, así que la
   ventana acumulada por "cargar más" se conserva; un parche por fila tendría que recorrer
   `data.pages` a mano para encontrar y reemplazar el elemento.

**`entry-order:filled` invalida además posiciones y analytics** por H4: es el único aviso de que se
abrió una posición. Sin eso, la pestaña de al lado miente hasta el próximo poll.

**Descartado:** `setQueryData` por `entryOrderId` (razones 1 y 2); un `refetchType: 'all'` explícito
(el default `'active'` ya refetchea lo montado y marca lo demás como stale, que es lo que se quiere:
la consulta del detalle del agente no está montada mientras el trader mira la tabla).

### D3 — Las tres notificaciones apuntan a la pestaña con el filtro que **sí** se puede construir

**Decisión.** `getNotificationRoute` suma un bloque —dentro del `try`, donde ya está parseado el
JSON— con las tres claves:

| Clave | Tipo backend | Ruta devuelta | De dónde sale |
| --- | --- | --- | --- |
| `entryOrderPlaced` | `TRADE_EXECUTED` | `/dashboard/positions?tab=entries&status=RESTING` | fija: una entrada recién colocada está `RESTING` |
| `entryOrderFilled` | `TRADE_EXECUTED` | `/dashboard/positions?tab=entries&status=FILLED` | fija |
| `entryOrderMissing` | `AGENT_ERROR` | `/dashboard/positions?tab=entries&status=MISSING&entryOrderId=<id>` | `entryOrderId` del JSON (H1); si falta o no es string, se omite el param y la ruta sigue siendo válida |

Ninguna lleva `configId` porque **ninguna notificación lo trae** (H1). La ruta se arma con
`URLSearchParams` para que el `entryOrderId` viaje escapado.

**El orden importa poco pero se fija:** el bloque nuevo va **después** de los tres `if` existentes.
Las claves son disjuntas, así que ninguna ruta previa cambia; el orden es el que produce el diff más
chico.

**`routeLabel` pasa a normalizar por pathname** (H3):

```ts
const [pathname, search] = route.split('?');
if (pathname === '/dashboard/positions' &&
    new URLSearchParams(search ?? '').get('tab') === 'entries')
  return t('positions.entries.linkLabel');
return MAP[pathname] ?? route;
```

Con eso las cuatro etiquetas existentes siguen devolviendo exactamente lo mismo (sus rutas no tienen
query string) y las tres nuevas muestran "Entradas descansando" en vez de la URL.

**Cómo lee la vista los parámetros.** La **página** (`positions.tsx`) es la única que toca
`useSearchParams` —regla 5 de `frontend-component-rules`: la página maneja routing y params— y baja
a `EntryOrdersPanel` un objeto `filters` controlado más `highlightEntryOrderId`. El panel no conoce
la URL: recibe `filters` y `onFiltersChange`, y la página traduce ese callback a `setSearchParams`.
Así el panel es testeable sin router y la URL sigue siendo la única fuente de verdad.

**El resaltado** se implementa con el `rowClassName` de `DataTable` (`ring-2 ring-primary/40
bg-primary/5`) más un `<span className="sr-only">{t('positions.entries.highlighted')}</span>` en la
primera celda de esa fila: el color no es el único portador de la información y el test lo afirma por
texto, no por clase. **No** se modifica `DataTable` para pasar `aria-current`.

**Descartado:** una ruta propia `/dashboard/entries/<id>` (obliga a la página propia que D1
descartó); estado de navegación en memoria vía `navigate(route, { state })` (no sobrevive a un
refresh, no es deep-linkeable y el E2E no puede afirmarlo).

### D4 — `useInfiniteQuery` con cursor, acumulando y deduplicando por `id`

**Decisión.** La lista usa `useInfiniteQuery` (TanStack Query 5.96, ya en el repo), con
`initialPageParam: undefined`, `getNextPageParam: (last) => last.nextCursor ?? undefined`, y un
selector puro `dedupeEntryOrders(pages)` que aplana conservando la **primera** aparición de cada
`id`. El resultado **acumula**: la lista crece hacia abajo y "cargar más" desaparece cuando
`hasNextPage` es `false`.

**Justificación frente al cursor manual en `useState`.**

1. **Es lo único compatible con D2.** Con acumulación manual (`setItems([...items, ...page.items])`),
   la lista visible vive fuera de la caché: una invalidación refetchea la última página y el
   `useState` sigue teniendo las filas viejas, con el estado que ya cambió. El bug sería
   exactamente el que este ciclo existe para evitar: una entrada mostrada como `RESTING` después de
   llenarse. `useInfiniteQuery` refetchea **todas** las páginas cargadas y reemplaza la ventana
   entera.
2. **Reinicia el cursor gratis** al cambiar el `queryKey` (US-2-005), sin un `useEffect` de reinicio
   que mantener sincronizado con dos filtros.
3. `isFetchingNextPage` distingue "cargando la primera página" (esqueleto, US-2-007) de "cargando
   más" (botón en curso) sin estado propio.

**La deduplicación es defensiva y se testea igual.** EP-017 pagina con `cursor: { id }, skip: 1`, así
que el borde no debería repetirse; el criterio de US-2-006 exige la propiedad de todas formas, y un
`nextCursor` repetido por un empate de `placedAt` es un modo de falla real. `dedupeEntryOrders` es
una función pura exportada, con su propio test sobre un fixture donde las dos páginas comparten un
`id` a propósito.

**Guarda anti-bucle:** si `nextCursor` viene igual al cursor pedido, `getNextPageParam` devuelve
`undefined` (no hay página siguiente) en vez de pedir la misma página para siempre.

**Los dos filtros son de servidor.** `status` y `configId` viajan como query params de EP-017 y son
parte del `queryKey`. Filtrar en cliente sobre páginas por cursor mostraría un subconjunto arbitrario
de cada página y dejaría "cargar más" trayendo filas que se descartan (mismo argumento que D1b.2).
`since` y `limit` **no** se usan: se hereda el default del backend (50), así que un cambio de default
del servidor no queda congelado en el cliente.

### D5 — El wire vive en `libs/shared` y se ata con exhaustividad de claves; `apps/api` no se toca

**Decisión.** Archivo nuevo `libs/shared/src/types/entry-order-wire.ts` (§3) con el tipo del
response, las listas congeladas y los chequeos de exhaustividad **reutilizando los helpers
`ExactKeys` / `AssertNoKeyDrift` que cycle-01 ya publicó** en `trading-config-wire.ts`. `apps/web`
importa de ahí y no declara ni una interfaz local del response (RN-05, constitución de `apps/web` §3).

**Cómo queda atado a `apps/api`, y hasta dónde llega la protección.** Cycle-01 pudo cerrar el lazo
con dos líneas en el DTO porque ese cambio estaba en su alcance; acá `apps/api` es out_of_scope, así
que la protección es más débil y conviene decir exactamente cuánto:

| Mecanismo | Qué atrapa | Qué no |
| --- | --- | --- |
| `_EntryOrderWireFieldsAreExhaustive` (type-level, §3.4) | Un campo agregado a `EntryOrderWire` sin agregarlo a `ENTRY_ORDER_WIRE_FIELDS` y viceversa | Una deriva del `select` de `apps/api` |
| `entry-order-wire.spec.ts`: las claves del fixture son set-iguales a `ENTRY_ORDER_WIRE_FIELDS` | Un fixture que se desactualiza respecto del tipo | Ídem |
| E2E `entry-orders.spec.ts`: `GET /trading/entry-orders` real con el token del trader ⇒ `items` es array y `nextCursor` es `string \| null` | Un renombre del **sobre** (`items`/`nextCursor`) | Un renombre de un campo de item (el trader sembrado tiene cero entradas, §11.3) |
| **Recomendado, no en este ciclo:** `satisfies` en el select de `apps/api` (§15) | Cualquier deriva del select, en `pnpm typecheck` | — |

El implementador **no** agrega el `satisfies`: queda registrado como FIX en el handoff, con su forma
exacta, para que el orquestador decida.

### D6 — Estado, motivo y modo: un mapeo por tabla, con caída a neutro en los tres

**Decisión.** Tres funciones puras en `entry-order-labels.ts`, todas con la misma forma
(`valor del wire → miembro del union | 'unknown'`), y la traducción siempre por `t()` sobre la clave
del union resuelto. El detalle de las tablas está en §6. Reglas que valen para las tres:

- El valor crudo del wire **nunca** llega al DOM: si no está en el union, se muestra la clave
  `…unknown` traducida.
- Un valor desconocido degrada **sólo esa celda**: el resto de la fila (bot, nivel, notional,
  fechas) se renderiza con sus valores reales (US-2-002).
- Ningún estado se deriva en el cliente: `expiresAt` en el pasado con `status: 'RESTING'` sigue
  mostrando `RESTING` (RN-01, y hay un caso de test dedicado).

### D7 — Dos celdas condicionales, con la condición explícita y sin mezclar estados

**Decisión.** `EntryOrderLevelCell` y `EntryOrderOutcomeCell` (§5). La regla dura de la segunda: la
información de fill (`filledLeg`, `executedPrice`, `executedQuantity`, `positionId`) se renderiza
**si y sólo si** `status === 'FILLED'`, aunque el fixture traiga esos campos poblados con otro estado
(US-2-004, criterio defensivo). La leyenda de `cancelReason` se renderiza **siempre que
`cancelReason !== null`**, en cualquier estado: eso es lo que hace que `FILLED` +
`PARTIAL_FILL_REMAINDER` muestre las dos cosas a la vez (US-2-003) sin ningún caso especial.

**El vínculo a la posición** (`positionId !== null` y `status === 'FILLED'`) es un `<Link>` de
react-router a `/dashboard/positions?tab=open&positionId=<id>`, y la página resuelve ese param
abriendo `PositionDetailModal` si la posición está entre las cargadas de la pestaña activa.
Limitación documentada y aceptada: si la posición ya cerró o cayó en otra página del paginado por
número, el enlace lleva a la pestaña correcta y no abre nada — no muestra un error ni un modal vacío.
El criterio verificable es el `href` (§13); la apertura de la modal se testea aparte con una posición
presente en el fixture.

### D8 — El detalle del agente consulta sus `RESTING` con una query propia bajo el mismo prefijo

**Decisión.** `AgentRestingEntries` (§5) usa `useRestingEntries(configId)`:
`GET /trading/entry-orders?configId=<id>&status=RESTING&limit=200`, con `queryKey`
`['trading','entry-orders','resting', configId]` — bajo el mismo prefijo que la lista, así que la
invalidación de D2 la alcanza sin código extra. Se monta dentro de `AgentDetailModal`, **debajo** de
`AgentAdvancedSummary` (que ya muestra la sección Entrada de cycle-01: modo, TTL y trailing), para
que el trader lea la configuración y su efecto vigente juntos.

- Cero elementos ⇒ `t('positions.entries.agentDetail.none')`; la sección **no** se omite (US-2-009).
- N elementos ⇒ N bloques de `KeyValueRow` (nivel, notional, vencimiento), no sólo el primero.
- Sólo `RESTING`: el historial vive en la vista general (RN-13). El bloque cierra con un `Link` a
  `/dashboard/positions?tab=entries&configId=<id>` — el **único productor real** del param `configId`
  del contrato de URL (H1).
- Solo lectura: ningún handler de escritura, ningún `PUT` (heredado de US-1-011).

**Descartado:** derivar la entrada vigente de la lista general ya cargada (el modal se abre desde
`/dashboard/config`, donde esa lista no existe) y embeberla en `useTradingConfigs` (exigiría cambiar
EP-005, que es out_of_scope).

### D9 — `libs/ui`: una sola variante nueva de `Badge`, aditiva

**Decisión.** `BadgeVariant` suma `'info'` (tono celeste, ícono `Clock`, **sin animación**), y
`VARIANTS` su entrada correspondiente. Nada más se toca en `libs/ui`.

**Por qué hace falta.** Las cinco variantes actuales son `success | error | warning | neutral |
loading`. `RESTING` necesita un tono "activo/informativo, ni error ni éxito todavía" (US-2-002) y la
única candidata libre, `loading`, renderiza un `Loader2` con `animate-spin`: un spinner por fila,
permanente, que además ignora `prefers-reduced-motion` (US-2-011). Usar `neutral` haría a `RESTING`
indistinguible de `CANCELLED`, que es exactamente la confusión que la historia pide evitar.

**Por qué es seguro.** `BadgeVariant` se usa en el repo sólo como **tipo de valor**
(`Record<string, { variant: BadgeVariant }>` en `trader-data-source-card.tsx`,
`data-source-health-badge.tsx` y `audit-log.tsx`); no hay ningún `Record<BadgeVariant, …>` fuera de
`badge.tsx`, así que agregar un miembro al union no deja ningún mapa incompleto. Es la regla 3 de
`frontend-component-rules` (presentacional, reutilizable, sin lógica de negocio) y el mismo criterio
aditivo de D8 de cycle-01.

### D10 — i18n: un solo namespace `positions.entries.*` más una clave de pestaña hermana

**Decisión.** Todo lo nuevo cuelga de `positions.entries.*`, salvo la etiqueta de la pestaña, que va
como `positions.tabEntries` para quedar al lado de `positions.tabOpen` y `positions.tabClosed` que ya
existen. Árbol completo en §8. La paridad `es`/`en` la garantiza el `locales-parity.spec.ts` que
cycle-01 ya dejó recorriendo el árbol entero: **no hace falta un test nuevo de paridad**, sí que las
claves se agreguen a los dos locales.

Las tres claves de `notificationMessages.entryOrder*` **ya existen** en ambos locales desde cycle-01
(`en.ts:2007-2012`, `es.ts:2035-2040`): este ciclo no las toca, sólo verifica que el enlace nuevo no
las rompió (CA-007).

### D11 — Cero animaciones nuevas

**Decisión.** La pestaña Entradas no introduce ninguna transición, stagger ni animación de fila. El
`useGSAP` existente de `positions.tsx` apunta a `.position-row`; las filas de entradas usan
`.entry-order-row`, así que con la pestaña Entradas activa el selector no matchea, `rows.length` es
`0` y el efecto retorna antes de animar. No se agrega `.entry-order-row` al stagger.

**Justificación.** El único movimiento que el ciclo podría introducir es el de una fila que cambia de
estado en tiempo real, y ahí una transición sería a la vez inútil (el cambio ya es evidente) y
riesgosa (US-2-011 exige respetar `prefers-reduced-motion`, y el stagger existente no lo consulta).
La forma más barata de cumplir el criterio es no tener nada que animar.

### D12 — Un solo lugar sabe cómo se ve una entrada

Los mapeos de estado/motivo/pierna, el rótulo del bot y el formato de USD viven en
`entry-order-labels.ts` y los consumen la tabla, la celda de resultado, el badge y el bloque del
detalle del agente. Ningún componente reimplementa un `switch` sobre `status`: es lo que hace que el
test de los seis estados cubra las cuatro superficies a la vez.

---

## 3. Tipos compartidos — `libs/shared/src/types/entry-order-wire.ts` (archivo nuevo)

Se agrega `export * from './entry-order-wire';` a `libs/shared/src/types/index.ts`. Cambio
aditivo: ningún nombre colisiona con `interfaces.ts` (que ya tiene `EntryOrderMode`, `EntryOrderLeg`,
`EntryOrderExchangeState` y `EntryOrderExchangeStatus`, con otro propósito: el vocabulario del
exchange, sin `EXPIRED`). **El sufijo `Wire` es deliberado** y sigue la convención de
`trading-config-wire.ts`: distingue el contrato del response de EP-017 de los tipos del exchange, y
evita chocar con el `EntryOrderStatus` de Prisma.

### 3.1 Uniones de literales

```ts
import type { EntryOrderLeg, EntryOrderMode } from './interfaces';
import type { TradingModeWire } from './trading-config-wire';

export type EntryOrderStatusWire =
  | 'RESTING'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'MISSING';

export type EntryOrderCancelReasonWire =
  | 'TTL_EXPIRED'
  | 'LATER_DECISION'
  | 'DAILY_LOSS_DISCARDED'
  | 'BOT_STOPPED'
  | 'REPLACED_BY_NEW_ENTRY'
  | 'PARTIAL_FILL_REMAINDER'
  | 'ORPHAN_SWEEP'
  | 'VANISHED_ON_EXCHANGE';
```

Espejan los enums de `apps/api/prisma/schema.prisma:203-227`. Se usan **uniones de literales, no
enums**, por la misma razón que cycle-01 (D2): dos enums distintos no son mutuamente asignables, y
un miembro de un string enum sí es asignable a su literal.

`entryMode` reutiliza `EntryOrderMode` (`interfaces.ts:281`) y **no** `RestingEntryMode`: la columna
es `EntryOrderMode` y el tipo del wire espeja la columna. Que hoy `MARKET` no llegue nunca a una fila
(H5) es una invariante del backend, no del wire; la UI trata `MARKET` como `unknown` (§6.3) en vez de
prometer un tipo que el response podría desmentir.

### 3.2 `EntryOrderWire` — los 24 campos del `select` de EP-017

```ts
export interface EntryOrderWire {
  id: string;
  configId: string;
  symbol: string;
  mode: TradingModeWire;
  entryMode: EntryOrderMode;
  status: EntryOrderStatusWire;
  quantity: number;
  limitPrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  referencePrice: number;
  plannedNotionalUsd: number;
  clientOrderId: string;
  orderListId: string | null;
  orderId: string | null;
  placedAt: string;
  expiresAt: string;
  filledLeg: EntryOrderLeg | null;
  executedPrice: number | null;
  executedQuantity: number | null;
  positionId: string | null;
  cancelReason: EntryOrderCancelReasonWire | null;
  settledAt: string | null;
}
```

Nulabilidad tomada de `schema.prisma:887-921` (`Float?`/`Int?`/`DateTime?`/`String?` ⇒ `| null`).
**Las cuatro fechas son `string`, no `Date`**: `placedAt` y `expiresAt` son `DateTime` no nulos que
Nest serializa a ISO-8601 en el JSON del response, y `settledAt` es `DateTime?`. Ningún componente
recibe un `Date`; la conversión es del lado de la vista (`new Date(iso).toLocaleString()`).

### 3.3 Sobre y query

```ts
export interface EntryOrdersPageWire {
  items: EntryOrderWire[];
  nextCursor: string | null;
}

export interface ListEntryOrdersQuery {
  configId?: string;
  status?: EntryOrderStatusWire;
  since?: string;
  limit?: number;
  cursor?: string;
}
```

`ListEntryOrdersQuery` espeja `ListEntryOrdersDto` (`apps/api/src/trading/dto/list-entry-orders.dto.ts`).
Este ciclo emite sólo `configId`, `status` y `cursor` (D4), pero el tipo declara los cinco para que
sea el espejo del DTO y no una lista de "lo que hoy usa el front".

### 3.4 Listas congeladas y exhaustividad

```ts
import type { AssertNoKeyDrift, ExactKeys } from './trading-config-wire';

export const ENTRY_ORDER_STATUSES = [
  'RESTING', 'FILLED', 'CANCELLED', 'EXPIRED', 'MISSING',
] as const satisfies readonly EntryOrderStatusWire[];

export const ENTRY_ORDER_CANCEL_REASONS = [
  'TTL_EXPIRED', 'LATER_DECISION', 'DAILY_LOSS_DISCARDED', 'BOT_STOPPED',
  'REPLACED_BY_NEW_ENTRY', 'PARTIAL_FILL_REMAINDER', 'ORPHAN_SWEEP', 'VANISHED_ON_EXCHANGE',
] as const satisfies readonly EntryOrderCancelReasonWire[];

export const ENTRY_ORDER_WIRE_FIELDS = [
  'id', 'configId', 'symbol', 'mode', 'entryMode', 'status', 'quantity', 'limitPrice',
  'stopPrice', 'stopLimitPrice', 'trailingDeltaBips', 'referencePrice', 'plannedNotionalUsd',
  'clientOrderId', 'orderListId', 'orderId', 'placedAt', 'expiresAt', 'filledLeg',
  'executedPrice', 'executedQuantity', 'positionId', 'cancelReason', 'settledAt',
] as const;

export const ENTRY_ORDER_WS_EVENTS = [
  'entry-order:placed',
  'entry-order:filled',
  'entry-order:skipped',
  'entry-order:missing',
  'entry-order:expired',
  'entry-order:cancelled',
] as const;

export type EntryOrderWireField = (typeof ENTRY_ORDER_WIRE_FIELDS)[number];
export type EntryOrderWsEvent = (typeof ENTRY_ORDER_WS_EVENTS)[number];

export type _EntryOrderWireFieldsAreExhaustive = AssertNoKeyDrift<
  ExactKeys<EntryOrderWire, Record<EntryOrderWireField, unknown>>
>;
export type _EntryOrderStatusesAreExhaustive = AssertNoKeyDrift<
  ExactKeys<Record<EntryOrderStatusWire, true>, Record<(typeof ENTRY_ORDER_STATUSES)[number], true>>
>;
export type _EntryOrderCancelReasonsAreExhaustive = AssertNoKeyDrift<
  ExactKeys<Record<EntryOrderCancelReasonWire, true>, Record<(typeof ENTRY_ORDER_CANCEL_REASONS)[number], true>>
>;
```

Los tres aliases se exportan a propósito (cycle-01 D2: un alias local sin uso puede caer bajo
`noUnusedLocals`). Son tipos: el `.js` emitido no cambia. Efecto: agregar un campo a `EntryOrderWire`
sin agregarlo a `ENTRY_ORDER_WIRE_FIELDS` falla con `TS2344: Type '"campo"' does not satisfy the
constraint 'never'`, y lo mismo al revés.

`ENTRY_ORDER_WS_EVENTS` es la fuente única del test parametrizado de tiempo real (US-2-012) y del
registrador de `use-websocket.ts`: la lista de eventos deja de estar escrita dos veces.

---

## 4. Contrato del hook y de la URL — `apps/web/src/hooks/use-entry-orders.ts` (archivo nuevo)

### 4.1 Claves de consulta

```ts
export const ENTRY_ORDERS_QUERY_ROOT = ['trading', 'entry-orders'] as const;

export type EntryOrderStatusFilter = EntryOrderStatusWire | 'ALL';
export type EntryOrderBotFilter = string | 'ALL';

export interface EntryOrdersFilters {
  status: EntryOrderStatusFilter;
  configId: EntryOrderBotFilter;
}

export const ENTRY_ORDERS_DEFAULT_FILTERS: EntryOrdersFilters = { status: 'ALL', configId: 'ALL' };

export function entryOrdersListKey(f: EntryOrdersFilters) {
  return [...ENTRY_ORDERS_QUERY_ROOT, 'list', f.status, f.configId] as const;
}

export function restingEntriesKey(configId: string) {
  return [...ENTRY_ORDERS_QUERY_ROOT, 'resting', configId] as const;
}
```

Las dos cuelgan de `ENTRY_ORDERS_QUERY_ROOT`, que es lo que hace que D2 las alcance con una sola
invalidación.

### 4.2 Funciones puras (exportadas y testeadas por separado)

```ts
export function buildEntryOrdersQuery(f: EntryOrdersFilters, cursor?: string): string;
// → 'configId=abc&status=RESTING&cursor=xyz' — omite cada clave con valor 'ALL' o undefined,
//   escapa con URLSearchParams, y NO emite `limit` ni `since` (D4).

export function dedupeEntryOrders(pages: EntryOrdersPageWire[]): EntryOrderWire[];
// → aplana en orden conservando la PRIMERA aparición de cada id.
```

### 4.3 Hooks

```ts
export function useEntryOrders(filters: EntryOrdersFilters) {
  return useInfiniteQuery({
    queryKey: entryOrdersListKey(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<EntryOrdersPageWire>(`/trading/entry-orders?${buildEntryOrdersQuery(filters, pageParam)}`),
    getNextPageParam: (last, _all, lastParam) =>
      last.nextCursor && last.nextCursor !== lastParam ? last.nextCursor : undefined,
    staleTime: 15_000,
  });
}

export function useRestingEntries(configId: string) {
  return useQuery({
    queryKey: restingEntriesKey(configId),
    queryFn: () =>
      api.get<EntryOrdersPageWire>(
        `/trading/entry-orders?configId=${encodeURIComponent(configId)}&status=RESTING&limit=200`,
      ),
    staleTime: 15_000,
  });
}
```

Sin `refetchInterval` en ninguna de las dos: el refresco es por WebSocket (D2), y un poll encima
duplicaría el tráfico sin agregar frescura. `staleTime: 15_000` evita un refetch por cada montaje
mientras el trader cambia de pestaña.

### 4.4 Contrato de la URL (lo implementa la página, §5)

```ts
// apps/web/src/pages/dashboard/positions.tsx
type StatusTab = 'OPEN' | 'CLOSED' | 'ENTRIES';

const TAB_PARAM: Record<StatusTab, string> = { OPEN: 'open', CLOSED: 'closed', ENTRIES: 'entries' };
```

- `tab` se lee de `searchParams` y se normaliza: cualquier valor fuera de los tres ⇒ `'OPEN'`.
- `status`: si el valor no está en `ENTRY_ORDER_STATUSES` ⇒ `'ALL'`.
- Cambiar pestaña o filtro ⇒ `setSearchParams(next, { replace: true })`.
- Al salir de la pestaña Entradas se **borran** `status`, `configId` y `entryOrderId` de la URL: un
  filtro de entradas colgando en la URL de la pestaña Open no significa nada.

---

## 5. Estructura de componentes

Todos tienen lógica de negocio (mapeos del wire, i18n, consultas) ⇒ regla 4 de
`frontend-component-rules`: viven en `apps/web/src/components/positions/entry-orders/`. Los
presenters (`DataTable`, `FilterPills`, `Select`, `Badge`, `KeyValueRow`, `EmptyState`, `Callout`,
`Button`, `SectionTitle`, `InfoTooltip`) salen de `@crypto-trader/ui`. Ninguna página define
subcomponentes inline (regla 5).

```
apps/web/src/components/positions/entry-orders/
├── entry-order-labels.ts          puro: resolvers de status/cancelReason/entryMode/leg, rótulo de bot, formatos
├── entry-orders-panel.tsx         EntryOrdersPanel     — consulta + filtros + tabla + cargar más + vacío/carga/error
├── entry-orders-table.tsx         EntryOrdersTable     — columnas del DataTable
├── entry-orders-filters.tsx       EntryOrdersFilters   — pastillas de estado + selector de bot
├── entry-order-status-badge.tsx   EntryOrderStatusBadge
├── entry-order-level-cell.tsx     EntryOrderLevelCell
├── entry-order-outcome-cell.tsx   EntryOrderOutcomeCell
├── agent-resting-entries.tsx      AgentRestingEntries  — bloque del detalle del agente (D8)
├── fixtures.ts                    fixtures del wire, tipados, compartidos por los tests
└── index.ts
```

`agent-resting-entries.tsx` vive acá y **no** en `components/config/` aunque lo monte
`AgentDetailModal`: la feature es "entradas descansando", y dejar el conocimiento del wire de
entradas en una sola carpeta es lo que hace que D12 se cumpla. `agent-detail-modal.tsx` lo importa
cruzando carpetas, como ya importa `AgentAdvancedSummary`.

| Componente | Props | Responsabilidad |
| --- | --- | --- |
| `EntryOrdersPanel` | `{ filters, onFiltersChange, highlightEntryOrderId }` | Llama `useEntryOrders(filters)` y `useTradingConfigs()`; decide entre esqueleto / error / vacío / tabla; renderiza `EntryOrdersFilters` (siempre visible, también en vacío y en error) y el botón "Cargar más" cuando `hasNextPage`. No conoce la URL. |
| `EntryOrdersTable` | `{ entries, configs, highlightEntryOrderId }` | Columnas del `DataTable`, `rowKey={(e) => e.id}`, `rowClassName` con `entry-order-row` más el resaltado. Sin estado. |
| `EntryOrdersFilters` | `{ filters, configs, onChange }` | `FilterPills` de estado (6 opciones) + `Select` de bot. Sin estado. |
| `EntryOrderStatusBadge` | `{ status }` | `Badge` con la variante y el texto de §6.1. |
| `EntryOrderLevelCell` | `{ entry }` | Los niveles según `entryMode`/`trailingDeltaBips` (§6.4). |
| `EntryOrderOutcomeCell` | `{ entry }` | Contenido condicional al `status` + leyenda de `cancelReason` (§6.5). |
| `AgentRestingEntries` | `{ configId }` | `useRestingEntries(configId)`; N bloques o el texto de "sin entrada activa"; enlace a la vista filtrada. Solo lectura. |

**Columnas de `EntryOrdersTable`** (orden fijo, todas con header por `t()`):

| key | header | contenido |
| --- | --- | --- |
| `bot` | `positions.entries.columns.bot` | `resolveBotLabel(configId, configs)` (§6.6) + `symbol` en línea secundaria |
| `mode` | `trading.mode` (clave existente) | mismo tratamiento visual que `positions-table.tsx` (D1b) |
| `entryMode` | `positions.entries.columns.type` | texto traducido del `entryMode` resuelto |
| `level` | `positions.entries.columns.level` | `<EntryOrderLevelCell>` |
| `notional` | `positions.entries.columns.notional` | `plannedNotionalUsd` formateado en USD, **sin recalcular** |
| `status` | `positions.entries.columns.status` | `<EntryOrderStatusBadge>` |
| `outcome` | `positions.entries.columns.outcome` | `<EntryOrderOutcomeCell>` |
| `placedAt` | `positions.entries.columns.placed` | fecha y hora local absolutas (§13, se reescribe el "tiempo relativo" del funcional) |

**Cambios en archivos existentes:**

| Archivo | Cambio |
| --- | --- |
| `src/pages/dashboard/positions.tsx` | `StatusTab` suma `'ENTRIES'`; la pestaña y los filtros salen de `useSearchParams` (D1/§4.4); tercera entrada en `Tabs`; rama de render para `ENTRIES` (`<EntryOrdersPanel>`); el bloque de paginado por número se condiciona a `tab !== 'ENTRIES'`; `usePositions(..., { enabled: tab !== 'ENTRIES' })`; resolución del param `positionId` (D7). |
| `src/components/positions/index.ts` | re-exporta los siete componentes nuevos. |
| `src/hooks/use-trading.ts` | `usePositions` gana un cuarto parámetro opcional `options?: { enabled?: boolean }`, con `enabled: options?.enabled ?? true`. Aditivo: ningún llamador existente cambia. |
| `src/hooks/use-websocket.ts` | registrador de los seis eventos de `ENTRY_ORDER_WS_EVENTS` (D2). |
| `src/components/notifications/notification-utils.ts` | bloque de las tres claves en `getNotificationRoute`; `routeLabel` normaliza por pathname (D3). |
| `src/containers/notifications-dropdown.tsx` | **borra** su `getNotificationRoute` local (H2) e importa la exportada; borra también su `translateMessage` local. |
| `src/components/notifications/notif-icon.tsx` | tres ramas nuevas por clave: `entryOrderPlaced` → `Clock` celeste, `entryOrderFilled` → `TrendingUp` esmeralda, `entryOrderMissing` → `AlertTriangle` roja. |
| `src/components/notifications/notification-utils.ts` (`iconBg`) | `entryOrderPlaced` → `bg-sky-500/10`, `entryOrderFilled` → `bg-emerald-500/10`, `entryOrderMissing` → `bg-red-500/10`. |
| `src/components/config/agent-detail-modal.tsx` | monta `<AgentRestingEntries configId={cfg.id} />` debajo de `<AgentAdvancedSummary>`. |
| `libs/ui/src/lib/primitives/badge.tsx` | variante `'info'` (D9). |
| `src/locales/es.ts` y `en.ts` | árbol de §8 en los dos. |

---

## 6. Mapeos del wire a pantalla

### 6.1 `status` → badge

| `status` | Variante de `Badge` | Clave de texto |
| --- | --- | --- |
| `RESTING` | `info` (nueva, D9) | `positions.entries.status.RESTING` |
| `FILLED` | `success` | `…status.FILLED` |
| `CANCELLED` | `neutral` | `…status.CANCELLED` |
| `EXPIRED` | `warning` | `…status.EXPIRED` |
| `MISSING` | `error` | `…status.MISSING` |
| cualquier otro | `neutral` | `…status.unknown` |

```ts
export function resolveEntryOrderStatus(value: string): EntryOrderStatusWire | 'unknown' {
  return (ENTRY_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as EntryOrderStatusWire)
    : 'unknown';
}
```

El `Badge` siempre lleva `label` textual: nunca hay estado comunicado sólo por color o ícono
(US-2-011).

### 6.2 `cancelReason` → leyenda

Ocho claves bajo `positions.entries.cancelReason.<VALOR>`, más `…cancelReason.unknown` para un valor
fuera del enum. `null` ⇒ **no se renderiza nada** (ni placeholder, ni guion). Mismo resolver que
6.1 sobre `ENTRY_ORDER_CANCEL_REASONS`.

### 6.3 `entryMode` y `filledLeg`

- `entryMode`: `LIMIT_MAKER` y `OCO` tienen clave propia; `MARKET` **y** cualquier otro valor caen en
  `positions.entries.entryMode.unknown` (H5: `MARKET` no debería existir en esta tabla; si aparece,
  la UI no lo interpreta).
- `filledLeg`: `LIMIT` ⇒ `positions.entries.fill.legLimit` ("pierna de soporte"); `STOP` ⇒
  `…fill.legStop` ("pierna de ruptura"); `null` o desconocido ⇒ no se muestra la pierna, pero **sí**
  el precio y la cantidad si están.

### 6.4 Celda de nivel (`EntryOrderLevelCell`)

| Caso | Primera línea | Segunda línea |
| --- | --- | --- |
| `entryMode = LIMIT_MAKER` | `limitPrice` | — (aunque el fixture traiga `stopPrice`) |
| `entryMode = OCO`, `trailingDeltaBips = null` | `limitPrice` | `stopPrice → stopLimitPrice` (`…level.stopPair`) |
| `entryMode = OCO`, `trailingDeltaBips ≠ null` | `limitPrice` | `…level.trailing` con `{{bips}}` — **no** imprime `stopPrice` como nivel fijo |
| `entryMode` desconocido | `limitPrice` | — |

Un `null` en `stopPrice`/`stopLimitPrice` cuando la rama los pediría ⇒ no se renderiza la segunda
línea (nunca `null`, `undefined` ni `NaN` visibles, US-2-001).

### 6.5 Celda de resultado (`EntryOrderOutcomeCell`)

| `status` | Línea principal |
| --- | --- |
| `RESTING` | `…outcome.expiresAt` con `expiresAt` **absoluto**. Nunca "vence en X": comparar contra el reloj del cliente es la derivación que RN-01 prohíbe. |
| `FILLED` | pierna (§6.3) + `executedPrice` + `executedQuantity`; si `positionId ≠ null`, el `Link` de D7 |
| `CANCELLED` | `…outcome.cancelledAt` con `settledAt` |
| `EXPIRED` | `…outcome.expiredAt` con `settledAt ?? expiresAt` |
| `MISSING` | `…outcome.missing` (texto de atención) |
| desconocido | nada |

Debajo, **en todos los casos**, la leyenda de `cancelReason` si no es `null` (§6.2). Los campos de
fill se renderizan **sólo** con `status === 'FILLED'` (D7).

### 6.6 Rótulo del bot

```ts
export function resolveBotLabel(configId: string, configs: TradingConfigWire[]): string {
  const cfg = configs.find((c) => c.id === configId);
  if (!cfg) return configId;               // nunca una celda vacía (US-2-001)
  return cfg.name || `${cfg.asset}/${cfg.pair}`;
}
```

Cuando cae al `configId` crudo se renderiza en mono con un `InfoTooltip`
(`positions.entries.unknownBot`) que explica que el bot ya no está en la lista. El selector de bot
del filtro lista sólo los configs conocidos más "todos"; si el `configId` de la URL no está entre
ellos, **se agrega como opción con su id crudo** para no descartar en silencio el filtro que traía el
enlace.

---

## 7. Contrato de wire (EP-017, sin cambios)

`GET /trading/entry-orders?configId=<id>&status=<STATUS>&cursor=<id>` · `Authorization: Bearer <jwt>`

**Respuesta 200 (fixture congelado de los tests, `fixtures.ts`):**

```json
{
  "items": [
    {
      "id": "eo_resting_oco_trailing",
      "configId": "cfg_btc",
      "symbol": "BTCUSDT",
      "mode": "TESTNET",
      "entryMode": "OCO",
      "status": "RESTING",
      "quantity": 0.0012,
      "limitPrice": 61250.5,
      "stopPrice": 63100,
      "stopLimitPrice": 63250,
      "trailingDeltaBips": 120,
      "referencePrice": 62000,
      "plannedNotionalUsd": 73.5,
      "clientOrderId": "ct-entry-0001",
      "orderListId": "9911",
      "orderId": null,
      "placedAt": "2026-09-03T12:00:00.000Z",
      "expiresAt": "2026-09-03T13:00:00.000Z",
      "filledLeg": null,
      "executedPrice": null,
      "executedQuantity": null,
      "positionId": null,
      "cancelReason": null,
      "settledAt": null
    }
  ],
  "nextCursor": "eo_resting_oco_trailing"
}
```

**401** — JWT ausente o inválido: la vista muestra el estado de error de US-2-007 (el interceptor de
`lib/api.ts` intenta el refresh antes).

El fixture completo del ciclo tiene **nueve** items: los cinco estados del union, uno con un `status`
inventado, un `LIMIT_MAKER` puro, un `OCO` con niveles fijos, y un `FILLED` con
`cancelReason: 'PARTIAL_FILL_REMAINDER'`. Los ocho `cancelReason` más `null` y el noveno inventado se
cubren con un segundo fixture derivado del primero por `map` (US-2-003).

**Nada de esto cambia `sdd/api.json`:** EP-017 documenta exactamente los 24 campos y los cinco query
params (H7). Sin discrepancias que anotar.

---

## 8. Árbol de claves i18n

Se agrega a `apps/web/src/locales/es.ts` y `en.ts` dentro del bloque `positions` (que arranca en
`en.ts:1220`). `locales-parity.spec.ts` de cycle-01 ya garantiza la paridad recorriendo el árbol.

```
positions.tabEntries                 "Entradas"                     / "Entries"
positions.entries
├── linkLabel                        "Entradas descansando"         / "Resting entries"   (routeLabel, D3)
├── highlighted                      "Entrada de la notificación"   / "Entry from the notification"  (sr-only)
├── unknownBot                       "Este bot ya no está en tu lista"
├── columns.bot / .type / .level / .notional / .status / .outcome / .placed
├── status.RESTING                   "Descansando"                  / "Resting"
├── status.FILLED                    "Ejecutada"                    / "Filled"
├── status.CANCELLED                 "Cancelada"                    / "Cancelled"
├── status.EXPIRED                   "Vencida"                      / "Expired"
├── status.MISSING                   "Sin confirmar"                / "Missing"
├── status.unknown                   "Desconocido"                  / "Unknown"
├── entryMode.LIMIT_MAKER / .OCO / .unknown
├── level.stopPair                   "Ruptura {{stop}} → {{stopLimit}}"
├── level.trailing                   "La ruptura persigue el precio ({{bips}} bips)"
├── notionalHint                     "Capital comprometido en el exchange, calculado al colocar la entrada"
├── outcome.expiresAt                "Vence el {{when}}"
├── outcome.cancelledAt              "Cancelada el {{when}}"
├── outcome.expiredAt                "Venció el {{when}}"
├── outcome.missing                  "El backend no puede confirmarla en el exchange"
├── fill.legLimit                    "Entró por el soporte"         / "Filled on the support leg"
├── fill.legStop                     "Entró por la ruptura"         / "Filled on the breakout leg"
├── fill.price                       "a ${{price}}"
├── fill.quantity                    "{{qty}} unidades"
├── fill.viewPosition                "Ver la posición"
├── cancelReason.TTL_EXPIRED         "Venció su plazo sin llenarse"
├── cancelReason.LATER_DECISION      "El bot no la sostuvo tras una decisión posterior"
├── cancelReason.DAILY_LOSS_DISCARDED "Descartada por el límite de pérdida diaria"
├── cancelReason.BOT_STOPPED         "Se detuvo el bot"
├── cancelReason.REPLACED_BY_NEW_ENTRY "Reemplazada por una entrada nueva"
├── cancelReason.PARTIAL_FILL_REMAINDER "Se canceló el remanente no ejecutado"
├── cancelReason.ORPHAN_SWEEP        "Limpiada: no había ciclo de bot detrás"
├── cancelReason.VANISHED_ON_EXCHANGE "Desapareció del exchange sin confirmación"
├── cancelReason.unknown             "Motivo desconocido"
├── filters.statusLabel / .botLabel
├── filters.statusAll                "Todos"                        / "All"
├── filters.botAll                   "Todos los bots"               / "All bots"
├── loadMore                         "Cargar más"                   / "Load more"
├── loadingMore                      "Cargando…"                    / "Loading…"
├── empty.title                      "Sin entradas descansando"
├── empty.hint                       "Tus bots no dejaron ninguna entrada en el exchange todavía."
├── empty.filteredHint               "Ninguna entrada coincide con los filtros elegidos."
├── error.title                      "No pudimos traer tus entradas"
├── error.retry                      "Reintentar"
└── agentDetail
    ├── title                        "Entrada vigente en el exchange"
    ├── none                         "Sin entrada activa"
    ├── level / .notional / .expiresAt      (labels de las KeyValueRow)
    └── viewAll                      "Ver todas las entradas de este bot"
```

---

## 9. Requisitos de accesibilidad

1. **Pastillas de filtro**: `FilterPills` de `libs/ui` ya renderiza `<button type="button">` con
   `aria-pressed` y `focus-visible:ring` dentro de un `role="group"` — alcanzable con `Tab`, activable
   con `Enter`/`Space` sin ningún cambio. Criterio verificable:
   `getAllByRole('button', { pressed: true })` devuelve exactamente la pastilla activa.
2. **Selector de bot**: `Select` de `libs/ui`, el mismo que ya usa el resto del dashboard, con
   `label` visible por `t()`.
3. **"Cargar más"**: `Button` de `libs/ui` (`<button>` real), nunca un `div` con `onClick`
   (US-2-011). Mientras carga queda `disabled` con el texto de `loadingMore`.
4. **Badges de estado**: siempre con `label` textual además del color y el ícono (§6.1).
5. **Resaltado por notificación**: además del anillo de color, un `sr-only` con
   `positions.entries.highlighted` (D3).
6. **Movimiento**: cero animaciones nuevas (D11), así que no hay nada que condicionar a
   `prefers-reduced-motion`. La variante `info` de `Badge` es la única del set sin animación por
   diseño (D9).
7. **Enlace a la posición**: `<Link>` de react-router (ancla real), con texto por `t()`.
8. **Limitación conocida, no de este ciclo:** el composite `Tabs` de `libs/ui` renderiza botones
   sueltos, sin `role="tablist"`/`aria-selected`. Es preexistente y compartido con todas las páginas
   que lo usan; cambiarlo acá tocaría consumidores fuera del alcance. La pestaña nueva es tan
   accesible como sus dos hermanas (botón nativo, foco y activación por teclado) y queda anotado para
   una spec de `libs/ui`.

---

## 10. Registro SDD

- `sdd/schema.json`: **sin cambios** — ninguna tabla nueva ni modificada (`entry_orders` es de
  spec-005 cycle-02 y este ciclo sólo la lee).
- `sdd/api.json`: **sin cambios** — EP-017 documenta exactamente el `select` y los query params
  verificados (H7); no hay discrepancia que anotar ni changelog que agregar.
- `sdd/components.json`: bajo `apps/web`, once entradas nuevas con `status: "defined"`,
  `created_in_cycle: 2`, y dos entradas existentes actualizadas.

**Nuevas** (COMP-018 a COMP-028):

| id | name | type | path | consumes |
| --- | --- | --- | --- | --- |
| COMP-018 | `EntryOrdersPanel` | component | `src/components/positions/entry-orders/entry-orders-panel.tsx` | EP-017 |
| COMP-019 | `EntryOrdersTable` | component | `src/components/positions/entry-orders/entry-orders-table.tsx` | — |
| COMP-020 | `EntryOrdersFilters` | component | `src/components/positions/entry-orders/entry-orders-filters.tsx` | — |
| COMP-021 | `EntryOrderStatusBadge` | component | `src/components/positions/entry-orders/entry-order-status-badge.tsx` | — |
| COMP-022 | `EntryOrderLevelCell` | component | `src/components/positions/entry-orders/entry-order-level-cell.tsx` | — |
| COMP-023 | `EntryOrderOutcomeCell` | component | `src/components/positions/entry-orders/entry-order-outcome-cell.tsx` | — |
| COMP-024 | `AgentRestingEntries` | component | `src/components/positions/entry-orders/agent-resting-entries.tsx` | EP-017 |
| COMP-025 | `useEntryOrders` | hook | `src/hooks/use-entry-orders.ts` | EP-017 |
| COMP-026 | `PositionsPage` | page | `src/pages/dashboard/positions.tsx` | EP-008, EP-017 |
| COMP-027 | `NotificationsDropdown` | component | `src/containers/notifications-dropdown.tsx` | — |
| COMP-028 | `useWebSocket` | hook | `src/hooks/use-websocket.ts` | — |

Las tres últimas ya existían **sin registrar** y este ciclo las modifica: entran con
`status: "defined"` y un changelog que explica el cambio, exactamente como cycle-01 hizo con
COMP-014..017 (no se puede fingir un `created_in_cycle` anterior para un componente que el registro
nunca tuvo).

**Actualizadas** (protocolo de modificación: `status: "updated"`, `updated_in_cycle: 2`, append al
changelog):

| id | name | Cambio de este ciclo |
| --- | --- | --- |
| COMP-016 | `AgentDetailModal` | monta `AgentRestingEntries` bajo el resumen avanzado (D8) |
| COMP-017 | `useTrading` | `usePositions` gana `options.enabled` para no pollear con la pestaña Entradas activa (D1) |

`libs/ui` no tiene sección en `components.json` y este ciclo **no** la crea: su único cambio es la
variante aditiva de `Badge`, documentada en D9 y en el fragmento de contexto de `libs/ui`.

---

## 11. Contrato de tests

Vitest corre en jsdom con `apps/web/vite.config.mts`. Patrón del repo: los especs que renderizan con
`useTranslation` hacen `import '../../lib/i18n';` y el idioma por default en jsdom es **`en`**
(`localStorage` vacío ⇒ `fallbackLng: 'en'`), así que las aserciones de texto van en inglés. Todo
componente que renderice un `<Link>` se monta dentro de `MemoryRouter`; los que consultan, dentro de
un `QueryClientProvider` con `retry: false`.

### 11.1 Fixtures — `apps/web/src/components/positions/entry-orders/fixtures.ts`

| Fixture | Tipo | Contenido |
| --- | --- | --- |
| `ENTRY_ORDERS_ALL_STATES` | `EntryOrderWire[]` | 9 items: `RESTING` (OCO con trailing), `RESTING` (LIMIT_MAKER, `expiresAt` **en el pasado**), `FILLED` (`filledLeg: 'LIMIT'`, `positionId` no nulo), `FILLED` (`filledLeg: 'STOP'`, `cancelReason: 'PARTIAL_FILL_REMAINDER'`, `positionId: null`), `CANCELLED`, `EXPIRED`, `MISSING`, uno con `status: 'PENDING_REVIEW' as EntryOrderStatusWire` y un `OCO` con niveles fijos (`trailingDeltaBips: null`) |
| `ENTRY_ORDERS_ALL_CANCEL_REASONS` | `EntryOrderWire[]` | 10 items: los ocho del enum + `null` + `'SOMETHING_ELSE' as EntryOrderCancelReasonWire` |
| `ENTRY_ORDERS_PAGE_1` / `_PAGE_2` | `EntryOrdersPageWire` | Dos páginas que comparten a propósito el `id` del borde; `_PAGE_1.nextCursor` apunta a ese id, `_PAGE_2.nextCursor: null` |
| `TRADING_CONFIGS_FOR_ENTRIES` | `TradingConfigWire[]` | Dos configs (una con `name`, otra sin `name` para ejercitar `asset/pair`); ningún config para uno de los `configId` del fixture de entradas |

Todos declarados con anotación de tipo o `satisfies` — nunca objetos literales sin tipo (US-2-012).

### 11.2 Especificaciones Vitest

| Archivo | Aserciones clave (CA / US) |
| --- | --- |
| `libs/shared/src/types/entry-order-wire.spec.ts` | `ENTRY_ORDER_WIRE_FIELDS` tiene 24 entradas, sin duplicados, y es set-igual a las claves de un `EntryOrderWire` construido en el test; `ENTRY_ORDER_STATUSES` tiene 5 y `ENTRY_ORDER_CANCEL_REASONS` 8; `ENTRY_ORDER_WS_EVENTS` tiene 6 y todos empiezan con `entry-order:` (D5) |
| `entry-orders-table.spec.tsx` | **CA-005**: con `ENTRY_ORDERS_ALL_STATES` renderiza 9 filas sin lanzar; la del `status` inventado muestra el texto de `status.unknown` y **sus otras celdas con los valores reales**. `LIMIT_MAKER` no produce segunda línea de nivel; `OCO` sin trailing muestra el par de niveles; `OCO` con trailing muestra el texto de trailing y **no** el `stopPrice`. El notional es exactamente `plannedNotionalUsd` (assert contra el número del fixture, no contra `quantity * limitPrice`). Barrido sobre el `textContent` de la tabla: no contiene `null`, `undefined` ni `NaN`. La `RESTING` con `expiresAt` pasado sigue mostrando "Resting" (RN-01). Ningún string crudo del wire (`'RESTING'`, `'TTL_EXPIRED'`, `'LIMIT_MAKER'`) aparece en el DOM. |
| `entry-order-outcome-cell.spec.tsx` | Los 10 casos de `ENTRY_ORDERS_ALL_CANCEL_REASONS` con `it.each` **derivado de `ENTRY_ORDER_CANCEL_REASONS`**, no de una lista a mano: cada uno muestra su leyenda traducida; `null` no muestra ninguna; el valor inventado muestra `cancelReason.unknown`. `FILLED` + `PARTIAL_FILL_REMAINDER` muestra fill **y** leyenda. Un `CANCELLED` con `executedPrice` poblado **no** muestra precio de ejecución (defensivo, US-2-004). `FILLED` con `positionId` renderiza un link con `href="/dashboard/positions?tab=open&positionId=…"`; con `positionId: null` no hay link. |
| `use-entry-orders.spec.tsx` | `buildEntryOrdersQuery`: `'ALL'` no emite el param; con filtros emite `configId` y `status`; nunca emite `limit` ni `since`. `dedupeEntryOrders(PAGE_1, PAGE_2)` devuelve `n1 + n2 - 1` items y ningún `id` repetido (**US-2-006**). Con `api.get` mockeado, `fetchNextPage()` pide `cursor=<nextCursor de la página 1>`; con `nextCursor: null` `hasNextPage` es `false`; con un `nextCursor` igual al cursor pedido, `hasNextPage` es `false` (guarda anti-bucle). Cambiar `filters` produce una `queryKey` distinta y la primera petición de esa clave **no** lleva `cursor` (US-2-005). |
| `entry-orders-panel.spec.tsx` | **US-2-007**: primera carga ⇒ esqueleto del `DataTable` y **ningún** texto de `empty.title`; `items: []` ⇒ `empty.title` + `empty.hint`, y con un filtro activo ⇒ `empty.filteredHint`; error ⇒ `error.title` visible y distinguible del vacío; el botón de reintento vuelve a llamar `api.get` con **la misma** query string que falló. Los filtros siguen visibles en los tres estados. "Cargar más" aparece sólo con `hasNextPage`. |
| `use-websocket.spec.tsx` (nuevo, junto al existente) | **CA-006**, test de propiedad `it.each(ENTRY_ORDER_WS_EVENTS)`: con `socket.io-client` mockeado por un socket falso que captura handlers, se monta `useWebSocket` con un `QueryClient` espiado; disparar cada uno de los seis eventos invalida `['trading','entry-orders']`. Casos adicionales: `entry-order:filled` invalida **además** `['trading','positions']` (H4); `entry-order:skipped` invalida y **no** lanza (US-2-008); ningún handler llama a `window.location.reload`. El spec existente (`use-websocket.spec.ts`, resolución de URL) no se toca. |
| `notification-utils.spec.ts` | **US-2-010**, tabla única de casos `(key, type, rutaEsperada)` que incluye **todas** las claves ya soportadas (`tradeBuy`, `tradeSell`, `manualClose`, `stopLoss`, `takeProfit`, `agentError`, `agentNoLLM`, `agentNoTestnetKeys`, `agentNetworkError`, `agentRateLimit`, `agentLlmError`, `orderError`), los cuatro caminos por `type` y las tres nuevas: cada ruta vieja es idéntica a la de antes del ciclo. `entryOrderMissing` con `entryOrderId` produce el param; sin él, la ruta sin param. Y sobre esa misma tabla: `routeLabel(ruta, t) !== ruta` para todas (H3, ninguna URL cruda en el DOM). |
| `agent-resting-entries.spec.tsx` | **US-2-009**: un item ⇒ nivel, notional y vencimiento visibles; `items: []` ⇒ `agentDetail.none` y la sección presente; dos items ⇒ dos bloques; ningún `api.put`/`api.post` durante el render ni al interactuar; el link de `viewAll` apunta a `?tab=entries&configId=<id>`. |
| `positions-page.spec.tsx` | La URL manda: `?tab=entries` monta el panel y **no** el paginado por número; `?tab=entries&status=MISSING` deja esa pastilla con `aria-pressed`; un `tab` inválido cae en Open; clickear una pastilla reescribe la query string; salir de Entradas borra `status`/`configId`/`entryOrderId`. `?tab=open&positionId=<id>` con esa posición en el fixture abre `PositionDetailModal`; con un id ausente no abre nada y no lanza. |

`locales-parity.spec.ts` (existente) cubre la paridad `es`/`en` del árbol nuevo sin cambios.

### 11.3 E2E (Playwright, headless, sin claves externas)

**Restricción real, y qué se puede afirmar por eso.** El trader sembrado por `global.setup-trader.ts`
opera en SANDBOX y **no tiene ni puede tener entradas**: crear una exige un bot en TESTNET/LIVE con
claves de exchange (que CI no tiene) y que el LLM decida `BUY` (que CI no puede provocar), y H5
prueba que en SANDBOX el backend nunca escribe una fila. Por lo tanto el E2E **no** afirma el render
de una fila, ni el paginado real, ni una transición de estado: eso lo cubren los tests de Vitest
sobre fixtures del wire (§11.2), que es donde el funcional puso el peso (US-2-012).

**Spec nuevo `e2e/entry-orders.spec.ts`** (storage state del trader, como
`agent-advanced-config.spec.ts`):

| Escenario | Aserción | CA |
| --- | --- | --- |
| `/dashboard/positions` | la pestaña "Entries" es visible junto a "Open" y "Closed"; "Open" sigue activa | CA-008 |
| Click en "Entries" | la URL pasa a contener `tab=entries`; se ve el estado vacío (`empty.title`) y **no** una tabla sin explicación; el bloque de paginado por número no está | CA-008, US-2-007 |
| Pastillas de estado | las seis son visibles; clickear "Missing" deja `aria-pressed="true"` en esa pastilla y agrega `status=MISSING` a la URL | US-2-005, US-2-011 |
| Deep link `/dashboard/positions?tab=entries&status=MISSING` | al cargar, la pestaña Entradas está activa y la pastilla "Missing" ya viene con `aria-pressed="true"` | CA-008, US-2-010 |
| Deep link con `tab` inválido | cae en la pestaña Open, sin error de consola | D1 |
| "Cargar más" | no está en el DOM (el trader no tiene entradas ⇒ `nextCursor: null`) | US-2-006 |
| Sonda de contrato: `GET /trading/entry-orders` con el token de `localStorage` | `200`, `items` es array y `nextCursor` es `null` o string | D5 |
| Volver a "Open" | la tabla o el estado vacío de posiciones vuelve, y la URL ya no tiene `status`/`configId` | D1 |

**Especs existentes:** ninguno se rompe. `e2e/positions.spec.ts` y el bloque 5 de
`e2e/agent-flow.spec.ts` afirman el heading, las dos pestañas por nombre exacto (`'Open'`,
`'Closed'`), la clase activa y `POSITIONS_SKELETON = '.animate-pulse.rounded-lg.bg-muted'`. Una
tercera pestaña no afecta a ninguna de esas aserciones, y el esqueleto del `DataTable` usa
`animate-pulse rounded bg-muted` (sin `rounded-lg`), así que **no** matchea ese selector aunque la
pestaña Entradas estuviera cargando. Verificado leyendo los tres archivos; el implementador confirma
en verde antes de cerrar.

---

## 12. Lectores a enumerar

Todo lo que hay que tocar o verificar, con su razón. Verificado con grep, no inferido.

| Archivo | Línea(s) | Qué pasa | Acción |
| --- | --- | --- | --- |
| `src/containers/notifications-dropdown.tsx` | 58-89 | `getNotificationRoute` **duplicado**; es el que usa la campana del header (`navigate` en 201 y 234) | **borrar** e importar el de `notification-utils` (H2) |
| `src/containers/notifications-dropdown.tsx` | ~35-49 | `translateMessage` duplicado | borrar e importar (higiene, sin criterio asociado) |
| `src/components/notifications/notification-utils.ts` | 3-38 | `getNotificationRoute` exportada | suma el bloque de las tres claves (D3) |
| `src/components/notifications/notification-utils.ts` | 95-103 | `routeLabel` con lookup exacto | normaliza por pathname (H3) |
| `src/components/notifications/notif-row.tsx` | 26, 66 | consume `getNotificationRoute` y `routeLabel` | sin cambios (hereda) |
| `src/components/notifications/notif-icon.tsx` | 25-47 | mapeo por clave | tres ramas nuevas (§5) |
| `src/pages/dashboard/positions.tsx` | 27-190 | pestañas, paginado, GSAP, filtro por `platformMode` | D1, D1b, D7, D11 |
| `src/hooks/use-trading.ts` | `usePositions` (≈195) | tres llamadores: `positions.tsx`, `useOpenPositions` (deprecado) y nada más | cuarto parámetro opcional `options.enabled` |
| `src/hooks/use-trading.ts` | `useTradingConfigs` (≈84) | `queryKey ['trading','config']`, `staleTime 30_000` | **se reutiliza tal cual**, ninguna consulta nueva para la lista de bots |
| `src/hooks/use-websocket.ts` | 47-135 | handlers actuales | suma el registrador de los seis eventos (D2) |
| `src/components/config/agent-detail-modal.tsx` | 151 | monta `AgentAdvancedSummary` | suma `AgentRestingEntries` debajo (D8) |
| `src/components/positions/index.ts` | 1-4 | barrel | re-exporta los siete componentes nuevos |
| `libs/shared/src/types/index.ts` | 1-5 | barrel | suma `export * from './entry-order-wire';` |
| `libs/ui/src/lib/primitives/badge.tsx` | 4-40 | `BadgeVariant` y `VARIANTS` | variante `info` (D9) |
| `apps/web/src/components/settings/trader-data-source-card.tsx`, `components/admin/data-source-health-badge.tsx`, `pages/admin/audit-log.tsx` | — | únicos consumidores de `BadgeVariant`, todos como **tipo de valor** | sin cambios; se verifican en `pnpm typecheck` |

**Ningún componente de `apps/web` lee hoy `entryOrder*`** (`grep entryOrder apps/web/src` ⇒ sólo las
claves de i18n de cycle-01): la superficie nueva no tiene lectores previos que migrar.

---

## 13. Criterios funcionales reescritos como ejecutables

| Origen | Criterio original | Reescritura ejecutable |
| --- | --- | --- |
| US-2-001, columna "Colocada" | "`placedAt`, tiempo relativo" | **Fecha y hora local absolutas.** Un rótulo relativo se recalcula en cada render a partir del reloj del cliente: es exactamente la clase de derivación que RN-01 prohíbe, y volvería el test dependiente de la hora de la corrida. `positions-table.tsx` ya usa `toLocaleDateString()` para sus fechas. |
| US-2-002, badge de `RESTING` | "tono activo/informativo" | Variante `info` **nueva** en `Badge` (D9): la única libre era `loading`, que renderiza un spinner permanente por fila e ignora `prefers-reduced-motion`. |
| US-2-004 | "permite navegar o vincular a esa posición (mecanismo a criterio del architect)" | `<Link to="/dashboard/positions?tab=open&positionId=<id>">`, y la página abre `PositionDetailModal` si esa posición está entre las cargadas. **Limitación explícita:** si ya cerró o cayó en otra página del paginado, el enlace lleva a la pestaña correcta y no abre nada. El criterio de test es el `href`; la apertura se testea aparte con la posición presente en el fixture. |
| US-2-005 | "pide a EP-017 ese `status` **o** filtra sobre los datos ya cargados" | Se cierra en una sola rama: **server-side**, `status` y `configId` como query params y parte del `queryKey` (D4). Filtrar en cliente sobre páginas por cursor muestra un subconjunto arbitrario por página. |
| US-2-006 | "agrega **o** reemplaza filas (según decida el architect)" | **Acumula** (`useInfiniteQuery`), con `dedupeEntryOrders` conservando la primera aparición de cada `id`. El fixture del test tiene el `id` de borde repetido a propósito. |
| US-2-008, `entry-order:*` | "cada evento invalida/actualiza la consulta" | Invalidación por **prefijo** `['trading','entry-orders']` para los seis, más `['trading','positions']` y `['analytics']` en `filled` (H4). Test parametrizado desde `ENTRY_ORDER_WS_EVENTS`, no una lista escrita a mano. |
| US-2-010 | "el enlace deja la vista filtrada o resaltada por el bot (`configId`) de la notificación" | **Imposible con el contrato actual** para `entryOrderPlaced` y `entryOrderFilled`: sus JSON no traen `configId` ni `entryOrderId` (H1). Reescrito: las tres enlazan a la pestaña Entradas con el `status` que corresponde, y `entryOrderMissing` —la única que trae un id— además resalta esa entrada. El `configId` del contrato de URL lo produce el detalle del agente (D8). FIX recomendado en §15 para que el criterio original sea alcanzable. |
| US-2-009 | "muestra su nivel, notional y vencimiento" | Consulta propia `useRestingEntries(configId)` bajo el mismo prefijo de invalidación (D8), no un derivado de la lista general (que no está montada en `/dashboard/config`). |
| US-2-011, último criterio | "la actualización en tiempo real no introduce una animación que ignore `prefers-reduced-motion`" | **Cero animaciones nuevas** (D11): no hay nada que condicionar. Verificable: el diff del ciclo no agrega ninguna clase `animate-*`, `transition-*` nueva ni un `gsap.` en los archivos de la vista. |
| US-2-012 / CA-008 | "un spec E2E abre la vista, aplica un filtro, **pide la página siguiente** y confirma el resultado" | El trader de CI no tiene entradas y no puede tenerlas (§11.3): el E2E afirma presencia de la pestaña, estado vacío, filtros con `aria-pressed`, deep link y **ausencia** de "cargar más" con `nextCursor: null`. El paginado real se verifica en Vitest sobre las dos páginas del fixture. |
| D1 del funcional, razón 2 | "reutiliza el filtro por `platformMode`" | **Descartado** (D1b): en SANDBOX —el modo por default— nunca existe una entrada (H5), así que ese filtro dejaría la pestaña permanentemente vacía. Se muestra la columna `mode` en su lugar. |
| Nota de compatibilidad de D1 | "`positions.tsx` pagina con el composite `Pagination` de `libs/ui`" | Falso (H6): pagina con dos `Button` inline. No cambia la decisión; el implementador no debe buscar el composite. |

---

## 14. Dependencias externas

Ninguna. Cero paquetes nuevos: `@tanstack/react-query@^5.96.0` (con `useInfiniteQuery`),
`react-router-dom` (con `useSearchParams`, ya usado en `settings.tsx:2`) y `socket.io-client` ya son
dependencias del repo.

---

## 15. Handoff

**Para el orquestador — dos FIX recomendados, ninguno bloqueante, ninguno ejecutado en este ciclo**
(`apps/api` es out_of_scope del brief; el ciclo cierra completo sin ellos):

- **FIX-α (`[IMPROVEMENT]`, `apps/api`)** — agregar `configId` a los tres JSON de notificación de
  entradas y `entryOrderId` a `entryOrderPlaced`/`entryOrderFilled`
  (`entry-order.service.ts:220-231, 350-360`). Es aditivo: `translateMessage` pasa el JSON entero
  como parámetros de interpolación y las claves que sobran se ignoran, así que **ninguna traducción
  cambia**. Vuelve ejecutable el criterio original de US-2-010 (enlace filtrado por bot) sin tocar
  esta vista.
- **FIX-β (`[IMPROVEMENT]`, `apps/api`)** — extraer el `select` de `listEntryOrders`
  (`trading.service.ts:804-829`) a una constante con
  `satisfies Record<EntryOrderWireField, true>` importando el tipo de `@crypto-trader/shared`. Mismo
  objeto en runtime, cero cambio de comportamiento, y a partir de ahí cualquier deriva entre el
  `select` y el wire compartido falla en `pnpm typecheck` — la protección que cycle-01 sí pudo
  montar para el wire de configuración (D5).

**Para el planner.** Orden de dependencia: `libs/shared` (§3) → `libs/ui` (D9, una variante) →
`use-entry-orders.ts` + `entry-order-labels.ts` (§4, §6) → componentes de presentación
(badge/celdas → tabla → filtros → panel) → pestaña y contrato de URL en `positions.tsx` (§5) →
tiempo real en `use-websocket.ts` (D2) → bloque del detalle del agente (D8) → ruteo y etiqueta de
notificaciones + borrado del duplicado (D3, H2) → locales (§8) → Vitest (§11.2) → E2E (§11.3) →
fragmentos de contexto y cierre de la spec. El hook y el módulo de labels son la task más pesada y
son prerequisito de todo lo visual; el contrato de URL de `positions.tsx` es prerequisito del E2E y
del ruteo de notificaciones.

**Para el reviewer.** `pnpm typecheck`, `pnpm nx test web`, `pnpm nx test shared`, la suite E2E en
CI, y `pnpm sdd:validate` en verde. Además, cuatro verificaciones que no salen de una suite:

1. `grep -rn "getNotificationRoute" apps/web/src` devuelve **una sola** definición (H2).
2. `grep -rn "entry-order:" apps/web/src` no devuelve ningún literal suelto: los seis eventos salen
   de `ENTRY_ORDER_WS_EVENTS` (D2/§3.4).
3. Ningún archivo de `apps/web` declara localmente el shape del response de EP-017 (RN-05).
4. El diff no toca `apps/api` ni agrega animaciones (D11).
