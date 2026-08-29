# Functional — Cycle 1: Loop de ejecución reactivo

> **Input:** sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-005-reactive-execution-loop/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Hoy el bot le saca una foto al mercado cada 15-30 minutos y reacciona a esa foto. Entre una
decisión y la siguiente queda ciego: si el precio se mueve un 4% en el minuto 3 de una ventana
de 30 minutos, el sistema no se entera hasta que el reloj lo despierta. La inteligencia de la
decisión y su costo ya se resolvieron en un ciclo anterior (spec-001): el cuello de botella dejado
de lado es el **tiempo de reacción**.

Este ciclo introduce una capa reactiva con tres piezas que trabajan a velocidades distintas:

1. **El disparador de ciclo de decisión** — decide CUÁNDO vale la pena evaluar la situación
   (con o sin LLM). Se dispara por evento material o por el temporizador, lo que llegue primero.
2. **El fast path** — un conjunto acotado de reflejos que protegen una posición ya abierta en
   cada tick de precio, sin pasar por el LLM.
3. **Los caps** — el freno que impide que la velocidad ganada en (1) y (2) se traduzca en
   sobre-operación. No son una mejora opcional: son la condición de seguridad que permite que
   exista todo lo demás. Sin caps, quitar el temporizador quita el único limitador de frecuencia
   que el sistema tiene hoy.

**Regla de lectura de este documento:** todo criterio de aceptación fue escrito o reescrito para
medir una **propiedad verificable con datos congelados** (fixtures, escenarios, mocks), nunca un
valor que dependa de cómo se mueva el mercado real. Donde el criterio de la spec original medía
un valor, se lo reinterpretó explícitamente — ver Regla de negocio RN-30.

**Actores de este ciclo:**

- **Trader dueño del bot** — configura su `TradingConfig`, opera con su capital, y es quien
  observa (o sufre) el comportamiento del loop reactivo, los reflejos del fast path y los caps.
  Es el actor principal de casi todas las historias.
- **Operador de la plataforma** — responsable de que el backend funcione correctamente cuando
  corre en más de una réplica; le interesa que un evento no se procese N veces, no el detalle de
  una posición individual.

---

## Historias de usuario

### US-01-001: Reaccionar a un movimiento de precio significativo sin esperar al reloj

**Como** trader dueño del bot
**Quiero** que el sistema evalúe una nueva decisión en cuanto el precio se aleja lo suficiente del
nivel al que se tomó la última decisión, sin esperar a que venza el temporizador
**Para** no quedar expuesto a un movimiento fuerte del mercado durante una ventana de espera larga

**Criterios de aceptación:**

- [ ] Dado un tick cuyo precio se aparta del precio registrado en la última decisión (LLM o gate)
      en más que el umbral configurado, el sistema inicia un ciclo de decisión antes de que venza
      el temporizador vigente.
- [ ] Dado un tick cuyo precio se mantiene dentro del umbral respecto de esa misma referencia, el
      sistema NO inicia un ciclo de decisión adicional; el temporizador sigue siendo el único
      disparador para esa ventana.
- [ ] El umbral usado es el mismo campo que ya gobierna el gate determinístico
      (`gatePriceChangePct` de `TradingConfig`) — este ciclo no introduce un segundo umbral de
      movimiento de precio que compita con el existente.

---

### US-01-002: Reaccionar a un quiebre de nivel de soporte o resistencia

**Como** trader dueño del bot
**Quiero** que el sistema evalúe una nueva decisión cuando el precio cruza un nivel de soporte o
resistencia ya identificado por el análisis técnico
**Para** no dejar pasar un quiebre que cambia el escenario, aunque el movimiento porcentual total
todavía no dispare el umbral de precio

**Criterios de aceptación:**

- [ ] Dado un tick cuyo precio cruza (pasa de un lado al otro de) alguno de los niveles vigentes
      en `IndicatorSnapshot.supportResistance` (soporte o resistencia), el sistema inicia un ciclo
      de decisión.
- [ ] Dado un tick cuyo precio oscila del mismo lado de todos los niveles vigentes sin cruzar
      ninguno, el sistema NO inicia un ciclo de decisión por este disparador.
- [ ] Un mismo nivel que ya disparó un evento no vuelve a disparar un segundo evento mientras el
      precio siga oscilando pegado a él sin alejarse y volver a cruzarlo (evita flapping sobre el
      mismo nivel).

---

### US-01-003: Reaccionar a un spike de volumen

**Como** trader dueño del bot
**Quiero** que el sistema evalúe una nueva decisión cuando el volumen operado se dispara respecto
de su promedio reciente
**Para** captar actividad anómala del mercado aunque el precio todavía no se haya movido lo
suficiente como para disparar los otros dos eventos

**Criterios de aceptación:**

- [ ] Dado un tick cuyo indicador de volumen reporta una proporción actual/promedio por encima del
      umbral configurado, el sistema inicia un ciclo de decisión.
