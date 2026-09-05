# Functional — Cycle 2: Migración del transporte del user data stream a la WebSocket API

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Cycle-01 construyó el detector de fills por evento del exchange y lo dejó verde contra dobles,
pero **inerte contra la Binance de hoy**: Binance retiró `POST/PUT/DELETE /api/v3/userDataStream`
(410 Gone, a nivel de infraestructura, en TESTNET y en producción — no es un problema de firma, de
clave ni de IP). El objetivo de negocio no cambió un milímetro: seguir protegiendo la posición
apenas Binance confirma el fill de una entrada descansando, en el orden de segundos y no en el
orden del próximo tick de mercado. Lo único que cambia es **el riel por el que viaja ese aviso**.

Binance reemplaza el par `listenKey` (REST) + socket single-stream por su **WebSocket API**: un
socket único donde primero hay que autenticarse (`session.logon`, firmado con una clave **Ed25519**
en vez de la clave HMAC de siempre) y después suscribirse a los eventos de la cuenta
(`userDataStream.subscribe`). El aviso concreto de un fill —el `executionReport`— es el mismo de
antes; lo que cambia es cómo se abre y se mantiene viva la sesión que lo entrega.

Todo lo que cycle-01 construyó y que **no depende de por dónde entra el aviso** se conserva
intacto: el crédito de una sola escucha por dueño y ambiente, la máquina de estados del ciclo de
vida, la correlación con la orden de entrada descansando (incluido el respaldo por sufijo de la
OCO), el conteo único de un mismo fill visto por dos detectores, la publicación de salud y
degradación, el interruptor apagado por default y el ensamblado en el composition root. Nada de
esto se vuelve a discutir: se hereda, y este ciclo lo protege de regresión.

Se suma una dimensión nueva que cycle-01 no tenía: la clave Ed25519 es una credencial que **el
dueño de la cuenta de Binance TESTNET tiene que crear él mismo** y cargar en el entorno. El
sistema no puede asumir que existe. Con la clave ausente, la plataforma tiene que arrancar exacta-
mente igual que si el interruptor estuviera apagado: sin sesión, sin ruido en el log, con la sonda
por tick como único detector.

Por último, este ciclo absorbe un puñado de defectos y deudas que cycle-01 dejó anotados en su
`reviewer_report` — no son ideas nuevas, son arreglos concretos sobre código que ya existe y que
sobrevive al cambio de transporte.

## Historias de usuario

### HU-01: Protección de la posición apenas se confirma la compra

**Como** trader dueño del bot
**Quiero** que mi posición quede protegida (stop loss / take profit) apenas Binance confirma que
mi orden de entrada se llenó
**Para** no quedar expuesto, ni un instante más de lo necesario, a un movimiento de precio en
contra sin ningún freno puesto

> Sin cambios de intención respecto de cycle-01: el transporte que entrega el aviso cambió, el
> contenido del aviso y lo que dispara no.

**Criterios de aceptación:**

- [ ] CA-1: La creación de la posición, el registro de la operación y la protección inicial se
      disparan por el aviso del exchange recibido a través de la sesión autenticada nueva, sin
      esperar ningún tick de mercado posterior — verificable porque, con cero ticks del símbolo
      después del fill, la posición igual queda creada y protegida.
- [ ] CA-2: El aviso del exchange se asocia a la orden de entrada descansando correcta usando su
      identificador principal; si ese identificador no alcanza a resolverla, se prueba con los
      identificadores de respaldo de esa misma orden (incluido el sufijo `-l`/`-s` de la pierna
      OCO) antes de descartar el aviso.
- [ ] CA-3: El trader ve, en la interfaz y en el historial, exactamente el mismo tipo de evento y
      el mismo contenido de información para un fill, sea cual sea el detector (sesión autenticada
      del exchange o sonda) que lo haya captado primero — no hay ningún dato ni campo nuevo que
      dependa de cuál detector ganó, ni ninguno que dependa de que el transporte haya cambiado.

