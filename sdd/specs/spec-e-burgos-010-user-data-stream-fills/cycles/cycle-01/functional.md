# Functional — Cycle 1: User data stream de fills de entrada

> **Input:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-010-user-data-stream-fills/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

Hoy, cuando el bot deja una orden de compra descansando en Binance (en vez de comprarla de una
al mercado), el sistema se entera de que esa orden se llenó porque una sonda le pregunta al
exchange **cada vez que llega un tick de mercado** del símbolo. Entre el momento real del fill y
esa pregunta hay una ventana: el trader ya tiene la moneda comprada, pero el sistema todavía no
le cargó el stop loss ni el take profit. Si el precio se mueve en contra justo en esa ventana, la
pérdida no tiene freno.

Esa ventana no depende de una decisión del sistema: depende del mercado. Si el símbolo está
quieto, o si el canal de mercado está degradado, la sonda tarda más en preguntar — y la ventana
sin protección se estira justo cuando más importa que sea corta.

Binance ya ofrece un canal propio que avisa el fill en el momento en que ocurre (el "user data
stream", con su propia clave de sesión, el `listenKey`). Este ciclo conecta ese canal. La sonda
por tick no desaparece: sigue funcionando como red de contención para cuando el canal de eventos
no está sano. La contracara de tener dos formas de enterarse del mismo hecho es que una misma
compra podría, si no se cuida, contarse dos veces — y contarla dos veces corrompe la posición, el
historial de operaciones y los límites de frecuencia del bot. Este ciclo tiene que entregar las
dos garantías a la vez: protección rápida y conteo único. Además, todo esto nace apagado: una
instalación que se actualiza sin tocar nada tiene que comportarse exactamente igual que hoy.

## Historias de usuario

### HU-01: Protección de la posición apenas se confirma la compra

**Como** trader dueño del bot
**Quiero** que mi posición quede protegida (stop loss / take profit) apenas Binance confirma que
mi orden de entrada se llenó
**Para** no quedar expuesto, ni un instante más de lo necesario, a un movimiento de precio en
contra sin ningún freno puesto

**Criterios de aceptación:**

- [ ] La creación de la posición, el registro de la operación y la protección inicial se disparan
      por el aviso del exchange, sin esperar ningún tick de mercado posterior — verificable
      porque, con cero ticks del símbolo después del fill, la posición igual queda creada y
      protegida.
- [ ] El aviso del exchange se asocia a la orden de entrada descansando correcta usando su
      identificador principal; si ese identificador no alcanza a resolverla, se prueba con los
      identificadores de respaldo de esa misma orden antes de descartar el aviso.
- [ ] El trader ve, en la interfaz y en el historial, exactamente el mismo tipo de evento y el
      mismo contenido de información para un fill, sea cual sea el detector (aviso del exchange o
      sonda) que lo haya captado primero — no hay ningún dato ni campo nuevo que dependa de cuál
      detector ganó.

**Casos de error:**

- [ ] Si el aviso del exchange llega para una orden que ya no está descansando (porque se
      canceló, ya se resolvió, o no existe), no produce ningún efecto: ni posición nueva, ni
      operación nueva, ni notificación.
- [ ] Si el identificador principal del aviso no coincide con ninguna orden descansando pero sí
      lo hace alguno de los identificadores de respaldo, el fill se resuelve igual sobre la orden
      correcta.

### HU-02: Una compra nunca se cuenta dos veces

**Como** operador de la plataforma
**Quiero** que un mismo fill de una orden de entrada nunca produzca más de una posición, más de
una operación registrada ni más de un registro de acción del bot, sin importar cuántos detectores
lo hayan visto ni en qué orden llegaron
**Para** que las posiciones, el historial de operaciones y los límites de frecuencia del bot no
se corrompan por tener ahora dos caminos que avisan del mismo hecho

**Criterios de aceptación:**

- [ ] Para una misma orden de entrada, cualquier combinación de detectores que observe el mismo
      fill — el aviso del exchange dos veces, el aviso del exchange y la sonda, o la sonda y el
      barrido de arranque — deja exactamente una posición, una operación registrada y un registro
      de acción del bot, en cualquiera de los dos órdenes posibles de llegada.
- [ ] El segundo detector (y cualquiera posterior) que observa un fill ya resuelto no genera una
      notificación nueva, ni un evento nuevo hacia la interfaz, ni una llamada redundante al
      exchange — el efecto observable del segundo aviso es nulo.

**Casos de error:**

- [ ] Si dos detectores llegan a procesar el mismo fill al mismo tiempo, solo uno de los dos
      completa la reconciliación; el otro se retira sin dejar rastro adicional.

### HU-03: La plataforma se despliega sin cambiar nada para nadie

**Como** operador de la plataforma
**Quiero** que esta capacidad se entregue apagada por default
**Para** poder actualizar la plataforma sin que ningún bot existente cambie su comportamiento
observable, y decidir yo cuándo y para quién activarla

**Criterios de aceptación:**

- [ ] Con la capacidad en su valor de fábrica (apagada), el sistema no abre ninguna conexión de
      escucha de eventos del exchange ni solicita ninguna clave de sesión — la sonda por tick
      sigue siendo el único detector, exactamente como antes de este ciclo.
- [ ] Activar o desactivar esta capacidad no requiere ningún cambio en la interfaz del trader: los
      mismos eventos y las mismas consultas que ya existen siguen funcionando igual, se use o no
      se use el canal de eventos del exchange.

**Casos de error:**

- [ ] N/A — esta historia describe la ausencia de comportamiento nuevo; no hay integración externa
      involucrada mientras la capacidad está apagada.

### HU-04: La escucha del exchange no se corta sola

**Como** operador de la plataforma
**Quiero** que la sesión de escucha de eventos del exchange se renueve y, si el exchange la
invalida, se renegocie sola
**Para** que la detección rápida de fills no se pierda silenciosamente por vencimiento de sesión
ni requiera que alguien la reconecte a mano

**Criterios de aceptación:**

- [ ] Mientras la capacidad está activa, nunca transcurre el plazo completo de vencimiento de la
      sesión de escucha sin que se haya registrado una renovación previa.
- [ ] Cuando el exchange invalida la sesión de escucha, el sistema negocia una nueva y vuelve a
      recibir eventos sin que el trader ni el operador intervengan.
- [ ] Al apagar el bot o la plataforma, la sesión de escucha se cierra explícitamente en vez de
      quedar abierta del lado del exchange.
- [ ] Para un mismo dueño y un mismo ambiente (real o de pruebas), existe una única sesión de
      escucha viva, sin importar cuántos bots de ese dueño estén corriendo al mismo tiempo.

**Casos de error:**

- [ ] Si el exchange rechaza la renovación o la creación de la sesión de escucha, el sistema lo
      trata como canal no sano (ver HU-05) en vez de quedar en un estado indefinido.

### HU-05: La degradación del canal de eventos se ve, y la sonda no la deja pasar

**Como** trader dueño del bot
**Quiero** que si el canal de eventos del exchange se cae o se queda en silencio el sistema lo
declare como no sano y la sonda por tick siga cubriendo mis fills
**Para** no perder protección de mis posiciones por una falla de infraestructura que nadie nota

**Criterios de aceptación:**

- [ ] Cuando el canal de eventos está degradado o caído, existe un estado observable que lo
      refleja, distinto del estado sano.
- [ ] Mientras el canal de eventos está degradado o caído, ningún fill de una orden de entrada
      queda sin reconciliar: la sonda por tick sigue produciendo la misma reconciliación completa
      que produciría el canal de eventos.
- [ ] Un canal de eventos silencioso (sin fills que avisar) y un canal de eventos muerto (caído)
      se distinguen por su antigüedad de última señal, nunca se reportan como si el silencio
      significara salud.
- [ ] Cuando el canal de eventos vuelve a estar sano, retoma la detección rápida sin que el
      operador tenga que reactivarlo a mano.

**Casos de error:**

- [ ] Si el mecanismo de coordinación del que depende la escucha no está disponible, el sistema
      cae al mismo estado degradado descrito arriba — nunca deja de detectar fills, y nunca falla
      de forma que interrumpa al resto del bot.

### HU-06: La clave de sesión del exchange nunca se filtra

**Como** operador de la plataforma
**Quiero** que la clave de sesión del exchange y las claves de API del trader nunca aparezcan en
logs, respuestas de la plataforma ni eventos hacia la interfaz
**Para** que ningún tercero con acceso a logs, a la base de datos o al tráfico hacia el navegador
pueda usar esas claves para leer u operar la cuenta del trader en Binance

**Criterios de aceptación:**

- [ ] Ningún log generado por la plataforma contiene la clave de sesión del exchange ni una clave
      de API.
- [ ] Ninguna respuesta de la plataforma ni ningún evento enviado hacia la interfaz del trader
      contiene la clave de sesión del exchange ni una clave de API.

**Casos de error:**

- [ ] Si en algún punto la clave de sesión llega a un componente que la registraría por default
      (por ejemplo, un log de error genérico), esa clave se enmascara antes de escribirse.

### HU-07: La confiabilidad del sistema se puede verificar sin depender de Binance

**Como** operador de la plataforma
**Quiero** que la suite de pruebas automatizadas no necesite acceso a la red del exchange, y que
exista evidencia registrada de una verificación real contra el ambiente de pruebas de Binance
**Para** poder confiar en la integración continua del proyecto y, aparte, tener prueba de que la
capacidad funciona contra el exchange real de pruebas, sin arriesgar nunca el ambiente real

**Criterios de aceptación:**

- [ ] La suite automatizada de los proyectos involucrados pasa completa sin ningún acceso a la
      red del exchange.
- [ ] Queda registrada, como evidencia del ciclo, al menos una corrida contra el ambiente de
      pruebas de Binance que haya creado, renovado y cerrado una sesión de escucha, y haya recibido
      al menos un aviso real de fill.
- [ ] Esa verificación nunca se ejecuta contra el ambiente real (de producción) de Binance.

**Casos de error:**

- [ ] N/A — esta historia describe una propiedad del proceso de verificación, no un flujo con
      input de usuario en producción.

## Reglas de negocio

1. **RN-01 — Un solo camino de reconciliación.** Sin importar qué detector avise primero de un
   fill (canal de eventos del exchange o sonda por tick), la creación de la posición, la operación
   registrada y la protección inicial siempre pasan por el mismo mecanismo de reconciliación. No
   existe un camino alternativo que produzca esos mismos efectos por su cuenta.
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
   una decisión explícita del operador, nunca el resultado de una actualización.
5. **RN-05 — La sonda por tick no se retira.** Aunque el canal de eventos del exchange esté sano y
   activo, la sonda por tick sigue existiendo como red de contención. La sonda es quien cubre los
   fills mientras el canal de eventos no está disponible o no está activado.
6. **RN-06 — Una sola escucha por dueño y ambiente.** Para un mismo dueño de credenciales y un
   mismo ambiente (real o de pruebas), existe una única sesión de escucha de eventos viva a la vez,
   sin importar cuántos bots de ese dueño estén corriendo.
7. **RN-07 — La clave de sesión es material sensible.** La clave de sesión del canal de eventos se
   trata igual que una credencial de acceso: no se escribe en logs, no se persiste en texto plano
   en un almacenamiento compartido con el resto de los datos del dominio, y no viaja hacia la
   interfaz del trader bajo ninguna circunstancia.
8. **RN-08 — Nunca contra el ambiente real durante la verificación.** Cualquier verificación de
   este ciclo contra Binance se hace exclusivamente contra el ambiente de pruebas. No hay
   escenario, ni de excepción, en el que la verificación toque el ambiente real.

## Glosario del dominio

| Término                          | Definición                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `listenKey`                       | Clave de sesión que Binance emite para habilitar la escucha de eventos privados de una credencial. Vence si no se renueva y se invalida si Binance emite otra.    |
| User data stream                  | Canal de eventos privados que Binance ofrece por credencial (no por símbolo): avisa, entre otras cosas, cuándo se llena una orden.                                |
| `executionReport`                 | El aviso concreto que llega por el user data stream cuando el estado de una orden cambia, incluido el fill.                                                       |
| Orden de entrada descansando      | Una orden de compra que el bot dejó puesta en el libro de Binance en vez de comprar de una al mercado; queda a la espera de que el precio la cruce.               |
| Sonda por tick                    | El detector de fills vigente hoy: cada vez que llega un movimiento de precio del símbolo, le pregunta al exchange si la orden de entrada ya se llenó.             |
| Barrido de arranque               | La verificación que corre al levantar el servicio y revisa el estado real de todas las órdenes de entrada descansando, por si algo cambió mientras estaba caído.  |
| Reconciliación                    | El proceso que, ante la confirmación de un fill, crea la posición, registra la operación, aplica la protección inicial y deja constancia de la acción del bot.    |
| Ventana sin protección            | El tiempo que transcurre entre el fill real en el exchange y el momento en que el sistema aplica stop loss / take profit a esa posición.                          |
| Estado degradado / caída del canal | La condición en la que el canal de eventos del exchange dejó de responder o de emitir señales dentro del plazo esperado, y por lo tanto no es confiable usarlo. |

## Trazabilidad — HU vs. criterios de aceptación de la spec (§6)

| HU    | CA-001 | CA-002 | CA-003 | CA-004 | CA-005 | CA-006 | CA-007 | CA-008 |
| ----- | :----: | :----: | :----: | :----: | :----: | :----: | :----: | :----: |
| HU-01 |        |   ✔    |        |   ✔    |        |        |        |        |
| HU-02 |        |        |   ✔    |        |        |        |        |        |
| HU-03 |   ✔    |        |        |   ✔    |        |        |        |        |
| HU-04 |        |        |        |        |   ✔    |        |        |        |
| HU-05 |        |        |        |        |        |   ✔    |        |        |
| HU-06 |        |        |        |        |        |        |   ✔    |        |
| HU-07 |        |        |        |        |        |        |        |   ✔    |
