# Functional — Cycle 2: Loop de ejecución reactivo (entrada descansando en el exchange)

> **Input:** sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Cycle-01 le dio al bot reflejos de **salida**: el fast path protege una posición ya abierta en
cada tick, sin esperar al LLM. La **entrada** sigue exactamente igual que antes de ese ciclo: el
LLM dice `BUY` y el bot compra a mercado, ahí mismo, en el precio que haya en ese instante. No hay
ninguna orden de entrada descansando en Binance que compre sola en un nivel, y por lo tanto
ninguna entrada sobrevive a que el servicio esté caído o se esté reiniciando — cosa que pasa en
cada deploy.

Este ciclo cierra esa asimetría: además de comprar a mercado, el bot puede dejar una orden
`LIMIT_MAKER` esperando en el soporte, o un OCO de entrada (`LIMIT_MAKER` por debajo +
`STOP_LOSS_LIMIT` de ruptura por arriba, con `trailingDelta` opcional en esa segunda pierna). Esa
orden vive en Binance, no en el proceso del bot: dispara sola aunque el backend esté abajo.

Ese mismo hecho es el riesgo central del ciclo: una orden condicional mal colocada **no se
deshace con un deploy** — sigue viva en el exchange hasta que se llena o se cancela
explícitamente. Por eso:

- El interruptor (`TradingConfig.entryOrderMode`) nace en `MARKET`, el valor que reproduce el
  comportamiento actual sin que el trader toque nada.
- Toda propiedad de este documento se verifica primero contra un mock de la capa de transporte
  (payload exacto, sin red).
- Antes de tocar una credencial LIVE, cada tipo de orden nuevo se coloca, consulta y cancela
  contra Binance **TESTNET**.
- Ninguna orden de este ciclo se coloca en modo LIVE bajo ninguna circunstancia.

Una entrada que se llena mientras el servicio está caído deja de ser invisible: se reconcilia a
una posición real, con su protección nativa, en cuanto el servicio vuelve a levantar.

**Actores de este ciclo:**

- **Trader dueño del bot** — configura `entryOrderMode`, el TTL y el `trailingDelta` opcional de
  su `TradingConfig`; es quien queda expuesto si una entrada descansando dispara sola mientras el
  servicio está caído, y quien se beneficia de que se cierre en un nivel mejor que el de mercado.
- **Responsable del cierre del ciclo (reviewer/dev)** — corre el harness contra TESTNET como
  evidencia de que cada tipo de orden nuevo se coloca, consulta y cancela correctamente antes de
  habilitar el interruptor para cualquier trader real.

**Regla de lectura de este documento:** todo criterio de aceptación mide una **propiedad**
verificable sin depender de cómo se mueva el mercado real — payload exacto enviado al port,
estado persistido en `entry_orders`/`Position`/`Trade`/`bot_actions`, cantidad de invocaciones al
mock de transporte, o código de rechazo de un filtro local. Ningún criterio de este documento
depende del valor de un precio de mercado en vivo.

---

## Historias de usuario

### US-2-001: Con `entryOrderMode = MARKET`, nada cambia

**Como** trader dueño del bot
**Quiero** que si nunca toco el modo de entrada, mi bot siga comprando a mercado exactamente como
antes de este ciclo
**Para** no verme afectado por una funcionalidad que no pedí ni configuré

**Criterios de aceptación:**

- [ ] Todo `TradingConfig` sin `entryOrderMode` explícito (creado antes o después de este ciclo)
      persiste `entryOrderMode: MARKET`.
- [ ] Dado `entryOrderMode = MARKET`, el camino de BUY del processor coloca la compra a mercado
      exactamente como antes de este ciclo: no invoca ningún método nuevo del port (entrada
      `LIMIT_MAKER` u OCO), no crea ninguna fila en `entry_orders`.
- [ ] Sobre un mismo escenario congelado, la secuencia y cantidad de invocaciones al mock de
      transporte con `entryOrderMode = MARKET` es idéntica a la que producía el sistema antes de
      este ciclo.
- [ ] `CreateTradingConfigDto` y `UpdateTradingConfigDto` aceptan `entryOrderMode`, el TTL de
      entrada y `trailingDelta` como campos opcionales; omitirlos no cambia ningún comportamiento
      observable.

---

### US-2-002: Colocar una entrada `LIMIT_MAKER` en el soporte

**Como** trader dueño del bot
**Quiero** que, en vez de comprar a mercado, mi bot deje una orden `LIMIT_MAKER` esperando en el
soporte más cercano
**Para** entrar en un nivel mejor que el precio de mercado del momento, sin pagar el spread de una
orden de mercado