**Casos de error:**

- [ ] CE-1: Si el aviso del exchange llega para una orden que ya no está descansando (porque se
      canceló, ya se resolvió, o no existe), no produce ningún efecto: ni posición nueva, ni
      operación nueva, ni notificación.
- [ ] CE-2: Si el identificador principal del aviso no coincide con ninguna orden descansando pero
      sí lo hace alguno de los identificadores de respaldo, el fill se resuelve igual sobre la
      orden correcta.

### HU-02: Una compra nunca se cuenta dos veces

**Como** operador de la plataforma
**Quiero** que un mismo fill de una orden de entrada nunca produzca más de una posición, más de
una operación registrada ni más de un registro de acción del bot, sin importar cuántos detectores
lo hayan visto ni en qué orden llegaron
**Para** que las posiciones, el historial de operaciones y los límites de frecuencia del bot no se
corrompan por tener dos caminos que avisan del mismo hecho

**Criterios de aceptación:**

- [ ] CA-1: Para una misma orden de entrada, cualquier combinación de detectores que observe el
      mismo fill — la sesión autenticada dos veces, la sesión autenticada y la sonda, o la sonda y
      el barrido de arranque — deja exactamente una posición, una operación registrada y un
      registro de acción del bot, en cualquiera de los dos órdenes posibles de llegada.
- [ ] CA-2: El segundo detector (y cualquiera posterior) que observa un fill ya resuelto no genera
      una notificación nueva, ni un evento nuevo hacia la interfaz, ni una llamada redundante al
      exchange — el efecto observable del segundo aviso es nulo.
- [ ] CA-3 *(issue-6)*: La identidad de un fill se marca como vista recién cuando la reconciliación
      terminó de resolverse con éxito. Si la reconciliación falla a mitad de camino (por ejemplo, la
      escritura no se completa), la identidad **no** queda marcada como vista y una reentrega
      posterior del mismo aviso puede volver a intentar la reconciliación — la plataforma nunca
      descarta un fill real solo porque un intento previo se cayó a mitad de camino.

**Casos de error:**

- [ ] CE-1: Si dos detectores llegan a procesar el mismo fill al mismo tiempo, solo uno de los dos
      completa la reconciliación; el otro se retira sin dejar rastro adicional.

### HU-03: La plataforma se despliega sin cambiar nada para nadie

**Como** operador de la plataforma
**Quiero** que esta capacidad se entregue apagada por default
**Para** poder actualizar la plataforma sin que ningún bot existente cambie su comportamiento
observable, y decidir yo cuándo y para quién activarla

**Criterios de aceptación:**

- [ ] CA-1: Con la capacidad en su valor de fábrica (apagada), el sistema no abre ninguna sesión
      autenticada de eventos del exchange, no envía ningún `session.logon` ni ningún
      `userDataStream.subscribe`, y no lee ni exige ninguna clave Ed25519 — la sonda por tick sigue
      siendo el único detector, exactamente como antes de este ciclo y exactamente igual que en
      cycle-01.
- [ ] CA-2: Activar o desactivar esta capacidad no requiere ningún cambio en la interfaz del
      trader: los mismos eventos y las mismas consultas que ya existen siguen funcionando igual, se
      use o no se use el canal de eventos del exchange.
- [ ] CA-3 *(issue-7)*: El interruptor se lee con una única forma válida de estar encendido — un
      valor de configuración que no sea exactamente esa forma (por ejemplo, una variante numérica
      o cualquier otro texto) se trata como apagado. No existe una segunda forma implícita de
      encender la capacidad.

**Casos de error:**

- [ ] N/A — esta historia describe la ausencia de comportamiento nuevo; no hay integración externa
      involucrada mientras la capacidad está apagada.

### HU-04: La sesión autenticada del exchange no se corta sola

