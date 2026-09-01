# Planner — Cycle 2: Reacción empujada al exchange (entradas descansando)

> **Input:** `sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-02/brief.yaml` +
> `functional.md`
> **Output:** este archivo y `tasks.json`
> **Generado por:** sdd-planner

> ⚠️ El sdd-architect escribe `architect.md` en paralelo con este documento y yo no lo veo. Toda
> vez que una task depende de un nombre que el architect decide (tipo compartido, método del
> port, tabla, columna, endpoint), esta descripción dice **"el nombre que fije architect.md
> §X"** en lugar de inventarlo. El orquestador reconcilia planner.md/tasks.json contra la versión
> final de architect.md antes de habilitar al implementador.

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 2 |
| Módulo | reactive-execution-loop |
| Fase | exchange-resting-entries |
| Tasks (filas en `tasks.json`) | 26 |
| Horas de trabajo estimadas | **108h** |
| Story points estimados | **138** |
| Duración estimada (serial) | ~2.7 semanas (108h a 8h/día hábil) |
| Duración estimada (explotando los carriles paralelos) | ~2 semanas |
| HUs cubiertas | US-2-001 .. US-2-018 (18/18) |

**Interruptor de todo el ciclo:** `entryOrderMode` nace en `MARKET`. Ninguna task de este plan
coloca una orden en modo `LIVE`; toda verificación contra un exchange real corre exclusivamente en
TESTNET (TASK-024).

---

## Orden de las capas (regla no negociable, heredada del brief)

1. **`libs/shared`** primero — el vocabulario de tipos de entrada no depende de nada y todo lo
   demás lo importa.
2. **`libs/data-fetcher`** (cliente `BinanceRestClient` + tests contra mock de transporte) antes
   que **`libs/trading-engine`** consuma esos métodos desde `LiveOrderExecutor`.
3. **`libs/trading-engine`** (port + `SandboxOrderExecutor` + `LiveOrderExecutor` + resolver puro
   de nivel de entrada) antes que **`apps/api`** orqueste con él.
4. **`apps/api` — datos** (`schema.prisma`, migración, DTOs) puede avanzar **en paralelo** con las
   capas 2 y 3: solo depende del vocabulario de `libs/shared` (capa 1), no de los executors.
5. **`apps/api` — comportamiento** (`EntryOrderService`, camino de BUY del processor,
   `ReconciliationService` extendido, `bot_actions`, concurrencia, WS/notificaciones, endpoint,
   wiring) solo empieza cuando el cliente (capa 2) y el port completo (capa 3) tienen tests en
   verde — **ninguna task de esta capa que coloque, consulte o cancele una orden real puede
   empezar antes**.
6. **Harness TESTNET** solo necesita el cliente (capa 2) en verde — corre **en paralelo** con las
   capas 3, 4 y 5, no al final de todas ellas.
7. **Cierre** — fragmentos de contexto aditivo y, solo si hubo lección real, entrada de journal.

---

## Tasks

### Capa 1 — `libs/shared`

#### TASK-001: Vocabulario de tipos de entrada + filtro `TRAILING_DELTA` en `libs/shared`

**Historias:** US-2-002, US-2-003, US-2-004, US-2-006, US-2-007
**App:** libs/shared
**Descripción:** Declarar en `libs/shared/src/types/interfaces.ts` (o el archivo que corresponda
del barrel) el vocabulario de entrada que resuelve D5: request de colocación de una entrada
(`LIMIT_MAKER` u `OCO_ENTRY`, discriminante de modo — nombre exacto de architect.md §D5), la
referencia devuelta (orderId suelto vs. orderListId + dos orderId de un OCO), el resultado con
precio/cantidad ejecutados de la pierna que llenó, y los cinco estados de `entry_orders`
(`RESTING`/`FILLED`/`CANCELLED`/`EXPIRED`/`MISSING`, RN-9). Agregar también el tipo/():shape del
filtro `TRAILING_DELTA` (min/maxTrailingAboveDelta) que `libs/data-fetcher` y la validación local
van a consumir. Todo exportado por el barrel existente (`export * from './interfaces'` /
`'./enums'`) — sin romper ningún import actual.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] Los tipos nuevos compilan y quedan exportados desde `@crypto-trader/shared` (verificar con
      un import de smoke desde `libs/data-fetcher` y desde `libs/trading-engine`).
- [ ] Ningún tipo existente (`ExchangeOrderState`, `ExchangeOrderStatus`, `OrderResult`) cambia de
      shape — solo se agregan tipos nuevos.
- [ ] `nx run shared:build` (o el target de typecheck del subproyecto) pasa en verde.

---

### Capa 2 — `libs/data-fetcher` (mismo archivo `binance-rest.client.ts` — carril serial)

#### TASK-002: `getSymbolFilters` lee el filtro `TRAILING_DELTA`

**Historias:** US-2-004, US-2-006
**App:** libs/data-fetcher
**Descripción:** Extender la caché de `getSymbolFilters` (`binance-rest.client.ts:332`) para
también cachear el filtro `TRAILING_DELTA` (`minTrailingAboveDelta`/`maxTrailingAboveDelta`) junto
a `LOT_SIZE`/`PRICE_FILTER`/`NOTIONAL`, usando el shape de TASK-001. `SymbolFilters` (línea 102)
gana el campo nuevo sin romper el uso actual en `placeMarketOrder`/`placeLimitOrder`/
`placeStopLossLimitOrder`/`placeOcoSellOrder`.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `binance-rest.client.spec.ts`: un símbolo con filtro `TRAILING_DELTA` en la respuesta mockeada
      de `exchangeInfo` cachea `minTrailingAboveDelta`/`maxTrailingAboveDelta` correctamente.
- [ ] Un símbolo sin ese filtro (mock sin la entrada) no rompe `getSymbolFilters` — el campo queda
      `null`/ausente según lo que fije architect.md.