- [ ] Dado un tick cuyo indicador de volumen reporta una proporción por debajo del umbral, el
      sistema NO inicia un ciclo de decisión por este disparador, sin importar cuán alto sea el
      volumen en términos absolutos (la comparación siempre es relativa al promedio reciente del
      propio símbolo, nunca un valor absoluto en USD o en unidades del activo).

---

### US-01-004: El temporizador nunca desaparece

**Como** trader dueño del bot
**Quiero** que el temporizador configurado siga funcionando como piso aunque el loop reactivo esté
encendido
**Para** tener la garantía de que, incluso si ningún evento material se dispara nunca, mi bot sigue
evaluando su posición con la cadencia que yo configuré

**Criterios de aceptación:**

- [ ] Dado un escenario congelado sin ningún evento material dentro de una ventana, el ciclo de
      decisión se ejecuta igual al vencer el temporizador vigente (`minIntervalMinutes` en modo
      `CUSTOM`, o `suggestedWaitMinutes` en modo `AGENT`).
- [ ] Ningún evento material puede alargar el temporizador vigente; un evento material solo puede
      adelantar el próximo ciclo, nunca posponerlo.

---

### US-01-005: Una ventana sin novedad no gasta una llamada de LLM

**Como** trader dueño del bot
**Quiero** que si no pasó nada material entre dos evaluaciones, el sistema no llame al LLM solo
porque el temporizador venció
**Para** que el loop reactivo baje mi costo operativo en vez de subirlo

**Criterios de aceptación:**

- [ ] Con el loop encendido, en cada uno de los escenarios congelados del harness de costo
      (`apps/api/src/orchestrator/cost-harness/`) donde no hay evento material dentro de la
      ventana, el número de llamadas al LLM del ciclo de decisión es igual o menor al de la línea
      base **para ese mismo escenario** — no alcanza con que el agregado de los 12 escenarios
      mejore; ninguno puede empeorar individualmente.
- [ ] El disparo de un ciclo de decisión (por evento o por temporizador) nunca implica, por sí
      solo, una llamada al LLM: la llamada sigue condicionada a que el gate determinístico
      determine que hace falta.

---

### US-01-006: El stop duro se ejecuta sin esperar al LLM

**Como** trader dueño del bot
**Quiero** que mi posición se cierre por stop duro en cuanto el precio lo justifica, sin esperar a
que un ciclo de LLM termine de razonar
**Para** no perder más de lo que mi configuración de riesgo tolera mientras el sistema "piensa"

**Criterios de aceptación:**

- [ ] Dado un tick de precio que hace que `evaluateSellPolicy` resuelva `LOSS_CUT` para una
      posición abierta, el sistema ejecuta la venta sin invocar al LLM y sin esperar al próximo
      ciclo de decisión, siempre que ningún cap de frecuencia (RN-16 a RN-22) lo bloquee.
- [ ] La decisión de vender por stop duro no requiere ni consulta ningún campo de la respuesta del
      LLM.

---

### US-01-007: La salida por trailing se ejecuta sin esperar al LLM

**Como** trader dueño del bot
**Quiero** que mi trailing stop se actualice y, si corresponde, dispare la salida en cada tick
**Para** capturar la mayor parte posible de una tendencia favorable sin depender de la cadencia del
LLM

**Criterios de aceptación:**

- [ ] Dado un tick que hace que `updateTrailingStop` (de `position-manager`) determine que el
      trailing debe disparar la salida, el sistema ejecuta la venta sin invocar al LLM, sujeto a
      los mismos caps de frecuencia que cualquier otra acción del fast path.
- [ ] Dado un tick que solo actualiza el nivel del trailing sin disparar la salida, el sistema
      persiste el nuevo nivel y no ejecuta ninguna orden ni cuenta como una acción a efectos de los
      caps (RN-16).

---

### US-01-008: La protección nativa se re-arma sin esperar al LLM

**Como** trader dueño del bot
**Quiero** que la orden de protección que descansa en el exchange (stop/OCO) se reemplace
automáticamente cuando el trailing o el take-profit parcial mueven el nivel que debía proteger
**Para** que la protección que realmente me cubre si el sistema se cae sea siempre la vigente, no
una desactualizada

**Criterios de aceptación:**

- [ ] Dado un tick en el que `resolveProtectionRearm` determina que el nivel de protección nativa
      quedó desactualizado respecto del nuevo stop/trailing, el sistema cancela la protección
      anterior y coloca la nueva sin invocar al LLM.
- [ ] El re-armado respeta la restricción de diseño ya vigente: la protección se cancela **antes**
      de cualquier venta de mercado relacionada con la misma posición (ver RN-15 y CA-006).

---

### US-01-009: El take-profit parcial se ejecuta sin esperar al LLM

