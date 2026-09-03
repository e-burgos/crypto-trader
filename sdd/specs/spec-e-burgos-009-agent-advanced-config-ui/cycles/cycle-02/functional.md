# Functional — Cycle 2: Entradas descansando en el dashboard

> **Input:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Desde `spec-e-burgos-005 cycle-02`, un bot en modo `LIMIT_MAKER` o `OCO` no compra a mercado: deja una
**entrada descansando** en el exchange (una orden `LIMIT_MAKER` suelta, o un OCO de dos piernas) y
espera a que el precio la alcance. Esa entrada vive en Binance de forma completamente independiente de
si el backend está corriendo, y el backend ya la registra y consulta (`EP-017 GET
/trading/entry-orders`) y ya emite seis eventos por WebSocket a medida que cambia de estado
(`entry-order:placed|filled|skipped|missing|expired|cancelled`). Lo único que falta es que el trader
la vea: hoy, el dashboard no tiene ni una fila, ni un badge, ni una notificación legible para esto.
Hay un bot `LIMIT_MAKER` en TESTNET corriendo en producción ahora mismo — en cuanto el LLM decida
`BUY`, colocará una entrada real que nadie puede seguir desde la SPA.

El riesgo central de este ciclo **no es de UX, es de confianza en el estado**: una entrada
descansando puede llenarse, vencer, cancelarse por seis motivos distintos, o directamente
desaparecer del exchange sin que el backend pueda confirmar por qué (`MISSING`). Mostrarle al trader
que una entrada está "llena" cuando en realidad venció, o viceversa, es peor que no mostrarle nada.
Por eso **el estado que se muestra es siempre el que devuelve el backend** (`status` del wire de
EP-017 o el evento de WebSocket que lo actualiza) — la SPA no calcula, no adivina ni corrige ese
estado a partir de otros datos (por ejemplo, comparar `expiresAt` contra la hora del cliente para
decidir que algo "ya venció"). Y por eso, igual que en `cycle-01`, todo criterio de este documento es
una **propiedad verificable** sobre un fixture del response de EP-017 o de un payload de WebSocket —
nunca el valor de un precio de mercado ni el resultado de una decisión del LLM.

**Actores de este ciclo:**

- **Trader dueño del bot** — quiere ver, sin ir a la API a mano, qué entradas tiene descansando cada
  uno de sus bots, en qué nivel, cuánto capital comprometen, cuándo vencen, y qué pasó con las que ya
  no están activas — con la lista actualizándose sola cuando algo cambia en el exchange.
- **Trader que recibe una notificación** — hace clic en "se colocó una entrada" o "tu entrada se
  llenó" y espera llegar directo a verla, no a una pantalla genérica.

---

## Historias de usuario

### US-2-001: Ver la lista de entradas descansando de todos mis bots

**Como** trader dueño de uno o más bots
**Quiero** una vista con una fila por cada entrada descansando (pasada o presente) de mis bots
**Para** saber de un vistazo qué capital tengo comprometido en órdenes que todavía no son posiciones

**Columnas de la vista** (fuente: response de `EP-017`, sin ningún cálculo de mercado):

| Columna | Contenido | Regla de armado |
| --- | --- | --- |
| Bot | Identifica el `configId` del wire contra la lista de bots del trader (nombre si tiene, si no `asset/pair`) | Si el `configId` no matchea ningún bot conocido por el cliente en ese momento, se muestra el `configId` crudo — nunca una fila vacía |
| Tipo de entrada | `entryMode` (`LIMIT_MAKER` u `OCO`) | Badge o texto corto, nunca el string crudo del wire sin traducir |
| Nivel(es) | `limitPrice` siempre; si `entryMode = OCO`, además `stopPrice`→`stopLimitPrice` como segunda línea | Si `trailingDeltaBips` no es `null`, la segunda línea se reemplaza por una indicación de que la pierna de ruptura persigue el precio (con el valor en BIPS), en vez de mostrar un nivel fijo que no es tal |
| Notional comprometido | `plannedNotionalUsd`, formateado en USD | Nunca se recalcula desde `quantity * limitPrice`: se muestra el campo del wire tal cual |
| Estado | `status` mapeado a badge/texto (ver US-2-002) | Un valor fuera del union conocido degrada a neutro (US-2-002) |
| Vencimiento / motivo / fill | Contenido condicional al `status` (ver US-2-002 a US-2-004) | Nunca mezcla información de dos estados a la vez |
| Colocada | `placedAt`, tiempo relativo | — |

**Criterios de aceptación:**

- [ ] Con un fixture de EP-017 de N entradas con distintos `configId`, la tabla renderiza exactamente
      N filas, cada una con el `configId` resuelto contra la lista de bots del trader.