- [ ] Los cuatro `place*` existentes siguen pasando sin cambios de comportamiento (regresión).

---

#### TASK-003: Validación local de filtros para órdenes de entrada (LOT_SIZE/PRICE_FILTER/NOTIONAL/TRAILING_DELTA)

**Historias:** US-2-004, US-2-006
**App:** libs/data-fetcher
**Descripción:** Escribir la validación local reutilizable (RN-6) que van a compartir
`placeLimitMakerBuy` y `placeOcoBuyOrder` (TASK-004/005): precio y cantidad contra `LOT_SIZE`/
`PRICE_FILTER`/`NOTIONAL`, y `trailingDelta` contra el rango `[minTrailingAboveDelta,
maxTrailingAboveDelta]` del filtro cacheado en TASK-002. Cada violación produce un código de
rechazo propio que identifica cuál filtro bloqueó (US-2-006 AC1) — **sin invocar el transporte
firmado**. Ubicar la función donde ya vive la validación análoga de `placeOcoSellOrder`, o en un
archivo propio si architect.md lo separa.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] Test por cada filtro: precio que viola `PRICE_FILTER`, cantidad que viola `LOT_SIZE`, notional
      que viola `NOTIONAL`, `trailingDelta` fuera de rango — los cuatro rechazan con un código
      distinguible y **cero invocaciones** al mock de transporte (`toHaveBeenCalledTimes(0)`).
- [ ] Un payload que pasa los cuatro filtros no rechaza (caso feliz cubierto para la siguiente task).

---

#### TASK-004: `placeLimitMakerBuy` — entrada suelta en el soporte

**Historias:** US-2-002, US-2-006
**App:** libs/data-fetcher
**Descripción:** Nuevo método en `BinanceRestClient` (nombre exacto de architect.md §D5, ej.
`placeLimitMakerBuy`) que llama `POST /api/v3/order` con `side: BUY`, `type: LIMIT_MAKER`, corre la
validación de TASK-003 antes de firmar, y agrega su entrada real en `ENDPOINT_WEIGHTS`
(`binance-rest.client.ts:22-37`) junto a la de `POST /api/v3/order` ya existente (peso 1).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-003
**Criterio de done:**

- [ ] `binance-rest.client.spec.ts`: el payload firmado contiene exactamente symbol, side `BUY`,
      type `LIMIT_MAKER`, price y quantity — sin ningún campo de tipo `STOP` (US-2-002 AC3).
- [ ] Cuando todos los filtros pasan, el mock de transporte se invoca **exactamente una vez**
      (US-2-006 AC3).
- [ ] Un rechazo local (TASK-003) no invoca el mock ni una sola vez (regresión del test anterior
      aplicada a este método concreto).

---

#### TASK-005: `placeOcoBuyOrder` — OCO de entrada con `trailingDelta` opcional

**Historias:** US-2-003, US-2-004, US-2-006
**App:** libs/data-fetcher
**Descripción:** Nuevo método (nombre de architect.md §D5, ej. `placeOcoBuyOrder`) que llama
`POST /api/v3/orderList/oco` con **`side: 'BUY'` explícito** (a diferencia de `placeOcoSellOrder`,
que lo hardcodea a `SELL`), `belowType: LIMIT_MAKER` + `belowPrice`, `aboveType:
STOP_LOSS_LIMIT` + `aboveStopPrice`/`abovePrice`/`aboveTimeInForce`, y `trailingDelta` en la pierna
`above` solo si viene configurado (> 0). Corre la validación de TASK-003 (incluyendo
`TRAILING_DELTA` cuando aplica) antes de firmar. Agrega peso real en `ENDPOINT_WEIGHTS` (mismo peso
1 que el OCO de venta existente).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-003
**Criterio de done:**

- [ ] El payload firmado tiene `side: 'BUY'` explícito, `belowPrice`, `aboveStopPrice`,
      `abovePrice`, `aboveTimeInForce` (US-2-003 AC3).
- [ ] Con `trailingDelta` > 0 configurado, el payload de la pierna `above` incluye `trailingDelta`
      con el valor exacto (US-2-004 AC1); sin configurar (ausente o 0), el payload NO incluye el
      campo (US-2-004 AC2).
- [ ] `trailingDelta` nunca aparece en ningún campo asociado a la pierna `LIMIT_MAKER`/`below`
      (US-2-004 AC3).
- [ ] Cuando todos los filtros pasan, el mock se invoca exactamente una vez para la colocación de
      un OCO de entrada (US-2-006 AC3); un rechazo local (cualquiera de los 4 filtros) no lo invoca
      ni una vez.

---

#### TASK-006: Consulta y cancelación de entradas — reúso de `getOrderStatus`/`getOcoStatus`/`cancelOrder`/`cancelOcoOrderList`

**Historias:** US-2-003, US-2-007
**App:** libs/data-fetcher
**Descripción:** `getOrderStatus` (línea 735), `getOcoStatus` (línea 755), `cancelOrder` (línea
804) y `cancelOcoOrderList` (línea 811) ya existen y son agnósticos de lado (se usan hoy para la
protección de venta). Para una entrada `LIMIT_MAKER` suelta se reúsan tal cual. Para el OCO de
entrada, `getOcoStatus` hoy resuelve `filledLeg: 'STOP' | 'TAKE_PROFIT' | null` — vocabulario de la
protección de **venta**, que no describe las piernas `LIMIT_MAKER`/`STOP_LOSS_LIMIT` de una
**entrada**. Extender el shape (nombre y valores exactos de architect.md §D5) para que el estado
de una entrada exponga cuál de sus dos piernas llenó, con el precio y la cantidad ejecutados de
esa pierna — sin romper el `filledLeg` que ya usa la reconciliación de protección de venta.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-004, TASK-005
**Criterio de done:**

- [ ] Test: una entrada `LIMIT_MAKER` suelta consultada por `getOrderStatus` expone `FILLED` con
      precio y cantidad ejecutados.