**Criterios de aceptación:**

- [ ] Dado `entryOrderMode = LIMIT_MAKER` y una decisión `BUY` con al menos un soporte utilizable
      en `IndicatorSnapshot.supportResistance.support` (por debajo del precio de referencia del
      ciclo), el precio de la orden es el soporte más cercano a ese precio de referencia, por
      debajo.
- [ ] Dado que no hay ningún soporte utilizable (lista vacía, o todos por encima del precio de
      referencia), el precio de la orden es el fallback `precio_referencia × (1 −
      orderPriceOffsetPct)`.
- [ ] El payload enviado al método del port para colocar la orden contiene exactamente: symbol,
      side `BUY`, type `LIMIT_MAKER`, el precio calculado y la cantidad resuelta por sizing — sin
      ningún campo de tipo `STOP`.
- [ ] Colocada la orden, se persiste una fila en `entry_orders` en estado `RESTING` con el
      `orderId` devuelto por el mock y un `clientOrderId` con el prefijo propio de este ciclo
      (nunca `prot-`).

---

### US-2-003: Colocar una entrada OCO (LIMIT_MAKER + ruptura)

**Como** trader dueño del bot
**Quiero** dejar dos órdenes condicionales de entrada a la vez — una en el soporte y otra que
compre si el precio rompe la resistencia hacia arriba
**Para** entrar tanto si el mercado retrocede a mi nivel como si rompe al alza, sin tener que
elegir un solo escenario de antemano

**Criterios de aceptación:**

- [ ] Dado `entryOrderMode = OCO`, la pierna `belowType LIMIT_MAKER` usa el mismo precio que
      resultaría de US-2-002 (soporte más cercano por debajo, o su fallback).
- [ ] La pierna `aboveType STOP_LOSS_LIMIT` usa como `aboveStopPrice` la resistencia más cercana
      por encima del precio de referencia, con el mismo criterio de fallback que la pierna de
      soporte (aplicado en sentido inverso) cuando no hay resistencia utilizable.
- [ ] El payload enviado al mock del endpoint de OCO de compra tiene `side: 'BUY'` explícito (no
      hardcodeado a `SELL`, a diferencia del OCO de venta existente), `belowPrice`,
      `aboveStopPrice`, `abovePrice` y `aboveTimeInForce`.
- [ ] Se persiste una única fila en `entry_orders` para el par, con el `orderListId` y los dos
      `orderId` de ambas piernas.
- [ ] La reconciliación de un fill de este OCO lee cuál de las dos piernas efectivamente se llenó
      (no asume cuál) y usa el precio y la cantidad ejecutados de esa pierna.

---

### US-2-004: `trailingDelta` opcional en la pierna de ruptura

**Como** trader dueño del bot
**Quiero** poder configurar un `trailingDelta` para que la pierna de ruptura de mi OCO de entrada
persiga el precio en vez de dispararse en un nivel fijo
**Para** capturar una ruptura sin fijar de antemano el punto exacto en que el precio la confirma

**Criterios de aceptación:**

- [ ] Dado `entryOrderMode = OCO` y un `trailingDelta` configurado en BIPS mayor a cero, el
      payload de la pierna de ruptura incluye el campo `trailingDelta` con ese valor exacto.
- [ ] Dado que `trailingDelta` no está configurado (ausente o igual a cero), el payload de la
      pierna de ruptura no incluye el campo `trailingDelta`.
- [ ] `trailingDelta` nunca aparece en el payload de la pierna `LIMIT_MAKER` (ni de la entrada
      suelta de US-2-002 ni de la pierna inferior del OCO de US-2-003) — Binance solo lo admite en
      las piernas de tipo `STOP_LOSS`/`STOP_LOSS_LIMIT`/`TAKE_PROFIT`/`TAKE_PROFIT_LIMIT`.
- [ ] Un `trailingDelta` fuera del rango `[minTrailingAboveDelta, maxTrailingAboveDelta]` del
      filtro `TRAILING_DELTA` del símbolo se rechaza localmente, con un código de rechazo propio de
      ese filtro, sin invocar el mock de transporte.

---

### US-2-005: La entrada descansando pasa por la misma puerta que una compra a mercado

**Como** trader dueño del bot
**Quiero** que colocar una entrada descansando consuma mis caps de frecuencia igual que una
compra a mercado
**Para** no poder terminar con más exposición comprometida de la que mis límites permiten, solo
porque la orden todavía no se ejecutó en el exchange

**Criterios de aceptación:**