- [ ] Para una entrada con `entryMode = LIMIT_MAKER`, la columna de nivel muestra únicamente
      `limitPrice`; los campos `stopPrice`, `stopLimitPrice` y `trailingDeltaBips` del fixture (que en
      este caso vienen `null`) no producen ninguna segunda línea ni un `null`/`undefined` visible.
- [ ] Para una entrada con `entryMode = OCO` y `trailingDeltaBips = null`, la columna de nivel muestra
      `limitPrice` y, en una segunda línea, `stopPrice` y `stopLimitPrice` como par de niveles fijos.
- [ ] Para una entrada con `entryMode = OCO` y `trailingDeltaBips` no nulo, la segunda línea indica
      que la pierna de ruptura persigue el precio con ese delta, y no imprime `stopPrice` como si fuera
      un nivel fijo.
- [ ] La columna de notional muestra exactamente el valor de `plannedNotionalUsd` del fixture, sin
      recalcularlo a partir de otros campos.
- [ ] Ningún campo `null` u opcional ausente del wire (`stopPrice`, `stopLimitPrice`,
      `trailingDeltaBips`, `filledLeg`, `executedPrice`, `executedQuantity`, `positionId`,
      `cancelReason`, `settledAt`) produce `null`, `undefined` o `NaN` visible en ninguna celda.

---

### US-2-002: Entender qué significa cada estado sin ambigüedad

**Como** trader dueño del bot
**Quiero** que cada uno de los cinco estados de una entrada tenga un badge y un texto propios, y que
un estado que no reconozco no rompa la pantalla
**Para** no confundir "está esperando" con "ya pasó algo", y no perder la vista entera por un valor
que el backend agregó y la SPA todavía no conoce

**Semántica de cada estado** (para el trader, en una línea):

| `status` | Qué significa | Tono del badge |
| --- | --- | --- |
| `RESTING` | La entrada sigue descansando en el exchange, esperando llenarse o vencer | Activo/informativo (no es un error ni un éxito todavía) |
| `FILLED` | Se ejecutó: hay una posición abierta a partir de esta entrada | Éxito |
| `CANCELLED` | Se dio de baja sin llenarse, por un motivo puntual (ver US-2-003) | Neutro, con el motivo siempre visible |
| `EXPIRED` | Superó su plazo (`entryOrderTtlMinutes`) sin llenarse ni cancelarse por otra razón | Advertencia |
| `MISSING` | El backend no puede confirmarla en el exchange: puede haberse ejecutado, cancelado o cancelado fuera de banda sin que el sistema se enterara a tiempo | Alerta — es el único estado que amerita atención del trader, no solo información |
| *(cualquier otro valor)* | Desconocido — el backend agregó un estado que esta versión de la SPA no contempla todavía | Neutro, igual que un campo `unknown` en cualquier otra pantalla del sistema |

**Criterios de aceptación:**

- [ ] **CA-005 (spec).** Un fixture con una entrada de cada uno de los cinco estados del union
      (`RESTING`, `FILLED`, `CANCELLED`, `EXPIRED`, `MISSING`) más una entrada con un sexto valor de
      `status` inventado (fuera del union) renderiza las seis filas sin lanzar ningún error, con la
      sexta mostrando un badge/texto neutro de "desconocido".
- [ ] El texto de cada badge de estado sale de `t()`; ningún estado se muestra como el string crudo
      del wire (`RESTING`, `FILLED`, etc.) sin pasar por la clave de traducción correspondiente.
- [ ] El estado mostrado en cada fila es exactamente el campo `status` del fixture, nunca un valor
      derivado en el cliente comparando `expiresAt` contra la hora actual: una entrada `RESTING` cuyo
      `expiresAt` ya pasó (fixture con `expiresAt` en el pasado) se sigue mostrando como `RESTING`,
      nunca como `EXPIRED` inferido.
- [ ] Un `status` desconocido no impide que el resto de las columnas de esa fila (nivel, notional,
      bot) se rendericen con sus valores reales del fixture.

---

### US-2-003: Entender por qué se canceló una entrada

**Como** trader dueño del bot
**Quiero** ver el motivo exacto por el que una entrada se canceló o venció, no solo que "ya no está"
**Para** distinguir una cancelación de rutina (el bot decidió reemplazarla) de una que necesita mi
atención (se descartó por el límite de pérdida diaria, o desapareció del exchange sin explicación)

**Los ocho motivos de `cancelReason`** (para el trader, en una línea):