- [ ] Test: un OCO de entrada donde llenó la pierna `below` expone eso explícitamente (no asume
      cuál llenó — lee la respuesta real de Binance, US-2-003 AC5); un test simétrico para la
      pierna `above`.
- [ ] El `filledLeg` existente de la protección de venta (`STOP`/`TAKE_PROFIT`) sigue pasando sin
      cambios — regresión de `reconciliation.service.spec.ts` en verde.
- [ ] `cancelOrder`/`cancelOcoOrderList` aplicados a una entrada (suelta u OCO) cancelan la orden
      correcta — test con el orderId/orderListId de una entrada, no de una protección.

---

### Capa 3 — `libs/trading-engine`

#### TASK-007: Resolver puro del nivel de entrada (`supportResistance` + fallback)

**Historias:** US-2-002, US-2-003
**App:** libs/trading-engine
**Descripción:** Función pura (nombre de architect.md, ej. `resolveEntryOrderLevels`) que recibe
`IndicatorSnapshot.supportResistance`, el precio de referencia del ciclo y `orderPriceOffsetPct`, y
devuelve: el precio `LIMIT_MAKER` (soporte más cercano por debajo del precio de referencia, o el
fallback `referencia × (1 − orderPriceOffsetPct)` si no hay soporte utilizable — RN-3) y el
`aboveStopPrice` de la pierna de ruptura (resistencia más cercana por encima, o el mismo fallback
en sentido inverso — RN-4). Vive en `libs/trading-engine` (nunca importa `libs/data-fetcher`, RN-25).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] Test: con al menos un soporte por debajo del precio de referencia, devuelve el más cercano
      (US-2-002 AC1); con lista vacía o todos por encima, devuelve el fallback (US-2-002 AC2).
- [ ] Test simétrico para la resistencia de la pierna de ruptura (US-2-003 AC2), incluyendo el caso
      sin resistencia utilizable.
- [ ] La función es pura (mismo input → mismo output, sin I/O) — verificado por el propio test, sin
      mocks de red ni de Prisma.

---

#### TASK-008: `OrderExecutorPort` extendido + `SandboxOrderExecutor` (contrato en memoria)

**Historias:** US-2-002, US-2-003, US-2-004, US-2-005, US-2-006, US-2-007
**App:** libs/trading-engine
**Descripción:** Agregar a `OrderExecutorPort` (`order-executor.ts:43-73`) los métodos de entrada
que cierra D5 (nombres exactos de architect.md — ej. `placeEntryOrder(req)` con discriminante de
modo, `getEntryOrderStatus`, `cancelEntryOrder`), usando el vocabulario de TASK-001. Implementar el
lado `SandboxOrderExecutor` (línea 86) como contrato en memoria: coloca, mantiene el estado
`RESTING` internamente, y expone un método de test para simular un fill/cancelación manual — sin
tocar la lógica real de negocio de SANDBOX del processor (RN-22, esa lógica sigue ignorando
`entryOrderMode` y nunca llama a este contrato en producción).
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-001, TASK-007
**Criterio de done:**

- [ ] `order-executor.spec.ts`: `SandboxOrderExecutor` coloca una entrada `LIMIT_MAKER` y una OCO,
      las consulta (`RESTING`), simula un fill vía el método de test y las vuelve a consultar
      (`FILLED` con precio/cantidad), y las cancela (`CANCELLED`) — sin red.
- [ ] La interfaz `OrderExecutorPort` sigue teniendo los 9 métodos existentes intactos (regresión
      de firma) más los nuevos de entrada.

---

#### TASK-009: `LiveOrderExecutor` — delegación estructural a las órdenes de entrada