- [ ] Dado `entryOrderMode` distinto de `MARKET` y modo `LIVE` o `TESTNET`, la colocación de la
      entrada (`LIMIT_MAKER` u OCO) se ejecuta dentro de `actionGate.authorizeAndRun` con
      `kind: BUY` y `source: LLM_CYCLE` — el mismo punto de control que usa hoy la compra a
      mercado.
- [ ] Los tres caps de frecuencia heredados de cycle-01 (acciones por hora, tiempo mínimo entre
      ejecuciones, pérdida diaria) bloquean o difieren la colocación de una entrada exactamente
      igual que bloquearían la compra a mercado equivalente — mismo `blockedBy`, mismo registro en
      `bot_actions.outcome`.
- [ ] Ninguna colocación de una entrada descansando ocurre fuera de `authorizeAndRun`: no existe
      un camino alternativo que la esquive.

---

### US-2-006: Los filtros del símbolo se validan antes de firmar, no después

**Como** trader dueño del bot
**Quiero** que una entrada que violaría un filtro de Binance se rechace antes de gastar una
llamada firmada al exchange
**Para** no perder tiempo ni exponer una llamada firmada por un cálculo que ya sé que Binance va a
rechazar

**Criterios de aceptación:**

- [ ] Dado un precio o una cantidad calculados que violan `LOT_SIZE`, `PRICE_FILTER` o
      `NOTIONAL`/`MIN_NOTIONAL` del símbolo, la colocación se rechaza localmente con un código de
      rechazo que identifica cuál filtro la bloqueó, y el mock de transporte (firma + llamada
      HTTP) no se invoca ni una sola vez.
- [ ] Lo mismo para un `trailingDelta` fuera de rango del filtro `TRAILING_DELTA` (ver US-2-004).
- [ ] Cuando todos los filtros aplicables pasan, el mock de transporte se invoca exactamente una
      vez para la colocación de un `LIMIT_MAKER` suelto, y exactamente una vez para la colocación
      de un OCO de entrada — sin reintentos silenciosos ante un rechazo local.

---

### US-2-007: Una entrada descansando tiene un ciclo de vida observable

**Como** trader dueño del bot
**Quiero** que cada entrada que dejé descansando tenga un estado claro en todo momento
**Para** saber si sigue esperando, se llenó, venció, se canceló, o el sistema la perdió de vista

**Criterios de aceptación:**

- [ ] `entry_orders` admite exactamente cinco estados: `RESTING`, `FILLED`, `CANCELLED`,
      `EXPIRED`, `MISSING`. Ninguna fila nace en un estado distinto de `RESTING`.
- [ ] La transición a `FILLED` ocurre únicamente cuando la reconciliación confirma, contra el
      exchange, que la orden se ejecutó — nunca se infiere de la ausencia de la orden en
      `openOrders`.
- [ ] La transición a `MISSING` ocurre cuando una consulta de reconciliación no encuentra la orden
      en el exchange y no hay evidencia de fill ni de una cancelación que el propio sistema haya
      emitido — se persiste como estado observable, nunca se descarta la fila en silencio.
- [ ] Los cinco estados son mutuamente excluyentes para una misma fila en un instante dado, y
      `RESTING` es el único estado desde el que puede salir una fila (los otros cuatro son
      terminales).

---

### US-2-008: Una entrada vence si nadie la llena a tiempo

**Como** trader dueño del bot
**Quiero** que una entrada que dejé descansando no quede viva para siempre si el precio nunca
llega a mi nivel
**Para** no terminar con una orden condicional colgada indefinidamente en el exchange, atada a un
escenario de mercado que ya pasó

**Criterios de aceptación:**

- [ ] Dado que transcurrió el TTL configurado desde `placedAt` sin que el exchange confirme un
      fill, el próximo ciclo de reconciliación cancela la orden en el exchange y transiciona la
      fila a `EXPIRED`.
- [ ] El TTL se computa siempre desde `placedAt`, nunca desde el momento de la última consulta de
      reconciliación.
- [ ] Dado que la consulta de reconciliación encuentra un fill confirmado para una entrada cuyo
      TTL ya venció, la fila transiciona a `FILLED` — el fill confirmado siempre gana sobre el
      vencimiento cuando ambos se detectan en la misma consulta.

---

### US-2-009: Una decisión posterior distinta de BUY cancela la entrada pendiente

**Como** trader dueño del bot
**Quiero** que si el LLM decide otra cosa en un ciclo posterior, mi entrada descansando anterior no
siga viva por su cuenta
**Para** no terminar con una posición que el sistema ya no quiere, solo porque una orden vieja
seguía esperando en el exchange