**Como** trader dueño del bot
**Quiero** que el sistema tome ganancia parcial en cuanto se alcanza el nivel configurado, sin
esperar el próximo ciclo de LLM
**Para** asegurar parte de la ganancia apenas está disponible, no cuando el reloj lo permite

**Criterios de aceptación:**

- [ ] Dado un tick que hace que `resolvePartialTakeProfit` devuelva una salida parcial elegible
      (posición sin escalón previo ejecutado), el sistema ejecuta `applyPartialExit` sin invocar
      al LLM.
- [ ] Dado una posición que ya ejecutó su único escalón de take-profit parcial soportado hoy
      (`partialExitCount > 0`), ningún tick posterior vuelve a disparar un take-profit parcial
      sobre esa posición — esto es una propiedad de la función pura existente, no una regla nueva
      de este ciclo (ver RN-6).

---

### US-01-010: El fast path nunca abre una posición nueva

**Como** trader dueño del bot
**Quiero** tener la garantía de que ningún reflejo automático del fast path puede iniciar una
posición nueva por sí solo
**Para** que la decisión de tomar riesgo nuevo siga pasando siempre por el criterio del LLM (y, en
última instancia, por el mío al configurar el bot)

**Criterios de aceptación:**

- [ ] El conjunto de acciones que el fast path puede ejecutar sin LLM está compuesto
      exclusivamente por: stop duro, salida por trailing, re-armado de protección nativa y
      take-profit parcial (RN-1 a RN-5). Ninguna de estas cuatro funciones puede producir una
      orden de compra.
- [ ] Dado cualquier tick — incluyendo uno donde no existe posición abierta para el símbolo — el
      fast path nunca coloca una orden `BUY`. La apertura de una posición solo puede originarse en
      una decisión del LLM.

---

### US-01-011: El fast path no pide permiso al LLM para proteger una posición

**Como** trader dueño del bot
**Quiero** que un ciclo de LLM en curso no bloquee ni retrase una acción del fast path sobre la
misma posición
**Para** que un análisis lento del LLM nunca sea la razón por la que mi stop duro llegó tarde

**Criterios de aceptación:**

- [ ] Dado un ciclo de decisión con LLM en curso para un `configId`, y un tick concurrente que
      dispara una acción elegible del fast path sobre la posición de ese mismo `configId`, el fast
      path ejecuta la acción sin esperar a que el ciclo de LLM termine.
- [ ] El ciclo de LLM en curso no se cancela ni se aborta por la acción del fast path: continúa
      hasta producir su decisión.

---

### US-01-012: El LLM nunca pisa una acción que el fast path ya ejecutó

**Como** trader dueño del bot
**Quiero** que, si el fast path ya vendió mi posición por stop mientras el LLM estaba decidiendo
HOLD, esa decisión de HOLD no reabra ni contradiga lo que ya pasó
**Para** no terminar con una orden inconsistente (por ejemplo, un intento de HOLD sobre una
posición que ya no existe, o una orden duplicada)

**Criterios de aceptación:**

- [ ] Dado que el fast path cerró una posición mientras un ciclo de LLM para esa misma posición
      estaba en curso, cuando ese ciclo de LLM concluye, su decisión se valida contra el estado
      **vigente al momento de aplicarla**, no contra el estado que existía cuando el ciclo empezó.
- [ ] Dado el escenario anterior, ninguna acción de mercado se ejecuta como consecuencia de la
      decisión del LLM sobre una posición que el fast path ya cerró — la decisión del LLM queda
      registrada para trazabilidad, pero no produce una orden.
- [ ] Dado que el LLM decide una acción (por ejemplo, `SELL` por tesis) sobre una posición que
      sigue abierta y sin cambios respecto de cuando el ciclo empezó, esa acción se ejecuta con
      normalidad — la regla anterior solo aplica cuando el estado cambió durante el ciclo.
- [ ] El siguiente ciclo de decisión sobre ese `configId` (evento o temporizador) parte del estado
      posterior a la acción del fast path: ve la posición cerrada, no la posición original.

---

### US-01-013: Ningún bot excede el máximo de acciones por hora

**Como** trader dueño del bot
**Quiero** que mi bot nunca ejecute más acciones de las que configuré como máximo por hora, sin
importar cuántos eventos materiales se disparen
**Para** no terminar sobre-operando (y pagando de más en comisiones y slippage) solo porque el
mercado estuvo agitado

**Criterios de aceptación:**

- [ ] Dada una secuencia de ticks que produciría, sin el cap, más acciones que el máximo
      configurado dentro de una ventana de una hora móvil, el sistema ejecuta como máximo esa
      cantidad de acciones dentro de la ventana — la primera acción que la excedería no se
      ejecuta.
- [ ] El cap cuenta por igual toda acción que efectivamente llega al exchange como consecuencia de
      una decisión del bot: compra, venta total, venta parcial o reemplazo de la orden de
      protección. Una decisión `HOLD`, una simple lectura de precio o una actualización interna
      del nivel de trailing que no dispara una orden NO cuentan como acción (ver RN-16).