**Historias:** US-2-002, US-2-003, US-2-004, US-2-006, US-2-007
**App:** libs/trading-engine
**Descripción:** Implementar en `LiveOrderExecutor` (`order-executor.ts:326`) los tres métodos
nuevos delegando en `placeLimitMakerBuy`/`placeOcoBuyOrder`/`getOrderStatus`/`getOcoStatus`/
`cancelOrder`/`cancelOcoOrderList` de TASK-004/005/006, manteniendo el tipado **estructural**
inline de la dependencia (`order-executor.ts:327-370`) — nunca un `import` de
`BinanceRestClient` ni de `@crypto-trader/data-fetcher` (RN-25, `libs/trading-engine` no depende de
`libs/data-fetcher`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-006, TASK-008
**Criterio de done:**

- [ ] Test: un objeto que satisface la interfaz estructural (no una instancia real de
      `BinanceRestClient`) alcanza para instanciar `LiveOrderExecutor` y ejercer los tres métodos
      nuevos — confirma que sigue siendo estructural.
- [ ] `nx run trading-engine:lint` (o el chequeo equivalente de dependencias) confirma que
      `trading-engine` no importa `data-fetcher` en ningún archivo.
- [ ] **Checkpoint de capa:** con TASK-002..009 en verde, ninguna task de `apps/api` que coloque,
      consulte o cancele una orden real puede empezar todavía — recién ahora puede.

---

### Capa 4 — `apps/api` — datos (en paralelo con las capas 2 y 3, desde que TASK-001 cierra)

#### TASK-010: `schema.prisma` — tabla `entry_orders`, columnas de `TradingConfig`, `EXCHANGE_TRIGGER`

**Historias:** US-2-001, US-2-007
**App:** apps/api
**Descripción:** Modelo nuevo (nombre de architect.md §D7, ej. `EntryOrder` → `@@map("entry_orders")`)
con los cinco estados de RN-9, prefijo de `clientOrderId` propio (RN-13), FK a `config` y a `user`
sin FK a `decision` (RN-21, mismo criterio que `BotAction`), e índices por `configId` + estado y
por `placedAt` (para el barrido de TTL de TASK-016). Agregar a `TradingConfig`: `entryOrderMode`
(default `MARKET`), TTL de entrada y `trailingDelta` opcional (defaults y rangos de architect.md —
pregunta abierta del funcional). Agregar `EXCHANGE_TRIGGER` a `BotActionSource`. Migración(es)
propia(s) y getter en `PrismaService` (patrón ya usado por los 20+ getters existentes,
`prisma.service.ts:19-76`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `pnpm nx run api:prisma-generate` (o el target equivalente) genera el cliente sin error;
      `prisma migrate dev` (o `diff`) no reporta drift tras aplicar la migración.
- [ ] Todo `TradingConfig` existente sin `entryOrderMode` explícito lee `MARKET` tras la migración
      (US-2-001 AC1) — test de migración o de default de Prisma.
- [ ] `entry_orders` solo permite los cinco valores de estado del enum — un sexto valor falla en
      tiempo de compilación/validación.
- [ ] `EXCHANGE_TRIGGER` es un valor válido de `BotActionSource` sin romper los dos valores
      existentes (`FAST_PATH`, `LLM_CYCLE`).

---

#### TASK-011: DTOs — `entryOrderMode`, TTL y `trailingDelta` en Create/Update

**Historias:** US-2-001
**App:** apps/api
**Descripción:** Declarar los tres campos nuevos como opcionales en `CreateTradingConfigDto` y
`UpdateTradingConfigDto` (`trading-config.dto.ts`), con los mismos decoradores `class-validator`
que ya usa el archivo (`@IsEnum`, `@IsInt`+`@Min`/`@Max`, `@IsOptional`) y los rangos/defaults que
fije architect.md. Es el mismo patrón que ya siguieron `reactiveLoopEnabled`/`maxActionsPerHour`/
`minActionIntervalSec` en cycle-01 — un campo que falta en uno de los dos DTOs responde 400 por
`forbidNonWhitelisted` (harness_rules).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] Test de DTO: omitir los tres campos no cambia ningún comportamiento observable (US-2-001
      AC4) — valida y no setea overrides.
- [ ] Test de DTO: los tres campos están declarados en **ambos** DTOs — un test que falle si se
      agrega uno sin el otro (mismo patrón de regresión que cycle-01).
- [ ] Un valor de `trailingDelta`/TTL fuera del rango declarado rechaza con 400 antes de llegar al
      service.

---

### Capa 5 — `apps/api` — comportamiento (requiere capas 2/3 completas)

#### TASK-012: `EntryOrderService` — colocación y persistencia

**Historias:** US-2-002, US-2-003, US-2-004, US-2-006
**App:** apps/api
**Descripción:** Servicio nuevo (nombre de architect.md, ej. `EntryOrderService`) que, dado un
`entryOrderMode` distinto de `MARKET`, resuelve el nivel con `resolveEntryOrderLevels` (TASK-007),
valida vía el port (la validación local de TASK-003 ya vive en el cliente, invocada por
`placeEntryOrder`), coloca a través de `OrderExecutorPort` (TASK-008/009) y persiste una fila
`entry_orders` en `RESTING` con el `clientOrderId` de prefijo propio y el `orderId`/`orderListId`
devuelto. No decide todavía **cuándo** se llama (eso es TASK-013) — es la pieza que sabe **cómo**
colocar y persistir una entrada.
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-007, TASK-009, TASK-010, TASK-011
**Criterio de done:**

- [ ] Test: colocar un `LIMIT_MAKER` persiste una fila `RESTING` con el `orderId` del mock y el
      prefijo propio (nunca `prot-`, US-2-002 AC4).
- [ ] Test: colocar un OCO persiste **una única** fila con `orderListId` y los dos `orderId` de
      ambas piernas (US-2-003 AC4).
- [ ] Toda fila nace en `RESTING` — ninguna test crea una fila en otro estado inicial (US-2-007 AC1).

---

#### TASK-013: Camino de BUY del processor — entrada descansando vía `authorizeAndRun`

**Historias:** US-2-001, US-2-005, US-2-017
**App:** apps/api
**Descripción:** En `trading.processor.ts` (~línea 1027 en adelante, el bloque `LIVE`/`TESTNET`
antes de `placeMarketOrder`): si `entryOrderMode` del `config` es distinto de `MARKET`, llamar a
`EntryOrderService` (TASK-012) **dentro** de `actionGate.authorizeAndRun({kind: 'BUY', source:
'LLM_CYCLE', ...})` en lugar de `executor.placeMarketOrder` — mismo punto de control, mismos tres
caps heredados de cycle-01 (US-2-005 AC1-2). Si `entryOrderMode === MARKET` (default) o el modo es
`SANDBOX`, el camino existente no cambia una línea (US-2-001 AC2, US-2-017 AC1) y en `SANDBOX`
nunca se crea una fila en `entry_orders` bajo ninguna configuración (US-2-017 AC2).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-012
**Criterio de done:**

- [ ] Test: `entryOrderMode = LIMIT_MAKER`/`OCO` + modo `LIVE`/`TESTNET` invoca `EntryOrderService`
      dentro de `authorizeAndRun` — nunca fuera de él (US-2-005 AC3).
- [ ] Test: los tres caps heredados (acciones/hora, intervalo mínimo, pérdida diaria) bloquean o
      difieren la colocación de una entrada con el mismo `blockedBy`/`outcome` que bloquearían la
      compra a mercado equivalente (US-2-005 AC2).
- [ ] Test: `entryOrderMode` distinto de `MARKET` en modo `SANDBOX` compra a mercado exactamente
      igual que hoy y no crea fila en `entry_orders` (US-2-017, ambos AC).
- [ ] Test de regresión: con `entryOrderMode = MARKET`, no se invoca ningún método nuevo del port
      ni se crea ninguna fila en `entry_orders` (US-2-001 AC2) — base del CA-001 que TASK-023 cierra
      a nivel de todo el ciclo.

---

#### TASK-014: `bot_actions` — excluir `EXCHANGE_TRIGGER` del conteo de caps por hora

**Historias:** US-2-014
**App:** apps/api
**Descripción:** `getBotActionCounters` (`bot-action-counters.ts:16-35`) hoy cuenta toda fila con
`outcome: EXECUTED` en la ventana de una hora, sin filtrar por `source`. Una fila `EXCHANGE_TRIGGER`
(el fill de una entrada, escrita directamente por la reconciliación en TASK-015 sin pasar por
`authorizeAndRun`) también tendría `outcome: EXECUTED` y se sumaría al mismo conteo que ya usó la
colocación — doble conteo de la misma decisión (RN-20). Excluir explícitamente `source:
EXCHANGE_TRIGGER` de la query de agregación.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] Test: una fila `EXCHANGE_TRIGGER` `EXECUTED` en la ventana de la hora **no** incrementa
      `executedActionsInLastHour` (US-2-014 AC4).