**Criterios de aceptación:**

- [ ] Dado un `configId` con una entrada `RESTING` para un símbolo, y un ciclo de decisión
      posterior (por evento o por temporizador) que resuelve `HOLD` o `SELL` para ese mismo
      símbolo, la entrada `RESTING` se cancela en el exchange y transiciona a `CANCELLED` antes de
      que el sistema actúe sobre la nueva decisión.
- [ ] Nunca coexisten dos filas `RESTING` para el mismo `configId` + símbolo: si la nueva decisión
      también es `BUY` con un nivel distinto, la cancelación de la entrada vieja se confirma antes
      de colocar la nueva.

---

### US-2-010: El cap de pérdida diaria cancela las entradas pendientes, no solo bloquea las nuevas

**Como** trader dueño del bot
**Quiero** que, si ya alcancé mi límite de pérdida diaria, mis entradas descansando también se
cancelen, no solo se bloqueen las compras nuevas
**Para** no seguir expuesto a comprar más de lo que mi límite de riesgo del día ya permite

**Criterios de aceptación:**

- [ ] Dado que el cap de pérdida diaria devuelve `DISCARDED` para un bot, todas las entradas
      `RESTING` de ese bot se cancelan en el exchange y transicionan a `CANCELLED` en el mismo
      ciclo en que se detecta el `DISCARDED`.
- [ ] Esa cancelación queda registrada en `bot_actions` con un motivo distinguible de un bloqueo
      ordinario de colocación (US-2-016), pero no cuenta como una nueva acción a efectos de los
      tres caps de frecuencia — es un cierre defensivo, exento igual que una venta (RN-17).

---

### US-2-011: Detener el bot cancela sus entradas pendientes

**Como** trader dueño del bot
**Quiero** que, al detener mi bot, cualquier entrada descansando sin llenarse todavía se cancele
**Para** no dejar una orden condicional viva en el exchange asociada a un bot que ya no está
operando

**Criterios de aceptación:**

- [ ] Dado que el trader detiene un bot con al menos una entrada `RESTING`, esa entrada se cancela
      en el exchange y transiciona a `CANCELLED` como parte del apagado.
- [ ] Detener el bot no toca la protección nativa de posiciones ya abiertas (comportamiento
      existente, sin cambios): solo cancela entradas que todavía no se convirtieron en posición.

---

### US-2-012: Un fill con el servicio caído se reconcilia a posición real con protección

**Como** trader dueño del bot
**Quiero** que si mi entrada se llena mientras el servicio está caído o reiniciando, en cuanto
vuelva a levantar tenga una posición real con su protección puesta
**Para** no descubrir, recién en el próximo ciclo del LLM, que tengo un balance comprado sin
ninguna red de seguridad

**Criterios de aceptación:**

- [ ] Dado que una entrada `RESTING` se confirma llena en la consulta de reconciliación, en una
      única operación reconciliada el sistema: crea una `Position` abierta con la cantidad y el
      precio ejecutados de la pierna que llenó, crea un `Trade` asociado con `decisionId: null`
      (mismo criterio que la reconciliación existente para lo que ejecutó el exchange), y coloca la
      protección nativa inicial si `nativeProtectionEnabled` está activo, por el camino ya
      existente (`placeProtectionWithRetry`).
- [ ] La fila de `entry_orders` transiciona a `FILLED` y queda vinculada a la `Position` creada
      para trazabilidad.
- [ ] Esta reconciliación es idéntica para el fill de un `LIMIT_MAKER` suelto y para el fill de
      cualquiera de las dos piernas de un OCO de entrada.

---

### US-2-013: Un fallo de protección tras el fill se maneja igual que hoy

**Como** trader dueño del bot
**Quiero** que si la protección nativa no se puede colocar después de reconciliar un fill de
entrada, el sistema reaccione exactamente igual que ante cualquier otra compra sin protección
**Para** tener el mismo nivel de aviso y de comportamiento sin importar si la compra vino de una
orden de mercado o de una entrada descansando

**Criterios de aceptación:**

- [ ] Dado que `placeProtectionWithRetry` agota sus reintentos para una posición creada por
      reconciliación de una entrada, el resultado es: `protectionStatus = UNPROTECTED`,
      notificación y evento WS `position:unprotected` — sin ninguna rama de código distinta de la
      que ya existe para el camino de compra a mercado.
- [ ] La posición se cierra únicamente si `closeOnProtectionFailure` está en `true` (mismo default
      `false` que hoy); el origen de la posición (entrada resting vs. compra a mercado) no cambia
      este criterio.