**Como** operador de la plataforma
**Quiero** que la sesión autenticada de eventos del exchange se renueve y, si la conexión se cae o
el exchange la invalida, se renegocie sola
**Para** que la detección rápida de fills no se pierda silenciosamente por vencimiento de sesión
ni requiera que alguien la reconecte a mano

> Reemplaza al HU-04 de cycle-01: donde antes había que crear, renovar por keepalive antes del
> vencimiento de 60 minutos y cerrar un `listenKey`, ahora hay que autenticar una sesión
> (`session.logon`), suscribirse (`userDataStream.subscribe`), y repetir esa autenticación y esa
> suscripción **después de cada reconexión del socket** — no solo cuando el exchange invalida algo
> explícitamente, porque la WebSocket API no tiene un aviso de invalidación equivalente al de
> `listenKey`: cualquier caída de la conexión deja la sesión sin autenticar del otro lado.

**Criterios de aceptación:**

- [ ] CA-1: Mientras la capacidad está activa, nunca transcurre el plazo completo del límite de la
      sesión/conexión sin que se haya registrado una renovación (relogon) previa.
- [ ] CA-2: Después de **cualquier** reconexión del socket —por caída de red, por cierre del lado
      del exchange, o por cualquier otro motivo— el sistema vuelve a autenticar la sesión
      (`session.logon`) y a suscribirse (`userDataStream.subscribe`) antes de considerar la
      escucha operativa de nuevo, sin que el trader ni el operador intervengan.
- [ ] CA-3: Al apagar el bot o la plataforma, la sesión se cierra explícitamente (logout o cierre
      limpio del socket) en vez de quedar abierta del lado del exchange.
- [ ] CA-4: Para un mismo dueño y un mismo ambiente (real o de pruebas), existe una única sesión
      autenticada viva, sin importar cuántos bots de ese dueño estén corriendo al mismo tiempo.
- [ ] CA-5 *(issue-2)*: Si la autenticación de una sesión nueva falla durante una renegociación
      (por ejemplo, el exchange rechaza el `session.logon`), el crédito de escucha de esa
      credencial se libera o se reintenta con espera creciente — nunca queda retenido para
      siempre bloqueando a otra réplica del mismo dueño y ambiente.
- [ ] CA-6 *(issue-3)*: El reintento de negociación de sesión disparado por el barrido periódico
      usa una espera que crece con cada intento fallido consecutivo (no un intento fijo cada 10
      segundos por credencial) y dejar de intentar no genera más de un aviso por intento real.

**Casos de error:**

- [ ] CE-1: Si el exchange rechaza la renovación o la creación de la sesión, el sistema lo trata
      como canal no sano (ver HU-05) en vez de quedar en un estado indefinido.

### HU-05: La degradación del canal de eventos se ve, y la sonda no la deja pasar

**Como** trader dueño del bot
**Quiero** que si el canal de eventos del exchange se cae o se queda en silencio el sistema lo
declare como no sano y la sonda por tick siga cubriendo mis fills
**Para** no perder protección de mis posiciones por una falla de infraestructura que nadie nota

**Criterios de aceptación:**

- [ ] CA-1: Cuando el canal de eventos está degradado o caído, existe un estado observable que lo
      refleja, distinto del estado sano.
- [ ] CA-2 *(issue-5)*: Mientras el canal de eventos está degradado o caído, un tick de mercado que
      cruza el nivel de la orden de entrada descansando produce la misma reconciliación completa
      que produciría el canal de eventos — verificado con un test de comportamiento explícito
      (stream en DEGRADED + tick que cruza el nivel ⇒ reconciliación), no por inspección manual del
      código ni por ausencia de acoplamiento entre servicios.
- [ ] CA-3: Un canal de eventos silencioso (sin fills que avisar) y un canal de eventos muerto
      (caído) se distinguen por su antigüedad de última señal, nunca se reportan como si el
      silencio significara salud.
- [ ] CA-4: Cuando el canal de eventos vuelve a estar sano, retoma la detección rápida sin que el
      operador tenga que reactivarlo a mano.