- [ ] Ningún campo que el LLM controla (por ejemplo, su nivel de confianza o su razonamiento) puede
      hacer que una acción se ejecute igual habiendo excedido el cap.
- [ ] El cap se evalúa en el mismo punto para una acción originada en el fast path y para una
      acción originada en una decisión del LLM — no existen dos implementaciones del límite.

---

### US-01-014: Ningún bot ejecuta dos acciones más rápido que el tiempo mínimo configurado

**Como** trader dueño del bot
**Quiero** que mi bot respete un tiempo mínimo entre una acción y la siguiente
**Para** evitar ráfagas de órdenes disparadas por ruido de mercado en fracciones de segundo

**Criterios de aceptación:**

- [ ] Dadas dos acciones elegibles separadas por menos del tiempo mínimo configurado entre
      ejecuciones, solo la primera se ejecuta; la segunda se descarta o difiere según RN-19, nunca
      se ejecuta antes de que se cumpla el tiempo mínimo.
- [ ] El tiempo mínimo se mide entre acciones efectivamente ejecutadas para el mismo bot
      (`configId`), no entre eventos materiales detectados — detectar un evento no consume el cap,
      solo ejecutar una acción lo hace.

---

### US-01-015: El límite de pérdida diaria frena el bot, no solo las compras

**Como** trader dueño del bot
**Quiero** que, si mi bot ya perdió en el día lo que configuré como máximo tolerable, deje de
operar por sí solo hasta el día siguiente
**Para** no dejar que una racha mala se convierta en una racha peor por seguir operando
automáticamente

**Criterios de aceptación:**

- [ ] Dado un bot cuya pérdida realizada acumulada del día alcanza `maxDailyLossUsd`, ninguna
      acción automática nueva se ejecuta para ese bot por el resto del día calendario — ni una
      apertura de posición originada en el LLM, ni una acción del fast path, ni una acción
      originada en una decisión del LLM sobre una posición existente.
- [ ] Cualquier orden de protección nativa que ya estuviera descansando en el exchange antes de
      alcanzar el límite sigue vigente y puede ejecutarse en el exchange sin intervención del bot
      — el freno aplica al bot decidiendo y operando activamente, no a una protección que Binance
      ya tiene colocada de antes.
- [ ] Al iniciar el día calendario siguiente, el bot vuelve a operar con normalidad sin
      intervención manual del trader — el freno se reevalúa sobre la pérdida del nuevo día, que
      arranca en cero.
- [ ] El freno se evalúa en el mismo punto para el camino reactivo y para el camino del LLM.

---

### US-01-016: Ver por qué una acción no se ejecutó

**Como** trader dueño del bot
**Quiero** poder ver que una acción fue descartada o diferida por un cap, y por cuál cap
específicamente
**Para** entender que mi bot está protegido y no simplemente "no reaccionó" o se quedó colgado

**Criterios de aceptación:**

- [ ] Toda vez que una acción elegible no se ejecuta porque violaría un cap (frecuencia por hora,
      tiempo mínimo entre ejecuciones o pérdida diaria), queda un registro consultable que
      identifica cuál de los tres caps la bloqueó.
- [ ] Ese registro es distinguible de un registro de decisión `HOLD` ordinaria: "no se ejecutó
      porque el LLM decidió no operar" y "no se ejecutó porque un cap lo impidió" son estados
      observables distintos.

---

### US-01-017: Ver que el stream de precios está degradado

**Como** trader dueño del bot
**Quiero** que el bot me diga explícitamente cuando dejó de recibir datos de precio en tiempo real
para mi símbolo, en vez de comportarse como si el mercado estuviera quieto
**Para** confiar en que el silencio del bot significa "no hay stream", no "no hay movimiento"

**Criterios de aceptación:**

- [ ] Dado que el heartbeat del stream para un símbolo no llega dentro del intervalo esperado, o el
      último tick recibido supera la edad máxima tolerada, el estado del stream para ese símbolo
      pasa a "degradado" y ese estado queda expuesto de forma consultable (no solo en un log
      interno).
- [ ] El estado "degradado" nunca se infiere de la ausencia de eventos materiales: solo se declara
      a partir de la ausencia del heartbeat o de la antigüedad del último tick, nunca de la
      ausencia de movimiento de precio.
- [ ] Cuando vuelve a llegar un heartbeat o un tick dentro de los márgenes tolerados, el estado
      vuelve a "sano" y ese cambio también queda registrado.

---

### US-01-018: El bot sigue protegiendo posiciones aunque el stream esté degradado

**Como** trader dueño del bot
**Quiero** que, mientras el stream en vivo está caído, mi bot siga evaluando mis posiciones por
temporizador y por REST en vez de quedar completamente inerte
**Para** no perder toda cobertura de reflejos solo porque el WebSocket se cortó