| `cancelReason` | Explicación para el trader |
| --- | --- |
| `TTL_EXPIRED` | Venció su plazo sin llenarse (acompaña normalmente a `status = EXPIRED`) |
| `LATER_DECISION` | El bot decidió no sostenerla más tras una decisión posterior del LLM |
| `DAILY_LOSS_DISCARDED` | Se descartó por haber alcanzado el límite de pérdida diaria del bot |
| `BOT_STOPPED` | Se canceló porque el trader (o el sistema) detuvo el bot |
| `REPLACED_BY_NEW_ENTRY` | El bot la reemplazó por una entrada nueva antes de que se llenara |
| `PARTIAL_FILL_REMAINDER` | Se llenó parcialmente; el resto de la cantidad que no llegó a ejecutarse se canceló (puede acompañar a `status = FILLED`, no solo a `CANCELLED`) |
| `ORPHAN_SWEEP` | El sistema la encontró sin un ciclo de bot activo detrás y la limpió |
| `VANISHED_ON_EXCHANGE` | Desapareció del exchange sin que el backend pudiera confirmar si se llenó o se canceló (puede acompañar tanto a `CANCELLED` como a `MISSING`) |
| *(cualquier otro valor, o `null`)* | Sin motivo — no se muestra ninguna leyenda de motivo (`null` es el valor normal para `RESTING` y para `FILLED` sin remanente cancelado) |

**Criterios de aceptación:**

- [ ] Un fixture con las ocho variantes de `cancelReason`, cada una en una entrada distinta, renderiza
      las ocho leyendas correspondientes, cada una traducida por `t()` — ninguna aparece como el
      string crudo del enum.
- [ ] Una entrada con `cancelReason = null` (el caso de una `RESTING` normal, o de una `FILLED` sin
      remanente) no muestra ninguna leyenda de motivo ni un placeholder vacío.
- [ ] Un `cancelReason` con un noveno valor inventado (fuera de los ocho documentados) degrada a una
      leyenda neutra genérica ("motivo desconocido"), sin romper el render de esa fila ni de las
      demás.
- [ ] Una entrada con `status = FILLED` y `cancelReason = PARTIAL_FILL_REMAINDER` muestra **ambas**
      cosas a la vez: la información de fill (US-2-004) y la leyenda de que el remanente se canceló —
      ninguna de las dos piezas de información se pisa con la otra.

---

### US-2-004: Ver el detalle de una entrada que se llenó

**Como** trader dueño del bot
**Quiero** que una entrada con `status = FILLED` me muestre qué pierna se ejecutó y a qué precio
**Para** saber si mi entrada `OCO` entró por el soporte o por la ruptura, y a qué precio exacto se
abrió la posición resultante

**Criterios de aceptación:**

- [ ] Una entrada `FILLED` con `filledLeg = "LIMIT"` muestra que se ejecutó la pierna de soporte, con
      `executedPrice` y `executedQuantity` del fixture.
- [ ] Una entrada `FILLED` con `filledLeg = "STOP"` muestra que se ejecutó la pierna de ruptura, con
      los mismos dos valores.
- [ ] Una entrada `FILLED` con `positionId` no nulo permite navegar o vincular a esa posición en
      Posiciones (el mecanismo exacto de navegación queda a criterio del architect); una `FILLED`
      cuyo fixture trae `positionId = null` no ofrece ese vínculo ni lo simula.
- [ ] Ninguna entrada con `status` distinto de `FILLED` muestra `filledLeg`, `executedPrice` ni
      `executedQuantity`, aunque el fixture los traiga con un valor (defensivo: el wire no debería
      poblarlos fuera de `FILLED`, pero la UI no los muestra igual si status no acompaña).

---

### US-2-005: Filtrar la lista por estado y por bot

**Como** trader con varios bots y muchas entradas acumuladas
**Quiero** filtrar la lista por estado y por bot
**Para** encontrar, por ejemplo, sólo las entradas `RESTING` de mi bot de BTC sin desplazarme por
todo el historial

**Criterios de aceptación:**

- [ ] El filtro de estado ofrece las cinco opciones del union más "todos"; seleccionar una opción
      hace que la vista pida a EP-017 exactamente ese `status` como query param (o, si trae los datos
      ya cargados, filtra sobre ellos con el mismo criterio — decisión del architect), nunca una
      combinación distinta de la elegida.
- [ ] El filtro de bot ofrece la lista de bots del trader (por nombre o `asset/pair`, igual criterio
      que la columna Bot de US-2-001) más "todos"; seleccionar un bot filtra por su `configId`.
- [ ] Ambos filtros son combinables: elegir un estado y un bot a la vez sobre un fixture con
      múltiples combinaciones deja visibles únicamente las filas que matchean las dos condiciones.
- [ ] Cambiar cualquiera de los dos filtros reinicia la paginación al primer cursor (nunca queda
      "colgado" en una página sin resultados de la combinación nueva).
- [ ] Con ningún resultado para la combinación de filtros elegida, se muestra el estado vacío de
      US-2-007, no una tabla en blanco sin explicación.

