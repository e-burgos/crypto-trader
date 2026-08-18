# Functional — Cycle 03: Reducción del costo por decisión

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-03/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-03/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

La plataforma opera bots de trading cripto con 6 agentes-personaje (KRYPTO, NEXUS, FORGE,
SIGMA, CIPHER, AEGIS). El cycle-01 dejó el costo medible y el cycle-02 dejó que la
justificación que el sistema ya paga determine cuánto se compra, cuándo se corta una pérdida y
cuánto riesgo se acepta. Lo que queda sin resolver es que **el sistema paga análisis completo en
cada ciclo de 5 a 30 minutos, casi siempre para terminar en HOLD**: 5-6 llamadas LLM por ciclo,
≈$1,40/día/bot con modelos clase Haiku y $4-5/día con modelos mejores, lineal por bot activo. Ese
costo lo paga el dueño del bot con sus propias credenciales LLM, y hoy el dashboard le reporta
cerca de $0 porque nada escribe el costo real por decisión — el hallazgo C de la spec.

Este ciclo reduce ese costo por dos vías que no compiten entre sí: **dejar de llamar al LLM
cuando no hay nada nuevo que evaluar** (gate determinista) y **pagar menos por lo que sí se
llama** (caché compartido, prompt caching de proveedor, `max_tokens` ajustado por tarea). La
condición que gobierna todo el ciclo es que ninguna de las dos vías puede costar una decisión: si
el gate determinista silencia un ciclo donde había señal real, el bot deja de operar y el ahorro
es una pérdida encubierta para el dueño del bot. Por eso este documento define, en la sección de
historias de usuario, qué significa concretamente "sin señal" y qué prueba en CI que el ahorro es
real y no una estimación.

El ciclo también cierra deuda que cycle-02 dejó documentada como bloqueante o riesgosa:
`apps/web` quedó desalineado con el wire de agentes que cycle-02 renombró (`agentId` → `slot`),
lo cual bloquea el deploy; la protección nativa de una posición no se re-arma cuando el trailing
o el breakeven mueven el stop, dejando un take-profit "zombie" vivo en el exchange; y dos piezas
de deuda técnica de test quedaron registradas como follow-up de una línea.