**Criterios de aceptación:**

- [ ] Mientras un símbolo está en estado "degradado", el ciclo de decisión para los bots de ese
      símbolo se sigue disparando por el temporizador vigente, usando precio obtenido por REST.
- [ ] Mientras un símbolo está en estado "degradado", ningún disparo por evento material (RN-1 a
      RN-3) se genera para ese símbolo — no hay ticks confiables sobre los cuales evaluarlo.
- [ ] Al volver el símbolo a estado "sano", el disparo por evento material se reactiva sin
      intervención manual.

---

### US-01-019: Un evento material produce una única ejecución aunque el backend corra en varias réplicas

**Como** operador de la plataforma
**Quiero** que un mismo evento material sobre un símbolo produzca un solo ciclo de decisión y, si
corresponde, una sola orden, sin importar cuántas réplicas del backend estén corriendo
**Para** no exponer a los traders a órdenes duplicadas ni a decisiones contradictorias sobre la
misma posición por una limitación de infraestructura

**Criterios de aceptación:**

- [ ] Dado un mismo evento material observado simultáneamente por más de una réplica del backend,
      se ejecuta exactamente un ciclo de decisión para ese `configId`, no N.
- [ ] Dado el mismo escenario, se ejecuta como máximo una orden de mercado como consecuencia de ese
      evento, no una por réplica.
- [ ] Los caps de frecuencia (RN-16 a RN-22) se evalúan sobre un conteo compartido entre réplicas,
      nunca sobre un contador en memoria de un único proceso — dos réplicas que cuentan por
      separado permitirían exceder el cap real combinado.

---

### US-01-020: Con el loop apagado, nada cambia

**Como** trader dueño del bot
**Quiero** que, si nunca activo el loop reactivo, mi bot se comporte exactamente igual que antes de
este ciclo
**Para** no verme afectado por una funcionalidad que no pedí ni configuré

**Criterios de aceptación:**

- [ ] Con el interruptor del loop reactivo en `off` (valor por defecto de toda instalación
      existente), dado un escenario congelado, el conjunto y el orden de órdenes producidas es
      idéntico, tick a tick, al que produce el sistema sin ninguno de los cambios de este ciclo.
- [ ] Con el interruptor en `off`, el número de llamadas al LLM para ese mismo escenario congelado
      es idéntico al de la línea base — ni una más, ni una menos.
- [ ] Con el interruptor en `off`, el temporizador sigue siendo el único disparador del ciclo de
      decisión: ningún evento material dispara nada.
- [ ] Todo campo nuevo de configuración introducido por este ciclo tiene un valor por defecto que
      reproduce el comportamiento actual sin que el trader tenga que tocar su configuración.

---

## Reglas de negocio

**Disparo del ciclo de decisión (spec §3.2, §6 CA-002)**

1. El fast path se evalúa en **cada tick** de precio recibido para un símbolo con al menos un bot
   activo suscripto, independientemente de si el tick constituye o no un evento material. Es la
   capa de reflejos; nunca duerme mientras el stream está sano.
2. El **ciclo de decisión** (que incluye el gate determinístico y, si corresponde, al LLM) se
   dispara únicamente por dos causas: un evento material (RN-3 a RN-8) o el vencimiento del
   temporizador vigente. No existe una tercera vía.
3. **Evento material tipo 1 — movimiento contra la referencia de la última decisión:** el precio
   del tick se aparta, en valor absoluto, más de `gatePriceChangePct` respecto del precio de la
   última decisión registrada para ese `configId` (la misma referencia que ya usa
   `evaluateDeterministicGate` para el motivo `PRICE_MOVED`). Este ciclo no introduce un segundo
   umbral de movimiento de precio.
4. **Evento material tipo 2 — quiebre de nivel:** el precio del tick cruza alguno de los niveles
   vigentes de `IndicatorSnapshot.supportResistance` (soporte o resistencia), es decir, pasa de un
   lado al otro del nivel entre dos ticks consecutivos.
5. **Evento material tipo 3 — spike de volumen:** el indicador de volumen del tick reporta una
   proporción actual/promedio por encima del umbral configurado. La comparación es siempre
   relativa al promedio reciente del propio símbolo, nunca un valor absoluto.
6. **Regla de no-ruido para el tipo 2:** un mismo nivel no dispara un segundo evento material
   mientras el precio siga oscilando pegado a él sin haberse alejado y vuelto a cruzar — evita que
   una zona de indecisión alrededor de un nivel produzca una cascada de eventos.
7. Un evento material dispara el **ciclo de decisión completo** (incluyendo el gate), no una
   llamada directa al LLM. El gate sigue siendo quien decide si hace falta o no invocar al LLM; un
   evento material no se salta esa evaluación.