**Casos de error:**

- [ ] CE-1: Si el mecanismo de coordinación del que depende la escucha no está disponible, el
      sistema cae al mismo estado degradado descrito arriba — nunca deja de detectar fills, y
      nunca falla de forma que interrumpa al resto del bot.

### HU-06: El material sensible de la sesión nunca se filtra

**Como** operador de la plataforma
**Quiero** que la clave privada Ed25519, la firma que produce y la clave de API del trader nunca
aparezcan en logs, respuestas de la plataforma ni eventos hacia la interfaz
**Para** que ningún tercero con acceso a logs, a la base de datos o al tráfico hacia el navegador
pueda usar ese material para leer u operar la cuenta del trader en Binance

> Reemplaza al HU-06 de cycle-01: donde el material sensible era el `listenKey`, ahora son tres
> piezas distintas — la clave privada Ed25519, la firma que se computa con ella para cada
> `session.logon`, y la `apiKey` que acompaña esa firma. Las tres se tratan igual de sensibles.

**Criterios de aceptación:**

- [ ] CA-1: Ningún log generado por la plataforma contiene la clave privada Ed25519, una firma de
      `session.logon`, ni una clave de API.
- [ ] CA-2: Ninguna respuesta de la plataforma ni ningún evento enviado hacia la interfaz del
      trader contiene la clave privada Ed25519, una firma de `session.logon`, ni una clave de API.

**Casos de error:**

- [ ] CE-1: Si en algún punto alguna de esas tres piezas llega a un componente que la registraría
      por default (por ejemplo, un log de error genérico que vuelca la configuración de la
      petición), se enmascara antes de escribirse.

### HU-07: La confiabilidad del sistema se puede verificar sin depender de Binance

**Como** operador de la plataforma
**Quiero** que la suite de pruebas automatizadas no necesite acceso a la red del exchange, y que
exista evidencia registrada de una verificación real contra el ambiente de pruebas de Binance
**Para** poder confiar en la integración continua del proyecto y, aparte, tener prueba de que la
capacidad funciona contra el exchange real de pruebas, sin arriesgar nunca el ambiente real

**Criterios de aceptación:**

- [ ] CA-1: La suite automatizada de los proyectos involucrados (`apps/api`, `libs/data-fetcher`,
      `libs/shared`, `libs/analysis`) pasa completa sin ningún acceso a la red del exchange,
      incluido el transporte nuevo de la WebSocket API — se verifica contra un doble.
- [ ] CA-2: La corrida contra el ambiente de pruebas de Binance es **opt-in y local** — no corre en
      CI, requiere una variable de entorno explícita para habilitarse, y queda **bloqueada** hasta
      que el dev cree la clave Ed25519 en su propia cuenta de TESTNET y la cargue en su `.env`. El
      bloqueo se documenta como tal: mientras la clave no exista, el ciclo registra que esa
      verificación no se ejecutó (no se inventa evidencia ni se marca como pasada) y deja constancia
      de que el bloqueo es la ausencia de la credencial, no un defecto del transporte.
- [ ] CA-3: Si y cuando esa corrida se ejecuta, para que cuente como evidencia tiene que haber
      creado una sesión autenticada real (`session.logon` + `userDataStream.subscribe`), haberla
      mantenido viva a través de al menos una renovación o reconexión, y haber recibido al menos un
      aviso real de fill que llegue al mismo camino de reconciliación que ya existe.
- [ ] CA-4: Esa verificación nunca se ejecuta contra el ambiente real (de producción) de Binance —
      el harness aborta si la URL base no es la de testnet.

**Casos de error:**

- [ ] N/A — esta historia describe una propiedad del proceso de verificación, no un flujo con input
      de usuario en producción.

### HU-08: Sin clave Ed25519, la plataforma arranca igual que siempre