---

### US-2-014: La colocación y el fill se contabilizan por separado, nunca dos veces

**Como** trader dueño del bot
**Quiero** ver en mi historial de acciones tanto el momento en que coloqué la entrada como el
momento en que se llenó, sin que cuenten como la misma compra repetida
**Para** entender cronológicamente qué decidió el bot y qué ejecutó el exchange, sin ruido de
duplicados

**Criterios de aceptación:**

- [ ] La colocación de una entrada genera exactamente un registro en `bot_actions` con
      `kind: BUY` y `source: LLM_CYCLE`.
- [ ] El fill de esa misma entrada, detectado por reconciliación, genera exactamente un registro
      adicional en `bot_actions` con `source: EXCHANGE_TRIGGER` (valor nuevo de
      `BotActionSource`) y sin pasar por `authorizeAndRun` — ya ocurrió, no hay nada que
      autorizar ni bloquear.
- [ ] Para una misma entrada nunca existen dos registros de `bot_actions` con `kind: BUY` y
      `source: LLM_CYCLE` (uno solo por colocación).
- [ ] El conteo de acciones por hora (cap heredado de cycle-01) usa únicamente el registro de
      colocación de una entrada, nunca también el de su fill — de lo contrario la misma decisión
      del bot consumiría el cap dos veces.

---

### US-2-015: Una entrada pendiente ocupa un lugar de concurrencia, no es exposición gratis

**Como** trader dueño del bot
**Quiero** que una entrada descansando cuente para mi máximo de posiciones concurrentes y para el
capital que ya tengo comprometido
**Para** no terminar con más exposición real de la que configuré, solo porque una de mis "posiciones"
todavía es una orden pendiente y no una posición abierta

**Criterios de aceptación:**

- [ ] Dado un bot con N posiciones abiertas y M entradas en estado `RESTING` tales que
      N + M == `maxConcurrentPositions`, una nueva decisión `BUY` (a mercado o descansando) se
      bloquea por el cap de concurrencia, exactamente igual que si tuviera N + M posiciones
      abiertas.
- [ ] El notional planificado de una entrada `RESTING` (cantidad de la orden × su precio) se
      incluye en el cálculo de exposición comprometida que usa el sizing de la siguiente decisión,
      de la misma forma que el notional de una posición abierta.
- [ ] Cuando una entrada pasa a un estado terminal sin fill (`CANCELLED`, `EXPIRED` o `MISSING`),
      deja de contar para la concurrencia y el notional planificado desde ese momento.
- [ ] Cuando una entrada pasa a `FILLED`, deja de contar como entrada `RESTING` y pasa a contar
      como la `Position` que la reconciliación creó en su lugar — nunca cuentan las dos a la vez.

---

### US-2-016: Ver cada etapa de una entrada descansando

**Como** trader dueño del bot
**Quiero** recibir una notificación o ver un evento en tiempo real cuando coloco una entrada, se
llena, vence o se cancela
**Para** saber en qué estado está mi orden condicional sin tener que consultarla a mano

**Criterios de aceptación:**

- [ ] Toda colocación exitosa de una entrada emite una notificación y un evento WS identificando
      symbol, modo (`LIMIT_MAKER`/`OCO`), precio(s) de la orden y el id del `entry_order`.
- [ ] Todo fill reconciliado de una entrada emite una notificación y un evento WS distinto del de
      colocación — permite distinguir "coloqué la entrada" de "la entrada se llenó".
- [ ] Todo vencimiento (`EXPIRED`) y toda cancelación (`CANCELLED`, cualquiera sea su motivo) emiten
      cada uno un evento observable propio, distinguible entre sí y del evento de transición a
      `MISSING`.

---

### US-2-017: SANDBOX sigue comprando a mercado, sin excepción

**Como** trader dueño del bot
**Quiero** que en modo SANDBOX mi bot se comporte igual que hoy sin importar qué modo de entrada
configuré
**Para** poder seguir probando mi configuración en papel sin que una simulación de entrada
descansando me haga creer que tengo cobertura que en SANDBOX no persiste

**Criterios de aceptación:**

- [ ] Dado modo `SANDBOX` y cualquier valor de `entryOrderMode` distinto de `MARKET`, el bot
      compra a mercado exactamente igual que hoy — `entryOrderMode` se ignora en `SANDBOX`.
- [ ] En modo `SANDBOX` no se crea ninguna fila en `entry_orders`, bajo ninguna configuración.

---

### US-2-018: Verificación reproducible contra Binance TESTNET, nunca contra LIVE

