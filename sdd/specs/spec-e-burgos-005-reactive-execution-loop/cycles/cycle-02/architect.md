# Architect — Cycle 2: Entrada descansando en el exchange

> **Input:** `brief.yaml` (`verified_facts` + `decisiones_criticas` D5–D9), `functional.md` (18 historias,
> 25 reglas de negocio, 4 preguntas abiertas), `spec-e-burgos-005-reactive-execution-loop.spec.md` §3
> (Cycle-02 + D2-1..D2-4), §5 y §6, `cycles/cycle-02/artifacts/testnet-write-probe.md`.
> **Output:** este archivo.
> **Generado por:** sdd-architect

---

## 0. Cómo leer este documento

Cada decisión D5–D9, cada hueco D2-1..D2-4 de la spec y cada una de las **4 preguntas abiertas** del
funcional se cierran acá como **contrato**: decisión tomada, alternativa descartada con su motivo, y
las firmas / payloads / secuencias exactas que el implementor sigue sin volver a decidir nada. Lo que
no aparece acá y hace falta para implementar es un hueco del arquitecto: se pregunta, no se inventa.

Las §1 a §10 son el contrato ejecutable. La **§12 corrige el funcional**: donde un criterio de
aceptación depende de un valor de mercado, o donde una regla de negocio contradice el código
verificado, esta sección lo reescribe. **El reviewer valida contra la redacción de §12, no contra la
letra original del funcional.**