---

### US-2-006: Recorrer el historial con paginado por cursor

**Como** trader con muchas entradas acumuladas
**Quiero** poder pedir la página siguiente de resultados
**Para** ver entradas más viejas que las que entran en la primera carga, sin que el sistema me
muestre un número de página que no significa nada sobre este recurso

**Criterios de aceptación:**

- [ ] Con un fixture de EP-017 cuyo `nextCursor` no es `null`, la vista ofrece una acción para pedir
      más resultados; activarla vuelve a pedir a EP-017 con `cursor` igual al `nextCursor` recibido.
- [ ] Con `nextCursor = null`, esa acción no se muestra (o se muestra deshabilitada) — la vista nunca
      pide una página que el backend ya indicó que no existe.
- [ ] La vista no calcula ni muestra un número total de páginas ni un conteo total de entradas: EP-017
      no expone `total`, y ningún criterio de esta vista depende de que exista.
- [ ] Pedir la página siguiente agrega o reemplaza filas (según decida el architect) pero nunca
      duplica una entrada cuyo `id` ya estaba en pantalla, verificado sobre un fixture donde la
      "página anterior" y la "página siguiente" comparten intencionalmente un `id` de borde.

---

### US-2-007: Ver un estado claro mientras carga, cuando no hay nada, o si algo falla

**Como** trader que abre la vista de entradas
**Quiero** distinguir "todavía está cargando" de "no tengo ninguna entrada" de "algo falló al pedir
los datos"
**Para** no interpretar una demora de red como que mi bot nunca puso una entrada, ni un error de
conexión como que no tengo entradas

**Criterios de aceptación:**

- [ ] Mientras la consulta a EP-017 está en curso (antes de la primera respuesta), la vista muestra un
      estado de carga (esqueleto), nunca una tabla vacía ni el estado vacío de "sin entradas".
- [ ] Con una respuesta exitosa cuyo `items` es un array vacío, la vista muestra un estado vacío con
      una explicación de dominio ("tu bot no dejó ninguna entrada descansando" o equivalente, según si
      hay o no un filtro activo), nunca una tabla con cero filas sin texto alrededor.
- [ ] Con una respuesta de error de EP-017 (fixture de fallo de red o 401), la vista muestra un estado
      de error distinguible visualmente del estado vacío, sin romper el resto del dashboard.
- [ ] Un reintento manual desde el estado de error vuelve a pedir la misma combinación de filtros y
      cursor que estaba activa antes del error, no la primera página sin filtros.

---

### US-2-008: Ver la lista actualizarse sola cuando algo cambia en el exchange

**Como** trader con la vista de entradas abierta
**Quiero** que la lista refleje un cambio de estado de una entrada sin que yo tenga que recargar la
página
**Para** enterarme en el momento de que mi entrada se llenó, venció o desapareció, mientras estoy
mirando el dashboard

**Qué ve el trader al llegar cada evento de WebSocket** (`apps/api/src/trading/entry-order.service.ts`):

| Evento | Qué cambia para el trader en la vista |
| --- | --- |
| `entry-order:placed` | Aparece una fila nueva en `RESTING` para ese bot (si el filtro activo la incluye) |
| `entry-order:filled` | La fila de ese `entryOrderId` pasa a `FILLED` con su pierna y precio de ejecución |
| `entry-order:expired` | La fila pasa a `EXPIRED` |
| `entry-order:cancelled` | La fila pasa a `CANCELLED` con su `cancelReason` |
| `entry-order:missing` | La fila pasa a `MISSING` — este es el único evento que además dispara una notificación de atención (`entryOrderMissing`, tipo `AGENT_ERROR`) |
| `entry-order:skipped` | No corresponde a ninguna fila (el backend nunca llegó a persistir una entrada: no había nivel utilizable). No hay fila que actualizar; ver D2 |

**Criterios de aceptación:**

- [ ] **CA-006 (spec).** Con la vista montada y un evento simulado `entry-order:filled` para un
      `entryOrderId` que ya está en pantalla como `RESTING`, la fila pasa a mostrar `FILLED` con el
      contenido de US-2-004, sin que el trader recargue la página.
- [ ] Un evento simulado `entry-order:placed` con un `entryOrderId` que todavía no está en pantalla
      hace aparecer una fila nueva para ese bot, respetando los filtros activos en ese momento (si el
      filtro de estado activo es distinto de `RESTING`/"todos", la fila nueva no se fuerza a aparecer
      fuera del criterio del filtro).
- [ ] Un evento simulado `entry-order:missing` refresca la fila a `MISSING` y es indistinguible, en
      cuanto a mecanismo de refresco, de cualquier otro evento de la tabla — la única diferencia es la
      notificación aparte que ya dispara el backend.