8. Un evento material solo puede **adelantar** el próximo ciclo; nunca lo pospone ni alarga el
   temporizador vigente. El temporizador configurado es el piso, nunca se elimina (spec §3.2).

**Fast path — set acotado de acciones (spec §3.3, §6 CA-004, CA-006)**

9. El fast path solo puede ejecutar, por sí solo y sin LLM, estas cuatro acciones — ninguna otra:
   - **Stop duro**, decidido por `evaluateSellPolicy` (resultado `LOSS_CUT`).
   - **Salida por trailing**, decidida por `updateTrailingStop`.
   - **Re-armado de protección nativa**, decidido por `resolveProtectionRearm`.
   - **Take-profit parcial**, decidido por `resolvePartialTakeProfit` + `applyPartialExit`.
   Estas cuatro funciones ya existen, son puras, y el fast path las **compone**: no las reimplementa
   ni las reinterpreta.
10. `resolvePartialTakeProfit` soporta un único escalón (`partialExitCount > 0` inhibe un segundo
    take-profit parcial). Esta es una propiedad ya vigente de la función pura, no una regla nueva
    de negocio de este ciclo; varios escalones quedan fuera de alcance salvo decisión explícita
    posterior.
11. **El fast path nunca abre una posición nueva.** Ninguna de las cuatro acciones enumeradas en
    RN-9 puede producir una orden `BUY`. Justificación de negocio: tomar riesgo nuevo es una
    decisión estratégica (qué comprar, cuánto, con qué tesis) que exige el criterio del LLM y, en
    última instancia, la configuración explícita del trader; un reflejo automático solo tiene
    sentido para **defender** capital ya comprometido, nunca para comprometer capital nuevo. Abrir
    posiciones queda exclusivamente en manos del LLM, tanto con el loop encendido como apagado.
12. El LLM conserva, sin excepción, la decisión estratégica: abrir posición, dimensionarla y
    cerrarla por tesis (razones que no son stop, trailing, protección o take-profit parcial). El
    fast path conserva los reflejos. Ninguna de las dos capas puede invadir el terreno de la otra.
13. Toda salida ejecutada por el fast path respeta la restricción de diseño ya vigente para
    cualquier venta: libera la protección nativa (`releaseProtectionIfNeeded`) antes de colocar la
    orden de venta de mercado. El fast path es un camino de salida nuevo, no una excepción a esta
    regla (CA-006).
14. El re-armado de protección (RN-9, tercera acción) es la única de las cuatro acciones que no
    vende: cancela una orden de protección vigente y coloca una nueva. Aun así cuenta como una
    acción a efectos de los caps de frecuencia (RN-16), porque toca el exchange igual que una
    venta.

**Frontera con el LLM (spec §3.3, hallazgo A y D del diagnóstico)**

15. El fast path nunca espera una autorización del LLM para actuar sobre una posición ya abierta;
    un ciclo de LLM en curso no bloquea, retrasa ni cancela una acción elegible del fast path
    sobre la misma posición.
16. Toda acción — del fast path o del LLM — se valida contra el **estado vigente de la posición en
    el instante en que se aplica**, no contra el estado que existía en el instante en que se tomó
    la decisión. Si el fast path cerró una posición mientras un ciclo de LLM para esa misma
    posición estaba en curso, la decisión del LLM (por ejemplo, `HOLD`) queda registrada para
    trazabilidad pero no produce ninguna orden adicional: no hay nada que "mantener" sobre una
    posición que ya no existe, y no hay reapertura implícita.
17. El siguiente ciclo de decisión sobre un `configId` — sea por evento o por temporizador —
    siempre parte del estado posterior a la última acción ejecutada (por el fast path o por el
    LLM), nunca de un estado congelado al momento en que ese ciclo anterior arrancó.

**Caps de frecuencia — qué cuenta como acción (spec §3.4, §6 CA-004)**

18. Cuenta como **una acción**, a efectos de todos los caps de este ciclo, toda orden que
    efectivamente llega al exchange como consecuencia de una decisión del bot: una compra, una
    venta total, una venta parcial, o el reemplazo de la orden de protección (cancelación +
    colocación). NO cuentan como acción: una decisión `HOLD`, una consulta de precio, ni una
    actualización interna de un nivel (por ejemplo, el nuevo tope del trailing) que no dispara una
    orden.
19. **Máximo de acciones por hora:** cap sobre la cantidad de acciones (RN-18) ejecutadas por un
    mismo bot dentro de una ventana móvil de una hora. Al alcanzarse, la siguiente acción elegible
    se **difiere**, no se descarta de forma permanente: si la condición que la originó sigue vigente
    cuando la ventana vuelve a tener margen, se reevalúa en el siguiente tick o ciclo elegible. El
    evento o la condición que la originó no desaparece por haber topado el cap.