**Como** responsable de cerrar el ciclo
**Quiero** un harness que coloque, consulte y cancele cada tipo de orden de entrada nuevo contra
Binance TESTNET, y que sea imposible de correr accidentalmente contra LIVE
**Para** tener evidencia real de que cada tipo de orden nueva funciona contra el exchange antes de
habilitar el interruptor para cualquier trader real

**Criterios de aceptación:**

- [ ] El harness es un spec de Jest gateado por una variable de entorno; por defecto (variable
      ausente) se salta, no corre en CI ni en una corrida local normal.
- [ ] El harness lee únicamente credenciales `BINANCE_API_TESTNET_*`; nunca lee ni referencia
      ninguna variable de credencial LIVE.
- [ ] El harness aborta antes de colocar ninguna orden si la `baseURL` resuelta del cliente no es
      `https://testnet.binance.vision`.
- [ ] Para cada tipo nuevo (`LIMIT_MAKER` suelto, OCO sin `trailingDelta`, OCO con
      `trailingDelta`), el harness coloca la orden a un precio alejado del precio de mercado
      corriente (de modo que no se llene durante la corrida), consulta su estado y confirma
      `RESTING`, y la cancela.
- [ ] Al finalizar la corrida completa, una consulta de `openOrders` sobre el símbolo usado
      devuelve cero órdenes propias del harness.
- [ ] Ninguna orden de este harness, ni de ningún otro punto de este ciclo, se coloca en modo LIVE
      bajo ninguna circunstancia.

---

## Reglas de negocio

**Interruptor y superficie de configuración (spec §3 D2, §5)**

1. `entryOrderMode` nace con default `MARKET`; con ese valor, el comportamiento del sistema es
   idéntico al que existía antes de este ciclo (kill switch, CA-001 heredado).
2. `entryOrderMode`, el TTL de la entrada y `trailingDelta` son campos opcionales declarados tanto
   en `CreateTradingConfigDto` como en `UpdateTradingConfigDto` — omitir cualquiera de los tres no
   cambia ningún comportamiento observable (`forbidNonWhitelisted` obliga a declararlos en ambos).

**Cálculo del nivel de entrada (spec D2-1)**

3. El precio de una orden `LIMIT_MAKER` de entrada (sola o como pierna inferior de un OCO) es el
   soporte más cercano por debajo del precio de referencia del ciclo, tomado de
   `IndicatorSnapshot.supportResistance.support`; si no hay ningún soporte utilizable, el precio es
   el fallback `precio_referencia × (1 − orderPriceOffsetPct)`.
4. La pierna de ruptura de un OCO de entrada (`STOP_LOSS_LIMIT`) usa como `aboveStopPrice` la
   resistencia más cercana por encima del precio de referencia, con el mismo criterio de fallback
   (en sentido inverso) cuando no hay resistencia utilizable.
5. `trailingDelta` es opcional y aplica exclusivamente a la pierna de ruptura del OCO de entrada;
   nunca a una pierna de tipo `LIMIT_MAKER`. Se expresa en BIPS y es combinable con `stopPrice`,
   según lo documentado por Binance para `STOP_LOSS_LIMIT`.

**Validación local antes de firmar (spec §5, restricciones de diseño)**

6. Todo precio, cantidad y `trailingDelta` calculados se validan contra los filtros vigentes del
   símbolo (`LOT_SIZE`, `PRICE_FILTER`, `NOTIONAL`/`MIN_NOTIONAL`, `TRAILING_DELTA`) antes de
   firmar cualquier request; un rechazo local no invoca el mock de transporte ni una sola vez.

**Puerta de autorización y caps (spec D2-3, RN heredadas de cycle-01)**

7. La colocación de una entrada descansando (cualquier modo distinto de `MARKET`) se ejecuta
   dentro de `actionGate.authorizeAndRun` con `kind: BUY` y `source: LLM_CYCLE` — el mismo punto
   de control, y los mismos tres caps de frecuencia, que la compra a mercado existente.
8. Una entrada `RESTING` cuenta como exposición comprometida a efectos de
   `maxConcurrentPositions` y del notional planificado del sizing, exactamente igual que una
   posición abierta; deja de contar en cuanto pasa a un estado terminal (`CANCELLED`, `EXPIRED`,
   `MISSING`) o se reemplaza por la `Position` que la reconciliación crea al llenarse (nunca
   cuentan las dos a la vez).

**Ciclo de vida de `entry_orders` (spec D2-2, D7)**