- [ ] Un evento simulado `entry-order:skipped` no produce ningún error ni fila fantasma en la tabla,
      aunque dispare la misma invalidación de consulta que los demás eventos (ver D2).
- [ ] Ningún evento de esta tabla dispara una recarga completa de la página (`window.location.reload`
      o equivalente): la actualización es siempre por invalidación/refetch de la consulta.

---

### US-2-009: Ver la entrada activa de un bot desde su propio detalle

**Como** trader dueño del bot
**Quiero** que el detalle de mi agente muestre si tiene una entrada `RESTING` vigente, sin tener que
ir a la vista general de entradas
**Para** entender de un vistazo, junto con el resto de la configuración de Entrada
(`entryOrderMode`, `entryOrderTtlMinutes`, `entryTrailingDeltaBips` — ya mostrados desde `cycle-01`),
si ese bot tiene ahora mismo capital comprometido en el exchange

**Criterios de aceptación:**

- [ ] Con un fixture de EP-017 filtrado por el `configId` del agente y `status = RESTING` que devuelve
      exactamente un elemento, el detalle del agente (`agent-detail-modal.tsx` /
      `agent-advanced-summary.tsx`) muestra su nivel, notional y vencimiento junto a la sección de
      Entrada existente.
- [ ] Con ese mismo fixture devolviendo un array vacío, el detalle muestra una indicación de "sin
      entrada activa" en vez de omitir la sección o mostrar un valor vacío sin explicación.
- [ ] Con un fixture que devuelve más de un elemento `RESTING` para el mismo `configId` (caso límite,
      no impedido por el wire), el detalle muestra todas las entradas devueltas, no sólo la primera.
- [ ] El detalle del agente no muestra entradas `FILLED`, `CANCELLED`, `EXPIRED` ni `MISSING` de ese
      bot — sólo la vigente (`RESTING`); el historial completo vive en la vista general (US-2-001).
- [ ] Esta sección es de solo lectura: ninguna interacción sobre ella dispara un `PUT`
      `/trading/config` ni ningún otro request de escritura (heredado de US-1-011, cycle-01).

---

### US-2-010: Llegar a la vista desde una notificación

**Como** trader que recibe una notificación de que una entrada se colocó, se llenó o desapareció
**Quiero** que hacer clic en esa notificación me lleve directo a verla
**Para** no tener que buscarla a mano entre todos mis bots

**Estado verificado del código:** `notification-utils.ts` (`getNotificationRoute`) hoy no reconoce las
claves `entryOrderPlaced`, `entryOrderFilled` ni `entryOrderMissing`: al no matchear ninguna del primer
bloque, cae al `switch` por `type`, y como `entryOrderPlaced`/`entryOrderFilled` usan
`NotificationType.TRADE_EXECUTED` terminan en `/dashboard/history` (Historial de operaciones, no la
vista de entradas), y `entryOrderMissing` (`AGENT_ERROR`) termina en `/dashboard/config`. Ninguna de
las tres apunta hoy a donde el trader necesita ir.

**Criterios de aceptación:**

- [ ] Las tres notificaciones (`entryOrderPlaced`, `entryOrderFilled`, `entryOrderMissing`) enlazan a
      la vista de entradas de este ciclo, no a Historial ni a Configuración.
- [ ] El enlace, como mínimo, deja la vista filtrada o resaltada por el bot (`configId`) de la
      notificación — el mecanismo exacto (query param, estado en memoria, o ambos) y si además
      selecciona la entrada puntual por `entryOrderId` quedan para el architect (ver D3).
- [ ] Ningún cambio de este ciclo rompe el enlace de las notificaciones ya existentes
      (`tradeBuy`, `stopLoss`, `agentError`, etc.): un test de propiedad recorre todas las claves
      conocidas de `getNotificationRoute` y confirma que cada una sigue devolviendo la misma ruta que
      antes de este ciclo, salvo las tres nuevas.
- [ ] Las tres claves de notificación siguen existiendo, traducidas, en `es.ts` y `en.ts` (**CA-007
      de la spec**, ya cumplido desde `cycle-01` — este ciclo sólo verifica que el enlace nuevo no las
      rompió).

---

### US-2-011: Usar la vista con teclado y sin depender del color para distinguir estados

**Como** trader que navega con teclado o que no puede distinguir estados solo por color
**Quiero** poder filtrar, paginar y leer cada fila sin mouse y sin depender únicamente del color del
badge de estado
**Para** usar la vista de entradas con la misma accesibilidad que el resto del dashboard

**Criterios de aceptación:**

- [ ] Cada pastilla de filtro de estado y de bot es alcanzable por `Tab`, expone `aria-pressed` (o el
      atributo equivalente del componente de `libs/ui` usado) y es activable con `Enter`/`Space`.