20. **Tiempo mínimo entre ejecuciones:** cap sobre el tiempo transcurrido entre dos acciones (RN-18)
    consecutivas del mismo bot. Se mide entre acciones efectivamente ejecutadas, no entre eventos
    detectados. Igual que el cap anterior, una acción bloqueada por este cap se difiere hasta que
    se cumpla el tiempo mínimo, no se descarta.
21. **Límite de pérdida diaria:** cap sobre la pérdida realizada acumulada de un bot dentro del día
    calendario. A diferencia de los dos anteriores, este cap no se "reevalúa pronto": al
    alcanzarse, **todas** las acciones automáticas nuevas de ese bot quedan bloqueadas por el
    resto del día calendario (se descartan, no se difieren dentro del mismo día) y el freno se
    levanta automáticamente al iniciar el día calendario siguiente, sin intervención manual del
    trader — el mismo criterio temporal que ya usa el freno de `maxDailyLossUsd` hoy.
22. **Ampliación de alcance respecto del comportamiento actual:** hoy `maxDailyLossUsd` de
    `UserRiskPolicy` solo frena compras (`assertBuyAllowed`). A partir de este ciclo, el freno por
    pérdida diaria frena **toda acción automática del bot** — apertura de posición, y cualquier
    acción del fast path o del LLM sobre una posición existente — no solo la apertura. Esta
    ampliación es intencional: "un límite de pérdida que frena el bot" (spec §2) es más amplio que
    "un límite que frena solo las compras". Una orden de protección nativa que ya está descansando
    en el exchange de antes de alcanzar el límite no se ve afectada: el freno aplica a las
    decisiones activas del bot, no a una protección que Binance ya tiene colocada.
23. Ningún parámetro que el LLM controla — confianza, razonamiento, `suggestedWaitMinutes` o
    cualquier otro campo de su respuesta — puede relajar, extender o sortear ninguno de los tres
    caps (RN-19 a RN-21). Los caps se evalúan en el mismo punto de control para el camino reactivo
    y para el camino del LLM: no existen dos implementaciones del límite ni una vía alternativa
    que uno de los dos caminos pueda usar para eludirlo.
24. Toda acción bloqueada o diferida por un cap deja un registro consultable que identifica cuál de
    los tres caps la bloqueó, distinguible de un registro de decisión `HOLD` ordinaria.
25. **Recomendación de negocio, no bloqueante para este ciclo:** un bot sin protección nativa
    habilitada (`nativeProtectionEnabled: false`) puede quedar sin ninguna red de seguridad si un
    stop duro legítimo es diferido por el cap de frecuencia. Este ciclo no fuerza
    `nativeProtectionEnabled` a verdadero; se documenta como riesgo conocido para que los valores
    por defecto de los umbrales (D4) se elijan con margen suficiente.

**Degradación del stream (spec §3.5, hallazgo F, §6 CA-005)**

26. Un stream se considera **sano** para un símbolo mientras su heartbeat llega dentro del
    intervalo esperado y la antigüedad del último tick recibido está por debajo del máximo
    tolerado. Ambas condiciones se evalúan por símbolo, no de forma global para todo el
    consumidor de mercado.
27. Cuando cualquiera de las dos condiciones deja de cumplirse, el símbolo pasa a estado
    **degradado**. Ese estado es observable (consultable, no solo un log interno) y queda
    registrado el cambio de sano a degradado y de degradado a sano.
28. El silencio del stream **nunca** se interpreta como ausencia de movimiento del mercado — es la
    regla dura del hallazgo F. Mientras un símbolo está degradado, ningún evento material (RN-3 a
    RN-5) se genera para ese símbolo: no hay ticks confiables sobre los que evaluarlo.
29. Mientras un símbolo está degradado, los bots de ese símbolo no quedan inertes: el ciclo de
    decisión se sigue disparando por el temporizador vigente, usando precio obtenido por REST — el
    mismo mecanismo que existe hoy, sin el loop reactivo. Al volver el símbolo a estado sano, el
    disparo por evento material se reactiva sin intervención manual del trader.

**Réplicas (spec §3.1, hallazgo G, §6 CA-007)**

30. Un evento material sobre un símbolo produce, sin importar cuántas réplicas del backend estén
    corriendo, **un** ciclo de decisión y, si corresponde, **una** orden — nunca N. El conteo usado
    por los tres caps de frecuencia (RN-19 a RN-21) es compartido entre réplicas; un contador en
    memoria de un único proceso no es una implementación válida, porque permitiría que la suma de
    lo que cuenta cada réplica exceda el límite real acordado con el trader.

**Reinterpretación de criterios de aceptación (regla de calidad transversal)**