- [ ] Test de regresión: el conteo de filas `FAST_PATH`/`LLM_CYCLE` `EXECUTED` no cambia (mismo
      comportamiento que cycle-01).

---

#### TASK-015: Reconciliación — fill de una entrada crea `Position` + `Trade` + protección

**Historias:** US-2-007, US-2-012, US-2-013, US-2-014
**App:** apps/api
**Descripción:** Extender `ReconciliationService.reconcile` (`reconciliation.service.ts:61`) para
recorrer las entradas `RESTING` del bot y consultar su estado vía `getEntryOrderStatus` (TASK-009).
Un fill confirmado, en una única operación reconciliada: crea `Position` (cantidad/precio de la
pierna que llenó), crea `Trade` con `decisionId: null` (mismo criterio que el camino existente para
lo que ejecutó el exchange — RN-15), coloca la protección inicial si `nativeProtectionEnabled` vía
`placeProtectionWithRetry` (ya importado en el archivo, línea 7) — si falla, mismo resultado que
hoy: `protectionStatus = UNPROTECTED`, notificación, evento `position:unprotected`, cierre solo si
`closeOnProtectionFailure` (RN-16, sin rama nueva). La fila `entry_orders` transiciona a `FILLED`
vinculada a la `Position`. Registra un `bot_action` con `source: EXCHANGE_TRIGGER` (RN-19), **sin**
pasar por `authorizeAndRun` — nunca dos filas `kind: BUY, source: LLM_CYCLE` para la misma entrada.
**Estimación:** 7h · **Story points:** 8
**Dependencias:** TASK-009, TASK-012, TASK-014
**Criterio de done:**

- [ ] Test: fill de un `LIMIT_MAKER` suelto y fill de cada pierna de un OCO de entrada producen
      el mismo resultado reconciliado (Position + Trade + protección) — US-2-012 AC1 y AC3.
- [ ] Test: `entry_orders` transiciona a `FILLED` y queda vinculada a la `Position` creada (US-2-012
      AC2).
- [ ] Test: `placeProtectionWithRetry` agotando reintentos deja `protectionStatus = UNPROTECTED` +
      notificación + evento WS, sin rama de código distinta del camino de compra a mercado (US-2-013
      AC1); cierre de la posición solo si `closeOnProtectionFailure = true` (US-2-013 AC2).
- [ ] Test: exactamente un registro `bot_actions` con `source: EXCHANGE_TRIGGER` por fill, y nunca
      un segundo `kind: BUY, source: LLM_CYCLE` para la misma entrada (US-2-014 AC2-3).

---

#### TASK-016: Reconciliación — vencimiento (TTL), `MISSING` y barrido de huérfanas propio

**Historias:** US-2-007, US-2-008
**App:** apps/api
**Descripción:** En la misma extensión de `ReconciliationService`: una entrada cuyo TTL (computado
desde `placedAt`, nunca desde la última consulta — RN-10) venció sin fill confirmado se cancela en
el exchange (`cancelEntryOrder`) y transiciona a `EXPIRED`; si en la **misma** consulta se detecta
un fill confirmado, el fill gana sobre el vencimiento (US-2-008 AC3). Una entrada que la consulta
no encuentra en el exchange y sin evidencia de fill ni de una cancelación propia transiciona a
`MISSING` — nunca se descarta la fila en silencio (RN-12). El barrido de huérfanas existente
(`sweepOrphanOrders`, línea 320) solo mira el prefijo `prot-`; agregar una rutina **separada**
que barre huérfanas con el prefijo propio de entradas (RN-13).
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-015
**Criterio de done:**

- [ ] Test: TTL vencido sin fill cancela en el exchange y transiciona a `EXPIRED` (US-2-008 AC1);
      el TTL se computa desde `placedAt` en un test que varía el momento de la consulta (US-2-008
      AC2).
- [ ] Test: fill confirmado + TTL vencido en la misma consulta transiciona a `FILLED`, no a
      `EXPIRED` (US-2-008 AC3).
- [ ] Test: orden no encontrada sin evidencia de fill/cancelación propia transiciona a `MISSING`
      (US-2-007 AC3) — la fila sigue existiendo y consultable, nunca se borra.
- [ ] Test: el barrido de huérfanas de entradas es una función/rutina distinta del barrido de
      `prot-`, y no toca huérfanas con prefijo `prot-` ni viceversa.

---

#### TASK-017: Cancelación de entradas — decisión posterior, cap diario `DISCARDED`, stop del bot

**Historias:** US-2-009, US-2-010, US-2-011
**App:** apps/api
**Descripción:** Tres disparadores de cancelación de una entrada `RESTING` (RN-11), cada uno antes
de que el sistema actúe sobre lo que la motiva: (a) una decisión posterior `HOLD`/`SELL` del mismo
`configId` + símbolo cancela la entrada vieja antes de actuar sobre la nueva decisión, y si la
nueva también es `BUY` con nivel distinto, la cancelación se confirma antes de colocar la nueva —
nunca coexisten dos `RESTING` (US-2-009, RN-14); (b) el cap de pérdida diaria `DISCARDED` cancela
**todas** las entradas `RESTING` del bot en el mismo ciclo, registrado en `bot_actions` con un
motivo distinguible de un bloqueo ordinario de colocación, exento de los tres caps de frecuencia
igual que una venta (US-2-010, RN-17); (c) detener el bot cancela sus entradas `RESTING` sin tocar
la protección nativa de posiciones ya abiertas (US-2-011).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-013, TASK-015
**Criterio de done:**