9. `entry_orders` tiene exactamente cinco estados: `RESTING`, `FILLED`, `CANCELLED`, `EXPIRED`,
   `MISSING`. `RESTING` es el único estado inicial y el único no terminal.
10. Una entrada vence (`EXPIRED`) cuando su TTL, computado desde `placedAt`, se cumple sin que el
    exchange confirme un fill; la cancelación en el exchange ocurre antes de marcar `EXPIRED`. Un
    fill confirmado en la misma consulta de reconciliación siempre gana sobre el vencimiento.
11. Una entrada se cancela (`CANCELLED`) cuando ocurre cualquiera de: una decisión posterior del
    LLM distinta de `BUY` sobre el mismo `configId` y símbolo, el cap de pérdida diaria devuelve
    `DISCARDED` para ese bot, o el trader detiene el bot.
12. Una entrada pasa a `MISSING` cuando la reconciliación no encuentra la orden en el exchange y
    no hay evidencia de fill ni de una cancelación que el propio sistema haya emitido — nunca se
    descarta la fila en silencio.
13. El prefijo de `clientOrderId` de una entrada descansando es propio y distinto de `prot-`; el
    barrido de huérfanas para entradas es una rutina separada de la que ya existe para órdenes de
    protección (esta última solo mira el prefijo `prot-`).
14. Nunca coexisten dos filas `RESTING` para el mismo `configId` + símbolo: cancelar la entrada
    vieja se confirma antes de colocar una nueva.

**Reconciliación del fill (spec D2-2, D8, restricción heredada de cancelar antes de vender)**

15. Un fill confirmado de una entrada `RESTING` crea, en una única operación reconciliada: una
    `Position` con la cantidad y el precio ejecutados de la pierna que llenó, un `Trade` con
    `decisionId: null` (mismo criterio que la reconciliación existente para lo que ejecutó el
    exchange), y la protección nativa inicial si `nativeProtectionEnabled` está activo, por el
    camino ya existente (`placeProtectionWithRetry`).
16. Si la protección inicial falla tras agotar los reintentos, el resultado es idéntico al camino
    existente para cualquier compra: `protectionStatus = UNPROTECTED`, notificación, evento WS
    `position:unprotected`, y cierre de la posición solo si `closeOnProtectionFailure` está en
    `true` (mismo default `false`).
17. Cancelar una entrada `RESTING` (por TTL, decisión posterior, cap diario o stop del bot) se
    clasifica como reductora de exposición y queda exenta de los tres caps de frecuencia, igual
    que una venta — un cap nunca puede impedir que se cancele una orden que compromete capital
    nuevo cuando ya no corresponde colocarla.
18. Toda venta que se origine sobre una posición creada por reconciliación de una entrada llenada
    cancela la protección nativa (`releaseProtectionIfNeeded`) antes de vender, exactamente igual
    que cualquier otra posición — el fast path y el camino de LLM no distinguen el origen de la
    posición.

**Contabilidad en `bot_actions` (spec D2-3)**

19. La colocación de una entrada genera exactamente un registro en `bot_actions` con
    `kind: BUY`, `source: LLM_CYCLE`. El fill de esa misma entrada, detectado por reconciliación,
    genera un registro separado con `source: EXCHANGE_TRIGGER` (valor nuevo de
    `BotActionSource`), sin pasar por `authorizeAndRun`.
20. El conteo de acciones por hora (cap heredado de cycle-01, RN-19 de ese ciclo) usa únicamente
    el registro de colocación de una entrada; el registro de su fill (`EXCHANGE_TRIGGER`) nunca se
    suma al mismo conteo — de lo contrario la misma decisión del bot consumiría el cap dos veces.
21. `entry_orders` no tiene FK a `decision` (auditoría, debe sobrevivir al borrado de lo que
    referencia — mismo criterio que `bot_actions`); tiene FK a `config` y a `user`, igual que
    `bot_actions`.

**Modos de ejecución (spec D2-4, §5)**

22. En modo `SANDBOX`, `entryOrderMode` se ignora: el bot siempre compra a mercado y nunca se crea
    una fila en `entry_orders` — la capa de entrada descansando es efectivamente `LIVE` y
    `TESTNET` únicamente.
23. Ninguna orden de este ciclo se coloca en modo `LIVE` bajo ninguna circunstancia; toda
    verificación contra un exchange real corre exclusivamente contra Binance TESTNET, con
    credenciales de testnet, y el harness aborta si detecta una `baseURL` que no sea la de
    testnet.

**Observabilidad y pureza heredada (spec §5)**