- [ ] La acción de "cargar más" (US-2-006) es un elemento enfocable y activable por teclado, no un
      `div` con `onClick`.
- [ ] Cada badge de estado lleva siempre un texto (`t()`), nunca solo un color o un ícono sin texto
      accesible — verificado con el mismo fixture de los seis estados de US-2-002.
- [ ] Con `prefers-reduced-motion: reduce`, la actualización en tiempo real de una fila (US-2-008) no
      introduce una animación de transición que ignore esa preferencia (heredado de la constitución de
      `apps/web` §4, sin excepción para esta vista).

---

### US-2-012: La vista tiene tests de propiedad sobre fixtures del wire real

**Como** responsable de cerrar el ciclo
**Quiero** que cada regla de este documento (estados, motivos de cancelación, filtros, paginado,
tiempo real, degradación de valores desconocidos) esté cubierta por un test que corre sobre un
fixture del wire real de EP-017, y que la suite E2E lo ejercite headless
**Para** tener evidencia, no solo una descripción, de que la vista se comporta como dice este
documento antes de cerrar la spec completa (dos ciclos)

**Criterios de aceptación:**

- [ ] Existe al menos un fixture Vitest construido a partir del tipo del wire de EP-017 importado de
      `@crypto-trader/shared` (no un objeto literal sin tipo) que cubre los cinco estados del union,
      un estado desconocido, y los ocho valores de `cancelReason` más `null`.
- [ ] Un test de propiedad, parametrizado por los seis eventos de WebSocket de la tabla de US-2-008,
      confirma que cada uno invalida/actualiza la consulta de entradas — no un test hardcodeado
      evento por evento sin relación con la lista de eventos real del servicio backend.
- [ ] El test de US-2-010 sobre `getNotificationRoute` recorre todas las claves conocidas (viejas y
      las tres nuevas) desde una única fuente de datos del test, no una lista de asserts sueltos.
- [ ] La suite E2E agrega al menos un spec headless que abre la vista de entradas, aplica un filtro,
      pide la página siguiente y confirma en el DOM el resultado esperado — corre en CI sin
      `PLAYWRIGHT_HEADED_DEBUG` y sin depender de una clave externa (**CA-008 de la spec**).
- [ ] Ningún test de este ciclo abre un navegador visible en la máquina del desarrollador.

---

## Reglas de negocio

**Estado y verdad del wire**

1. El estado de una entrada (`status`, `cancelReason`, `filledLeg`, y cualquier otro campo derivado
   del ciclo de vida) siempre viene del backend — de la respuesta de EP-017 o del payload de un evento
   `entry-order:*` — nunca se infiere, calcula ni corrige en el cliente comparando otros campos (por
   ejemplo, `expiresAt` contra la hora del cliente) contra el estado mostrado (US-2-002).
2. Un valor de `status` fuera del union documentado (`RESTING | FILLED | CANCELLED | EXPIRED |
   MISSING`) degrada esa fila a un estado neutro ("desconocido"), sin romper el render de las demás
   filas ni de la pantalla (heredado de la constitución de `apps/web` §4).
3. Un valor de `cancelReason` fuera de los ocho documentados, o inesperado para el `status` de esa
   fila, degrada a una leyenda neutra genérica, nunca a un error de render.
4. `status = FILLED` y `cancelReason = PARTIAL_FILL_REMAINDER` no son mutuamente excluyentes: una fila
   puede y debe mostrar ambas piezas de información a la vez (US-2-003, US-2-004).

**Tipos y superficie**

5. El tipo del wire de EP-017 (`items`, `nextCursor`, y cada campo de una entrada) se importa desde
   `@crypto-trader/shared`; ningún componente de esta vista redeclara localmente el shape del response
   (heredado de US-1-001, mismo principio que evitó el desalineamiento del wire de configuración).
6. Todo texto visible — labels de columna, badges de estado, leyendas de `cancelReason`, textos de
   filtro, estado vacío/error — pasa por `t()` con la convención `seccion.componente.elemento`;
   ninguna clave nueva existe en un locale sin su par en el otro.
7. El catálogo de `libs/ui` (`data-table`, `filter-pills`, `pagination`, `tabs`, `badge`,
   `key-value-row`, `info-card`, `tooltip`/`info-tooltip`) se revisa y reutiliza antes de escribir
   cualquier primitiva nueva; una primitiva nueva sólo se crea si ninguna composición de las
   existentes cumple el requisito, siguiendo la regla 3 de `frontend-component-rules`.
8. Ningún archivo de página define un subcomponente inline: la tabla, los filtros, el paginado y las
   celdas condicionales por estado son componentes propios de
   `apps/web/src/components/positions/` (o la subcarpeta que el architect defina), importados por la
   página (regla 5 de `frontend-component-rules`).