- [ ] Test: decisión posterior `HOLD` o `SELL` sobre el mismo símbolo cancela la `RESTING` antes de
      que el sistema actúe sobre la nueva decisión (US-2-009 AC1); una nueva decisión `BUY` con
      nivel distinto confirma la cancelación antes de colocar la nueva (US-2-009 AC2).
- [ ] Test: cap diario `DISCARDED` cancela todas las `RESTING` del bot en el mismo ciclo, con
      `bot_actions` distinguible de un bloqueo ordinario y **sin** consumir los tres caps de
      frecuencia (US-2-010, ambos AC).
- [ ] Test: detener el bot cancela sus `RESTING` y no toca `protectionStatus` de posiciones abiertas
      (US-2-011, ambos AC).

---

#### TASK-018: Concurrencia y notional planificado de una entrada `RESTING`

**Historias:** US-2-015
**App:** apps/api
**Descripción:** `maxConcurrentPositions`/`assertBuyAllowed` hoy cuentan solo posiciones abiertas.
Extender el conteo (en `trading.processor.ts`/`aggregate-risk.service.ts`, el archivo exacto que
fije architect.md) para que una entrada `RESTING` sume 1 a la concurrencia y su notional (cantidad
× precio de la orden, **una sola pierna** — RN-8, no la suma de las dos piernas del OCO, que son
mutuamente excluyentes) al notional planificado que ya usa el sizing. Deja de contar al pasar a un
estado terminal sin fill, y al pasar a `FILLED` cuenta como la `Position` creada en su lugar —
nunca las dos a la vez.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-012, TASK-015
**Criterio de done:**

- [ ] Test: N posiciones abiertas + M `RESTING` con N+M == `maxConcurrentPositions` bloquea una
      nueva `BUY` (a mercado o descansando) exactamente igual que N+M posiciones abiertas (US-2-015
      AC1).
- [ ] Test: el notional planificado de una entrada `RESTING` (una pierna) se incluye en el cálculo
      de exposición comprometida del sizing (US-2-015 AC2).
- [ ] Test: pasar a `CANCELLED`/`EXPIRED`/`MISSING` deja de contar desde ese momento (US-2-015 AC3);
      pasar a `FILLED` cuenta como la `Position` creada, nunca las dos a la vez (US-2-015 AC4).

---

#### TASK-019: Detección de fill fuera del ciclo del processor (D6)

**Historias:** US-2-012
**App:** apps/api
**Descripción:** El ciclo del processor reconcilia cada 15-30 min; una entrada llenada con el
servicio arriba queda sin protección durante esa ventana. Cablear un chequeo adicional (candidato
(a) de D6: en el riel reactivo, cuando el tick toca el precio de la entrada, solo con
`reactiveLoopEnabled`) que invoca **la misma** rutina de reconciliación de fill de TASK-015 —
sin duplicar su lógica. Documentar el peso del endpoint que este chequeo agrega (`GET
/api/v3/order` peso 4 o `GET /api/v3/orderList` peso 4, según el tipo de entrada) contra el
presupuesto de `ENDPOINT_WEIGHTS`.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-015
**Criterio de done:**

- [ ] Test: un tick que toca el precio de una entrada `RESTING` con `reactiveLoopEnabled = true`
      dispara la consulta de estado y, si confirma fill, reconcilia idéntico a TASK-015 (mismo
      resultado, sin rama nueva).
- [ ] Test: con `reactiveLoopEnabled = false`, este chequeo no corre — el fill sigue detectándose
      solo en el ciclo de reconciliación del processor (comportamiento sin cambios para bots sin el
      loop reactivo).
- [ ] El peso agregado por este chequeo queda anotado en el comentario/constante de
      `ENDPOINT_WEIGHTS` o en la constante de umbrales reactivos correspondiente.

---

#### TASK-020: Eventos WS y notificaciones por etapa de una entrada

**Historias:** US-2-016
**App:** apps/api
**Descripción:** Cuatro eventos distinguibles entre sí (RN-24): colocación exitosa (symbol, modo,
precio(s), id del `entry_order`), fill reconciliado (distinto del de colocación), vencimiento
(`EXPIRED`) y cancelación (`CANCELLED`, cualquiera sea su motivo de TASK-017) — cada uno con su
notificación y evento WS propio, siguiendo el patrón ya usado en `trading.processor.ts` (
`this.gateway.emitToUser` + `this.notificationsService.create`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-013, TASK-015, TASK-016, TASK-017
**Criterio de done:**

- [ ] Test: colocación exitosa emite notificación + evento WS con symbol/modo/precio(s)/id
      (US-2-016 AC1).
- [ ] Test: el fill emite un evento distinto del de colocación (US-2-016 AC2).
- [ ] Test: `EXPIRED` y cada motivo de `CANCELLED` emiten eventos observables propios, distinguibles
      entre sí y del evento de `MISSING` (US-2-016 AC3).

---

#### TASK-021: Endpoint de listado de `entry_orders`

**Historias:** US-2-007
**App:** apps/api
**Descripción:** Endpoint nuevo (EP y ruta que fije architect.md — paginado/filtros, mismo patrón
que `EP-016 GET /trading/actions` de cycle-01) que expone el ciclo de vida observable de las
entradas de un bot: estado, symbol, modo, precios, timestamps.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] Test de controller: lista las entradas de un `configId` con paginación/filtro por estado.
- [ ] Test: el DTO de respuesta expone los cinco estados posibles sin ambigüedad.

---