**Como** operador de la plataforma
**Quiero** que la ausencia de la clave Ed25519 del dueño de la credencial no rompa el arranque ni
ensucie el log
**Para** poder desplegar y operar la plataforma en cualquier entorno —incluido uno donde el dev
todavía no creó esa clave en su cuenta de Binance TESTNET— sin ningún efecto adverso

**Criterios de aceptación:**

- [ ] CA-1: Con la capacidad encendida pero sin la contraparte Ed25519 cargada para una credencial
      dada, la plataforma arranca con normalidad: no lanza una excepción, no bloquea el arranque de
      ningún otro módulo, y esa credencial en particular queda sin sesión autenticada de eventos.
- [ ] CA-2: Para esa credencial sin Ed25519, la sonda por tick sigue siendo el detector de fills —
      exactamente el mismo comportamiento observable que si la capacidad estuviera apagada para
      ella.
- [ ] CA-3: La ausencia de la clave se registra **una vez** (o con una frecuencia acotada y
      espaciada) y nunca como un log de error repetido por segundo o por intento de reconexión —
      la ausencia de credencial no es una condición de reintento agresivo.
- [ ] CA-4: Una credencial que sí tiene su contraparte Ed25519 cargada abre su sesión con
      normalidad aunque otras credenciales del mismo despliegue no la tengan — la ausencia de la
      clave es por credencial, nunca un apagado global de la capacidad.

**Casos de error:**

- [ ] CE-1: Si la clave Ed25519 está presente pero es inválida o está mal formada (PEM corrupto,
      por ejemplo), el sistema lo trata igual que una autenticación rechazada por el exchange —
      cae al mismo estado degradado de HU-05, nunca a una excepción no controlada.

### HU-09: Un error de socket nunca tira el proceso abajo, y la memoria del proceso no crece sin límite

**Como** operador de la plataforma
**Quiero** que un error del socket subyacente se capture y se trate como degradación, y que las
estructuras internas que acumulan estado por credencial o por ejecución tengan un límite
**Para** que ni un error de red ni el paso del tiempo en un proceso de larga vida terminen tirando
abajo la plataforma completa o agotándole la memoria

**Criterios de aceptación:**

- [ ] CA-1 *(issue-4)*: Un error emitido por el cliente WebSocket de la sesión autenticada de
      eventos de usuario se captura explícitamente: nunca queda como un evento sin escucha que
      derribe el proceso. El error se refleja como degradación del canal (HU-05), nunca como una
      caída del proceso completo.
- [ ] CA-2 *(issue-4)*: La misma garantía aplica al cliente WebSocket del stream de mercado que ya
      existía antes de este ciclo: un error del socket de mercado tampoco tira abajo el proceso.
- [ ] CA-3 *(issue-8)*: Las estructuras internas que guardan configuración, credenciales o
      ejecutores resueltos por credencial no crecen sin límite a lo largo de la vida del proceso —
      verificable resolviendo más entradas distintas que la capacidad esperada y comprobando que el
      tamaño de esas estructuras deja de crecer.

**Casos de error:**

- [ ] N/A — esta historia describe garantías de resiliencia operativa, no un flujo de negocio con
      input de usuario.

## Reglas de negocio

1. **RN-01 — Un solo camino de reconciliación.** Sin importar qué detector avise primero de un
   fill (sesión autenticada del exchange o sonda por tick), la creación de la posición, la
   operación registrada y la protección inicial siempre pasan por el mismo mecanismo de
   reconciliación. No existe un camino alternativo que produzca esos mismos efectos por su cuenta.
2. **RN-02 — Conteo único (anti doble conteo).** Un fill de una orden de entrada nunca produce más
   de una posición, más de una operación registrada ni más de un registro de acción del bot,
   independientemente de cuántos detectores lo observen o en qué orden lo hagan. Esta regla es un
   requisito del ciclo, no una consecuencia esperada de otra cosa.
3. **RN-03 — El silencio nunca es salud.** Un canal de eventos que no tiene fills que avisar y un
   canal de eventos caído se ven exactamente igual desde afuera: ninguno de los dos emite nada. El
   sistema nunca interpreta la ausencia de eventos como "todo en orden"; el estado de salud se
   decide por la antigüedad de la última señal recibida, no por la ausencia de fills.