**Filtros y paginado**

9. El filtro por estado y el filtro por bot son independientes y combinables; cambiar cualquiera de
   los dos reinicia el cursor de paginación (US-2-005).
10. El paginado de esta vista es exclusivamente por cursor (`cursor`/`nextCursor` de EP-017): la vista
    nunca muestra ni calcula un número de página o un total, porque el wire no lo expone (US-2-006).

**Tiempo real**

11. Los seis eventos `entry-order:*` (`placed`, `filled`, `skipped`, `missing`, `expired`,
    `cancelled`) disparan una actualización de la consulta de entradas en `use-websocket.ts`; el
    evento `entry-order:skipped` no corresponde a ninguna fila persistida y por lo tanto nunca produce
    una fila nueva ni la modificación de una existente (US-2-008).
12. Ninguna actualización en tiempo real de esta vista recarga la página completa: siempre es
    invalidación/refetch de la consulta de TanStack Query correspondiente.

**Detalle del agente**

13. El detalle de un agente muestra únicamente su entrada (o entradas) en estado `RESTING` vigente;
    el historial completo de esa entrada (si venció, se llenó o se canceló) vive sólo en la vista
    general de entradas, no se duplica en el detalle (US-2-009).

**Notificaciones**

14. Las notificaciones `entryOrderPlaced`, `entryOrderFilled` y `entryOrderMissing` enlazan a la vista
    de entradas de este ciclo (no a Historial ni a Configuración, que es donde enlazan hoy por
    default de tipo); ningún enlace de notificación existente antes de este ciclo cambia de destino
    (US-2-010).

**Convenciones heredadas del repo**

15. El criterio de done de esta vista es un test de comportamiento en verde sobre un fixture del wire
    real de EP-017, no sólo que `tsc` no marque error (constitución `apps/web` §4).
16. Ninguna animación introducida por esta vista (transición de estado en tiempo real, apertura de
    filtros) ignora `prefers-reduced-motion` ni supera 300ms.
17. Ningún test de este ciclo abre un navegador visible en la máquina del desarrollador: Vitest y
    Playwright corren siempre headless.
18. El código de este ciclo no lleva comentarios narrativos (regla del dual-harness, no negociable).
19. Esta spec no cambia ni un endpoint, DTO ni evento del backend: si algún campo del response de
    EP-017 resulta ininteligible para la UI, se registra como fix, no se cambia acá (no-objetivo de
    la spec, sección 4).

---

## Preguntas abiertas para el architect

- **D1 (brief) — Dónde vive la vista.** **Recomendación de este documento: una tercera pestaña
  "Entradas" dentro de `positions.tsx`**, junto a las pestañas existentes `Open`/`Closed`
  (`apps/web/src/pages/dashboard/positions.tsx`, que ya usa el composite `Tabs` de `libs/ui`), en vez
  de una página propia bajo otra ruta del sidebar. Razones:
  1. **Comparte el modelo mental de exposición** que ya menciona el brief: una entrada descansando es
     capital comprometido que todavía no es una posición, pero que el trader piensa en el mismo lugar
     donde revisa qué tiene abierto y qué cerró — no en una sección aparte que tendría que aprender a
     buscar.
  2. **Reutiliza infraestructura ya resuelta en esa página**: el filtro por modo de operación global
     (`platformMode`) que ya aplica `positions.tsx` sobre `usePositions` aplica igual de bien sobre
     entradas (una entrada tiene `mode` en su wire), y la página ya importa `Tabs` de `libs/ui`.
  3. **No agrega una entrada nueva al sidebar** para un recurso que, a diferencia de una posición, no
     tiene P&L ni acciones de cierre — es información de acompañamiento, no una sección de primer
     nivel del producto (mismo argumento de "recurso propio, no de primer nivel" que ya usó
     `spec-e-burgos-005 cycle-02` para no embeber EP-017 en EP-008).
  El architect puede apartarse de esta recomendación si encuentra una razón técnica de peso (por
  ejemplo, que la pestaña adicional complique el `useGSAP`/stagger existente de la página o el
  paginado por número de página que ya usa `Open`/`Closed` de forma incompatible con el cursor de
  entradas — ver la pregunta siguiente), pero debe documentar la alternativa y por qué.
  **Nota de compatibilidad detectada:** `positions.tsx` pagina `Open`/`Closed` con el composite
  `Pagination` de `libs/ui` (`currentPage`/`totalPages`, sin cursor) porque `EP-008` sí expone
  `total`. La pestaña "Entradas" **no puede reusar ese mismo mecanismo** porque `EP-017` no expone
  `total` (US-2-006, RN-10): el architect debe decidir si la pestaña de entradas convive con una UI de
  paginado distinta a la de sus hermanas (ej. "cargar más") o si se busca otro composite.