#### TASK-022: Module wiring — dueño explícito de los servicios nuevos

**Historias:** US-2-001
**App:** apps/api
**Descripción:** Registrar `EntryOrderService` (TASK-012) y el controller de TASK-021 en el módulo
que corresponda (`trading.module.ts` y/o `reactive.module.ts` — el dueño exacto lo fija
architect.md; deuda conocida de la cola duplicada entre ambos módulos, fuera de alcance de este
ciclo), y confirmar que `ReconciliationService` extendido sigue resolviendo desde donde ya se
inyecta hoy. Dueño explícito de cualquier registro en `app.module.ts` si aplica — nada queda huérfano.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-012, TASK-015, TASK-021
**Criterio de done:**

- [ ] Test de resolución por DI: `EntryOrderService` y el controller nuevo resuelven desde el
      módulo raíz (mismo patrón que `reactive-module-wiring.spec.ts` de cycle-01).
- [ ] Ningún servicio nuevo se instancia a mano fuera del contenedor de Nest.

---

#### TASK-023: Test de equivalencia CA-001 — `entryOrderMode = MARKET` es idéntico al comportamiento pre-ciclo

**Historias:** US-2-001
**App:** apps/api
**Descripción:** Sobre un escenario congelado (mismo patrón que el CA-001 de cycle-01), con
`entryOrderMode = MARKET` (default) verificar que la secuencia y cantidad de invocaciones al mock
de transporte es idéntica a la que producía el sistema antes de este ciclo (US-2-001 AC3): ningún
método nuevo del port se invoca, ninguna fila se crea en `entry_orders`, el flujo completo
(concurrencia, `bot_actions`, WS) queda exactamente igual que hoy.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-013, TASK-018, TASK-022
**Criterio de done:**

- [ ] Test: con `entryOrderMode = MARKET`, cero invocaciones a `placeEntryOrder`/
      `getEntryOrderStatus`/`cancelEntryOrder`, cero filas en `entry_orders`.
- [ ] Test: la secuencia de invocaciones al mock de transporte coincide 1:1 con la del camino de
      compra a mercado documentado antes de este ciclo (mismo assert que valida el reviewer al
      cerrar).

---

### Harness TESTNET (en paralelo con las capas 3, 4 y 5 — solo depende del cliente de la capa 2)

#### TASK-024: Harness Jest contra Binance TESTNET (D9)

**Historias:** US-2-018
**App:** libs/data-fetcher
**Descripción:** Spec de Jest gateado por variable de entorno (por defecto se salta, RN heredada de
`harness_rules`): lee **solo** `BINANCE_API_TESTNET_*`, construye el cliente con `testnet: true`,
**aborta antes de colocar ninguna orden** si la `baseURL` resuelta no es
`https://testnet.binance.vision`. Para cada tipo nuevo (`LIMIT_MAKER` suelto, OCO sin
`trailingDelta`, OCO con `trailingDelta`): coloca a un precio alejado del mercado corriente (para
que no se llene durante la corrida), consulta y confirma `RESTING`, cancela. Al final, una consulta
de `openOrders` sobre el símbolo usado confirma cero órdenes propias del harness. Tolera la
latencia medida contra TESTNET (~1s por request, exchangeInfo ~950ms, account ~300ms — verified_facts).
Documentar el comando exacto para que el reviewer lo corra al cerrar el ciclo.
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-004, TASK-005, TASK-006
**Criterio de done:**

- [ ] El spec se salta por defecto (variable ausente) — confirmado corriendo la suite completa sin
      la variable seteada y viendo el test en `skipped`.
- [ ] Test (solo bajo la variable, correr manualmente): aborta antes de colocar si la `baseURL` no
      es de testnet — simulado con una URL LIVE inyectada, sin llamar a la red real.
- [ ] Corrida real documentada contra TESTNET (evidencia para el reviewer): los tres tipos se
      colocan/consultan/cancelan, y `openOrders` termina en cero para el símbolo usado.
- [ ] El comando (`pnpm nx test ... -- --testPathPattern=...` con la env var) queda documentado en
      un comentario del propio archivo del spec o en `architect.md`/`planner.md` — nunca solo en la
      cabeza de quien lo corrió.

---

### Cierre

#### TASK-025: Fragmento de contexto aditivo — `libs/shared`, `libs/data-fetcher`, `libs/trading-engine`

**Historias:** US-2-002, US-2-003, US-2-004, US-2-006, US-2-007, US-2-018
**App:** libs/shared
**Descripción:** Crear
`sdd/context/libs/shared/updates/2026-09-01-spec-e-burgos-005-cycle-02.md`,
`sdd/context/libs/data-fetcher/updates/2026-09-01-spec-e-burgos-005-cycle-02.md` y
`sdd/context/libs/trading-engine/updates/2026-09-01-spec-e-burgos-005-cycle-02.md` (patrón
append-only de la sección 🧩 del CLAUDE.md) documentando: vocabulario de entrada nuevo, métodos
nuevos de `BinanceRestClient`, extensión del port y de ambos executors. No editar directamente
`constitution.md`/`context_prompt.md` de ninguna de las tres libs.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-009, TASK-024
**Criterio de done:**

- [ ] Los tres fragmentos existen con las secciones no vacías correspondientes (Estado/Estructura/
      Dependencias/Qué sigue), cortos y solo el delta.
- [ ] `constitution.md`/`context_prompt.md` de las tres libs no cambiaron una línea.

---

#### TASK-026: Fragmento de contexto aditivo `apps/api` + journal (si aplica) + usage consolidado