31. **CA-003 de la spec** dice literalmente que "el costo de LLM por bot/día... no debe superar la
    línea base". El costo en USD no es una propiedad ejecutable por sí sola: depende de tarifas de
    proveedor externas al sistema, que pueden cambiar sin que el sistema haya cambiado. Se
    reinterpreta como propiedad verificable en US-01-005: **el número de llamadas al LLM por
    escenario congelado**, en la corrida con el loop encendido, debe ser menor o igual al de la
    línea base, evaluado **escenario por escenario** sobre los 12 escenarios congelados del harness
    existente — nunca solo sobre el agregado. Dado que el costo es una función determinística y
    monótona del número de llamadas para un mismo modelo y un mismo tamaño de prompt, esta
    propiedad implica la propiedad de costo sin depender de un precio externo. Ningún assert de
    este ciclo puede expresarse en dólares.
    **Dos precisiones agregadas tras el cierre del architect:**
    (a) **Condición de no-vacuidad obligatoria.** Además del assert por escenario, la corrida
    debe verificar que al menos uno de los 12 escenarios efectivamente adelantó el ciclo. Un
    `<=` se cumple trivialmente si el loop nunca se dispara: sin esta condición el test pasaría
    sin probar nada.
    (b) **Este ciclo no promete que el costo baje, solo que no suba.** El temporizador no se
    elimina (RN-4) y el umbral del evento es el mismo `gatePriceChangePct` del gate (RN-3), así
    que las evaluaciones por ventana son exactamente una con el loop encendido o apagado: el loop
    cambia **cuándo** ocurre la evaluación, no **cuántas**. El aporte del ciclo es latencia a
    costo constante; la baja de llamadas ya la entregó el gate de `spec-e-burgos-001`.
32. **CA-001** ("comportamiento observable idéntico con el loop apagado") ya es una propiedad
    verificable tal como está en la spec; se detalla en US-01-020 con tres dimensiones concretas
    (órdenes, número de llamadas de LLM, disparador único) para que el Reviewer pueda marcarla
    PASS/FAIL sin ambigüedad.
33. **CA-002, CA-004, CA-005, CA-006 y CA-007** ya miden propiedades (existencia de un disparo
    adelantado, ausencia de llamada de LLM, ausencia de violación de cap, observabilidad de un
    estado, unicidad de ejecución bajo réplicas) y no requirieron reescritura — se detallan en las
    historias correspondientes (US-01-001/005, US-01-013/014/015, US-01-017/018, US-01-006 a
    US-01-009, US-01-019).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Evento material | Disparador que adelanta el ciclo de decisión respecto del temporizador: movimiento de precio contra la referencia de la última decisión, quiebre de nivel de soporte/resistencia, o spike de volumen (RN-3 a RN-5). |
| Ciclo de decisión | La evaluación que incluye el gate determinístico y, si corresponde, al LLM. Se dispara por evento material o por temporizador — nunca en cada tick. |
| Fast path | Capa de reflejos que se evalúa en cada tick de precio y ejecuta, sin LLM, el set acotado de cuatro acciones (RN-9) sobre posiciones ya abiertas. |
| Referencia de la última decisión | El precio registrado en el momento de la última decisión (LLM o gate) tomada para un `configId`; es la base de comparación del evento material tipo 1 (RN-3), la misma que ya usa `evaluateDeterministicGate`. |
| Quiebre de nivel | Cruce del precio de un lado al otro de un nivel de soporte o resistencia vigente en `IndicatorSnapshot.supportResistance`, entre dos ticks consecutivos. |
| Spike de volumen | Proporción del volumen del tick actual respecto de su promedio reciente, por encima de un umbral — siempre relativo al propio símbolo, nunca un valor absoluto. |
| Stop duro | Salida forzosa de una posición cuando `evaluateSellPolicy` resuelve `LOSS_CUT`. |
| Re-armado de protección nativa | Cancelación de la orden de protección vigente en el exchange y colocación de una nueva, cuando el nivel a proteger cambió (trailing o take-profit parcial). |
| Take-profit parcial | Venta de una porción de la posición al alcanzar un nivel de ganancia configurado; soporta un único escalón (RN-10). |
| Acción (a efectos de los caps) | Toda orden que efectivamente llega al exchange por decisión del bot: compra, venta total, venta parcial o reemplazo de protección (RN-18). `HOLD`, lecturas de precio y actualizaciones internas sin orden no cuentan. |
| Cap de frecuencia | Cualquiera de los tres límites duros fuera del alcance del LLM: máximo de acciones por hora, tiempo mínimo entre ejecuciones, límite de pérdida diaria (RN-19 a RN-22). |
| Stream sano / degradado | Estado del consumidor de mercado en vivo para un símbolo, determinado por heartbeat y antigüedad del último tick (RN-26 a RN-29); nunca se infiere de la ausencia de movimiento de precio. |
| Dueño único (bajo réplicas) | Garantía de que, con N réplicas del backend, un evento material produce una sola ejecución y los caps se cuentan sobre estado compartido, no en memoria de un proceso (RN-30). |
| Loop reactivo apagado | Estado por defecto de toda instalación existente: el sistema se comporta exactamente igual que antes de este ciclo (US-01-020). |