4. **RN-04 — Apagado por default, siempre.** Toda instalación que se actualice sin tocar su
   configuración se comporta exactamente igual que antes de este ciclo. Encender la capacidad es
   una decisión explícita del operador, nunca el resultado de una actualización, y esa decisión se
   expresa con un único valor válido (RN-09).
5. **RN-05 — La sonda por tick no se retira.** Aunque el canal de eventos del exchange esté sano y
   activo, la sonda por tick sigue existiendo como red de contención. La sonda es quien cubre los
   fills mientras el canal de eventos no está disponible, no está activado, o la credencial no
   tiene su contraparte Ed25519 (RN-11).
6. **RN-06 — Una sola escucha por dueño y ambiente.** Para un mismo dueño de credenciales y un
   mismo ambiente (real o de pruebas), existe una única sesión autenticada de eventos viva a la
   vez, sin importar cuántos bots de ese dueño estén corriendo.
7. **RN-07 — El material de la sesión es sensible.** La clave privada Ed25519, la firma que
   produce y la clave de API se tratan igual que una credencial de acceso: no se escriben en logs,
   no viajan hacia la interfaz del trader bajo ninguna circunstancia, y se enmascaran si llegan a
   un componente que las registraría por default.
8. **RN-08 — Nunca contra el ambiente real durante la verificación.** Cualquier verificación de
   este ciclo contra Binance se hace exclusivamente contra el ambiente de pruebas. No hay
   escenario, ni de excepción, en el que la verificación toque el ambiente real.
9. **RN-09 — El interruptor tiene una sola forma de estar encendido.** El valor de configuración
   que enciende la capacidad admite exactamente una forma válida; cualquier otro valor —incluidas
   variantes que antes se toleraban— se trata como apagado.
10. **RN-10 — Re-autenticación obligatoria tras cualquier reconexión.** La WebSocket API no avisa
    invalidez de sesión como lo hacía el `listenKey`: toda reconexión del socket, sea cual sea su
    causa, exige una autenticación y una suscripción nuevas antes de considerar la escucha
    operativa otra vez.
11. **RN-11 — La credencial Ed25519 es por dueño, y su ausencia es local a esa credencial.** Que
    una credencial no tenga su contraparte Ed25519 nunca apaga la capacidad para las demás
    credenciales del mismo despliegue, ni rompe el arranque: esa credencial en particular queda sin
    sesión, cubierta por la sonda.
12. **RN-12 — Un intento fallido de reconciliación no cierra la puerta a la reentrega.** La
    identidad de un fill se marca como vista solo después de que la reconciliación termina de
    resolverse con éxito; un intento que falla a mitad de camino deja la puerta abierta a que una
    reentrega posterior lo vuelva a intentar.
13. **RN-13 — Los reintentos crecen, nunca se repiten a ritmo fijo indefinidamente.** Todo
    reintento de negociación de sesión —sea por reconexión, por invalidación o por el barrido
    periódico— usa una espera que crece con cada fallo consecutivo, y cada intento real (no cada
    tick de espera) genera como máximo un aviso.
14. **RN-14 — El estado interno del proceso no crece sin límite.** Las estructuras que acumulan
    configuración, credenciales o ejecutores resueltos por credencial tienen un tamaño acotado a lo
    largo de la vida del proceso, sin importar cuántas credenciales distintas se resuelvan con el
    tiempo.

## Glosario del dominio