**Historias:** US-2-001
**App:** apps/api
**Descripción:** Crear
`sdd/context/apps/api/updates/2026-09-01-spec-e-burgos-005-cycle-02.md` con el delta de este
ciclo (tabla `entry_orders`, `EntryOrderService`, extensión de `ReconciliationService`, endpoint
nuevo, `EXCHANGE_TRIGGER`). Si al cerrar el ciclo hubo una lección real (filtro anti-ruido de la
sección 🧠 MEMORIA GATE), crear
`sdd/memory/journal/2026-09-01-spec-e-burgos-005-cycle-02.md`. Confirmar que cada task de este
`tasks.json` cerró con su `usage.model_tier` registrado (regla `harness_rules` del brief) antes de
que el reviewer cierre el `cycle.json`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-020, TASK-021, TASK-022, TASK-023
**Criterio de done:**

- [ ] El fragmento de `apps/api` existe, es corto y solo el delta; `constitution.md`/
      `context_prompt.md` de `apps/api` no cambiaron una línea.
- [ ] Si se creó entrada de journal, pasa el filtro anti-ruido (cambiaría el comportamiento de un
      agente futuro) — si no hay lección real, no se crea ninguna entrada.
- [ ] `pnpm sdd:validate` no reporta ninguna task de este `tasks.json` sin `usage`.

---

## Orden de ejecución

```
Capa 1 (libs/shared)
  TASK-001
       │
       ├──────────────────────────────┬───────────────────────────────┐
       ▼                               ▼                               ▼
Capa 2 (data-fetcher,            Capa 3a (pure resolver,        Capa 4 (apps/api datos,
 mismo archivo — SERIAL)          archivo propio — PARALELO       archivos propios — PARALELO
  TASK-002 → 003 → 004 → 005      a la Capa 2 y a la Capa 4)       a la Capa 2 y a la Capa 3a)
       │                               TASK-007                       TASK-010 → TASK-011
       ▼                                    │
     TASK-006                                │
       │                                     ▼
       │                          Capa 3b (port, mismo archivo — SERIAL)
       │                             TASK-008 (usa TASK-001+007)
       │                                     │
       └────────────────────────────────────▶ TASK-009 (usa TASK-006+008)
                                              │
                    ┌─────────────────────────┴──────────────────────────┐
                    ▼                                                     ▼
        Capa 5 (apps/api comportamiento — arranca solo con         Harness TESTNET
        TASK-006..009 Y TASK-010..011 en verde)                     (solo necesita TASK-004/005/006)
        TASK-012 → TASK-013 ┐                                          TASK-024
                    │        └─▶ TASK-017 (con TASK-015)
        TASK-014 (paralelo a 012/013, archivo propio)
                    │
                    ▼
                TASK-015 ─┬─▶ TASK-016 (archivo reconciliation, SERIAL con 015)
                           ├─▶ TASK-018 (archivo processor/aggregate-risk, PARALELO a 016/017)
                           └─▶ TASK-019 (archivo reactive, PARALELO a 016/017/018)
                    │
        TASK-021 (paralelo a toda la capa 5, solo depende de TASK-010)
                    │
        TASK-020 (depende de 013+015+016+017 — último antes del wiring)
                    │
                TASK-022 (wiring, depende de 012+015+021)
                    │
                TASK-023 (CA-001, depende de 013+018+022)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   TASK-025 (cierre libs)   TASK-026 (cierre apps/api, depende de 020+021+022+023)
   (depende de 009+024)
```

**Carriles paralelos explícitos (mismo momento, archivos distintos):**

1. Tras TASK-001: **{data-fetcher TASK-002..006}** ‖ **{TASK-007 resolver puro}** ‖ **{TASK-010→011
   schema/DTO}** — tres implementadores distintos pueden trabajar en simultáneo.
2. Tras TASK-006: **TASK-024 (harness TESTNET)** corre en paralelo a **todo** el resto del ciclo —
   no espera a `apps/api`.
3. Dentro de la capa 5: **TASK-014** (archivo `bot-action-counters.ts`) es paralela a **TASK-012/013**
   (archivos `entry-order.service.ts`/`trading.processor.ts`) desde que TASK-010 cierra.
4. Tras TASK-015: **TASK-016** (mismo archivo `reconciliation.service.ts`, serial con 015) ‖
   **TASK-018** (archivo processor/aggregate-risk) ‖ **TASK-019** (archivo reactivo) — tres
   implementadores distintos.
5. **TASK-021** (endpoint, archivo propio) es paralela a toda la capa 5 desde que TASK-010 cierra.

**Camino crítico (la cadena más larga que ningún paralelismo acorta):**
TASK-001 → TASK-002 → TASK-003 → TASK-004/005 → TASK-006 → TASK-009 → TASK-012 → TASK-013 →
TASK-015 → TASK-016/17 → TASK-020 → TASK-022 → TASK-023 → TASK-026.
Horas del camino crítico: 3+3+4+5+4+4+6+6+7+6+4+3+3+2 = **60h** (~7.5 días hábiles); el resto del
trabajo (108h totales) cabe en los carriles paralelos sin extender esa cifra si hay al menos 2-3
implementadores trabajando el ciclo a la vez.

---

## Notas para el orquestador (reconciliación contra `architect.md`)

- Los nombres exactos de: el método discriminado del port (D5), el `filledLeg` de una entrada
  (D5), el modelo `EntryOrder`/enum de estados (D7), el endpoint de listado (capa 4/5) y el archivo
  donde vive la validación local (TASK-003) **no están fijados por este documento** — son decisión
  del architect. Si `architect.md` elige un shape distinto al sugerido acá (p. ej. un método por
  tipo de orden en vez de uno discriminado), TASK-007..009 y TASK-012 son las que hay que ajustar;
  el resto del plan no cambia.
- Si `architect.md` resuelve la pregunta abierta del funcional sobre fills parciales de una entrada
  con una decisión explícita, esa decisión agrega criterios a TASK-015/016 pero no cambia su
  estimación de forma material (mismo servicio, una rama más).
- TASK-019 (D6) asume el candidato (a) de la pregunta del brief (chequeo en el riel reactivo). Si
  el architect elige el candidato (b) (job repetible) o (c) (ambos), esta task es la única que
  cambia de forma — el resto del plan no se ve afectado.