**Restricción transversal de este entorno:** no hay base de datos corriendo ni credenciales
Binance/LLM reales disponibles para verificar estas historias. Todo criterio de aceptación de
este documento se formula para ejecutarse en CI mediante tests unitarios y de integración con
mocks/fixtures — nunca contra una base de datos viva, un LLM real ni el exchange real (testnet
incluido). Donde la spec original pide una verificación que asume infraestructura inexistente en
este entorno (un backtest de referencia contra el que medir "no degradar la tasa de decisiones
correctas"), el criterio se reescribe en términos de un harness determinista y reproducible en
CI — mismo precedente que CA-001 del cycle-01 y CA-012 del cycle-02, donde el reviewer ya validó
la reinterpretación y no la letra literal.

**Restricción transversal de negocio:** ningún cambio de este ciclo puede alterar el
comportamiento de un bot ya desplegado sin que su dueño lo habilite explícitamente. El gate
determinista y el caché nacen con la configuración que reproduce el comportamiento actual (gate
desactivado, caché sin efecto observable en la decisión), y su activación es explícita.

**Fuera de alcance de este ciclo (deuda documentada, no ausencia de decisión):**

- La UI de configuración de los 17 campos nuevos de `TradingConfig` y de la política de riesgo
  agregado (`EP-004`/`EP-005`) — siguen configurándose solo por API. Es una superficie de
  formularios ajena al eje de costo de este ciclo; queda para una spec de UI dedicada.
- Las columnas de estado de protección/trailing de posiciones en la UI de `apps/web` — el backend
  sí expone esos campos en este ciclo (ver HU-03-10), pero su presentación visual no.
- Migración del enum Prisma `AgentId` (8 valores) y abstracción de exchange/futuros — decididas
  fuera de esta spec (ver `spec.md` §4).

## Historias de usuario

### HU-03-01: Que el bot no pague un análisis completo cuando no hay nada nuevo que evaluar

**Como** dueño del bot
**Quiero** que el ciclo resuelva HOLD sin llamar a ningún LLM cuando los indicadores, el precio,
mis posiciones y las noticias no cambiaron de forma relevante desde la última decisión
**Para** no pagar un análisis completo en ciclos donde ese análisis no puede cambiar lo que el
bot va a hacer

**Definición de "sin señal" (comportamiento observable — el arquitecto fija los umbrales
exactos de cada condición):**

Un ciclo se considera "sin señal" solo cuando **las cinco condiciones siguientes se cumplen
simultáneamente** respecto de la última decisión evaluada de ese bot. Ninguna condición decide
por sí sola:

1. No hubo cruce entre las EMAs de referencia (corta/larga) desde el último ciclo evaluado.
2. El RSI está dentro de la banda neutra — ni en zona de sobrecompra ni de sobreventa.
3. El precio no se movió más que el umbral configurado de cambio significativo desde el último
   ciclo evaluado.
4. Las posiciones abiertas del bot no cambiaron de estado desde el último ciclo evaluado (mismo
   conjunto de posiciones, mismo estado de protección).
5. No hay noticias ni eventos macro nuevos relevantes desde el último ciclo evaluado (la señal de
   CIPHER no cambió).

**Criterios de aceptación:**

- [ ] CA-038: Con las cinco condiciones cumplidas simultáneamente, el ciclo resuelve HOLD sin
  invocar a ningún proveedor LLM (test con mock del cliente LLM, assert explícito de cero
  invocaciones).
- [ ] CA-039: Con cualquiera de las cinco condiciones incumplida individualmente — las demás
  cumplidas —, el ciclo invoca al LLM con normalidad, igual que hoy (suite parametrizada, un caso
  por condición).
- [ ] CA-040: El HOLD resuelto por el gate persiste una `AgentDecision` como cualquier otra
  decisión del ciclo, con `llmCostUsd = 0` y una justificación legible que la identifica como
  decisión determinista (no generada por LLM) — nunca queda un hueco en el historial de
  decisiones del bot.
- [ ] CA-041: El HOLD resuelto por el gate emite el mismo evento WebSocket `agent:decision` que
  emitiría una decisión generada por LLM, con la misma estructura de payload (test que verifica
  el evento emitido).
- [ ] CA-042: En el primer ciclo de un bot, sin ninguna `AgentDecision` previa contra la cual
  comparar "sin cambio", el gate nunca aplica — el ciclo llama al LLM (test).

**Casos de error:**

- CE-01: Si la reconciliación de estado del exchange (regla no negociable de cycle-02, corre
  antes de toda decisión) no puede confirmar el estado real de las posiciones en este ciclo, el
  gate no aplica — el ciclo llama al LLM en vez de asumir "sin cambio de posiciones" sobre un dato
  no confirmado (fail-closed).
- CE-02: Si algún indicador necesario para evaluar las cinco condiciones falta o está
  desactualizado más allá de la tolerancia configurada, el gate no aplica — el ciclo llama al LLM
  en vez de interpretar el dato incompleto como "sin señal" (fail-closed).
- CE-03: Con el gate desactivado por configuración (default de migración), ningún ciclo lo evalúa
  — el comportamiento es idéntico al actual, todo ciclo llama al LLM.

**Prioridad:** Alta
**Estimación:** L

---

### HU-03-02: No volver a pagar un análisis que otro bot ya pagó en la misma ventana

**Como** dueño del bot
**Quiero** que el análisis técnico y macro de un activo/par/timeframe que otro bot (mío o de otro
usuario) ya calculó recientemente no se vuelva a pagar de nuevo
**Para** que mi costo no dependa de cuántos bots están mirando el mismo mercado en el mismo
momento

**Criterios de aceptación:**

- [ ] CA-043: Dos o más bots que evalúan el mismo `(asset, pair, timeframe)` dentro de la
  ventana de vigencia comparten el mismo resultado de señal técnica/macro; solo el primero
  dispara el cálculo real (test con N bots concurrentes sobre la misma clave, assert de una sola
  invocación del origen de datos subyacente).
- [ ] CA-044: Vencida la ventana de vigencia, la siguiente consulta recalcula en vez de servir
  el valor anterior (test de invalidación).
- [ ] CA-045: La señal macro (CIPHER) tiene una ventana de vigencia propia, del orden de horas
  y mayor a la de señal técnica (test que verifica ventanas independientes por tipo de señal).
- [ ] CA-046: El caché no mezcla resultados entre `asset`, `pair` o `timeframe` distintos —
  claves distintas nunca comparten valor (test de aislamiento).

**Casos de error:**

- CE-04: Si el origen de datos subyacente falla al recalcular tras vencer la ventana de vigencia,
  se devuelve el último valor conocido (stale) en vez de bloquear el ciclo — mismo patrón que el
  caché de sentimiento de noticias ya existente.

**Prioridad:** Alta
**Estimación:** M

---

### HU-03-03: Pagar el prompt fijo de mis agentes una sola vez, no en cada llamada

**Como** dueño del bot
**Quiero** que el texto fijo (system prompt) de mis agentes se tarifique aprovechando el cache de
prompt del proveedor cuando está disponible
**Para** pagar menos por el input que se repite en cada llamada, sin que el comportamiento del
agente cambie

**Criterios de aceptación:**

- [ ] CA-047: Con un proveedor/modelo que soporta cache de prompt, la llamada arma el bloque
  de system prompt estático marcado para cache (test unitario del armado de la request, sin red).
- [ ] CA-048: Con un proveedor/modelo que no lo soporta, la llamada se arma igual — sin la
  marca de cache — y no falla ni cambia el resultado de la decisión (degradación silenciosa,
  test).
- [ ] CA-049: El contenido y el resultado de la decisión del agente son los mismos con y sin
  la marca de cache activa, para el mismo input (test de regresión).

**Casos de error:**

- CE-05: Si el proveedor rechaza explícitamente la marca de cache, el sistema reintenta la misma
  llamada sin ella en vez de fallar el ciclo completo.

**Prioridad:** Media
**Estimación:** S

---

### HU-03-04: No pagar más tokens de salida de los que una tarea necesita

**Como** dueño del bot
**Quiero** que cada tipo de tarea del agente (por ejemplo risk_gate o sizing) pida al LLM solo el
límite de tokens de salida que esa tarea necesita, en vez del límite genérico actual
**Para** no pagar por espacio de respuesta que la tarea nunca usa

**Criterios de aceptación:**

- [ ] CA-050: Las tareas de risk_gate y sizing piden un límite de tokens de salida
  sensiblemente menor al límite genérico usado hoy — valor exacto a definir por el arquitecto en
  el rango 300-400 (test que verifica el límite en la request armada, por tipo de tarea).
- [ ] CA-051: El límite de tokens de salida se define por tipo de tarea, no por agente ni por
  modelo asignado — dos agentes distintos que ejecutan la misma tarea usan el mismo límite (test).
- [ ] CA-052: Una respuesta truncada por el nuevo límite no se interpreta como una decisión
  válida parcial: se maneja con el mismo camino de error que hoy usa una respuesta incompleta
  (test).

**Casos de error:**

- CE-06: Respuesta truncada por el límite de tokens → se trata como respuesta no confiable, el
  ciclo no opera sobre un fragmento de decisión.

**Prioridad:** Media
**Estimación:** S

---

### HU-03-05: Ver cuánto gasté realmente en LLM, por bot y por día

**Como** dueño del bot
**Quiero** ver el costo real que mi bot gastó en LLM hoy, en vez de un valor que siempre marca
cerca de cero
**Para** saber si el costo de operar mi bot es sostenible con mis propias credenciales

**Criterios de aceptación:**

- [ ] CA-053: Toda `AgentDecision` que se originó en una llamada LLM real persiste su costo
  calculado con la tarifa vigente del modelo usado al momento de la llamada — no un valor fijo ni
  estimado después (test unitario del cálculo, con mock de la resolución de tarifa).
- [ ] CA-054: Una `AgentDecision` resuelta por el gate determinista (HU-03-01) persiste
  `llmCostUsd = 0`, distinguible en el mismo campo de una decisión con costo real.
- [ ] CA-055: El costo de un bot en un día calendario es la suma de `llmCostUsd` de todas sus
  `AgentDecision` de ese día, sin excluir ninguna, sin importar si fue resuelta por LLM o por el
  gate (test de agregación).
- [ ] CA-056: Un bot que tuvo llamadas LLM reales en el día no puede mostrar costo $0 (test de
  regresión directo sobre el hallazgo C de la spec).

**Casos de error:**

- CE-07: Si la resolución de tarifa del modelo usado no encuentra un precio confiable (cascada
  agotada), la decisión igual se persiste y se cuenta en el historial — no se descarta ni se
  excluye silenciosamente del costo del día; el valor que no pudo calcularse queda marcado como
  tal, no como cero encubierto.

**Prioridad:** Alta
**Estimación:** M

---

### HU-03-06: Ver el costo LLM agregado de toda la plataforma

**Como** operador de la plataforma
**Quiero** ver el costo LLM agregado de todos los bots activos en un período
**Para** confirmar que la reducción de costo de este ciclo se sostiene una vez en producción y
detectar si el gasto vuelve a subir

**Criterios de aceptación:**

- [ ] CA-057: El costo agregado de un período es la suma de `llmCostUsd` de todas las
  `AgentDecision` de todos los bots en ese período, calculada sobre la misma fuente que el costo
  por bot individual de HU-03-05 — sin un cálculo paralelo que pueda desincronizarse (test de
  agregación cruzada: suma de individuales == agregado).
- [ ] CA-058: El costo agregado permite distinguir cuánto del total corresponde a decisiones
  resueltas por LLM y cuánto a decisiones resueltas por el gate determinista, para poder atribuir
  el ahorro a su causa (test).

**Prioridad:** Media
**Estimación:** S

---

### HU-03-07: Confiar en que ahorrar costo no significa perder decisiones correctas

**Como** dueño del bot
**Quiero** que la reducción de costo de este ciclo esté demostrada contra un conjunto fijo y
reproducible de escenarios, no contra una estimación
**Para** confiar en que el ahorro no significa que mi bot deje de operar cuando debería

**Contexto:** no existe un backtest de referencia ni un escenario de referencia como
infraestructura corriendo en este entorno. La reinterpretación ejecutable del criterio de la spec
("costo por ciclo −50% sin degradar decisiones") es un harness determinista, corrido en CI, sobre
un conjunto fijo de escenarios versionado como fixture del repo — mismo precedente que CA-001
(cycle-01) y CA-012 (cycle-02).

**Criterios de aceptación:**

- [ ] CA-059: Existe un conjunto fijo de N escenarios (fixtures deterministas de indicadores,
  precio, posiciones abiertas y noticias) que cubre explícitamente casos "sin señal" (deben
  resolver HOLD por el gate) y casos "con señal" (no deben resolver HOLD por el gate) — versionado
  en el repo, no generado en runtime.
- [ ] CA-060: El harness corre el mismo conjunto de escenarios dos veces sobre mocks
  deterministas (sin red, sin LLM real): una vez con la configuración previa a este ciclo (línea
  base) y otra con las optimizaciones activas (gate, caché, prompt caching, `max_tokens` por
  tarea), contando llamadas LLM y tokens totales consumidos en cada corrida.
- [ ] CA-061: El total de llamadas LLM y tokens de la corrida "con optimizaciones" es al menos
  50% menor que el de la corrida "línea base" para el conjunto fijo de escenarios (assert
  numérico sobre el conteo del harness).
- [ ] CA-062: Ningún escenario del conjunto diseñado con señal real resuelve HOLD por el gate
  determinista en la corrida "con optimizaciones" — el assert es por escenario individual, no
  agregado, para que un solo escenario silenciado haga fallar el harness aunque el promedio de
  ahorro se cumpla.
- [ ] CA-063: El harness corre como parte de `pnpm nx run-many -t test` (no como script manual
  aparte), de forma que una regresión futura sobre el gate o el caché lo detecte en CI sin
  intervención humana.

**Prioridad:** Alta
**Estimación:** M

---

### HU-03-08 (follow-up cycle-02, PRIORIDAD 1 — DEPLOY-BLOCKER): Administrar mis agentes desde el dashboard sin que la pantalla falle

**Como** dueño del bot que configura sus agentes desde `apps/web`
**Quiero** ver el nombre real de cada uno de mis agentes, poder filtrarlos por categoría y
guardar mi configuración sin que la petición falle
**Para** administrar mis agentes desde la UI en vez de quedar bloqueado por una migración de
backend que la pantalla nunca reflejó

**Contexto:** cycle-02 renombró `agentId` → `slot` y el valor `'fallback'` → `'preset'` (union
completo de `ResolutionSource`: `override | user | admin | preset | credential`) en el wire de
`GET /users/me/agents/config` y `GET /users/me/agents/health`. `apps/web` declara su propia
interfaz de ese response — el typecheck no detecta el desalineamiento — y sigue leyendo
`config.agentId` en `hooks/use-agent-config.ts` y `pages/dashboard/settings/agents.tsx` (8
lecturas). Resultado hoy: nombres de agente vacíos, filtros `'risk'`/`'routing'` que no matchean,
y guardar dispara `PUT /users/me/agents/undefined/config`. Es prerrequisito de deploy: sin esto,
la pantalla de configuración de agentes está rota en producción.

**Criterios de aceptación:**

- [ ] CA-064: La pantalla de configuración de agentes muestra el nombre de cada agente a
  partir del campo `slot` del response — ningún nombre aparece vacío (test de UI que monta el
  componente con un fixture del response real post-cycle-02 y verifica el texto renderizado).
- [ ] CA-065: Los filtros de categoría (`'risk'`, `'routing'`, y el resto de categorías
  vigentes) matchean correctamente contra los agentes del fixture (test de UI).
- [ ] CA-066: Guardar la configuración de un agente dispara la petición con el `slot` real del
  agente editado en la URL — nunca `.../agents/undefined/config` (test que intercepta la llamada
  HTTP saliente y verifica la URL armada).
- [ ] CA-067: `hooks/use-agent-config.ts` tipa `source` con el union completo de
  `ResolutionSource` (`override | user | admin | preset | credential`); un valor `'preset'` se
  procesa igual que cualquier otro valor del union, sin caer a un default por no reconocerlo
  (test unitario del hook, un caso por valor del union).
- [ ] CA-068: La cobertura de estos criterios es con tests de comportamiento sobre datos
  reales del wire (fixture del response de cycle-02) — el criterio de done es explícitamente "test
  en verde", nunca "typecheck en verde", porque el typecheck no detecta este desalineamiento hoy.

**Casos de error:**

- CE-08: Si el response trae un valor de `source` fuera del union conocido, la fila
  correspondiente no rompe el render de toda la pantalla — degrada a un estado visible
  "desconocido" en esa fila en vez de crashear o quedar en blanco.

**Prioridad:** Alta
**Estimación:** M

---

### HU-03-09 (follow-up cycle-02): Que mi posición no dependa de una orden de protección obsoleta en el exchange

**Como** dueño del bot con trailing stop o breakeven activados
**Quiero** que la orden de protección real en el exchange se actualice cuando el stop se mueve
**Para** que mi posición no dependa de que el sistema la cierre a mercado un ciclo después, y para
que no exista una orden de take-profit vieja que pueda ejecutarse mientras el trailing sigue
corriendo

**Contexto:** cycle-02 documentó como degradación aceptada que, con `nativeProtectionEnabled` +
(`trailingStopEnabled` o `partialTpEnabled`) simultáneos, la OCO no se re-arma cuando el trailing
o el breakeven mueven el stop. Es segura en el sentido de que `checkOpenPositions` cancela la OCO
obsoleta y cierra a mercado en el stop trailed local, pero con latencia de un ciclo — y la OCO
viva conserva el take-profit original ("TP zombie"), que puede llenarse mientras la máquina local
lo da por deshabilitado.

**Criterios de aceptación:**

- [ ] CA-069: Cuando el trailing stop o el breakeven mueven el nivel de stop en 0.1% o más
  respecto del stop vigente en la orden de protección activa, el sistema cancela esa orden y
  coloca una nueva con los niveles actualizados y la cantidad remanente de la posición (test con
  mock del cliente del exchange: assert de cancelación seguida de la nueva colocación, con los
  parámetros correctos).
- [ ] CA-070: Un movimiento de stop menor al umbral de 0.1% no dispara cancelación ni
  recolocación (test: ninguna de las dos operaciones se invoca).
- [ ] CA-071: Después de un re-arme exitoso, no sobrevive en el exchange ninguna pierna de la
  orden de protección anterior — la única orden viva refleja los niveles nuevos, sin take-profit
  zombie (test).
- [ ] CA-072: Con `nativeProtectionEnabled` + `trailingStopEnabled` (o `partialTpEnabled`)
  activos simultáneamente, un movimiento de stop que cruza el umbral ya no depende del cierre a
  mercado local documentado en cycle-02 como degradación — el re-arme de la orden real reemplaza
  ese camino (test de regresión directo sobre el escenario documentado en cycle-02).

**Casos de error:**

- CE-09: Si la cancelación de la orden de protección vigente falla, el sistema no asume que la
  posición quedó protegida con los niveles nuevos — aplica el mismo tratamiento de "posición
  desprotegida" que cycle-02 definió para la colocación inicial, hasta confirmar el estado real.
- CE-10: Si la colocación de la nueva orden falla después de una cancelación exitosa, la posición
  queda explícitamente desprotegida (no en un estado ambiguo sin ninguna orden) y el error queda
  registrado, con el mismo camino que la protección inicial de cycle-02.

**Prioridad:** Alta
**Estimación:** M

---

### HU-03-10 (follow-up cycle-02): Consultar el estado completo de protección de mis posiciones

**Como** dueño del bot
**Quiero** que la consulta de mis posiciones incluya el estado de protección y trailing de cada
una
**Para** poder auditar o integrar el estado real de mis órdenes de protección, sin depender de
que la UI lo muestre

**Nota:** la presentación visual de estos campos en `apps/web` queda fuera de alcance de este
ciclo (deuda documentada). Esta historia cubre que el dato esté disponible en la API.

**Criterios de aceptación:**

- [ ] CA-073: La consulta de posiciones (`EP-008`) devuelve, para cada posición,
  `protectionStatus`, `stopPrice`, `takeProfitPrice`, `highWaterPrice`, `trailingActive`,
  `initialQuantity`, `partialExitCount`, `realizedPnl` y `exitReason` (test de integración del
  endpoint con fixture/mock de datos, sin BD real).
- [ ] CA-074: Los valores devueltos son los mismos que tiene la entidad `Position` en el
  momento de la consulta — no un cálculo derivado distinto del que usa el resto del sistema (test
  de consistencia).
- [ ] CA-075: `EP-008` pasa de estado `defined` a `implemented` en `sdd/api.json`.

**Casos de error:**

- CE-11: Una posición sin trailing activo ni ventas parciales devuelve los campos nuevos con
  valores definidos (neutros), no `null` inesperado ni campo ausente — el contrato del endpoint
  no cambia de forma según el estado de la posición.

**Prioridad:** Media
**Estimación:** S

---

### HU-03-11 (follow-up cycle-02 — deuda técnica de test): Que el pipeline impida reintroducir código ya eliminado

**Como** responsable de mantener el pipeline de tests
**Quiero** que el pipeline falle automáticamente si alguien reintroduce
`isFalseConcentrationBlock` o el cast `as unknown as AgentId`
**Para** no depender de que un reviewer humano lo detecte por grep en cada ciclo

**Criterios de aceptación:**

- [ ] CA-076: El pipeline de tests incluye una verificación estática (mismo patrón
  `readFileSync` sobre el árbol fuente ya usado en `trading.processor.isolation.spec.ts`) que
  falla si aparece la cadena `isFalseConcentrationBlock` o `as unknown as AgentId` en el código
  fuente de `apps/api` o `libs/`.
- [ ] CA-077: Con el árbol actual (sin esos símbolos), la verificación pasa — confirma que no
  es un falso positivo permanente (test en verde).
- [ ] CA-078: Reintroducir cualquiera de los dos símbolos en un fixture de prueba controlado
  hace fallar la verificación (test que agrega temporalmente la cadena y confirma el fallo).

**Prioridad:** Baja
**Estimación:** XS

---

### HU-03-12 (follow-up cycle-02 — deuda técnica de test): Que los tests de regresión no obliguen a acomodar el código al test

**Como** responsable de mantener el pipeline de tests
**Quiero** que las aserciones de `trading.processor.isolation.spec.ts` y
`trading.processor.decision-traceability.spec.ts` verifiquen el comportamiento de
`closeAtMarket` y del crédito de wallet SANDBOX sin depender del rango exacto de texto fuente
entre `checkOpenPositions` y `parseSymbolForSandbox`
**Para** poder refactorizar `checkOpenPositions` sin romper tests que no cambiaron su
comportamiento

**Criterios de aceptación:**

- [ ] CA-079: Las aserciones que hoy extraen código por coincidencia de texto sobre el rango
  fuente entre ambos métodos se reemplazan por una verificación de comportamiento observable
  (invocar y verificar el efecto) o por una unidad extraída y testeada de forma independiente.
- [ ] CA-080: Los dos specs afectados siguen verificando lo mismo que antes (cierre a mercado,
  crédito de wallet SANDBOX) y quedan en verde.
- [ ] CA-081: Un cambio cosmético en `checkOpenPositions` que no altera su comportamiento
  (reordenar código, renombrar una variable local) no rompe estos tests (test de regresión: se
  aplica el cambio cosmético y los specs siguen en verde).

**Prioridad:** Baja
**Estimación:** S

---

## Requisitos funcionales

### RF-01: Gate determinista pre-LLM

**Descripción:** Cuando cinco condiciones de "sin señal" se cumplen simultáneamente respecto de
la última decisión evaluada de un bot, el ciclo resuelve HOLD sin invocar a ningún proveedor LLM.
El gate es fail-closed ante cualquier duda sobre el estado real.

**Reglas de negocio:**

- RN-01: Las cinco condiciones (sin cruce de EMA, RSI en banda neutra, sin cambio significativo
  de precio, sin cambio de posiciones abiertas, sin noticia/evento macro nuevo) deben cumplirse
  todas simultáneamente; el arquitecto fija el umbral exacto de cada una.
- RN-02: El gate es fail-closed: reconciliación no confirmada, indicador faltante o stale más
  allá de tolerancia, o ausencia de decisión previa para comparar → el ciclo llama al LLM.
- RN-03: Toda resolución del gate persiste una `AgentDecision` con `llmCostUsd = 0` y
  justificación que la identifica como decisión determinista, con el mismo evento WS que una
  decisión LLM.
- RN-04: El gate nace desactivado por configuración; su activación es explícita del dueño del
  bot.

**Casos de error:**

- CE-01: Reconciliación no confirmada → gate no aplica.
- CE-02: Indicador faltante/stale → gate no aplica.

**Origen:** spec §3 Cycle-03 punto 1; spec §1 hallazgo C; brief.yaml scope punto 1.

---

### RF-02: Caché compartido de señal técnica y macro por `(asset, pair, timeframe)`

**Descripción:** El patrón de caché TTL ya existente para sentimiento de noticias se extiende a
señal técnica y macro, con clave `(asset, pair, timeframe)` compartida entre bots y usuarios, y
TTL diferenciado por tipo de señal (CIPHER en el orden de horas).

**Reglas de negocio:**

- RN-05: La clave de caché es `(asset, pair, timeframe)`; un cálculo dentro de la ventana de
  vigencia sirve a cualquier bot o usuario que consulte la misma clave.
- RN-06: El TTL es configurable por tipo de señal; CIPHER usa un TTL mayor (horas) que la señal
  técnica.

**Casos de error:**

- CE-04: Falla al recalcular tras vencer el TTL → se devuelve el último valor conocido (stale),
  mismo patrón que el caché de sentimiento existente.

**Origen:** spec §3 Cycle-03 punto 2; brief.yaml scope punto 2.

---

### RF-03: Prompt caching de proveedor con degradación silenciosa

**Descripción:** Las llamadas a proveedores que soportan cache de prompt (Anthropic
`cache_control`, equivalente de OpenRouter) marcan el bloque de system prompt estático para
cache. Donde el modelo no lo soporta, la llamada se arma igual, sin la marca.

**Reglas de negocio:**

- RN-07: La marca de cache solo se aplica cuando el proveedor/modelo la soporta explícitamente.
- RN-08: La ausencia de soporte no genera error ni cambia el resultado de la decisión.

**Casos de error:**

- CE-05: Rechazo explícito de la marca por el proveedor → reintento sin ella, sin fallar el
  ciclo.

**Origen:** spec §3 Cycle-03 punto 3; brief.yaml scope punto 3.

---

### RF-04: `max_tokens` configurable por tarea

**Descripción:** El límite de tokens de salida se define por tipo de tarea (risk_gate, sizing,
etc.), no por agente ni modelo. risk_gate y sizing usan un límite menor al genérico actual
(300-400, valor exacto del arquitecto).

**Reglas de negocio:**

- RN-09: El límite se define por tarea, independiente del agente/modelo asignado.
- RN-10: Una respuesta truncada por el límite no se interpreta como decisión parcial válida.

**Casos de error:**

- CE-06: Respuesta truncada → tratada como no confiable, mismo camino de error existente.

**Origen:** spec §3 Cycle-03 punto 4; brief.yaml scope punto 4.

---

### RF-05: Registro real de costo por decisión (`AgentDecision.llmCostUsd`)

**Descripción:** Toda `AgentDecision` originada en una llamada LLM real persiste su costo
calculado con la tarifa vigente al momento de la llamada. Una `AgentDecision` del gate
determinista persiste `llmCostUsd = 0`.

**Reglas de negocio:**

- RN-11: El costo se calcula con la tarifa vigente al momento de la llamada, nunca estimado a
  posteriori ni fijo.
- RN-12: El gate determinista persiste `llmCostUsd = 0`, nunca `null` ni el campo omitido.

**Casos de error:**

- CE-07: Tarifa no resoluble (cascada de `ModelPricingService` agotada) → la decisión igual se
  persiste y se cuenta en el historial; el valor no calculable no se disfraza de cero.

**Origen:** spec §3 Cycle-03 punto 5; spec §1 hallazgo C; brief.yaml scope punto 5.

---

### RF-06: Visibilidad de costo por bot/día y agregado de plataforma

**Descripción:** El costo por bot/día se agrega desde `AgentDecision.llmCostUsd`; el costo
agregado de plataforma usa la misma fuente, discriminando cuánto corresponde a decisiones LLM y
cuánto al gate determinista.

**Reglas de negocio:**

- RN-13: El costo de un bot en un día calendario es la suma de `llmCostUsd` de todas sus
  decisiones de ese día, sin exclusiones silenciosas.
- RN-14: El costo agregado de plataforma se calcula sobre la misma fuente que el costo por bot
  individual, sin un cálculo paralelo independiente.

**Origen:** spec §3 Cycle-03 punto 5; brief.yaml scope punto 5.

---

### RF-07: Harness determinista de verificación del ahorro de costo (reinterpretación ejecutable)

**Descripción:** Reinterpretación ejecutable en CI del criterio de aceptación de la spec ("costo
por ciclo −50% sin degradar decisiones") ante la ausencia de backtest/escenario de referencia
como infraestructura: un harness determinista corre un conjunto fijo de escenarios dos veces
(línea base vs. optimizaciones activas), contando llamadas LLM y tokens, y verificando que ningún
escenario con señal real quede silenciado por el gate.

**Reglas de negocio:**

- RN-15: El conjunto de escenarios es fijo y versionado como fixture del repo, no generado en
  runtime.
- RN-16: El harness corre dos veces sobre el mismo conjunto — línea base y optimizado — contando
  llamadas LLM y tokens en ambas.
- RN-17: Ningún escenario diseñado con señal real puede resolver HOLD por el gate en la corrida
  optimizada; el assert es por escenario, no agregado.

**Origen:** spec §3 Cycle-03 (criterio de aceptación); brief.yaml scope punto 6 (reinterpretación
ejecutable); precedente CA-001 (cycle-01), CA-012 (cycle-02).

---

### RF-08: Migración de `apps/web` al wire de agentes (`slot` / `ResolutionSource`)

**Descripción:** `apps/web` deja de leer `config.agentId` y tipar `source` con el vocabulario
previo a cycle-02; adopta `slot` y el union completo de `ResolutionSource`
(`override | user | admin | preset | credential`), verificado con tests de comportamiento sobre
el wire real, no con `tsc`.

**Reglas de negocio:**

- RN-18: Toda lectura de `config.agentId` en `apps/web` se reemplaza por `slot`.
- RN-19: El tipo de `source` en `apps/web` cubre el union completo de `ResolutionSource`.
- RN-20: Guardar una configuración de agente usa el `slot` real del agente en la URL de la
  petición, nunca `undefined`.
- RN-21: La corrección se verifica con tests de comportamiento sobre fixtures del wire real — el
  typecheck no es criterio de done porque no detecta este desalineamiento.

**Casos de error:**

- CE-08: `source` con valor fuera del union conocido → la fila correspondiente degrada a un
  estado "desconocido" visible, sin romper el render de la pantalla.

**Origen:** brief.yaml scope (follow-up cycle-02, PRIORIDAD 1 — deploy-blocker); cycle-02
`reviewer_report.issues_found`; `sdd/context/apps/api/context_prompt.md` "Qué sigue".

---

### RF-09: Re-arme de la orden de protección nativa al mover el stop

**Descripción:** Cuando el trailing stop o el breakeven mueven el nivel de stop en 0.1% o más
respecto de la orden de protección vigente, el sistema cancela esa orden y coloca una nueva con
los niveles actualizados y la cantidad remanente, eliminando el take-profit zombie que cycle-02
documentó como degradación aceptada.

**Reglas de negocio:**

- RN-22: Un movimiento de stop ≥ 0.1% respecto del stop vigente dispara cancelación +
  recolocación.
- RN-23: Un movimiento < 0.1% no dispara re-arme (evita recolocar en cada tick).
- RN-24: Tras un re-arme exitoso, no sobrevive ninguna pierna de la orden anterior en el exchange.

**Casos de error:**

- CE-09: Cancelación fallida → la posición no se asume protegida con los niveles nuevos; aplica
  el tratamiento de "desprotegida" de cycle-02 hasta confirmar el estado real.
- CE-10: Colocación fallida tras cancelación exitosa → la posición queda explícitamente
  desprotegida (no en estado ambiguo) y el error se registra.

**Origen:** brief.yaml scope (follow-up cycle-02); cycle-02 `reviewer_report.issues_found`
(degradación aceptada, architect.md cycle-02 §8.3).

---

### RF-10: Extensión del select de `getPositions` y `EP-008` a `implemented`

**Descripción:** El `select` de `TradingService.getPositions` se extiende con los 9 campos nuevos
de `Position` que architect.md de cycle-02 §14 dejó pendientes; `EP-008` pasa de `defined` a
`implemented` en `sdd/api.json`.

**Reglas de negocio:**

- RN-25: El `select` incluye `protectionStatus`, `stopPrice`, `takeProfitPrice`,
  `highWaterPrice`, `trailingActive`, `initialQuantity`, `partialExitCount`, `realizedPnl` y
  `exitReason`.
- RN-26: `sdd/api.json` refleja `EP-008` en `implemented` tras este ciclo.

**Casos de error:**

- CE-11: Posición sin trailing/parciales → campos nuevos con valores definidos, no `null`
  inesperado.

**Origen:** brief.yaml scope (follow-up cycle-02); cycle-02 architect.md §14; `sdd/api.json`
`EP-008`.

---

### RF-11: Guard estático anti-regresión (CA-031/CA-034)

**Descripción:** El pipeline de tests incluye una verificación estática que falla si
`isFalseConcentrationBlock` o el cast `as unknown as AgentId` reaparecen en el código fuente,
usando el patrón `readFileSync` ya presente en `trading.processor.isolation.spec.ts`.

**Reglas de negocio:**

- RN-27: El pipeline falla si cualquiera de los dos símbolos aparece en `apps/api` o `libs/`.

**Origen:** brief.yaml scope (follow-up cycle-02); cycle-02 CA-031/CA-034 (PASS con observación,
sin guard automatizado).

---

### RF-12: Aserciones de `checkOpenPositions` independientes de string-matching

**Descripción:** Las aserciones de `trading.processor.isolation.spec.ts` y
`trading.processor.decision-traceability.spec.ts` que hoy extraen código por coincidencia de
texto entre `checkOpenPositions` y `parseSymbolForSandbox` se reemplazan por verificación de
comportamiento observable.

**Reglas de negocio:**

- RN-28: Las aserciones verifican comportamiento (cierre a mercado, crédito de wallet SANDBOX),
  no el texto fuente circundante al método.

**Origen:** brief.yaml scope (follow-up cycle-02); cycle-02 `reviewer_report.issues_found`.

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Gate determinista | Verificación previa a la llamada LLM que, si las cinco condiciones de "sin señal" se cumplen, resuelve HOLD sin invocar al LLM. |
| "Sin señal" | Estado observable en el que no hubo cruce de EMA, el RSI está en banda neutra, el precio no cambió significativamente, las posiciones no cambiaron y no hay noticias/eventos macro nuevos, todo respecto de la última decisión evaluada. |
| Fail-closed | Ante cualquier dato faltante, stale o no confirmable, el sistema opta por el camino más costoso pero seguro (llamar al LLM) en vez de asumir "sin cambio". |
| HOLD determinista | `AgentDecision` de tipo HOLD resuelta por el gate, sin llamada LLM, con `llmCostUsd = 0` y justificación que la distingue de una decisión generada por LLM. |
| `AgentDecision.llmCostUsd` | Campo pre-existente en el modelo de datos; hoy sin ningún escritor en el flujo real. Este ciclo lo llena por decisión, real o cero. |
| Caché compartido por `(asset, pair, timeframe)` | Extensión del patrón de `DataSourceCacheService` (TTL en memoria) a señal técnica y macro, con clave compartida entre bots/usuarios. |
| CIPHER | Agente-personaje responsable de la señal macro/noticias; su caché usa un TTL del orden de horas. |
| Prompt caching de proveedor | Mecanismo del proveedor LLM (Anthropic `cache_control`, equivalente OpenRouter) que tarifica un bloque de contexto repetido una sola vez en vez de en cada llamada. |
| Degradación silenciosa | Ante un proveedor/modelo sin soporte de una optimización (prompt caching), la llamada se arma igual y no falla, sin la optimización aplicada. |
| `max_tokens` por tarea | Límite de tokens de salida configurado por tipo de tarea del agente (risk_gate, sizing, etc.), no por agente ni modelo. |
| Harness determinista de costo | Suite de CI que corre un conjunto fijo de escenarios dos veces (línea base y optimizado) para medir el ahorro de llamadas/tokens sin backtest real. |
| `slot` | Identificador de agente en el wire post-cycle-02 de `ResolvedAgentModel`, reemplaza a `agentId`. |
| `ResolutionSource` | Union de origen de una configuración de agente: `override \| user \| admin \| preset \| credential`. Cycle-02 renombró `'fallback'` → `'preset'`. |
| TP zombie | Pierna de take-profit de una OCO que queda viva en el exchange con el nivel original después de que el trailing/breakeven movió el stop localmente, sin que la OCO se haya re-armado. |
| Umbral de 0.1% | Umbral mínimo de movimiento del stop para disparar el re-arme de la orden de protección — evita recolocar en cada tick. |
| `EP-008` | `GET /trading/positions`; queda en `defined` desde cycle-02, pasa a `implemented` en este ciclo al extender el `select` de `getPositions`. |
| Guard estático | Verificación en el pipeline de tests que falla si un símbolo eliminado (`isFalseConcentrationBlock`, `as unknown as AgentId`) reaparece en el código fuente, por lectura directa del archivo (no por ejecución). |
| Deuda de UI diferida | Los 17 campos nuevos de `TradingConfig`, `EP-004`/`EP-005` y las columnas de protección/trailing: expuestos por API en este ciclo o en cycle-02, sin UI dedicada — follow-up explícito para una spec de UI. |