**Fuente de verdad del comportamiento real del exchange:** este documento no infiere nada de la
documentación de Binance. Todo payload, todo código de error y toda forma de respuesta salen de
`cycles/cycle-02/artifacts/testnet-write-probe.md`, ejecutado contra Binance TESTNET el 2026-09-01
con la API cruda antes de escribir una línea de código. Cada vez que se cita, se referencia como
**[probe #N]**.

### Reparto arquitectónico (invariante del ciclo)

| Capa | Qué le toca | Prohibido |
| --- | --- | --- |
| `libs/shared` | Vocabulario de la orden de entrada (`EntryOrderMode`, `EntryOrderRequest`, `EntryOrderRef`, `EntryOrderResult`, `EntryOrderExchangeState`, `EntryOrderExchangeStatus`, `EntryOrderLeg`) | Depender de nada |
| `libs/trading-engine` | `OrderExecutorPort` extendido + los DOS executors + `resolveEntryLevels` (**función pura**) | Depender de `data-fetcher` (regla vigente, no se toca), Prisma, Nest, `Date.now()` interno |
| `libs/data-fetcher` | Extensión aditiva de `BinanceRestClient`: 3 colocaciones nuevas, consulta y cancelación de entrada, filtro `TRAILING_DELTA` | Conocer bots, configs, posiciones o `entry_orders` |
| `apps/api` | Orquestación: decisión de colocar, persistencia en `entry_orders`, reconciliación del fill, cancelaciones, WS y notificaciones | Reimplementar una decisión que ya vive en una lib; colocar una orden fuera de `authorizeAndRun` |

`Date.now()` no aparece dentro de ninguna función nueva de `libs/`: el tiempo entra por parámetro,
igual que en `planFastPath` y `evaluateActionCaps`.

---

## 1. D5 — Shape del contrato de entrada en el port

### Decisión

**Un solo método de colocación con discriminante de modo**, más una consulta y una cancelación:

```
placeEntryOrder(req: EntryOrderRequest): Promise<EntryOrderResult>
getEntryOrderStatus(symbol: string, ref: EntryOrderRef, opts?: { leg?: EntryOrderLeg }): Promise<EntryOrderExchangeStatus>
cancelEntryOrder(symbol: string, ref: EntryOrderRef): Promise<void>
```

**Por qué un método y no uno por tipo.** El llamador (`TradingProcessor.executeBuy`) tiene un solo
punto de decisión —`config.entryOrderMode`— y un solo camino de persistencia. Un método por tipo
obligaría a un `switch` en `apps/api` que replicaría el discriminante del tipo, y a duplicar el
tratamiento del resultado (`orderId` suelto vs. `orderListId` + dos piernas). Con un discriminante en
el request, el `switch` vive una sola vez, adentro del executor, que es donde ya vive el conocimiento
de qué endpoint corresponde a cada modo.

**Alternativa descartada:** `placeLimitMakerEntry()` + `placeOcoEntry()`. Descartada porque la
reconciliación y la cancelación necesitan igual una referencia **unificada** (`EntryOrderRef`) para
no ramificar en cada uso; si la referencia se unifica, unificar también la colocación es gratis.

### Tipos nuevos en `libs/shared/src/types/interfaces.ts`

Van al lado de `ExchangeOrderState` / `ExchangeOrderStatus` (línea 271), que son el precedente exacto:
vocabulario que `trading-engine` necesita tipar sin importar `data-fetcher`.

```ts
export type EntryOrderMode = 'MARKET' | 'LIMIT_MAKER' | 'OCO';

export type RestingEntryMode = Exclude<EntryOrderMode, 'MARKET'>;

export type EntryOrderLeg = 'LIMIT' | 'STOP';

export interface EntryOrderRequest {
  mode: RestingEntryMode;
  symbol: string;
  quantity: number;
  limitPrice: number;
  referencePrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  clientOrderId: string;
}

export interface EntryOrderRef {
  orderListId: string | null;
  orderId: string | null;
  limitLegOrderId: string | null;
  stopLegOrderId: string | null;
}

export interface EntryOrderResult {
  mode: RestingEntryMode;
  orderListId: string | null;
  orderId: string | null;
  limitLegOrderId: string | null;
  stopLegOrderId: string | null;
  clientOrderId: string;
  placedAt: Date;
}

export type EntryOrderExchangeState =
  | 'RESTING'
  | 'FILLED'
  | 'CANCELLED'
  | 'MISSING';

export interface EntryOrderExchangeStatus {
  state: EntryOrderExchangeState;
  filledLeg: EntryOrderLeg | null;
  executedPrice: number | null;
  executedQuantity: number | null;
  remainingQuantity: number | null;
  partial: boolean;
  orderId: string | null;
}
```

**Cuatro decisiones de tipado que no son cosméticas:**

1. **`EntryOrderExchangeState` no incluye `EXPIRED`.** El exchange nunca reporta "venció": el TTL es
   una regla nuestra, medida contra `placedAt`. `EXPIRED` existe **solo** como estado persistido
   (`EntryOrderStatus` de Prisma, §4). Meter `EXPIRED` en el tipo del exchange invitaría a que alguien
   lo infiera de una respuesta, que es justo lo que US-2-007 prohíbe.
2. **El estado del exchange se llama `RESTING`, no `ACTIVE`.** `ExchangeOrderState` ya usa `ACTIVE`
   para la protección; usar la misma palabra haría que los dos vocabularios se confundan en
   `reconciliation.service.ts`, donde conviven. `RESTING` es además la palabra del dominio.
3. **`filledLeg` es `'LIMIT' | 'STOP'`, no `'STOP' | 'TAKE_PROFIT'`.** En una entrada no hay
   take-profit: la pierna de abajo es la compra en soporte y la de arriba es la ruptura. Reusar
   `ExchangeOrderStatus` habría obligado a llamar `TAKE_PROFIT` a una compra en soporte.
4. **`EntryOrderStatus` (el tipo TS de la consulta) NO se llama así**, se llama
   `EntryOrderExchangeStatus`. El enum de Prisma de §4 sí se llama `EntryOrderStatus` (es el nombre que
   pide el brief) y ambos se importan juntos en `reconciliation.service.ts`: dos tipos homónimos en el
   mismo archivo es una colisión real, no un detalle de estilo. La simetría
   `ExchangeOrderState`/`ExchangeOrderStatus` ya existente resuelve el nombre sin inventar nada.

### `OrderExecutorPort` — métodos nuevos (pasa de 9 a 12)

```ts
export interface OrderExecutorPort {
  // … los 9 métodos vigentes, sin cambios …
  placeEntryOrder(req: EntryOrderRequest): Promise<EntryOrderResult>;
  getEntryOrderStatus(
    symbol: string,
    ref: EntryOrderRef,
    opts?: { leg?: EntryOrderLeg },
  ): Promise<EntryOrderExchangeStatus>;
  cancelEntryOrder(symbol: string, ref: EntryOrderRef): Promise<void>;
}
```

### `LiveOrderExecutor` — adición estructural al constructor

`LiveOrderExecutor` **sigue sin importar `BinanceRestClient`**: se le suman tres firmas al objeto
estructural inline del constructor (`order-executor.ts:328-371`), nada más.

```ts
export class LiveOrderExecutor implements OrderExecutorPort {
  constructor(
    private readonly binance: {
      // … las 8 firmas vigentes, sin cambios …
      placeLimitMakerBuyOrder(
        symbol: string,
        params: {
          quantity: number;
          price: number;
          referencePrice: number;
          clientOrderId?: string;
        },
      ): Promise<{ orderId: string; clientOrderId: string; placedAt: Date }>;
      placeOcoBuyOrder(
        symbol: string,
        params: {
          quantity: number;
          belowPrice: number;
          aboveStopPrice: number;
          abovePrice: number;
          aboveTrailingDeltaBips?: number;
          referencePrice: number;
          listClientOrderId?: string;
          belowClientOrderId?: string;
          aboveClientOrderId?: string;
        },
      ): Promise<{
        orderListId: string;
        listClientOrderId: string;
        stopOrderId: string;
        limitOrderId: string;
        placedAt: Date;
      }>;
      getEntryOrderStatus(
        symbol: string,
        ref: {
          orderListId?: string | null;
          orderId?: string | null;
          limitLegOrderId?: string | null;
          stopLegOrderId?: string | null;
        },
        opts?: { leg?: EntryOrderLeg },
      ): Promise<EntryOrderExchangeStatus>;
      cancelEntryOrder(
        symbol: string,
        ref: { orderListId?: string | null; orderId?: string | null },
      ): Promise<void>;
    },
  ) {}
}
```

`placeEntryOrder` ramifica por `req.mode` y traduce; **no valida nada** (la validación de filtros es
del cliente, §2.4) y **no redondea nada** (el tick rounding es del cliente, §2.5).

### `SandboxOrderExecutor` — comportamiento contratado

Existe **para poder testear el contrato del port sin red**, no para dar cobertura en papel (D2-4 de la
spec). Contrato exacto:

| Método | Comportamiento |
| --- | --- |
| `placeEntryOrder` | Guarda la entrada en un `Map<string, SandboxEntry>` con id `sandbox-entry-{n}`. Devuelve `orderId` para `LIMIT_MAKER`; `orderListId` + `limitLegOrderId`/`stopLegOrderId` sintéticos para `OCO`. **No mueve balances**: una entrada no ejecutada no compromete saldo en la simulación. |
| `getEntryOrderStatus` | Con precio seteado por `setPrice`: `price <= limitPrice` ⇒ `FILLED` con `filledLeg: 'LIMIT'`, `executedPrice = limitPrice`, `partial: false`; `price >= stopPrice` (solo `OCO`) ⇒ `FILLED` con `filledLeg: 'STOP'`, `executedPrice = stopLimitPrice`. Sin precio o sin cruce ⇒ `RESTING`. Referencia desconocida ⇒ `MISSING`. |
| `cancelEntryOrder` | Borra del `Map`. Referencia desconocida ⇒ resuelve sin error (idempotente). |

`SandboxOrderExecutor` **se construye nuevo en cada ciclo del processor**, así que su `Map` se evapora
entre ciclos: por eso el modo `SANDBOX` nunca coloca entradas descansando (RN-22) y por eso este
executor es una herramienta de test, no una feature.

---

## 2. Contrato del `BinanceRestClient`

### 2.1 Método nuevo: `LIMIT_MAKER` BUY colocable

```ts
async placeLimitMakerBuyOrder(
  symbol: string,
  params: {
    quantity: number;
    price: number;
    referencePrice: number;
    clientOrderId?: string;
  },
): Promise<{ orderId: string; clientOrderId: string; placedAt: Date }>
```

Payload exacto de `POST /api/v3/order` [probe #1]:

```
symbol:           <symbol>
side:             BUY
type:             LIMIT_MAKER
quantity:         formatDecimal(adjustedQty, lotSize.stepSize)
price:            formatDecimal(adjustedPrice, price.tickSize)
newOrderRespType: FULL
newClientOrderId: <clientOrderId>            (solo si viene)
```

**`LIMIT_MAKER` no lleva `timeInForce`.** Binance lo rechaza. La respuesta `FULL` trae `status: NEW`,
`workingTime` seteado y `fills: []` [probe #1].

### 2.2 Método existente extendido: `STOP_LOSS_LIMIT` BUY con `trailingDelta`

`placeStopLossLimitOrder` se extiende de forma **aditiva** (no cambia ningún parámetro posicional):

```ts
async placeStopLossLimitOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  stopPrice: number | null,
  limitPrice: number,
  opts?: { clientOrderId?: string; trailingDeltaBips?: number },
): Promise<OrderResult>
```

Payload **con** `stopPrice` [probe #2]:

```
symbol:           <symbol>
side:             BUY
type:             STOP_LOSS_LIMIT
timeInForce:      GTC
quantity:         formatDecimal(adjustedQty, lotSize.stepSize)
price:            formatDecimal(adjustedLimitPrice, price.tickSize)
stopPrice:        formatDecimal(adjustedStopPrice, price.tickSize)
trailingDelta:    String(trailingDeltaBips)   (solo si trailingDeltaBips > 0)
newOrderRespType: FULL
newClientOrderId: <clientOrderId>             (solo si viene)
```

Payload **sin** `stopPrice` (`stopPrice: null`, exige `trailingDeltaBips > 0`) [probe #3]: idéntico,
**omitiendo la clave `stopPrice`**. `stopPrice: null` sin `trailingDeltaBips` es
`OrderValidationError('PRICE_FILTER')` local: una orden stop sin ningún disparador no existe.

**Decisión — este ciclo usa SIEMPRE `stopPrice` + `trailingDelta`, nunca `trailingDelta` solo.**
[probe #2] mide que con `stopPrice` la pierna queda dormida (`trailingTime: -1`, `isWorking: false`)
hasta que el precio cruza el stop, y recién ahí empieza a perseguir; [probe #3] mide que sin
`stopPrice` trackea desde el próximo trade. Razones para quedarnos con la primera:

1. La resistencia **es** el nivel de ruptura que el trader quiere: sin `stopPrice`, el trailing
   arranca desde el mínimo del momento y puede comprar en cualquier rebote muy por debajo del nivel
   — no es la orden que se pidió.
2. **El notional planificado sería incalculable.** RN-8 y §5 exigen contabilizar exposición
   comprometida; sin `stopPrice` el precio de disparo es desconocido de antemano.
3. Es la única de las dos formas que preserva el criterio `limitPrice < referencePrice < stopPrice`
   como propiedad verificable antes de firmar (§2.6).

El modo "sin `stopPrice`" queda soportado por el cliente (lo necesita el harness, escenario S3) pero
**ningún camino de `apps/api` lo usa en este ciclo**.

### 2.3 Método nuevo: OCO de compra

```ts
async placeOcoBuyOrder(
  symbol: string,
  params: {
    quantity: number;
    belowPrice: number;
    aboveStopPrice: number;
    abovePrice: number;
    aboveTrailingDeltaBips?: number;
    referencePrice: number;
    listClientOrderId?: string;
    belowClientOrderId?: string;
    aboveClientOrderId?: string;
  },
): Promise<OcoOrderResult>
```

Payload exacto de `POST /api/v3/orderList/oco` [probe #5, #6]:

```
symbol:              <symbol>
side:                BUY
quantity:            formatDecimal(adjustedQty, lotSize.stepSize)
belowType:           LIMIT_MAKER
belowPrice:          formatDecimal(adjustedBelowPrice, price.tickSize)
aboveType:           STOP_LOSS_LIMIT
aboveStopPrice:      formatDecimal(adjustedAboveStopPrice, price.tickSize)
abovePrice:          formatDecimal(adjustedAbovePrice, price.tickSize)
aboveTimeInForce:    GTC
aboveTrailingDelta:  String(aboveTrailingDeltaBips)   (solo si > 0)
newOrderRespType:    FULL
listClientOrderId:   <listClientOrderId>              (solo si viene)
belowClientOrderId:  <belowClientOrderId>             (solo si viene)
aboveClientOrderId:  <aboveClientOrderId>             (solo si viene)
```

**Tres cosas que este payload NO es**, y que un implementor apurado escribiría mal:

- **`aboveTrailingDelta`, no `trailingDelta`.** En el OCO el parámetro va prefijado por la pierna
  [probe #6]. `trailingDelta` a secas en un `orderList` no aplica a nada.
- **`belowTimeInForce` no existe acá.** La pierna de abajo es `LIMIT_MAKER` y `LIMIT_MAKER` no lleva
  `timeInForce`. Es el espejo exacto del OCO de venta, donde el `GTC` va en `belowTimeInForce` porque
  ahí la pierna `STOP_LOSS_LIMIT` es la de abajo.
- **`side: 'BUY'` explícito.** `placeOcoSellOrder` tiene `side: 'SELL'` hardcodeado
  (`binance-rest.client.ts:664`) y **no se toca**: son dos métodos, con `parseOcoResult` compartido.
  Parametrizar el existente con un `side` obligaría a invertir tipos de pierna, dirección de redondeo
  y sentido de la validación adentro del mismo método — es decir, a tocar el camino de la protección
  nativa, que CA-001 exige dejar bit a bit igual.

`parseOcoResult` (privado, ya existente) sirve tal cual: busca `type === 'STOP_LOSS_LIMIT'` y
`type === 'LIMIT_MAKER'` en `orderReports`, y ambos vienen en la respuesta `FULL` [probe #5].

### 2.4 Consulta y cancelación de una entrada

```ts
async getEntryOrderStatus(
  symbol: string,
  ref: {
    orderListId?: string | null;
    orderId?: string | null;
    limitLegOrderId?: string | null;
    stopLegOrderId?: string | null;
  },
  opts?: { leg?: EntryOrderLeg },
): Promise<EntryOrderExchangeStatus>

async cancelEntryOrder(
  symbol: string,
  ref: { orderListId?: string | null; orderId?: string | null },
): Promise<void>
```

**`getEntryOrderStatus` — orden de llamadas exacto:**

1. `ref.orderListId == null` (entrada `LIMIT_MAKER` suelta): `GET /api/v3/order?symbol&orderId`
   (peso 4). `-2013` ⇒ `MISSING`. Mapea con §2.7.
2. `ref.orderListId != null` y `opts.leg` presente: `GET /api/v3/order` **solo** del `orderId` de esa
   pierna (peso 4). Es el camino barato del riel reactivo (§3).
3. `ref.orderListId != null` sin `opts.leg`: `GET /api/v3/orderList?orderListId` (peso 4) y **después**
   `GET /api/v3/order` de cada pierna (peso 4 c/u). **La consulta de la lista no alcanza:** [probe #9]
   mide que `GET /api/v3/orderList` devuelve solo `orders[]` con id y `clientOrderId`, **sin precios
   ni cantidades ejecutadas** — y que tampoco trae `orderReports`. El precio y la cantidad del fill
   salen sí o sí de la consulta de la pierna, igual que en `getOcoStatus`.
4. **`listOrderStatus: 'EXECUTING'` NO se puede tomar como `RESTING` sin más.** Una pierna
   parcialmente ejecutada mantiene la lista en `EXECUTING`; por eso el paso 3 consulta las piernas
   también en ese caso. La única condición que corta antes es `-2013` en la lista ⇒ `MISSING`.
5. `listOrderStatus: 'ALL_DONE'` sin ninguna pierna `FILLED`/`PARTIALLY_FILLED` ⇒ `CANCELLED`.

**`cancelEntryOrder`:** con `orderListId` ⇒ `DELETE /api/v3/orderList` [probe #12]; sin él ⇒
`DELETE /api/v3/order` [probe #11]. **Trata `-2011` (`Unknown order sent`) y `-2013` como éxito**: la
orden ya no está y ese es exactamente el estado que la cancelación buscaba. Cualquier otro código
propaga.

### 2.5 Redondeo por pierna (dirección, y por qué)

`validatePrice(price, filter, rounding)` ya existe y acepta `'up' | 'down'`. Direcciones para una
**compra**:

| Precio | Dirección | Motivo |
| --- | --- | --- |
| `LIMIT_MAKER` BUY (`price`, `belowPrice`) | **`down`** (floor al tick) | Tiene que quedar **estrictamente por debajo** del mercado o Binance responde `-2010 Order would immediately match and take` [probe #7]. Redondear hacia arriba lo acerca al mercado: la dirección del redondeo es lo que separa una orden aceptada de una rechazada. |
| `STOP_LOSS_LIMIT` BUY — `stopPrice` / `aboveStopPrice` | **`up`** (ceil al tick) | Tiene que quedar **estrictamente por encima** del mercado. Es la inversión exacta del caso de venta, donde el mismo campo se redondea `down`. |
| `STOP_LOSS_LIMIT` BUY — `price` / `abovePrice` | **`up`** (ceil al tick) | El límite de una compra stop va **arriba** del stop (`stop × (1 + stopLimitOffsetPct)`), para que la orden pueda llenarse cuando dispara. En una venta va abajo. |
| `quantity` (todas) | **floor** al `stepSize` | Sin cambios: `validateQuantity` vigente. |

Corolario obligatorio: **`placeStopLossLimitOrder` deja de redondear siempre `down`.** Pasa a
`side === 'BUY' ? 'up' : 'down'` para ambos precios. La rama `SELL` queda idéntica (CA-001); la rama
`BUY` hoy no tiene ningún llamador, así que el cambio no puede alterar ningún comportamiento vigente.

### 2.6 Validación local antes de firmar

Orden exacto de validación en las tres colocaciones nuevas, **todo antes del `signedRequest`**:

1. `getSymbolFilters(symbol)` (cacheado a nivel de proceso).
2. `validateQuantity` ⇒ `OrderValidationError('LOT_SIZE')`.
3. `validatePrice` de cada precio con la dirección de §2.5 ⇒ `OrderValidationError('PRICE_FILTER')`.
4. `validateNotional` con **el precio de cada pierna** ⇒ `OrderValidationError('MIN_NOTIONAL')`.
5. `validateTrailingDelta` (nuevo, §2.7) ⇒ `OrderValidationError('TRAILING_DELTA')`.
6. `PRICE_CROSSES_MARKET` (nuevo sentido para compra) ⇒ `OrderValidationError('PRICE_CROSSES_MARKET')`.

**Regla `PRICE_CROSSES_MARKET` para compra:**

```
LIMIT_MAKER suelto:  limitPrice < referencePrice
OCO de compra:       belowPrice < referencePrice < aboveStopPrice
STOP_LOSS_LIMIT BUY: referencePrice < stopPrice
```

Es la inversión literal de la regla de venta vigente (`takeProfit > reference > stop`). Lo que la
justifica no es simetría estética: [probe #7] mide que un `LIMIT_MAKER` BUY con precio ≥ mercado es
`-2010 Order would immediately match and take.`, y `-2010` está en la lista de **no reintentables**
(constitución de `data-fetcher` §3) — reintentarlo quema rate limit sin ninguna chance de éxito. Se
rechaza local o se paga una llamada firmada garantizadamente perdida.

`referencePrice` es **obligatorio** en las tres colocaciones nuevas (en `placeOcoSellOrder` es
opcional; acá no, porque no existe el caso "no sé dónde está el mercado" en un camino que elige un
nivel a partir del mercado).

### 2.7 Filtro `TRAILING_DELTA` en `getSymbolFilters`

```ts
export interface TrailingDeltaFilter {
  minTrailingAboveDelta: number;
  maxTrailingAboveDelta: number;
  minTrailingBelowDelta: number;
  maxTrailingBelowDelta: number;
}

export interface SymbolFilters {
  lotSize: { minQty: number; maxQty: number; stepSize: number };
  price: { minPrice: number; maxPrice: number; tickSize: number };
  notional: { minNotional: number; applyToMarket: boolean };
  trailingDelta?: TrailingDeltaFilter;
}

export type OrderValidationCode =
  | 'LOT_SIZE'
  | 'PRICE_FILTER'
  | 'MIN_NOTIONAL'
  | 'PRICE_CROSSES_MARKET'
  | 'TRAILING_DELTA';
```

**`trailingDelta` es opcional a propósito.** Cuatro specs vigentes construyen literales
`SymbolFilters` (`reactive-multi-replica.spec.ts:55`, `reactive-kill-switch.spec.ts:179`,
`market-stream.service.spec.ts:32`, `fast-path.service.spec.ts:88`); un campo requerido los rompería a
los cuatro sin que ninguno tenga nada que ver con este ciclo. Opcional, el cambio es estrictamente
aditivo.

**Regla fail-closed:** si se pide un `trailingDeltaBips` y el símbolo **no** declara el filtro, se
rechaza con `OrderValidationError('TRAILING_DELTA')`. No se manda un parámetro cuyos límites no se
pueden verificar.

`validateTrailingDelta(bips, filter)` para una **compra** valida contra
`[minTrailingAboveDelta, maxTrailingAboveDelta]` — la pierna contingente de una compra es la de
arriba. En TESTNET BTCUSDT son `10 / 2000` BIPS. Violarlo contra el exchange devuelve
`-1013 Filter failure: TRAILING_DELTA` [probe #4] — el **mismo** código que `LOT_SIZE`, con lo cual el
código de error de Binance no permite distinguir qué filtro falló: la única forma de que el rechazo
sea diagnosticable es rechazarlo localmente con su propio `OrderValidationCode`.

### 2.8 Mapeo del estado de una orden de entrada

`toEntryOrderStatus` es un mapper **propio**, no reusa `mapOrderStatusToState`:

| `status` de Binance | `state` | `partial` | `executedQuantity` |
| --- | --- | --- | --- |
| `NEW` | `RESTING` | `false` | `null` |
| `PARTIALLY_FILLED` con `executedQty > 0` | **`FILLED`** | `true` | `executedQty` |
| `PARTIALLY_FILLED` con `executedQty == 0` | `RESTING` | `false` | `null` |
| `FILLED` | `FILLED` | `false` | `executedQty` |
| `CANCELED`, `REJECTED`, `EXPIRED`, `EXPIRED_IN_MATCH` | `CANCELLED` | `false` | `null` |
| `-2013` en la consulta | `MISSING` | `false` | `null` |

`executedPrice = cummulativeQuoteQty / executedQty` cuando ambos son > 0; `filledLeg` sale del `type`
de la orden consultada (`LIMIT_MAKER` ⇒ `LIMIT`, `STOP_LOSS_LIMIT` ⇒ `STOP`).
`remainingQuantity = origQty − executedQty`.

**`mapOrderStatusToState` (el de la protección) no se toca**: ahí `PARTIALLY_FILLED ⇒ ACTIVE` es
correcto y cambiarlo alteraría el camino de la protección nativa.

### 2.9 `ENDPOINT_WEIGHTS`

**No se agrega ninguna entrada.** [probe #8, #9, #10] mide los pesos reales contra el header
`x-mbx-used-weight-1m` y coinciden con la tabla vigente: `POST /api/v3/order` 1,
`POST /api/v3/orderList/oco` 1, `GET /api/v3/order` 4, `GET /api/v3/orderList` 4,
`GET /api/v3/openOrders` con símbolo 6, `DELETE` de ambos 1. La regla de prefijo + método de
`getEndpointWeight` ya cubre los tres endpoints nuevos porque son los mismos endpoints.

---

## 3. D6 — Detección del fill y ventana sin protección

### Decisión

**Dos detectores, una sola implementación de la liquidación (settlement).**

| Detector | Cuándo corre | Alcance | Peso por sondeo |
| --- | --- | --- | --- |
| **Reconciliación de inicio de ciclo** (`ReconciliationService`) | Una vez por ciclo del processor, `LIVE`/`TESTNET` con credenciales, antes de toda decisión | **Todas** las entradas `RESTING` del config | 4 (`LIMIT_MAKER`) · 12 (`OCO`: lista + 2 piernas) |
| **Sonda por tick** (`EntryFillWatchService`, `src/reactive/`) | Solo con `reactiveLoopEnabled = true`, solo en la réplica dueña del símbolo, solo cuando el tick **cruza** un nivel de una entrada viva | La entrada y **la pierna** cuyo nivel cruzó | 4 |

**Condición de disparo de la sonda, exacta:** para una entrada `RESTING` de ese `configId`+símbolo,
`tick.price <= limitPrice` dispara la sonda de la pierna `LIMIT`; `tick.price >= stopPrice` dispara la
de la pierna `STOP`. Fuera de esos dos cruces, cero llamadas.

**Debounce:** `entryFillProbeDebounceMs = 15_000`, por `(entryOrderId, leg)`, en
`reactive-runtime-thresholds.ts` junto a los demás umbrales de infraestructura. Peor caso real: 4
sondeos por minuto × peso 4 = **16 de peso por minuto por entrada viva**, contra el presupuesto de
1100/min del `BinanceRateLimiter`. Con el máximo de entradas que la concurrencia permite
(`maxConcurrentPositions`, default 2) el techo es 32/min.

**Por qué la sonda por tick y no un job repetible (opción (b) del brief).** Un repetible gasta peso
en función del **reloj**, no del mercado: un bot con una entrada colocada a 5 % del precio pagaría
sondeos durante horas sin que el precio se acerque nunca. El tick ya llega gratis (la suscripción
existe desde cycle-01), ya está deduplicado por réplica vía el lease `rx:v1:owner:{symbol}` (CA-007),
y **cruza el nivel exactamente cuando el fill es posible**. La única ventana que un repetible cubriría
mejor es la del stream degradado — y esa ya la cubre la reconciliación de inicio de ciclo, que corre
igual.

**La sonda no es autoridad, es adelanto.** La reconciliación de inicio de ciclo corre siempre y llega
a la misma conclusión; la sonda solo acorta la ventana sin protección de "hasta el próximo ciclo
(15–30 min)" a "hasta el próximo tick (~1 s)". Si la sonda está apagada
(`reactiveLoopEnabled = false`), el sistema es correcto igual, solo más lento — que es exactamente lo
que CA-001 exige del interruptor.

**Ventana sin protección que el ciclo acepta:** con el interruptor reactivo apagado, hasta un ciclo
completo del processor. Es la misma ventana que ya existe hoy para una posición que el exchange cerró
por su cuenta (`closeFilledByExchange`), y se acepta con el mismo argumento: la alternativa real
—`user data stream`— está explícitamente fuera de alcance del ciclo.

**Cableado sin ciclo de módulos:** el settlement vive en `EntryOrderService` (`src/trading/`),
`TradingModule` lo agrega a `exports`, y `ReactiveModule` —que ya importa `TradingModule`— lo inyecta.
El grafo `ReactiveModule → TradingModule` no se invierte.

---

## 4. D7 — Tabla `entry_orders` y su ciclo de vida

### 4.1 Enums y modelo Prisma

```prisma
enum EntryOrderMode {
  MARKET
  LIMIT_MAKER
  OCO
}

enum EntryOrderStatus {
  RESTING
  FILLED
  CANCELLED
  EXPIRED
  MISSING
}

enum EntryOrderLeg {
  LIMIT
  STOP
}

enum EntryOrderCancelReason {
  TTL_EXPIRED
  LATER_DECISION
  DAILY_LOSS_DISCARDED
  BOT_STOPPED
  REPLACED_BY_NEW_ENTRY
  PARTIAL_FILL_REMAINDER
  ORPHAN_SWEEP
  VANISHED_ON_EXCHANGE
}

model EntryOrder {
  id                 String                  @id @default(cuid())
  userId             String
  configId           String
  symbol             String
  asset              Asset
  pair               QuoteCurrency
  mode               TradingMode
  entryMode          EntryOrderMode
  status             EntryOrderStatus        @default(RESTING)
  quantity           Float
  limitPrice         Float
  stopPrice          Float?
  stopLimitPrice     Float?
  trailingDeltaBips  Int?
  referencePrice     Float
  plannedNotionalUsd Float
  clientOrderId      String                  @unique
  orderListId        String?
  orderId            String?
  limitLegOrderId    String?
  stopLegOrderId     String?
  placedAt           DateTime                @default(now())
  expiresAt          DateTime
  /// Referencia de auditoría, sin FK a propósito (ver nota)
  decisionId         String?
  /// Referencia de auditoría, sin FK a propósito (ver nota)
  positionId         String?
  filledLeg          EntryOrderLeg?
  executedPrice      Float?
  executedQuantity   Float?
  settledAt          DateTime?
  cancelReason       EntryOrderCancelReason?
  lastError          String?
  updatedAt          DateTime                @updatedAt

  user   User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  config TradingConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([configId, status])
  @@index([userId, status])
  @@index([status, expiresAt])
  @@map("entry_orders")
}
```

Back-relations: `entryOrders EntryOrder[]` en `User` y en `TradingConfig`.
Getter obligatorio en `PrismaService`: **`get entryOrder() { return this._client.entryOrder; }`** — los
getters son 1:1 con los modelos y sin él el build rompe.

### 4.2 Tabla de columnas

| Columna | Tipo | Constraints | Rol |
| --- | --- | --- | --- |
| `id` | `String @id @default(cuid())` | PK | — |
| `user_id` | `String` | NOT NULL, FK `users(id)` CASCADE | Dato operativo del bot (mismo criterio que `bot_actions`) |
| `config_id` | `String` | NOT NULL, FK `trading_configs(id)` CASCADE | Idem |
| `symbol` | `String` | NOT NULL | `BTCUSDT`. Redundante con `asset`+`pair` a propósito: es la clave con la que se consulta al exchange |
| `asset` / `pair` | `Asset` / `QuoteCurrency` | NOT NULL | Permiten contar exposición por activo sin parsear el símbolo |
| `mode` | `TradingMode` | NOT NULL | `LIVE` o `TESTNET`. **Nunca `SANDBOX`** (RN-22) |
| `entry_mode` | `EntryOrderMode` | NOT NULL | `LIMIT_MAKER` u `OCO`. **Nunca `MARKET`** |
| `status` | `EntryOrderStatus @default(RESTING)` | NOT NULL | Único estado inicial y único no terminal |
| `quantity` | `Float` | NOT NULL | Cantidad colocada (ya ajustada al `stepSize`) |
| `limit_price` | `Float` | NOT NULL | Pierna de abajo (ya ajustada al `tickSize`) |
| `stop_price` | `Float` | NULL | Solo `OCO`: `aboveStopPrice` |
| `stop_limit_price` | `Float` | NULL | Solo `OCO`: `abovePrice` |
| `trailing_delta_bips` | `Int` | NULL | Solo `OCO` y solo si el trader lo configuró |
| `reference_price` | `Float` | NOT NULL | Precio de mercado contra el que se resolvieron los niveles: sin él, un `EXPIRED` no se puede auditar |
| `planned_notional_usd` | `Float` | NOT NULL | `quantity × max(limit_price, stop_limit_price)` — §5.2 |
| `client_order_id` | `String @unique` | NOT NULL, UNIQUE | Prefijo `ent-`. La unicidad es la que hace idempotente el barrido de huérfanas |
| `order_list_id` | `String` | NULL | Solo `OCO` |
| `order_id` | `String` | NULL | Solo `LIMIT_MAKER` suelto |
| `limit_leg_order_id` / `stop_leg_order_id` | `String` | NULL | Solo `OCO`: permiten consultar **una** pierna (peso 4 en vez de 12) |
| `placed_at` | `DateTime @default(now())` | NOT NULL | Origen **único** del cómputo del TTL |
| `expires_at` | `DateTime` | NOT NULL | `placed_at + entryOrderTtlMinutes`, materializado al colocar |
| `decision_id` | `String` | NULL | Auditoría **sin FK** |
| `position_id` | `String` | NULL | Auditoría **sin FK**. Se setea al `FILLED` (trazabilidad de US-2-012) |
| `filled_leg` | `EntryOrderLeg` | NULL | Qué pierna llenó. **Se lee del exchange, nunca se asume** |
| `executed_price` / `executed_quantity` | `Float` | NULL | Lo que efectivamente ejecutó esa pierna |
| `settled_at` | `DateTime` | NULL | Momento de la transición terminal |
| `cancel_reason` | `EntryOrderCancelReason` | NULL | Motivo de **todo** cierre no-`FILLED`, incluidos `EXPIRED` (`TTL_EXPIRED`) y `MISSING` (`VANISHED_ON_EXCHANGE`) |
| `last_error` | `String` | NULL | Error de la cancelación contra el exchange, truncado a 180 |
| `updated_at` | `DateTime @updatedAt` | NOT NULL | — |

**`decision_id` y `position_id` sin FK, a propósito** — mismo criterio que `bot_actions`: la fila es
auditoría y tiene que sobrevivir al borrado de lo que referencia. Un `CASCADE` borraría la evidencia
de por qué se compró; un `SET NULL` la borraría en silencio. `user_id` y `config_id` sí llevan FK con
`CASCADE` porque son datos operativos sin sentido huérfanos.

**Índices:**

| Nombre | Tipo | Columnas | Consulta que sirve |
| --- | --- | --- | --- |
| `pk_entry_orders` | PRIMARY | `id` | — |
| `uk_entry_orders_client_order_id` | UNIQUE | `clientOrderId` | Barrido de huérfanas: resolver un `clientOrderId` del exchange a una fila |
| `idx_entry_orders_config_status` | INDEX | `configId`, `status` | Conteo de `RESTING` por bot (concurrencia) y la reconciliación por config |
| `idx_entry_orders_user_status` | INDEX | `userId`, `status` | Notional comprometido por usuario/activo y EP-017 |
| `idx_entry_orders_status_expires` | INDEX | `status`, `expiresAt` | Barrido de vencidas |

**No se crea un índice único parcial `(configId, symbol) WHERE status = 'RESTING'`** aunque RN-14 lo
pediría a gritos. Motivo: Prisma no modela índices parciales, y una lección vigente del repo dice que
**lo que se crea por SQL crudo y no está en `schema.prisma` lo borra el próximo diff autogenerado** —
tendríamos una garantía que desaparece sola en la próxima migración. La invariante se sostiene por
construcción (cancelar-y-confirmar antes de colocar, §7.1 paso 6) y por un test dedicado.

### 4.3 Máquina de estados

`RESTING` es el **único** estado inicial y el **único** no terminal. Los otros cuatro son absorbentes.

| Desde | Hacia | Disparador | Efecto lateral obligatorio, en orden |
| --- | --- | --- | --- |
| — | `RESTING` | Colocación confirmada por el exchange | Fila creada **después** de la respuesta OK, nunca antes |
| `RESTING` | `FILLED` | `getEntryOrderStatus ⇒ FILLED` (reconciliación o sonda) | (1) si `partial`: cancelar el remanente en el exchange · (2) `Position` + `Trade` · (3) protección inicial · (4) `bot_action` `EXCHANGE_TRIGGER` · (5) fila a `FILLED` con `positionId` |
| `RESTING` | `EXPIRED` | `now >= expiresAt` **y** la consulta del mismo ciclo no confirma fill | Cancelar en el exchange **antes** de marcar `EXPIRED` |
| `RESTING` | `CANCELLED` | Decisión posterior ≠ BUY · `DAILY_LOSS` `DISCARDED` · stop del bot · reemplazo por entrada nueva · barrido de huérfanas | Cancelar en el exchange, confirmar, después transicionar |
| `RESTING` | `MISSING` | La consulta no encuentra la orden (`-2013`) y no hay evidencia de fill ni cancelación propia | **Ninguno**: se persiste el estado, jamás se descarta la fila |

**Precedencia dura: el fill confirmado le gana al vencimiento.** En la reconciliación, la consulta al
exchange va **primero** y el chequeo de TTL después: si la misma pasada ve `FILLED` con el TTL ya
vencido, la fila va a `FILLED` (US-2-008, tercer criterio). Consultar antes de mirar el reloj no es un
detalle de implementación, es lo que hace que esa precedencia sea imposible de romper por accidente.

**`MISSING` no se infiere de la ausencia en `openOrders`.** La única fuente de `MISSING` es un `-2013`
en la consulta **directa** de la orden. Una orden llena tampoco está en `openOrders`, y confundir las
dos cosas convertiría un fill real en una fila descartada — el modo de falla exacto que este ciclo
existe para eliminar (US-2-007, segundo criterio).

### 4.4 `clientOrderId`: prefijo y forma

```
cid = 'ent-' + randomUUID().replace(/-/g, '').slice(0, 24)     // 28 caracteres
```

| Uso | Valor |
| --- | --- |
| `LIMIT_MAKER` suelto | `newClientOrderId = cid` |
| `OCO` — lista | `listClientOrderId = cid` |
| `OCO` — pierna de abajo | `belowClientOrderId = ${cid}-l` (30 caracteres) |
| `OCO` — pierna de arriba | `aboveClientOrderId = ${cid}-s` (30 caracteres) |

**Por qué no `ent-{configId}-...` (el patrón de `prot-{positionId}-{attempt}`):** `newClientOrderId`
tiene un máximo de **36 caracteres** y un `cuid` son 25 — `ent-` + cuid + separador + timestamp da 45
y Binance lo rechaza. Y el id de la fila no se puede usar como semilla porque el `cuid` lo genera
Prisma en el `create`, que ocurre **después** de la colocación (una fila solo nace `RESTING` cuando el
exchange ya confirmó).

**Las dos piernas del OCO llevan `clientOrderId` propio a propósito.** Sin eso, las órdenes que
`GET /api/v3/openOrders` devuelve para el OCO traen el `clientOrderId` que Binance autogenera, no
tiene el prefijo `ent-`, y el barrido de huérfanas no las reconocería como nuestras: una lista OCO
huérfana quedaría viva en el exchange para siempre.

**El prefijo `ent-` es disjunto de `prot-`** y el barrido de huérfanas de entradas es una rutina
**separada** de `sweepOrphanOrders` (que sigue filtrando solo por `prot-`, sin cambios). Las dos
comparten **una sola** llamada a `getOpenOrders(symbol)` (peso 6) por ciclo: se pide una vez y se
recorre dos veces.

### 4.5 Migraciones — **tres archivos, no uno**

| # | Archivo | Contenido |
| --- | --- | --- |
| 1 | `apps/api/prisma/migrations/20260901230000_add_entry_order_bot_action_values/migration.sql` | `ALTER TYPE "BotActionSource" ADD VALUE 'EXCHANGE_TRIGGER';` · `ALTER TYPE "BotActionKind" ADD VALUE 'ENTRY_CANCEL';` |
| 2 | `apps/api/prisma/migrations/20260901230100_add_entry_orders/migration.sql` | Los 4 `CREATE TYPE` nuevos + `CREATE TABLE entry_orders` + índices + FKs |
| 3 | `apps/api/prisma/migrations/20260901230200_add_trading_config_entry_order_columns/migration.sql` | Los 3 `ADD COLUMN` de `trading_configs` |

**Por qué el `ALTER TYPE ... ADD VALUE` va solo, en su propia migración.** Postgres no deja usar un
valor de enum recién agregado dentro de la **misma transacción** que lo agregó, y Prisma corre cada
archivo de migración en una transacción. Si el `ADD VALUE` compartiera archivo con algo que lo use, la
migración falla en producción y no en desarrollo (donde la base suele recrearse). Separarlo cuesta un
archivo y elimina la clase entera de fallo. Es la única razón; las migraciones 2 y 3 podrían ir juntas
pero se separan por el mismo criterio con el que cycle-01 separó `add_reactive_loop_switch` de
`add_action_caps_columns`: un archivo, un cambio.

SQL de la migración 2 (forma exacta, siguiendo el patrón de `20260830120000_add_bot_actions`):

```sql
CREATE TYPE "EntryOrderMode"         AS ENUM ('MARKET','LIMIT_MAKER','OCO');
CREATE TYPE "EntryOrderStatus"       AS ENUM ('RESTING','FILLED','CANCELLED','EXPIRED','MISSING');
CREATE TYPE "EntryOrderLeg"          AS ENUM ('LIMIT','STOP');
CREATE TYPE "EntryOrderCancelReason" AS ENUM ('TTL_EXPIRED','LATER_DECISION','DAILY_LOSS_DISCARDED','BOT_STOPPED','REPLACED_BY_NEW_ENTRY','PARTIAL_FILL_REMAINDER','ORPHAN_SWEEP','VANISHED_ON_EXCHANGE');

CREATE TABLE "entry_orders" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "configId"           TEXT NOT NULL,
  "symbol"             TEXT NOT NULL,
  "asset"              "Asset" NOT NULL,
  "pair"               "QuoteCurrency" NOT NULL,
  "mode"               "TradingMode" NOT NULL,
  "entryMode"          "EntryOrderMode" NOT NULL,
  "status"             "EntryOrderStatus" NOT NULL DEFAULT 'RESTING',
  "quantity"           DOUBLE PRECISION NOT NULL,
  "limitPrice"         DOUBLE PRECISION NOT NULL,
  "stopPrice"          DOUBLE PRECISION,
  "stopLimitPrice"     DOUBLE PRECISION,
  "trailingDeltaBips"  INTEGER,
  "referencePrice"     DOUBLE PRECISION NOT NULL,
  "plannedNotionalUsd" DOUBLE PRECISION NOT NULL,
  "clientOrderId"      TEXT NOT NULL,
  "orderListId"        TEXT,
  "orderId"            TEXT,
  "limitLegOrderId"    TEXT,
  "stopLegOrderId"     TEXT,
  "placedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "decisionId"         TEXT,
  "positionId"         TEXT,
  "filledLeg"          "EntryOrderLeg",
  "executedPrice"      DOUBLE PRECISION,
  "executedQuantity"   DOUBLE PRECISION,
  "settledAt"          TIMESTAMP(3),
  "cancelReason"       "EntryOrderCancelReason",
  "lastError"          TEXT,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entry_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uk_entry_orders_client_order_id" ON "entry_orders" ("clientOrderId");
CREATE INDEX "idx_entry_orders_config_status"  ON "entry_orders" ("configId", "status");
CREATE INDEX "idx_entry_orders_user_status"    ON "entry_orders" ("userId", "status");
CREATE INDEX "idx_entry_orders_status_expires" ON "entry_orders" ("status", "expiresAt");

ALTER TABLE "entry_orders"
  ADD CONSTRAINT "entry_orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entry_orders"
  ADD CONSTRAINT "entry_orders_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "trading_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Migración 3:

```sql
ALTER TABLE "trading_configs"
  ADD COLUMN "entryOrderMode"        "EntryOrderMode" NOT NULL DEFAULT 'MARKET',
  ADD COLUMN "entryOrderTtlMinutes"  INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "entryTrailingDeltaBips" INTEGER;
```

Todo aditivo: cuatro `CREATE TYPE`, dos `ALTER TYPE ADD VALUE`, un `CREATE TABLE` y tres `ADD COLUMN`
con default. **Ninguna migración de `TradingMode`**, ninguna columna existente cambia de tipo.

### 4.6 `BotActionKind` y `BotActionSource`

**`BotActionSource` suma `EXCHANGE_TRIGGER`.** Es el valor que D2-3 de la spec ya decidió: audita algo
que el exchange ejecutó, sin pasar por `authorizeAndRun`.

**`BotActionKind` NO suma un kind para el fill.** Colocación y fill son ambos `kind: BUY`, distinguidos
por `source` (`LLM_CYCLE` vs `EXCHANGE_TRIGGER`) y por `detail` (`ENTRY_PLACED_LIMIT_MAKER` /
`ENTRY_PLACED_OCO` vs `ENTRY_FILLED_LIMIT` / `ENTRY_FILLED_STOP`). Acepto la recomendación del brief y
la fundamento: `classifyActionExposure` mapea `kind ⇒ exposure`, y la exposición de un fill de entrada
**es** `INCREASING`, exactamente igual que la de una compra a mercado. Un kind nuevo con la misma
exposición sería una segunda etiqueta para la misma cosa, y `EP-016` ya expone `source` para
distinguirlas.

**`BotActionKind` SÍ suma `ENTRY_CANCEL`, con exposición `REDUCING`.** Ese es el único kind nuevo, y
sale de una exigencia del funcional que el modelo actual no puede satisfacer de otra forma:

- RN-10 pide que la cancelación defensiva quede en `bot_actions` **con un motivo distinguible**.
- RN-10 y RN-17 piden que **no consuma los caps**.
- `classifyActionExposure('BUY') = INCREASING`: registrar la cancelación como `BUY` diría, en el
  único lugar del sistema que clasifica exposición, que cancelar una compra aumenta exposición.

`EXPOSURE_BY_KIND` es un `Record` exhaustivo, así que agregar el valor **obliga** a declarar su
exposición — que es justo lo que la constitución de `trading-engine` exige al sumar un kind.

**Corolario obligatorio en `getBotActionCounters`** (`bot-action-counters.ts`): el conteo de la ventana
móvil y el `max(occurredAt)` del cooldown pasan a excluir dos cosas:

```
where: {
  configId, outcome: 'EXECUTED', occurredAt: { gte: windowStart },
  source: { not: 'EXCHANGE_TRIGGER' },
  kind:   { not: 'ENTRY_CANCEL' },
}
```

Sin esa exclusión, RN-20 es incumplible: hoy el contador suma **toda** fila `EXECUTED` del config, así
que el fill haría que una misma decisión del bot consumiera el cap dos veces, y la cancelación
defensiva empujaría el cooldown de la próxima acción. La exclusión **no puede relajar ningún cap
vigente**: los dos valores son nuevos, ninguna fila histórica los tiene, y el conteo sobre datos
previos a este ciclo es bit a bit idéntico (CA-001).

---

## 5. D8 — Concurrencia, notional y fallo de protección

### 5.1 Una entrada `RESTING` ocupa un lugar de concurrencia

**Sí, cuenta.** Es exposición comprometida: la orden está viva en el exchange y puede llenarse sin que
el bot intervenga, incluso con el servicio caído. Si no contara, `maxConcurrentPositions: 2` con dos
entradas colocadas y una decisión `BUY` nueva podría terminar en tres posiciones.

**Dónde se lee** (los dos únicos puntos, en `TradingProcessor.executeBuy`, junto al `openCount`
existente de `trading.processor.ts:885`):

```
openCount     = prisma.position.count({ userId, configId, status: 'OPEN', asset, mode })
restingCount  = entryOrders.countResting({ configId, asset, mode })
if (openCount + restingCount >= config.maxConcurrentPositions) return
```

`EntryOrderService.countResting` es el **único** lector de ese conteo. Con la tabla vacía —o sea,
siempre que el interruptor esté en `MARKET`— `restingCount` es `0` y la comparación es idéntica a la
de hoy.

### 5.2 Notional planificado, y la respuesta a la 4.ª pregunta abierta

**Confirmado: el notional planificado de un OCO de entrada es el de UNA sola compra potencial, no la
suma de las dos piernas.** Las dos son mutuamente excluyentes por diseño de Binance (al llenarse una,
la otra se cancela) y el endpoint `orderList/oco` toma **un solo** `quantity` para la lista, no uno por
pierna: sumarlas duplicaría una exposición que el exchange no permite tomar.

**Corrección al supuesto del funcional:** la pregunta habla de "una sola compra potencial" sin decir a
qué precio. Las dos piernas tienen precios distintos y la de arriba es **más cara**. El notional
planificado usa el **peor caso**:

```
plannedNotionalUsd = quantity × (entryMode === 'OCO'
  ? Math.max(limitPrice, stopLimitPrice)
  : limitPrice)
```

Un cap de exposición que se calcula con el precio más barato de dos posibles no es un cap.

**Dónde entra:** en el `plannedNotionalUsd` que `executeBuy` le pasa a
`AggregateRiskService.assertBuyAllowed`, sumado al notional de las entradas `RESTING` que **ya**
existen:

```
plannedNotionalUsd = quantity × worstCasePrice
                   + entryOrders.sumRestingPlannedNotionalUsd({ userId, asset, mode })
```

**`AggregateRiskService` no se toca.** Sigue siendo la única puerta del riesgo agregado y sigue
tomando el notional planificado como **entrada**; lo que cambia es que el llamador ahora le informa
toda la exposición comprometida, no solo la de la orden que está por mandar. Meter `entry_orders`
adentro de `PortfolioContextService.build` habría sido la alternativa —y contamina un servicio que hoy
describe *posiciones*, del que cuelgan la analítica y el contexto del LLM, con filas que no son
posiciones.

**Sizing:** la cantidad se resuelve contra el peor precio también
(`resolveBuySizing(balance, worstCasePrice, …)`), para que el saldo alcance si llena la pierna cara.

### 5.3 Fallo de la protección después del fill — respuesta a la 1.ª pregunta abierta

**La lectura del funcional es correcta y se ratifica: son dos mecanismos distintos y no hay
cancelación de entrada involucrada.**

La frase de D7 "quién cancela una entrada … fallo de protección tras el fill" está mal agrupada en el
brief. Cuando la protección falla, la entrada **ya transicionó a `FILLED`** —estado terminal— y ya
existe una `Position`: no hay ninguna orden de entrada que cancelar, porque la que había se ejecutó.
Lo que corresponde es, palabra por palabra, el camino que ya existe para cualquier compra:

1. `placeProtectionWithRetry` agota sus 3 intentos.
2. `protectionStatus = UNPROTECTED`, `protectionLastError`, notificación `positionUnprotected`, evento
   WS `position:unprotected`.
3. La posición se cierra **solo** si `config.closeOnProtectionFailure` es `true` (default `false`).

Se reusa `ReconciliationService.attemptProtection`, que ya hace exactamente eso — **cero ramas
nuevas**, que es lo que exige US-2-013. La fila de `entry_orders` **no se toca** en este camino: sigue
`FILLED`, con su `positionId`. El origen de la posición no aparece en ninguna condición de este
camino, y esa es la propiedad a testear.

**Lista de motivos de cancelación de una entrada `RESTING`, corregida y cerrada** (los del enum
`EntryOrderCancelReason`): TTL vencido, decisión posterior ≠ BUY, `DAILY_LOSS` `DISCARDED`, stop del
bot, reemplazo por una entrada nueva del mismo bot y símbolo, barrido de huérfanas, y remanente de un
fill parcial. El fallo de protección **no** está en la lista.

### 5.4 Fills parciales — respuesta a la 2.ª pregunta abierta

**Decisión: un fill parcial se trata como fill de la cantidad ejecutada más cancelación del
remanente. No se difiere.**

**Por qué es una posibilidad real de este ciclo, y no un caso teórico.** Una entrada de este ciclo es
`LIMIT_MAKER` —descansa en el book, a veces por horas— y su notional típico es de decenas de USDT.
Que el book se coma una parte y siga de largo es el comportamiento normal de una orden límite; la
diferencia con el resto del surface ya verificado es que ahí las órdenes son `MARKET` (llenan entero
contra el book) o son la OCO de protección (cuya pierna se dispara por precio sobre una cantidad ya
poseída). El supuesto de "llena entero o no llena" no se hereda.

**Por qué "fill de lo ejecutado + cancelar el remanente" y no "sigue `RESTING` por el remanente":**

1. Dejarla `RESTING` significa que existirían **a la vez** una `Position` abierta y una entrada viva
   para el mismo `configId`+símbolo: viola RN-14 y hace que la concurrencia y el notional cuenten
   dos veces la misma intención.
2. La `Position` creada por la parte llena necesita su protección nativa **ya**. Si el remanente
   llena después, la protección quedaría dimensionada por debajo de la cantidad poseída — una
   posición parcialmente desprotegida, que es peor que ninguna de las dos alternativas.
3. Diferirlo significa que el saldo base ejecutado queda sin `Position`: **es exactamente el modo de
   falla que este ciclo existe para cerrar**, reintroducido por la puerta de atrás.

**Orden obligatorio: cancelar el remanente PRIMERO, crear la `Position` después.** Si se crea primero
y el remanente llena mientras tanto, hay un segundo fill sin registro y sin protección. El orden
completo está en §7.2, paso 5.

**Caso borde declarado:** si la cantidad ejecutada queda por debajo de `LOT_SIZE.minQty` o su notional
por debajo de `minNotional`, la protección nativa es **imposible de colocar** (el cliente la rechaza
localmente con `LOT_SIZE`/`MIN_NOTIONAL`). Eso no es una rama nueva: es el camino de §5.3 con
`protectionStatus = UNPROTECTED`, su notificación y su evento. La `Position` se crea igual, porque el
saldo ejecutado existe y esconderlo sería peor.

---

## 6. Resolución del nivel de entrada — función pura en `libs/trading-engine`

Archivo nuevo: `libs/trading-engine/src/lib/entry-levels.ts`, exportado por el barrel.

```ts
export interface EntryLevelInput {
  mode: RestingEntryMode;
  referencePrice: number;
  support: number[];
  resistance: number[];
  orderPriceOffsetPct: number;
}

export type EntryLevelSource = 'SUPPORT' | 'RESISTANCE' | 'OFFSET_FALLBACK';

export interface EntryLevelPlan {
  mode: RestingEntryMode;
  limitPrice: number;
  limitSource: EntryLevelSource;
  stopPrice: number | null;
  stopSource: EntryLevelSource | null;
  degradedFromOco: boolean;
}

export function resolveEntryLevels(input: EntryLevelInput): EntryLevelPlan | null;
```

**Reglas, en orden:**

1. `limitPrice` = **el soporte más cercano estrictamente por debajo** de `referencePrice`:
   `max{ s ∈ support : s < referencePrice }`. `limitSource = 'SUPPORT'`.
2. Si no hay ninguno (lista vacía, o todos `>= referencePrice`): fallback
   `referencePrice × (1 + orderPriceOffsetPct)`, **usable solo si `orderPriceOffsetPct < 0`**.
   `limitSource = 'OFFSET_FALLBACK'`.
3. Si el fallback no es usable ⇒ **`null`**. Sin `limitPrice` no hay entrada, ni siquiera degradada.
4. `mode === 'OCO'`: `stopPrice` = **la resistencia más cercana estrictamente por encima**:
   `min{ r ∈ resistance : r > referencePrice }`. `stopSource = 'RESISTANCE'`.
5. Si no hay ninguna: fallback `referencePrice × (1 − orderPriceOffsetPct)`, usable solo si
   `orderPriceOffsetPct < 0`. `stopSource = 'OFFSET_FALLBACK'`.
6. Si el fallback de la pierna de arriba no es usable ⇒ **se degrada a `LIMIT_MAKER`**:
   `mode: 'LIMIT_MAKER'`, `stopPrice: null`, `degradedFromOco: true`.
7. Invariante de salida, verificada por la propia función:
   `limitPrice < referencePrice` y, si hay `stopPrice`, `referencePrice < stopPrice`. Si no se
   cumple (valores no finitos, `referencePrice <= 0`, aritmética degenerada) ⇒ `null`.
8. **No redondea nada.** El ajuste al `tickSize` es del cliente (§2.5), que es el único que conoce los
   filtros del símbolo. La lib no habla con el exchange.

`stopLimitPrice` **no** lo calcula esta función: sale de `stopPrice × (1 + config.stopLimitOffsetPct)`
en el llamador, porque `stopLimitOffsetPct` es política de la config, no del nivel.

### Dos correcciones al funcional que esta función materializa

**(a) El signo del offset del fallback estaba invertido en RN-3.** RN-3 escribe
`precio × (1 − orderPriceOffsetPct)`. La convención de signo vigente en el repo es la opuesta:
`orderPriceOffsetPct` **negativo = por debajo del mercado** (DTO `trading-config.dto.ts:186-199` y
`trading.processor.ts:905`, `livePrice = marketPrice * (1 + offsetPct)`). Con la fórmula de RN-3 y un
offset de `−0.01`, el "fallback por debajo" da `precio × 1.01`: **por encima** del mercado, es decir,
un `LIMIT_MAKER` BUY que Binance rechaza con `-2010` [probe #7]. La fórmula correcta es
`referencePrice × (1 + orderPriceOffsetPct)` — la misma que el processor ya usa.

**(b) Con el default `orderPriceOffsetPct = 0` el fallback no existe, y el bot NO compra a mercado.**
Un offset de cero da `limitPrice === referencePrice`, que viola el `LIMIT_MAKER`. Las tres salidas
posibles eran: inventar un offset mínimo (0.1 %), caer a la compra a mercado, o no colocar nada. Se
elige **no colocar nada** y devolver `null`:

- Inventar un offset es fijar un parámetro de riesgo sin que el trader lo pida.
- Caer a mercado es **hacer algo distinto de lo que el trader configuró**, a peor precio: el trader
  pidió descansar en un nivel, no comprar ya.
- Devolver `null` hace que el ciclo no compre y que el próximo recalcule los niveles con velas
  frescas. El costo es una oportunidad perdida; el beneficio es que el sistema nunca opera fuera de
  lo configurado.

Con `null`, `executeBuy` retorna sin colocar, **sin** tocar `authorizeAndRun` (nada llegó a la puerta,
así que no hay fila en `bot_actions` — un cap no bloqueó nada) y emitiendo el evento WS
`entry-order:skipped` con `reason: 'NO_USABLE_LEVEL'`, para que el silencio sea observable.

### Precio de referencia

`referencePrice` para la resolución de niveles es el **precio de mercado crudo** (`currentPrice`:
ticker en `LIVE`, cierre de la última vela en `TESTNET`), **no** el `referencePrice` con offset que
`executeBuy` calcula hoy para el sizing. Aplicarle el offset y después buscar el soporte "por debajo"
de un precio ya desplazado aplicaría el offset dos veces.

---

## 7. Contratos de secuencia

### 7.1 (a) Camino de BUY del processor con `entryOrderMode != MARKET`

Precondición: `mode ∈ {LIVE, TESTNET}`, credenciales presentes, decisión `BUY` con
`confidence ≥ buyThreshold`. En `SANDBOX` esta rama **no existe**: se ejecuta la compra a mercado de
hoy sin mirar `entryOrderMode` (RN-22).

1. `openCount + restingCount >= maxConcurrentPositions` ⇒ retorna (§5.1).
2. `currentPrice = cachedPrice ?? executor.getPrice(symbol)`.
3. `plan = resolveEntryLevels({ mode: config.entryOrderMode, referencePrice: currentPrice, support,
   resistance, orderPriceOffsetPct })`, con `support`/`resistance` del `IndicatorSnapshot` del ciclo.
   `plan === null` ⇒ evento `entry-order:skipped` y retorna (§6).
4. `stopLimitPrice = plan.stopPrice != null ? plan.stopPrice × (1 + config.stopLimitOffsetPct) : null`.
   `worstCasePrice = max(plan.limitPrice, stopLimitPrice ?? plan.limitPrice)`.
5. `sizing = resolveBuySizing(quoteBalance.free, worstCasePrice, config, decisionContext)`.
   `sizing.blockedBy` o `quantity <= 0` ⇒ retorna (comportamiento vigente, sin cambios).
6. **Reafirmación idempotente / reemplazo.** Se busca la entrada `RESTING` del mismo `configId`+símbolo:
   - Existe, con el mismo `entryMode` y los mismos `limitPrice`/`stopPrice`, y no vencida ⇒ **no se
     hace nada**: no se cancela, no se coloca, no se consume cap, no se escribe `bot_actions`. El
     bot está reafirmando la misma orden que ya está viva.
   - Existe y difiere (nivel distinto, modo distinto, o vencida) ⇒ `cancelEntryOrder` en el exchange,
     **confirmar**, transicionar a `CANCELLED` con `REPLACED_BY_NEW_ENTRY`, y recién después seguir.
     Si la cancelación falla, se **aborta la colocación** y se registra `lastError`: dos entradas vivas
     para el mismo bot y símbolo es exactamente lo que RN-14 prohíbe.
7. `aggregateRiskService.assertBuyAllowed({ userId, asset, mode, plannedNotionalUsd })` con el notional
   de §5.2. `!allowed` ⇒ notificación `aggregateRiskBlocked` y retorna (camino vigente, sin cambios).
8. `cid = 'ent-' + …` (§4.4).
9. **`actionGate.authorizeAndRun({ kind: 'BUY', source: 'LLM_CYCLE', positionId: null, decisionId,
   expected: null, detail: 'ENTRY_PLACED_' + plan.mode }, execute)`** — la **única** puerta, la misma
   que usa la compra a mercado. Dentro de `execute`:
   1. `result = executor.placeEntryOrder({ mode, symbol, quantity, limitPrice, referencePrice:
      currentPrice, stopPrice, stopLimitPrice, trailingDeltaBips, clientOrderId: cid })`.
   2. `prisma.entryOrder.create({ status: 'RESTING', … , expiresAt: placedAt +
      config.entryOrderTtlMinutes × 60_000 })` — **después** de la respuesta del exchange.
   3. `notificationsService.create(TRADE_EXECUTED, { key: 'entryOrderPlaced', … })`.
   4. `gateway.emitToUser(userId, 'entry-order:placed', …)`.
10. Si el gate devuelve `BLOCKED` con `blockedBy === 'DAILY_LOSS'` ⇒ cancelación defensiva de todas las
    entradas `RESTING` del bot (§7.3-c2). El resto de los outcomes se loguean igual que hoy.

**Nada de esto ocurre con `entryOrderMode === 'MARKET'`:** el `if` que ramifica es lo primero del
bloque `LIVE`/`TESTNET` y con el default cae al camino de hoy sin evaluar ninguno de estos pasos
(CA-001).

### 7.2 (b) Reconciliación de las entradas al inicio del ciclo

`ReconciliationService.reconcile` suma un paso, **antes** del barrido de huérfanas (necesita haber
resuelto qué está vivo) y **después** de la reconciliación de posiciones protegidas. Toda la lógica de
liquidación vive en `EntryOrderService`; `ReconciliationService` orquesta.

1. `resting = prisma.entryOrder.findMany({ configId, status: 'RESTING' })`. Vacío ⇒ el paso entero se
   saltea sin ninguna llamada al exchange (CA-001: con el interruptor apagado nunca hay filas).
2. Si `aggregateRisk.evaluateDailyLoss({ userId, mode }).reached` ⇒ cancelar **todas** con
   `DAILY_LOSS_DISCARDED` (§7.3-c2) y terminar el paso.
3. Para cada entrada, **en este orden**:
   1. `status = executor.getEntryOrderStatus(symbol, ref)` — **la consulta va primero, siempre**, para
      que un fill le gane al vencimiento.
   2. `status.state === 'FILLED'` ⇒ **liquidación** (paso 5).
   3. `status.state === 'RESTING'` y `now >= expiresAt` ⇒ `cancelEntryOrder`, confirmar,
      `EXPIRED` + `TTL_EXPIRED` + `settledAt`, evento `entry-order:expired`. Si la cancelación falla:
      la fila **queda `RESTING`** con `lastError`, para reintentar el ciclo próximo — marcarla
      `EXPIRED` con la orden viva en el exchange sería perder de vista una orden que puede disparar.
   4. `status.state === 'RESTING'` y no vencida ⇒ se agrega su `clientOrderId` (y los de sus piernas)
      al set de vivas del barrido, y nada más.
   5. `status.state === 'CANCELLED'` ⇒ fila a `CANCELLED` + `settledAt`, evento
      `entry-order:cancelled`. El `cancelReason` se conserva si ya venía seteado (la cancelación fue
      nuestra y esta pasada solo la confirma); si estaba en `null`, se escribe `VANISHED_ON_EXCHANGE`
      — la orden la canceló alguien que no fuimos nosotros.
   6. `status.state === 'MISSING'` ⇒ `MISSING` + `VANISHED_ON_EXCHANGE` + `settledAt`, evento
      `entry-order:missing`, notificación `AGENT_ERROR` `entryOrderMissing`. **No se descarta la fila.**
4. Barrido de huérfanas de entradas (§7.2-bis).
5. **Liquidación de un fill** (`EntryOrderService.settleFill`, la **única** implementación; la sonda
   por tick de §3 llama a este mismo método):
   1. Si `status.partial` ⇒ `cancelEntryOrder(symbol, ref)` para matar el remanente. **Antes de todo lo
      demás** (§5.4). Si falla, se aborta la liquidación y se reintenta el ciclo próximo: la fila queda
      `RESTING` con `lastError`.
   2. `claimed = prisma.entryOrder.updateMany({ where: { id, status: 'RESTING' }, data: { status:
      'FILLED', filledLeg, executedPrice, executedQuantity, settledAt } })`. **`claimed.count === 0`
      ⇒ se corta**: otra pasada (o la otra réplica) ya liquidó esta entrada. Es la misma transición
      condicional que `closeFilledByExchange` usa para ser idempotente — nunca un conteo de trades.
   3. `positionData = positionManager.openPosition({ entryPrice: executedPrice, quantity:
      executedQuantity, … })` y `prisma.position.create` con `protectionStatus: 'PENDING'`,
      `stopPrice`, `takeProfitPrice`, `highWaterPrice`, `initialQuantity` cuando
      `nativeProtectionEnabled`, exactamente igual que `executeBuy` (`trading.processor.ts:1109-1120`).
   4. `prisma.trade.create({ type: 'BUY', price: executedPrice, quantity: executedQuantity, fee:
      executedPrice × executedQuantity × TRADE_FEE_PCT, binanceOrderId: status.orderId, decisionId:
      null })`. **`decisionId: null`** — mismo criterio que toda la reconciliación: lo ejecutó el
      exchange (RN-15).
   5. `prisma.entryOrder.update({ positionId })`.
   6. `prisma.botAction.create({ kind: 'BUY', source: 'EXCHANGE_TRIGGER', outcome: 'EXECUTED',
      blockedBy: null, positionId, decisionId: entryOrder.decisionId, detail: 'ENTRY_FILLED_' +
      filledLeg })`. **Sin `authorizeAndRun`**: ya ocurrió, no hay nada que autorizar ni bloquear
      (D2-3).
   7. Protección inicial si `nativeProtectionEnabled`, por `attemptProtection` (el camino existente,
      con `placeProtectionWithRetry` y `clientOrderIdFor: prot-{positionId}-{attempt}`). El fallo se
      maneja según §5.3, sin ramas nuevas.
   8. Notificación `TRADE_EXECUTED` `entryOrderFilled` + evento `entry-order:filled`.

**El paso 5 es idéntico para un `LIMIT_MAKER` suelto y para cualquiera de las dos piernas de un OCO**
(US-2-012, tercer criterio): lo único que cambia es `filledLeg`, que **se lee** de la consulta, nunca
se asume.

### 7.2-bis Barrido de huérfanas de entradas

Rutina **separada** de `sweepOrphanOrders`, sobre la **misma** respuesta de `getOpenOrders(symbol)`
(una sola llamada, peso 6, recorrida dos veces):

1. `liveEntryCids` = `clientOrderId` de **todas** las filas `RESTING` del mismo `userId`+`symbol`,
   **de cualquier config** — mismo criterio que `addExternalLiveOrderIds` para la protección: barrer
   la entrada viva de otro bot del mismo usuario sería un bug, no una limpieza.
2. Para cada orden abierta con `clientOrderId.startsWith('ent-')`: se normaliza el sufijo de pierna
   (`-l` / `-s`) y, si el `cid` resultante **no** está en `liveEntryCids` ⇒
   `cancelEntryOrder(symbol, { orderListId: order.orderListId, orderId: order.orderId })`.
3. Un fallo de cancelación se loguea y no corta el barrido (mismo criterio que el barrido vigente).

Órdenes con prefijo `prot-` las sigue tratando `sweepOrphanOrders`, sin cambios. Una orden sin ninguno
de los dos prefijos **no se toca**: puede ser del trader.

### 7.3 (c) Disparadores de cancelación

Todos convergen en `EntryOrderService.cancelResting({ configId | ids, executor, symbol, reason })`,
que por cada fila: cancela en el exchange → confirma → `status: 'CANCELLED'` + `cancelReason` +
`settledAt` → evento `entry-order:cancelled`, y deja **una** fila `bot_actions`
`{ kind: 'ENTRY_CANCEL', source, outcome: 'EXECUTED', detail: reason }`.

> **Corrección del orquestador (2026-09-01) sobre la primera redacción de esta sección.** Las
> cancelaciones que el **bot decide** —c1, c1', c2 y c3 de la tabla— **sí pasan por
> `ActionGateService.authorizeAndRun`** con `kind: 'ENTRY_CANCEL'`: es la única puerta de toda acción
> automática (constitución de `apps/api` §3.1 y brief `harness_rules`) y es la que toma el lease
> `rx:v1:bot:{configId}`, que serializa la cancelación contra un fill que la sonda por tick pueda
> estar liquidando en la otra réplica. Como `ENTRY_CANCEL` es `REDUCING`, la puerta la deja pasar
> **antes de mirar cap alguno** (`REDUCING_EXPOSURE_EXEMPT`) y es la propia puerta la que escribe la
> fila de `bot_actions`; `cancelResting` no escribe una segunda. Por §4.6 esa fila no alimenta los
> contadores. Lo que **no** pasa por la puerta es lo que la reconciliación **observa o limpia** sin
> decidir nada: el vencimiento por TTL (§7.2 paso 3.3), la confirmación de una cancelación ajena
> (`VANISHED_ON_EXCHANGE`), `MISSING` y el barrido de huérfanas (c4) — ahí `cancelResting` escribe la
> fila directamente (`source: 'LLM_CYCLE'`, `detail: reason`), salvo c4, que no tiene fila que auditar.
> En `executeBuy`, la cancelación defensiva c2 ocurre **después** de que el primer `authorizeAndRun`
> devolvió `BLOCKED` y liberó el lease: es una segunda llamada a la puerta, no una llamada anidada.

| # | Disparador | Dónde | `cancelReason` | `source` de la fila |
| --- | --- | --- | --- | --- |
| c1 | Decisión posterior ≠ `BUY` (o `BUY` bajo umbral) sobre el mismo `configId`+símbolo | `TradingProcessor.runCycle`, paso nuevo **después** de persistir la `AgentDecision` y **antes** de las ramas de ejecución; solo `LIVE`/`TESTNET` con credenciales | `LATER_DECISION` | `LLM_CYCLE` |
| c1' | Decisión `BUY` que coloca una entrada con nivel/modo distinto | `executeBuy`, §7.1 paso 6 | `REPLACED_BY_NEW_ENTRY` | `LLM_CYCLE` |
| c2 | Cap de pérdida diaria `DISCARDED` | Dos puntos, mismo método: `ReconciliationService` (§7.2 paso 2, corre siempre) y `executeBuy` cuando el gate devuelve `blockedBy: 'DAILY_LOSS'` (§7.1 paso 10, mismo ciclo) | `DAILY_LOSS_DISCARDED` | `LLM_CYCLE` |
| c3 | Stop del bot | `TradingService.stopAgentById`, **después** de `isRunning: false` y **antes** de vaciar la cola | `BOT_STOPPED` | `LLM_CYCLE` |
| c4 | Orden con prefijo `ent-` sin fila `RESTING` | §7.2-bis | `ORPHAN_SWEEP` | — (no genera `bot_actions`: no hay fila que auditar) |

**Sobre c1:** la cancelación es un paso propio porque hoy `HOLD` **no tiene rama de ejecución** en el
processor — sin un paso explícito, la decisión más común del sistema no cancelaría nada. La condición
es "este ciclo no va a colocar una entrada para este símbolo", que cubre `HOLD`, `SELL` y un `BUY` por
debajo del umbral de confianza.

**Sobre c3:** `stopAgentById` hoy no construye ningún executor ni resuelve credenciales. Para cancelar
necesita ambos: resuelve `binanceCredential` por `userId_isTestnet` y arma
`LiveOrderExecutor(new BinanceRestClient(...))`, igual que el processor. Si **no hay credenciales o la
cancelación falla**, el stop **igual procede** (el bot se detiene) y cada fila queda `RESTING` con
`lastError`; la orden sigue viva en el exchange y la próxima reconciliación —o el barrido de
huérfanas— la levanta. Detener el bot nunca puede quedar bloqueado por el exchange. **`stopAgentById`
no toca la protección nativa de posiciones abiertas** (US-2-011, segundo criterio): solo entradas.

`stopAgentsByModeForUser`, `stopAllAgentsForUser` y `stopAllAgents` recorren configs y llaman al mismo
método por config — están en la lista de lectores de §11.

### 7.4 (d) Sonda de fill por tick (D6, detalle ejecutable)

`EntryFillWatchService` en `src/reactive/`, suscripto a `MarketStreamService.on('tick')` igual que
`FastPathService`:

1. `marketStream.isWarmupComplete(tick.symbol)` falso ⇒ retorna (mismo criterio que el fast path).
2. Configs activas con `reactiveLoopEnabled: true` para ese símbolo, con el mismo caché de
   `symbolRefreshIntervalMs` que ya usa `FastPathService`.
3. Entradas `RESTING` de esas configs, cacheadas con el mismo TTL e invalidadas al liquidar.
4. Para cada entrada: `leg = tick.price <= limitPrice ? 'LIMIT' : (stopPrice != null && tick.price >=
   stopPrice ? 'STOP' : null)`. `leg === null` ⇒ nada.
5. Debounce: `now − lastProbeAt[(entryOrderId, leg)] < entryFillProbeDebounceMs` ⇒ nada.
6. `status = executor.getEntryOrderStatus(symbol, ref, { leg })` — peso 4.
7. `status.state === 'FILLED'` ⇒ `entryOrderService.settleFill(...)`, el **mismo** método de §7.2
   paso 5, con su transición condicional haciendo la deduplicación contra la reconciliación.
8. Cualquier otro estado ⇒ solo actualiza el debounce. La sonda **nunca** vence, cancela ni marca
   `MISSING`: esas transiciones son de la reconciliación. La sonda solo adelanta el fill.

### 7.5 (e) Concurrencia y notional — resumen de puntos de lectura

| Regla | Lector | Cambio |
| --- | --- | --- |
| `maxConcurrentPositions` | `TradingProcessor.executeBuy` (`trading.processor.ts:885`) | `openCount + entryOrders.countResting(...)` |
| `maxConcurrentPositions` | `RiskBudgetService.assess` → `countOpenPositions` | Suma las `RESTING` del mismo scope (§11) |
| Notional comprometido | `TradingProcessor.executeBuy` → `assertBuyAllowed` | `+ entryOrders.sumRestingPlannedNotionalUsd(...)` |
| Deja de contar | Toda transición terminal | `countResting`/`sumResting…` filtran `status: 'RESTING'`: `FILLED`, `CANCELLED`, `EXPIRED` y `MISSING` dejan de contar **por construcción**, sin código extra |
| Nunca cuentan las dos | `FILLED` crea la `Position` en la **misma** liquidación que saca la fila de `RESTING` | La transición condicional del paso 5.2 garantiza que no haya un instante con las dos contando |

---

## 8. Configuración nueva de `TradingConfig`

Tres columnas, y solo tres.

| Campo | Tipo Prisma | Default | Rango DTO | Rol |
| --- | --- | --- | --- | --- |
| `entryOrderMode` | `EntryOrderMode` | `MARKET` | `MARKET \| LIMIT_MAKER \| OCO` | Interruptor de la capa entera |
| `entryOrderTtlMinutes` | `Int` | `120` | `5..1440` | Vida máxima de una entrada sin fill |
| `entryTrailingDeltaBips` | `Int?` | `null` | `10..2000`, opcional | `trailingDelta` de la pierna de ruptura del OCO |

### Respuesta a la 3.ª pregunta abierta: default y rango del TTL

**Default `120` minutos.** El nivel de entrada sale de `calculateSupportResistance` sobre velas de
**1 h** (`getKlines('1h', 200)`): dos velas es el horizonte en que ese nivel sigue siendo
contemporáneo del análisis que lo produjo. Más corto haría vencer entradas antes de que el mercado
tenga chance de llegar; más largo dejaría vivas órdenes atadas a un escenario que el propio sistema ya
dejó de creer (cycle-01 fijó 90 minutos como la guarda de envejecimiento de esos mismos niveles para
eventos materiales — 120 es el mismo orden de magnitud, redondeado a la vela).

**Rango `5..1440`.** El piso de 5 minutos es el `minIntervalMinutes` mínimo: un TTL más corto que el
ciclo más rápido haría que **toda** entrada venza antes de que ningún ciclo pueda observarla — un
valor que garantiza que la feature no funcione no debe ser aceptable. El techo de 1440 (24 h) es el
horizonte máximo para el que un soporte de velas de 1 h todavía es defendible; más allá, el trader
está dejando una orden viva contra un mercado que ya no es el que analizó.

**`entryTrailingDeltaBips` en `10..2000`** por el filtro `TRAILING_DELTA` medido en TESTNET para
BTCUSDT. **El DTO no es la validación real**: el rango vive en el símbolo y puede diferir, así que el
cliente lo revalida contra el filtro vigente antes de firmar (§2.7). El rango del DTO es una guarda de
usabilidad, no la fuente de verdad.

### DTO — `class-validator` exacto, en **Create y Update**

Un campo declarado en uno solo hace que el request entero responda **400** por
`forbidNonWhitelisted: true`. Los tres van en `CreateTradingConfigDto` **y** en
`UpdateTradingConfigDto`, con el mismo bloque:

```ts
export enum EntryOrderModeEnum {
  MARKET = 'MARKET',
  LIMIT_MAKER = 'LIMIT_MAKER',
  OCO = 'OCO',
}

@ApiPropertyOptional({
  enum: EntryOrderModeEnum,
  example: EntryOrderModeEnum.MARKET,
  description:
    'Modo de la orden de entrada. MARKET = compra a mercado (comportamiento actual). ' +
    'LIMIT_MAKER = entrada descansando en el soporte. OCO = soporte + ruptura. ' +
    'Se ignora en modo SANDBOX.',
})
@IsEnum(EntryOrderModeEnum)
@IsOptional()
entryOrderMode?: EntryOrderModeEnum;

@ApiPropertyOptional({
  minimum: 5,
  maximum: 1440,
  example: 120,
  description: 'Minutos desde placedAt tras los que una entrada sin fill vence y se cancela',
})
@IsInt({ message: 'TTL de la entrada debe ser un entero' })
@Min(5, { message: 'TTL de la entrada debe ser al menos $constraint1 minutos' })
@Max(1440, { message: 'TTL de la entrada no puede superar $constraint1 minutos (24hs)' })
@IsOptional()
entryOrderTtlMinutes?: number;

@ApiPropertyOptional({
  minimum: 10,
  maximum: 2000,
  example: 100,
  description:
    'trailingDelta en BIPS de la pierna de ruptura del OCO de entrada (100 = 1%). ' +
    'Omitirlo deja la pierna en nivel fijo. El rango real lo fija el filtro TRAILING_DELTA del símbolo.',
})
@IsInt({ message: 'Trailing delta de entrada debe ser un entero en BIPS' })
@Min(10, { message: 'Trailing delta de entrada debe ser al menos $constraint1 BIPS' })
@Max(2000, { message: 'Trailing delta de entrada no puede superar $constraint1 BIPS' })
@IsOptional()
entryTrailingDeltaBips?: number;
```

`TradingService.createConfig` suma los tres a `DEFAULTS` y al objeto de creación;
`updateConfig` los suma a la comparación de "config sin cambios" y al `data` del update — los dos
lugares, o un cambio de modo no persiste.

---

## 9. Contratos de API, WebSocket y notificaciones

### 9.1 Endpoint nuevo — EP-017 `GET /trading/entry-orders`

| | |
| --- | --- |
| Auth | `Authorization: Bearer <jwt>`, `@Roles('TRADER')`, scope estricto por `entry_orders.userId` |
| Query | `configId?` · `status?` (`RESTING\|FILLED\|CANCELLED\|EXPIRED\|MISSING`) · `since?` (ISO-8601, `placedAt >=`) · `limit?` (1..200, default 50) · `cursor?` (id) |
| 200 | `{ items: [{ id, configId, symbol, mode, entryMode, status, quantity, limitPrice, stopPrice, stopLimitPrice, trailingDeltaBips, referencePrice, plannedNotionalUsd, clientOrderId, orderListId, orderId, placedAt, expiresAt, filledLeg, executedPrice, executedQuantity, positionId, cancelReason, settledAt }], nextCursor: string\|null }` |
| 401 | JWT ausente o inválido |

**Decisión: endpoint propio, no se embebe en EP-008 `GET /trading/positions`.** Una entrada
descansando **no es una posición**: no tiene P&L, ni protección, ni `exitReason`, y su ciclo de vida es
otro. Embeberla obligaba a una de dos cosas malas: mezclar filas heterogéneas en una colección
paginada por `entryAt` (rompiendo el paginado de los clientes actuales), o colgar un array paralelo de
una respuesta paginada, donde `total`/`page` dejarían de describir el contenido. Además `apps/web`
declara **su propia interfaz** del response de posiciones, así que todo campo nuevo ahí es una ruptura
silenciosa que el typecheck del monorepo no detecta (lección vigente del repo). Un recurso propio no
toca nada de lo existente. La forma (cursor + filtros) copia EP-016, el endpoint más reciente del
mismo módulo.

`ListEntryOrdersDto` es una **clase con decoradores** (un `@Query()` tipado inline desactiva el
`ValidationPipe` global en silencio: el pipe hace short-circuit cuando el metatype es `Object`).

### 9.2 Endpoints modificados

| ID | Cambio | Status |
| --- | --- | --- |
| **EP-006** `POST /trading/config` | Acepta `entryOrderMode?`, `entryOrderTtlMinutes?`, `entryTrailingDeltaBips?` | `updated`, `updated_in_cycle: 2` |
| **EP-007** `PUT /trading/config/{id}` | Idem | `updated`, `updated_in_cycle: 2` |

**EP-008 `GET /trading/positions` no cambia.** Ni un campo.

### 9.3 Eventos WebSocket (no van a `api.json`)

Todos por `emitToUser(userId, …)`. Los cinco primeros son **distinguibles entre sí** (US-2-016).

| Evento | Cuándo | Payload |
| --- | --- | --- |
| `entry-order:placed` | Colocación confirmada | `{ configId, entryOrderId, symbol, entryMode, limitPrice, stopPrice, stopLimitPrice, trailingDeltaBips, quantity, plannedNotionalUsd, placedAt, expiresAt }` |
| `entry-order:filled` | Liquidación de un fill | `{ configId, entryOrderId, symbol, positionId, filledLeg, executedPrice, executedQuantity, partial }` |
| `entry-order:expired` | TTL vencido y cancelada | `{ configId, entryOrderId, symbol, placedAt, expiresAt }` |
| `entry-order:cancelled` | Cualquier cancelación | `{ configId, entryOrderId, symbol, cancelReason }` |
| `entry-order:missing` | La orden desapareció del exchange | `{ configId, entryOrderId, symbol, orderListId, orderId }` |
| `entry-order:skipped` | No hubo nivel utilizable (§6) | `{ configId, symbol, entryMode, reason: 'NO_USABLE_LEVEL' }` |

### 9.4 Notificaciones

Sin valores nuevos en `NotificationType` (el enum es de Prisma y de `libs/shared`; sumarle un valor
sería otro `ALTER TYPE` para tres mensajes).

| Momento | `NotificationType` | `key` |
| --- | --- | --- |
| Colocación | `TRADE_EXECUTED` | `entryOrderPlaced` |
| Fill liquidado | `TRADE_EXECUTED` | `entryOrderFilled` |
| `MISSING` | `AGENT_ERROR` | `entryOrderMissing` |

`EXPIRED` y `CANCELLED` **no** generan notificación: son el curso normal de la vida de una entrada y
notificarlos sería ruido. Quedan observables por WS y por EP-017, que es lo que RN-24 pide
("notificación **y/o** evento WS").

Las tres `key` necesitan entrada en `apps/web/src/locales/{es,en}.ts` para renderizar; está listado en
§11 como deuda declarada (la UI está fuera de alcance por el `out_of_scope` del brief, y el repo ya
tiene el precedente de `positionUnprotected` sin traducción).

---

## 10. D9 — Harness TESTNET

### Ubicación y gate

**Archivo: `libs/data-fetcher/src/lib/binance/binance-rest.client.testnet.spec.ts`.**

**Por qué en `libs/data-fetcher` y no en `apps/api`.** Lo que el harness verifica es el **payload del
cliente contra el exchange real**: la unidad bajo prueba es `BinanceRestClient`. En `apps/api`
arrastraría el bootstrap de Nest, Prisma y el `.env` de la app para probar algo que no depende de
ninguno de los tres, y quedaría a un import de distancia de tocar una config real.

```ts
const TESTNET_E2E_ENABLED = process.env['BINANCE_TESTNET_E2E'] === '1';
const describeTestnet = TESTNET_E2E_ENABLED ? describe : describe.skip;
```

Sin `BINANCE_TESTNET_E2E=1` el bloque entero se saltea: **CI nunca llama al exchange** y una corrida
local normal tampoco.

### Credenciales y guarda de aborto

- Lee **únicamente** `BINANCE_API_TESTNET_KEY` y `BINANCE_API_TESTNET_SECRET`. Ninguna variable de
  credencial LIVE se nombra en el archivo — es una propiedad verificable por grep sobre **un archivo
  concreto**, no un string-match entre dos símbolos.
- Si el gate está activo y falta alguna de las dos ⇒ el harness **falla** (no se saltea): pedir la
  corrida y no correrla es peor que no pedirla.
- Cliente: `new BinanceRestClient({ apiKey, apiSecret, testnet: true })`.
- **Guarda de aborto en `beforeAll`:** `expect(client.getBaseUrl()).toBe('https://testnet.binance.vision')`
  y, si no coincide, `throw` antes de cualquier colocación.

`getBaseUrl(): string` es un getter público nuevo en `BinanceRestClient` que devuelve
`this.client.defaults.baseURL`. **Es necesario:** una guarda que recalcula la URL esperada a partir de
la misma constante que está custodiando no prueba nada; tiene que leer la URL **resuelta** de la
instancia real.

### Escenarios

Símbolo `BTCUSDT`, `quantity` mínima que supere `minNotional` (≈ 0.0002 con el precio de la corrida),
`clientOrderId` con prefijo `ent-e2e-`. `ref = getTickerPrice('BTCUSDT')` al empezar.

| # | Escenario | Colocación | Consulta | Cancelación |
| --- | --- | --- | --- | --- |
| S1 | `LIMIT_MAKER` BUY muy por debajo | `price = ref × 0.6` | `getEntryOrderStatus ⇒ RESTING` | `cancelEntryOrder` |
| S2 | `STOP_LOSS_LIMIT` BUY con `trailingDelta` y `stopPrice` | `stopPrice = ref × 1.4`, `price = stopPrice × 1.001`, `trailingDeltaBips = 100` | `RESTING` | `cancelEntryOrder` |
| S3 | `STOP_LOSS_LIMIT` BUY con `trailingDelta` **sin** `stopPrice` | `stopPrice = null`, `trailingDeltaBips = 100` | `RESTING` | `cancelEntryOrder` |
| S4 | OCO BUY sin trailing | `belowPrice = ref × 0.6`, `aboveStopPrice = ref × 1.4`, `abovePrice = aboveStopPrice × 1.001` | `RESTING`, dos piernas | `cancelEntryOrder` por `orderListId` |
| S5 | OCO BUY con `aboveTrailingDeltaBips = 100` | igual a S4 + trailing | `RESTING` | idem |
| S6 | **Rechazo local** — `trailingDeltaBips = 5` (bajo el mínimo real del símbolo) | — | `rejects.toThrow(OrderValidationError)` con `code === 'TRAILING_DELTA'` | — |
| S7 | **Rechazo local** — `LIMIT_MAKER` BUY con `price = ref × 1.05` | — | `rejects` con `code === 'PRICE_CROSSES_MARKET'` | — |
| S8 | Cierre | — | `getOpenOrders('BTCUSDT')` filtrado por `clientOrderId.startsWith('ent-e2e-')` ⇒ **longitud 0** | — |

**Los precios son múltiplos del precio de la corrida, no constantes.** `ref × 0.6` y `ref × 1.4` están
lo bastante lejos como para que nada se llene durante la corrida, y siguen siendo válidos aunque
BTCUSDT valga otra cosa el día que el reviewer lo ejecute.

**S6 y S7 — "el transporte no fue invocado".** La aserción de que el mock **no** se invocó vive en el
spec contra mock de transporte (§13), donde el transporte es nuestro. Acá, con un cliente real y sin
punto de inyección del transporte, se afirma la **misma propiedad de forma observable**: la promesa
rechaza con el `OrderValidationError` correcto **y** `getOpenOrders` devuelve exactamente el mismo
conjunto de órdenes antes y después — ninguna llamada firmada llegó a Binance. Es una aserción más
fuerte que un spy, y evita abrir en producción una costura de inyección que existiría solo para un
test. **El reviewer valida contra esta redacción.**

### Robustez y limpieza

- **Latencia:** 300–500 ms por request firmado medidos [probe, cierre]. `jest.setTimeout(120_000)` para
  el bloque.
- **Rate limit:** el `BinanceRateLimiter` del propio cliente lo administra; el harness no lo esquiva.
- **`afterAll` incondicional:** `getOpenOrders('BTCUSDT')`, y cancelar **toda** orden con prefijo
  `ent-e2e-` que haya quedado, falle o no cada test. La corrida no puede dejar basura viva en el
  exchange.
- Si una orden del harness igual se escapara, el barrido de huérfanas de producción (§7.2-bis) la
  cancelaría por el prefijo `ent-`: es red de seguridad, no la primera línea.

### Comando

```bash
set -a && source .env && set +a
BINANCE_TESTNET_E2E=1 pnpm nx test data-fetcher --testPathPattern=testnet
```

Queda documentado para que el reviewer lo corra como **evidencia de cierre del ciclo**. Ninguna orden
de este harness, ni de ningún otro punto de este ciclo, se coloca en modo `LIVE`.

---

## 11. Lectores a enumerar

Todo lector existente que cambia de comportamiento —o que **debe** cambiar— por la existencia del
estado nuevo. Un lector que sobrevive con su propia consulta produce una UI que promete lo que el
backend niega.

| # | Lector | Archivo | Qué le pasa |
| --- | --- | --- | --- |
| 1 | `TradingProcessor.executeBuy` — cap de concurrencia | `trading.processor.ts:885` | Suma `countResting` |
| 2 | `TradingProcessor.executeBuy` — notional planificado | `trading.processor.ts:1056` | Suma `sumRestingPlannedNotionalUsd` |
| 3 | `TradingProcessor.executeBuy` — rama `LIVE`/`TESTNET` | `trading.processor.ts:1026` | Ramifica por `entryOrderMode` |
| 4 | `TradingProcessor.runCycle` — ramas de decisión | `trading.processor.ts:594-670` | Paso nuevo de cancelación c1 |
| 5 | **`RiskBudgetService.countOpenPositions`** | `agents/domain/risk-budget.service.ts:97` | **Segundo** lector de `maxConcurrentPositions` (`MAX_POSITIONS`): tiene que sumar las `RESTING` del mismo scope o promete margen que `executeBuy` niega |
| 6 | `ReconciliationService.reconcile` | `reconciliation.service.ts:61` | Paso nuevo de entradas + barrido propio |
| 7 | `ReconciliationService.sweepOrphanOrders` | `reconciliation.service.ts:320` | **No cambia** (sigue solo `prot-`), pero comparte la respuesta de `getOpenOrders` |
| 8 | `TradingService.stopAgentById` | `trading.service.ts:405` | Cancela entradas (c3) |
| 9 | `TradingService.stopAgentsByModeForUser` / `stopAllAgentsForUser` / `stopAllAgents` | `trading.service.ts:437, 469, 511` | Delegan por config en el mismo camino c3 |
| 10 | `TradingService.deleteConfig` | `trading.service.ts:332` | Ya llama a `stopAgentById`: hereda la cancelación. **Verificar el orden**: el `CASCADE` de la FK borra las filas, así que la cancelación en el exchange tiene que ocurrir antes del delete |
| 11 | `getBotActionCounters` | `bot-action-counters.ts` | Excluye `EXCHANGE_TRIGGER` y `ENTRY_CANCEL` (§4.6) |
| 12 | `classifyActionExposure` / `EXPOSURE_BY_KIND` | `libs/trading-engine/src/lib/risk/action-caps.ts:21` | `Record` exhaustivo: obliga a declarar la exposición de `ENTRY_CANCEL` |
| 13 | `ActionGateService` — tipo `BotActionSource` | `action-gate.service.ts:19` | Suma `'EXCHANGE_TRIGGER'` al union TS |
| 14 | `FastPathService` — caché de posiciones | `reactive/fast-path.service.ts:150` | **No cambia**, pero la liquidación de un fill debe invalidarlo (una `Position` nueva no puede quedar invisible al fast path hasta el próximo refresh) |
| 15 | `TradingModule.exports` | `trading.module.ts` | Agrega `EntryOrderService` para que `ReactiveModule` lo consuma sin invertir el grafo |
| 16 | `PrismaService` | `prisma/prisma.service.ts` | Getter `entryOrder` (1:1 con los modelos, o rompe el build) |
| 17 | `TradingController` | `trading.controller.ts` | `@Get('entry-orders')` (EP-017) |
| 18 | `apps/web` — locales | `src/locales/{es,en}.ts` | 3 `key` de notificación nuevas. **Deuda declarada**, UI fuera de alcance |
| 19 | `apps/web` — render de `bot_actions` | `src/components/…` que consuman EP-016 | `kind: 'ENTRY_CANCEL'` y `source: 'EXCHANGE_TRIGGER'` son valores nuevos: verificar que un valor desconocido no rompa el render |
| 20 | `apps/web` — interfaces de `TradingConfig` | `src/hooks/use-trading.ts` | 3 campos nuevos en el response de EP-006/007. Aditivo: los clientes existentes los ignoran |

---

## 12. Correcciones al funcional y criterios reescritos como ejecutables

**El reviewer valida contra esta sección, no contra la letra original del funcional.**

### 12.1 Criterios que dependían de un valor de mercado

| Origen | Criterio original | Criterio ejecutable |
| --- | --- | --- |
| US-2-002 | "el precio de la orden es el soporte más cercano a ese precio de referencia, por debajo" | `resolveEntryLevels` con `support` y `referencePrice` **congelados como fixture** devuelve `limitPrice === max{s ∈ support : s < referencePrice}` y `limitSource === 'SUPPORT'`. Función pura, sin mercado |
| US-2-002 | "el fallback `precio × (1 − orderPriceOffsetPct)`" | Con `support: []` y `orderPriceOffsetPct: -0.01` ⇒ `limitPrice === referencePrice × 0.99` y `limitSource === 'OFFSET_FALLBACK'`. **Signo corregido**, §6(a). Con `orderPriceOffsetPct: 0` ⇒ `null`, §6(b) |
| US-2-003 | "la resistencia más cercana por encima" | Idéntico, sobre `resistance` y `min{r > referencePrice}` |
| US-2-004 | "un `trailingDelta` fuera del rango del filtro se rechaza localmente" | Con `getSymbolFilters` **mockeado** devolviendo `trailingDelta: { minTrailingAboveDelta: 10, maxTrailingAboveDelta: 2000 }` y `trailingDeltaBips: 5`: la promesa rechaza con `OrderValidationError.code === 'TRAILING_DELTA'` y el mock de transporte tiene `0` invocaciones. **Sin red** |
| US-2-008 | "transcurrido el TTL sin fill, el próximo ciclo cancela y transiciona a `EXPIRED`" | Con `now` **inyectado** y `expiresAt` en el pasado, y el executor mockeado devolviendo `RESTING`: se invoca `cancelEntryOrder` **antes** del `update`, y la fila queda `EXPIRED`/`TTL_EXPIRED`. Assert sobre **orden de invocación del mock**, nunca sobre el reloj real |
| US-2-008 | "el fill confirmado gana sobre el vencimiento" | Con `expiresAt` en el pasado **y** el executor devolviendo `FILLED`: la fila queda `FILLED` y `cancelEntryOrder` **no** se invoca (salvo `partial`) |
| US-2-015 | "N posiciones + M entradas == `maxConcurrentPositions` bloquea" | Con `position.count` mockeado en `N` y `countResting` en `M`, `N+M === maxConcurrentPositions`: `executeBuy` retorna sin invocar `placeEntryOrder` ni `placeMarketOrder` |
| US-2-018 | "la coloca a un precio alejado del precio de mercado corriente" | Precios como **múltiplo** del `ref` leído en la corrida (`ref × 0.6` / `ref × 1.4`), nunca constantes (§10) |
| US-2-018 | "cero órdenes abiertas propias" | `getOpenOrders(symbol)` **filtrado por `clientOrderId.startsWith('ent-e2e-')`** tiene longitud 0. Sin el filtro, el criterio fallaría por una orden manual del dev en la misma cuenta de testnet |

### 12.2 Reglas de negocio corregidas

| RN | Corrección |
| --- | --- |
| **RN-3** | El fallback es `referencePrice × (1 + orderPriceOffsetPct)`, no `(1 − …)`: la convención vigente del repo es **negativo = por debajo**. Con la fórmula original, un offset negativo produce un `LIMIT_MAKER` BUY por encima del mercado ⇒ `-2010` [probe #7]. Y con el default `0` **no hay fallback**: la entrada no se coloca (§6b) |
| **RN-5** | El `trailingDelta` de la pierna de ruptura del OCO se manda como **`aboveTrailingDelta`**, no `trailingDelta` [probe #6]. Y se usa **siempre combinado con `aboveStopPrice`** (§2.2) |
| **RN-8** | El notional planificado de un OCO es el de **una** compra potencial, **al precio de la pierna más cara** (§5.2) |
| **RN-10 / RN-17 / RN-20** | Son incumplibles con el contador vigente: `getBotActionCounters` suma **toda** fila `EXECUTED` del config. Se corrige excluyendo `source: 'EXCHANGE_TRIGGER'` y `kind: 'ENTRY_CANCEL'` (§4.6). La cancelación se registra con `kind: 'ENTRY_CANCEL'` (kind nuevo, exposición `REDUCING`), no con `kind: 'BUY'` |
| **RN-11** | La lista de motivos de cancelación **no incluye** el fallo de protección posterior al fill (§5.3) y **sí incluye** dos que el funcional no enumeraba: reemplazo por entrada nueva y remanente de fill parcial |
| **RN-12** | `MISSING` se determina **solo** por `-2013` en la consulta directa de la orden, jamás por ausencia en `openOrders` (una orden llena tampoco está ahí) |
| **RN-15** | Se agrega el paso previo obligatorio: si el fill es parcial, **cancelar el remanente antes** de crear la `Position` (§5.4) |
| **US-2-007** | Se agrega la transición `RESTING → CANCELLED` con motivo `REPLACED_BY_NEW_ENTRY`, que el funcional describe en US-2-009 pero no lista entre las transiciones |

### 12.3 Lo que el funcional pedía y este documento confirma sin cambios

Preguntas abiertas 1 y 4 (fallo de protección como mecanismo separado; notional de un OCO como una
sola compra): **la lectura del funcional es correcta**, ratificada en §5.3 y §5.2 con la única
precisión del "peor caso" de precio.

---

## 13. Contrato de tests

| Archivo | Qué afirma |
| --- | --- |
| `libs/data-fetcher/src/lib/binance/binance-rest.client.spec.ts` (extendido) | **Payload exacto** de las tres colocaciones nuevas contra un mock de transporte, clave por clave: `LIMIT_MAKER` sin `timeInForce`; `STOP_LOSS_LIMIT` BUY con y sin `stopPrice`; OCO BUY con `belowType`/`aboveType`/`aboveTimeInForce`/`aboveTrailingDelta` y **sin** `belowTimeInForce`. Redondeo por pierna (`down` en el límite de compra, `up` en stop y su límite). Parseo del filtro `TRAILING_DELTA`. **Mock con 0 invocaciones** ante cada rechazo local: `LOT_SIZE`, `PRICE_FILTER`, `MIN_NOTIONAL`, `TRAILING_DELTA` (incluido el caso "el símbolo no declara el filtro") y `PRICE_CROSSES_MARKET`. Mapeo de `PARTIALLY_FILLED ⇒ FILLED, partial: true`. `getEntryOrderStatus` de un OCO consulta la **lista y las dos piernas**, y con `opts.leg` consulta **una sola** |
| `libs/trading-engine/src/lib/entry-levels.spec.ts` (nuevo) | `resolveEntryLevels` puro: soporte más cercano estrictamente por debajo; resistencia más cercana estrictamente por encima; fallback con offset **negativo**; `null` con offset `0` y sin niveles; **degradación de OCO a `LIMIT_MAKER`** cuando no hay resistencia utilizable; `null` cuando no hay pierna de abajo aunque sí haya de arriba; invariante `limit < reference < stop` |
| `libs/trading-engine/src/lib/order-executor.spec.ts` (extendido) | **Los dos** executors contra el mismo contrato: `LiveOrderExecutor` delega el discriminante al método correcto del objeto estructural; `SandboxOrderExecutor` cumple la tabla de §1. Que `trading-engine` **no** importe `data-fetcher` se afirma sobre el grafo de dependencias de Nx, no sobre texto fuente |
| `apps/api/src/trading/entry-order.service.spec.ts` (nuevo) | `settleFill`: fill completo y **parcial** (cancelación del remanente **antes** de crear la `Position`, por orden de invocación del mock); transición condicional idempotente (`claimed.count === 0` corta); `Trade` con `decisionId: null`; fila `bot_actions` `{BUY, EXCHANGE_TRIGGER, EXECUTED}` **sin** pasar por `authorizeAndRun`; `cancelResting` por cada uno de los motivos, con su `cancelReason` y su fila `ENTRY_CANCEL` |
| `apps/api/src/trading/reconciliation.service.spec.ts` (extendido) | Fill / vencida / `MISSING` / `CANCELLED`; **precedencia del fill sobre el TTL**; sin filas `RESTING` no se hace ninguna llamada al exchange; barrido de huérfanas de `ent-` preservando las de otras configs del mismo usuario; una **sola** llamada a `getOpenOrders` para los dos barridos |
| `apps/api/src/trading/trading.processor.entry-orders.spec.ts` (nuevo) | Camino de BUY con `LIMIT_MAKER` y con `OCO`: colocación **dentro** de `authorizeAndRun` con `kind: 'BUY'`/`source: 'LLM_CYCLE'`; fila `RESTING` con prefijo `ent-`; reafirmación idempotente (misma entrada ⇒ cero llamadas, cero filas en `bot_actions`); reemplazo (cancelar-confirmar-colocar, por orden de invocación); cap de concurrencia contando `RESTING`; notional del peor caso; `null` de `resolveEntryLevels` ⇒ nada colocado y **nada** en `bot_actions`; `SANDBOX` ignora `entryOrderMode` y no crea filas |
| `apps/api/src/trading/trading.processor.entry-cancellation.spec.ts` (nuevo) | c1 (`HOLD`/`SELL`/`BUY` bajo umbral), c2 (`DAILY_LOSS` por los dos puntos), c3 (stop del bot, incluido "sin credenciales el stop igual procede") |
| `apps/api/src/reactive/entry-fill-watch.service.spec.ts` (nuevo) | Dispara solo al cruzar el nivel; consulta **solo** la pierna cruzada; respeta el debounce; con `reactiveLoopEnabled: false` cero llamadas; nunca vence ni cancela ni marca `MISSING` |
| `apps/api/src/trading/bot-action-counters.spec.ts` (extendido) | Una fila `EXCHANGE_TRIGGER` y una `ENTRY_CANCEL` **no** mueven el conteo ni el `lastExecutedActionAtMs`; el conteo sobre filas previas al ciclo es idéntico |
| `apps/api/src/trading/dto/…` (spec de DTO vigente) | Los 3 campos declarados en **Create y Update**; fuera de rango ⇒ 400; omitirlos ⇒ sin cambio de comportamiento |
| `apps/api/src/trading/trading.controller.entry-orders.spec.ts` (nuevo) | EP-017: scope por `userId`, filtros, paginado por cursor, 401 sin JWT |
| **CA-001** — `trading.processor.*.spec.ts` vigentes | **Pasan sin cambiar ninguna aserción.** Con `entryOrderMode: 'MARKET'`, la secuencia y el conteo de invocaciones del mock de transporte son idénticos a los de hoy, y `entry_orders` queda vacía |
| `libs/data-fetcher/…/binance-rest.client.testnet.spec.ts` (nuevo, gateado) | §10 |

Prohibiciones vigentes en todos estos tests: nada de `readFileSync` + match entre dos símbolos; nada
de assert sobre un precio de mercado en vivo; **ningún comentario narrativo en el código de
producción** — la documentación de todo esto vive en este archivo.

---

## 14. Entradas escritas en los registros SDD

Escritas por **este** documento (§Deliverable 2 del ciclo), con `pnpm sdd:validate` en verde.

### `sdd/schema.json` → app-key `apps/api`

| Tabla | Operación | Detalle |
| --- | --- | --- |
| `entry_orders` | **CREAR** | `status: "defined"`, `created_in_cycle: 2`, `migration_file` de §4.5-2, las 28 columnas de §4.2, los 5 índices, `changelog: []` |
| `trading_configs` | **MODIFICAR** | `status: "updated"`, `updated_in_cycle: 2`, 3 columnas nuevas, entrada de changelog |
| `bot_actions` | **MODIFICAR** | `status: "updated"`, `updated_in_cycle: 2`, `kind` y `source` suman un valor cada uno, entrada de changelog |

### `sdd/api.json` → app-key `apps/api`

| Endpoint | Operación |
| --- | --- |
| `EP-017 GET /trading/entry-orders` | **CREAR**, `status: "defined"`, `created_in_cycle: 2` |
| `EP-006 POST /trading/config` | **MODIFICAR**: `updated_in_cycle: 2`, 3 campos nuevos en el body |
| `EP-007 PUT /trading/config/{id}` | **MODIFICAR**: idem |

`EP-008 GET /trading/positions` **no se toca** (§9.2).

---

## 15. Riesgos conocidos que el ciclo acepta

1. **Una entrada mal colocada no se deshace con un deploy.** Es el riesgo central y no se elimina: se
   acota con el interruptor apagado por default, la validación local antes de firmar, el TTL, el
   barrido de huérfanas por prefijo y la verificación en TESTNET antes de tocar una clave LIVE.
2. **Ventana sin protección tras un fill.** Con el riel reactivo apagado, hasta un ciclo completo del
   processor. Es la misma ventana que ya existe para un cierre ejecutado por el exchange, y la
   solución real (`user data stream`) está fuera de alcance por decisión del brief.
3. **La sonda por tick no cubre el `MISSING` ni el vencimiento.** Una entrada cancelada desde la app
   de Binance por el trader se detecta recién en la reconciliación del próximo ciclo. Aceptado: la
   sonda existe para acortar la ventana del **fill**, que es la única con consecuencia de riesgo.
4. **La invariante "una sola `RESTING` por config+símbolo" no está en la base.** Vive en el código
   (cancelar-y-confirmar) y en un test, porque un índice único parcial lo borraría el próximo diff
   autogenerado de Prisma (§4.2).
5. **`entryTrailingDeltaBips` es por config, no por símbolo.** Un rango válido para BTCUSDT puede no
   serlo para ETHUSDT: el cliente lo revalida contra el filtro vigente y rechaza localmente, así que
   el modo de falla es "la entrada no se coloca y queda registrada", no una orden mal formada.
6. **`RiskBudgetService` alimenta contexto del LLM además del cap.** Sumarle las `RESTING` (lector 5)
   cambia también lo que el LLM ve como "posiciones abiertas". Es lo correcto —comprometido es
   comprometido— pero es un cambio de entrada del modelo que no se puede verificar por test.