- **D2 (brief) — Granularidad de la invalidación en tiempo real.** Este documento no fija si cada uno
  de los seis eventos `entry-order:*` invalida toda la lista de entradas (simple, y el volumen real
  por bot es bajo) o si actualiza sólo la fila de su `entryOrderId` (más preciso, evita un parpadeo de
  toda la tabla). Un dato para la decisión: `entry-order:skipped` **nunca** trae un `entryOrderId` que
  identifique una fila existente (el backend no llegó a persistir nada, ver US-2-008) — cualquier
  estrategia de "actualizar sólo la fila" necesita, como mínimo, un caso especial de invalidación
  completa (o ningún efecto) para ese evento puntual. El architect fija el mecanismo final; los
  criterios de este documento son válidos con cualquiera de las dos estrategias.

- **D3 (brief) — Enlace exacto desde la notificación.** Este documento fija que las tres
  notificaciones deben enlazar a la vista de entradas en vez de a Historial/Configuración
  (US-2-010, RN-14) y confirma contra el código que `getNotificationRoute` en
  `notification-utils.ts` hoy no las reconoce. No fija la ruta exacta, ni si el query param es
  `configId`, `entryOrderId`, ambos, o un estado de navegación en memoria, ni si la pestaña "Entradas"
  (si D1 se resuelve así) se auto-selecciona al llegar por notificación. El architect debe fijar el
  contrato exacto y confirmar que no rompe ningún enlace de notificación existente (criterio de
  US-2-010).

- **Fuente de la lista de bots para el filtro y para resolver la columna "Bot".** US-2-001 y
  US-2-005 asumen que la vista tiene acceso a la lista de bots del trader para traducir un `configId`
  en un nombre legible y para poblar el filtro por bot. `apps/web/src/hooks/use-trading.ts` ya expone
  `useTradingConfigs()` con esa lista; el architect debe confirmar que esta vista la reutiliza tal
  cual (sin una consulta nueva) y fijar qué se muestra si un `configId` del wire de entradas no
  aparece en esa lista (bot eliminado, u otra causa) — este documento sólo exige que nunca sea una
  fila vacía (US-2-001).

- **Mecanismo del "cargar más" y comportamiento ante datos duplicados.** US-2-006 exige que pedir la
  página siguiente nunca duplique un `id` ya visible, pero no fija si el resultado se acumula (lista
  que crece) o reemplaza (ventana fija que avanza) — cualquiera de los dos es válido para los
  criterios de este documento; el architect elige uno y lo documenta, porque cambia el fixture exacto
  del test de propiedad correspondiente.

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Entrada descansando | Orden de entrada (`LIMIT_MAKER` u `OCO`, `entryOrderMode ≠ MARKET`) que el bot dejó colocada en el exchange en vez de comprar a mercado; existe como fila en esta vista desde que se coloca hasta que llega a un estado terminal. |
| `RESTING` | Estado de una entrada que sigue viva en el exchange, esperando llenarse o vencer; es el único estado no terminal del union. |
| Fill / llenarse | El exchange ejecutó la entrada (total o parcialmente): pasa a `status = FILLED` y abre una posición. |
| Pierna (`filledLeg`) | Cuál de las dos órdenes de un OCO se ejecutó: `LIMIT` (la de soporte) o `STOP` (la de ruptura); no aplica a una entrada `LIMIT_MAKER` suelta, que sólo tiene una pierna. |
| OCO | Par de órdenes contingentes de entrada: al llenarse una, Binance cancela la otra. En este dominio, combina una pierna `LIMIT_MAKER` (soporte) con una de ruptura (`stopPrice`/`stopLimitPrice`, opcionalmente con `trailingDeltaBips`). |
| `LIMIT_MAKER` | Tipo de orden límite que Binance rechaza si ejecutaría como taker; usado como entrada suelta o como pierna de soporte de un OCO de entrada. |
| TTL | `entryOrderTtlMinutes`: minutos desde que se coloca la entrada hasta que vence (`status = EXPIRED`) si nadie la llenó ni se canceló antes por otro motivo. |
| Notional comprometido | `plannedNotionalUsd`: el capital en USD que la entrada reserva en el exchange mientras está `RESTING`, calculado por el backend al colocarla — la UI nunca lo recalcula. |
| `cancelReason` | Motivo por el que una entrada dejó de estar `RESTING` sin llenarse del todo (o con remanente); ocho valores posibles, documentados en US-2-003. |
| Cursor | Identificador (`id` del último elemento de la página anterior) que EP-017 usa para paginar hacia atrás en el tiempo (`placedAt desc`); reemplaza al número de página porque el recurso no expone un total. |