24. Toda colocación, fill, vencimiento y cancelación de una entrada emite un evento observable
    (notificación y/o evento WS) distinguible de los otros tres.
25. `libs/trading-engine` nunca depende de `libs/data-fetcher`; el vocabulario de tipos de entrada
    compartido (request, referencia, resultado y estados de la orden de entrada) vive en
    `libs/shared`, y `LiveOrderExecutor` sigue tipando su dependencia de forma estructural.

---

## Preguntas abiertas para el architect

- **Ambigüedad en D7 (spec, "quién cancela una entrada"):** la lista de motivos de cancelación
  incluye "fallo de protección tras el fill", pero ese fallo ocurre **después** de que la entrada
  ya se confirmó llena (ya transicionó a `FILLED` y ya existe una `Position`) — no es una
  cancelación de una entrada todavía `RESTING`. Este documento trató ambos mecanismos por
  separado: US-2-011/RN-11 (cancelación de una entrada viva) vs. US-2-013/RN-16 (fallo de
  protección posterior a un fill ya reconciliado). Pedimos al architect confirmar esta lectura o
  corregirla si la intención original era otra.
- **Fills parciales de una entrada no contemplados.** Este documento asume que una entrada
  `LIMIT_MAKER` o cada pierna de un OCO de entrada se llena por completo o no se llena (igual que
  el resto del surface de órdenes ya verificado); no se definió qué pasa si Binance reporta un
  fill parcial de una entrada. Si el architect determina que el fill parcial es una posibilidad
  real de este ciclo, hace falta una decisión explícita (¿se trata como fill completo de la
  cantidad ejecutada, o la entrada sigue `RESTING` por el remanente?) que este documento no
  resuelve.
- **Valor por defecto del TTL de entrada.** La spec y el brief establecen que existe un TTL
  configurable, pero ninguno de los dos documentos fija su valor por defecto ni un rango válido.
  Corresponde al architect definir el default y las validaciones del campo en el DTO.
- **Notional planificado de una entrada con dos piernas (OCO).** RN-8 asume que el notional
  planificado de una entrada OCO es el de una sola compra potencial (no la suma de ambas piernas,
  que son mutuamente excluyentes por diseño de Binance). Pedimos al architect confirmar esta
  lectura al definir el cálculo de sizing/concurrencia exacto.

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| `LIMIT_MAKER` | Tipo de orden límite que Binance rechaza si cruzaría el book y ejecutaría como taker; en este ciclo se coloca como orden de entrada suelta o como pierna inferior de un OCO de entrada, siempre por debajo del precio de referencia para una compra. |
| OCO de entrada | Par de órdenes contingentes de compra (`orderList` con `side: BUY`): `LIMIT_MAKER` por debajo del precio de referencia y `STOP_LOSS_LIMIT` de ruptura por encima; al llenarse una pierna, Binance cancela la otra. |
| `trailingDelta` | Delta en BIPS que hace que una pierna de tipo `STOP_LOSS`/`STOP_LOSS_LIMIT`/`TAKE_PROFIT`/`TAKE_PROFIT_LIMIT` persiga el precio en vez de dispararse en un nivel fijo; en este ciclo, opcional y exclusivo de la pierna de ruptura del OCO de entrada. |
| BIPS | Unidad de `trailingDelta`: 100 BIPS equivalen a 1 %. |
| Filtro `TRAILING_DELTA` | Filtro de símbolo de Binance que acota el rango válido (`minTrailingAboveDelta`..`maxTrailingAboveDelta`) de un `trailingDelta` para una compra; se valida localmente antes de firmar. |
| Entrada descansando | Orden de entrada (`LIMIT_MAKER` suelta u OCO) colocada en Binance y persistida en `entry_orders`, viva en el exchange independientemente de si el servicio está corriendo. |
| Fill | Confirmación, obtenida por consulta REST durante la reconciliación, de que una entrada descansando se ejecutó en el exchange. |
| Reconciliación | Rutina (`ReconciliationService`) que corre al inicio de cada ciclo del processor en `LIVE`/`TESTNET` y, en este ciclo, además detecta el fill, el vencimiento y las órdenes huérfanas de las entradas descansando. |
| `EXCHANGE_TRIGGER` | Valor nuevo de `BotActionSource`: identifica un registro de `bot_actions` que audita algo que el exchange ya ejecutó (el fill de una entrada), sin haber pasado por `authorizeAndRun`. |
| TTL de entrada | Tiempo máximo, contado desde `placedAt`, que una entrada puede permanecer `RESTING` sin fill antes de vencer (`EXPIRED`) y cancelarse en el exchange. |