| Término                            | Definición                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WebSocket API de Binance            | El transporte nuevo de este ciclo: un socket único (`wss://ws-api(.testnet)…/ws-api/v3`) sobre el que se autentica una sesión y se reciben eventos, en reemplazo del `listenKey` + socket single-stream de cycle-01. |
| `session.logon`                     | El método de la WebSocket API que autentica la sesión, firmado con la clave privada Ed25519 del dueño de la credencial.                                                       |
| `userDataStream.subscribe`          | El método de la WebSocket API que, sobre una sesión ya autenticada, suscribe al socket a los eventos privados de la cuenta (incluido `executionReport`).                      |
| Clave Ed25519                       | La credencial nueva que el dueño de la cuenta de Binance TESTNET crea y carga en su entorno para poder firmar `session.logon`. Reemplaza, para este propósito, a la firma HMAC de las claves de API tradicionales. |
| `executionReport`                   | El aviso concreto que llega por la sesión autenticada cuando el estado de una orden cambia, incluido el fill. Su contenido no cambió respecto de cycle-01.                    |
| `listenKey`                         | Transporte de cycle-01, retirado por Binance (410 Gone) y reemplazado en este ciclo. Se documenta solo como referencia histórica.                                             |
| Orden de entrada descansando        | Una orden de compra que el bot dejó puesta en el libro de Binance en vez de comprar de una al mercado; queda a la espera de que el precio la cruce.                            |
| Sonda por tick                      | El detector de fills vigente antes de este ciclo y que sigue existiendo: cada vez que llega un movimiento de precio del símbolo, le pregunta al exchange si la orden ya se llenó. |
| Barrido de arranque                 | La verificación que corre al levantar el servicio y revisa el estado real de todas las órdenes de entrada descansando, por si algo cambió mientras estaba caído.               |
| Reconciliación                      | El proceso que, ante la confirmación de un fill, crea la posición, registra la operación, aplica la protección inicial y deja constancia de la acción del bot.                 |
| Ventana sin protección              | El tiempo que transcurre entre el fill real en el exchange y el momento en que el sistema aplica stop loss / take profit a esa posición.                                       |
| Estado degradado / caída del canal  | La condición en la que la sesión autenticada del exchange dejó de responder o de emitir señales dentro del plazo esperado, y por lo tanto no es confiable usarla.              |
| Reconexión                          | Cualquier evento que cierra y vuelve a abrir el socket de la WebSocket API, sea por caída de red, por cierre del lado del exchange o por cualquier otro motivo — siempre exige re-autenticación y re-suscripción. |

## Trazabilidad — HU vs. criterios de aceptación de la spec (§6, reinterpretados por DEC-001)

| HU    | CA-001 | CA-002 | CA-003 | CA-004 | CA-005 | CA-006 | CA-007 | CA-008 |
| ----- | :----: | :----: | :----: | :----: | :----: | :----: | :----: | :----: |
| HU-01 |        |   ✔    |        |   ✔    |        |        |        |        |
| HU-02 |        |        |   ✔    |        |        |        |        |        |
| HU-03 |   ✔    |        |        |   ✔    |        |        |        |        |
| HU-04 |        |        |        |        |   ✔    |        |        |        |
| HU-05 |        |        |        |        |        |   ✔    |        |        |
| HU-06 |        |        |        |        |        |        |   ✔    |        |
| HU-07 |        |        |        |        |        |        |        |   ✔    |
| HU-08 |  (✔)   |        |        |        |        |        |        |        |
| HU-09 |        |        |        |        |        |        |        |        |

> **HU-08** no tiene un CA-00X propio en la spec original: extiende el espíritu de CA-001
> (interruptor apagado ⇒ nada nuevo se abre) al caso, no contemplado en cycle-01, de interruptor
> **encendido** pero credencial Ed25519 **ausente**. La marca `(✔)` refleja esa extensión, no una
> coincidencia literal — así lo exige `brief.yaml` de este ciclo.
>
> **HU-09** no traza contra ningún CA de la spec: cubre follow-ups de robustez operativa
> (issue-4, issue-8) que `reviewer_report.follow_ups` de cycle-01 dejó pendientes y que
> `brief.yaml` de cycle-02 absorbe explícitamente como alcance del ciclo, sin ser parte de los
> criterios de aceptación originales de la spec.
