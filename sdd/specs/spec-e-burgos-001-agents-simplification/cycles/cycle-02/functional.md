# Functional — Cycle 02: Venta inteligente y gestión activa de riesgo

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-02/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-02/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

La plataforma opera bots de trading cripto con 6 agentes-personaje (KRYPTO, NEXUS, FORGE,
SIGMA, CIPHER, AEGIS) que analizan el mercado vía LLM y deciden operar. El cycle-01 dejó el
núcleo podado, medible y con tres servicios de dominio (`RiskBudgetService`,
`PortfolioContextService`, `simulateTrade`) rescatados y testeados pero sin ningún caller real
— andamio deliberado para este ciclo.

Hoy el sistema paga el análisis completo y después lo ignora en la ejecución: compra siempre el
mismo porcentaje fijo del balance sin importar qué dijeron FORGE ni AEGIS, no puede vender en
pérdida aunque el agente lo pida con máxima confianza (solo sale por stop-loss fijo verificado
por polling), deja las posiciones sin orden de protección en el exchange entre ciclos de 5 a 30
minutos y ante caídas del proceso, no tiene ningún límite de riesgo que mire la cuenta completa
del usuario en vez de un bot aislado, y un BLOCK legítimo de AEGIS puede anularse por una
coincidencia de palabras en un texto libre. Este ciclo es donde la justificación que el sistema
ya paga empieza a tener consecuencias reales sobre el dinero: cuánto se compra, cuándo se corta
una pérdida, y cuánto riesgo se acepta en total.

**Restricción transversal de este entorno:** no hay base de datos corriendo ni credenciales
Binance reales disponibles para verificar estas historias. Todo criterio de aceptación de este
documento está formulado para ejecutarse en CI mediante tests unitarios y de integración con
mocks/fixtures — nunca contra una base de datos viva ni contra el exchange real (testnet
incluido). Donde la spec original pide una verificación operativa no reproducible en este
entorno (p. ej. "OCO colocada en testnet"), el criterio se reescribe en términos del contrato
verificable por test — mismo precedente que CA-001 del cycle-01, donde el reviewer ya validó
contra la reinterpretación y no contra la letra literal.

**Restricción transversal de negocio:** ningún cambio de este ciclo puede alterar el
comportamiento de un bot ya desplegado sin que su dueño lo habilite explícitamente en su
config. Toda herramienta nueva (corte de pérdida por señal, trailing, parciales, salida por
tiempo, límites agregados) nace con un default conservador en la migración que reproduce el
comportamiento actual.

## Historias de usuario

### HU-02-01: Cortar una pérdida cuando el agente lo indica con alta convicción

**Como** dueño del bot
**Quiero** que el bot pueda vender en pérdida cuando el agente de señal tiene una confianza alta,
en vez de quedar atado a un piso de ganancia mínima que nunca se cumple
**Para** no sostener una posición perdedora mientras el análisis ya me está diciendo que hay que
salir

**Criterios de aceptación:**

- [ ] CA-001: Con la confianza del agente por debajo del umbral configurable de corte de
  pérdida y `profitPct` negativo, la política de SELL rechaza la venta (test unitario de la
  función de política, sin BD).
- [ ] CA-002: Con la confianza del agente igual o por encima del umbral configurable de corte de
  pérdida y `profitPct` negativo, la política de SELL permite la venta (test unitario).
- [ ] CA-003: Con la configuración por defecto que produce la migración (umbral de corte de
  pérdida en el valor que reproduce el comportamiento actual), el mismo escenario de CA-002 sigue
  siendo rechazado — ningún bot cambia de conducta sin configurar el umbral explícitamente (test
  de regresión).
- [ ] CA-004: `minProfitPct` sigue actuando como piso del camino de toma de ganancia: un SELL con
  `profitPct` positivo pero por debajo de `minProfitPct`, sin que aplique el corte de pérdida por
  señal, se rechaza igual que hoy (test unitario).

**Casos de error:**

- CE-01: Si la decisión del agente no trae un valor de confianza utilizable (nulo, fuera de
  rango), la política de SELL no interpreta eso como "alta confianza" por omisión: el corte de
  pérdida por señal no se activa y el camino se resuelve como si no hubiera señal de corte —
  nunca se abre una venta en pérdida por un dato faltante.

**Prioridad:** Alta
**Estimación:** M

---

### HU-02-02: Comprar el tamaño que mi configuración y el análisis de riesgo justifican

**Como** dueño del bot
**Quiero** que el tamaño de cada orden de compra respete mi techo configurado (`maxTradePct`) y
se reduzca cuando AEGIS o FORGE indican un tamaño menor
**Para** no arriesgar nunca más de lo que mi configuración permite, ni más de lo que el análisis
de riesgo del propio ciclo justifica

**Criterios de aceptación:**

- [ ] CA-005: Con `positionSizeMultiplier` de AEGIS en su valor neutro (sin reducción) y el
  sizing sugerido por FORGE igual o mayor al techo, el tamaño de orden resultante es exactamente
  `balance × maxTradePct` — mismo resultado que el comportamiento actual (test unitario).
- [ ] CA-006: Con `positionSizeMultiplier` de AEGIS por debajo de 1, el tamaño de orden resultante
  es menor al techo, en la proporción que define `architect.md` (test unitario).
- [ ] CA-007: Con un sizing de FORGE menor al techo ya modulado por AEGIS, el tamaño de orden
  resultante nunca supera el menor de los dos valores (test unitario con varias combinaciones).
- [ ] CA-008: El verdict `REDUCE` de AEGIS reduce el tamaño de la orden en la magnitud definida
  por `architect.md`, en vez de no tener ningún efecto como ocurre hoy (test unitario que compara
  el tamaño resultante con y sin `REDUCE`).
- [ ] CA-009: Para cualquier combinación de `positionSizeMultiplier`, sizing de FORGE y verdict,
  incluyendo valores que individualmente superarían el techo, el tamaño de orden final nunca
  excede `balance × maxTradePct` (test unitario con valores límite/extremos).

**Prioridad:** Alta
**Estimación:** M

---

### HU-02-03: No quedar desprotegido cuando el bot compra

**Como** dueño del bot
**Quiero** que al abrir una posición se coloquen sus órdenes de stop-loss y take-profit
directamente en el exchange como órdenes reales, no solo verificadas por consulta periódica
**Para** no quedar expuesto sin protección si el proceso del bot se cae o si el próximo ciclo
tarda en correr

**Criterios de aceptación:**

- [ ] CA-010: Al construir el payload de una orden LIMIT, STOP_LOSS_LIMIT u OCO con el cliente
  REST de Binance, el payload incluye los parámetros y la firma que define el contrato de
  `architect.md` — verificado con un test unitario contra un mock de la capa HTTP, sin red real
  ni credenciales.
- [ ] CA-011: Antes de enviar la orden, el cliente valida las reglas de lot-size, minNotional y
  tick-size del símbolo; con una cantidad o precio fuera de esas reglas, la orden se rechaza
  localmente sin llegar a invocar al exchange (test unitario con fixtures de filtros de símbolo).
- [ ] CA-012: En un flujo de apertura de posición simulado con el cliente Binance mockeado, la
  colocación de la orden de protección (OCO, o STOP_LOSS_LIMIT + LIMIT según defina el
  architect) ocurre inmediatamente después de confirmarse la compra (test de integración con
  mocks, sin BD real). Esta verificación reemplaza el criterio original de la spec ("OCO
  colocada en testnet"), inejecutable en este entorno sin credenciales — reinterpretación
  análoga al precedente CA-001 del cycle-01.
- [ ] CA-013: Caso crítico — cuando la compra ya se ejecutó pero el exchange rechaza la orden de
  protección (mock que devuelve error), la posición queda marcada explícitamente en el estado
  que defina `architect.md` para "sin protección" — nunca queda indistinguible de una posición
  protegida (test que verifica el estado resultante y que la situación es observable).

**Casos de error:**

- CE-02: Si la colocación de la orden de protección falla por un error de red simulado (timeout
  del mock), el sistema no asume silenciosamente que la protección quedó puesta: aplica el
  mismo manejo que CA-013 o el reintento que defina el architect, pero nunca continúa el ciclo
  tratando la posición como protegida sin confirmación.

**Prioridad:** Alta
**Estimación:** L

---

### HU-02-04: Que el bot sepa si mi posición ya se cerró antes de decidir de nuevo

**Como** dueño del bot
**Quiero** que antes de tomar cualquier decisión nueva, el bot revise contra el exchange si las
órdenes de protección de mis posiciones abiertas siguen vigentes
**Para** que una posición que ya se cerró por stop-loss o take-profit fuera de ciclo no siga
tratándose como abierta, y para que una posición que quedó desprotegida se detecte y resuelva

**Criterios de aceptación:**

- [ ] CA-014: Con un mock que reporta la orden de protección como ejecutada (FILLED), la
  reconciliación actualiza la `Position` local a cerrada con el precio de cierre reportado (test
  de integración con mocks, sin BD real).
- [ ] CA-015: Con un mock que reporta la orden de protección como cancelada o inexistente, la
  reconciliación marca la posición como desprotegida y activa la ruta de resolución que defina
  `architect.md` (re-colocar orden o alertar) — test.
- [ ] CA-016: Ejecutar la reconciliación dos veces seguidas sobre el mismo estado simulado no
  duplica trades ni cambia el resultado de la segunda corrida respecto de la primera
  (idempotencia, test).

**Prioridad:** Alta
**Estimación:** M

---

### HU-02-05: Asegurar ganancia parcial sin tener que vigilar el mercado

**Como** dueño del bot
**Quiero** poder activar trailing stop, take-profit escalonado (venta parcial + stop a
breakeven) y una salida automática por tiempo máximo de posición, todos opcionales
**Para** asegurar ganancias progresivamente sin monitorear manualmente, sin que esto cambie el
comportamiento de un bot que no activó nada nuevo

**Criterios de aceptación:**

- [ ] CA-017: Con trailing stop desactivado (valor por defecto de la migración), el resultado de
  un escenario de salida ya cubierto por tests existentes es idéntico al actual (test de
  regresión).
- [ ] CA-018: Con trailing stop activado y una secuencia de precios ascendente, el nivel de stop
  se mueve hacia arriba y nunca retrocede (test unitario de la función de trailing).
- [ ] CA-019: Con take-profit escalonado activado y el precio alcanzando el primer umbral
  configurado, se ejecuta una venta parcial de la posición y el stop remanente se mueve a
  breakeven (test unitario).
- [ ] CA-020: Con salida por tiempo máximo activada, una posición cuya antigüedad supera el
  límite configurado dispara la señal de cierre correspondiente (test con reloj controlado /
  fake timers, sin esperar tiempo real).
- [ ] CA-021: Con las tres herramientas en su valor por defecto (apagadas o neutras), ningún test
  de regresión pre-existente sobre el flujo de salida cambia de resultado (test de regresión de
  default conservador).

**Prioridad:** Media
**Estimación:** L

---

### HU-02-06: No perder más de lo que estoy dispuesto a arriesgar en toda mi cuenta

**Como** dueño del bot
**Quiero** definir un límite de exposición por activo entre todos mis bots, una pérdida diaria
máxima y un drawdown que pause mis agentes automáticamente
**Para** que ningún bot individual me arriesgue más de lo que estoy dispuesto a perder en el
conjunto de mi cuenta, aunque cada bot por separado parezca estar dentro de su propio límite

**Criterios de aceptación:**

- [ ] CA-022: Con dos `TradingConfig` del mismo usuario sobre el mismo activo cuya exposición
  combinada superaría el límite configurado, una nueva orden que la excedería es rechazada por
  `RiskBudgetService` (test de integración usando el servicio de dominio con datos simulados, sin
  BD real).
- [ ] CA-023: Con una pérdida diaria acumulada que supera el máximo configurado para el usuario,
  nuevas compras del usuario quedan bloqueadas por el resto del día (test).
- [ ] CA-024: Con un drawdown que cruza el umbral configurado, los agentes del usuario quedan
  pausados automáticamente (`isRunning` en falso o el estado equivalente que defina el
  architect) sin intervención manual (test).
- [ ] CA-025: Con los límites agregados en su valor por defecto (deshabilitados o equivalentes al
  comportamiento actual), ningún escenario cubierto por tests pre-existentes cambia de resultado
  (test de regresión de default conservador).

**Prioridad:** Alta
**Estimación:** L

---

### HU-02-07: Poder auditar por qué se ejecutó cada operación

**Como** dueño del bot
**Quiero** que cada compra o venta ejecutada quede vinculada a la decisión del agente que la
originó
**Para** poder revisar mi historial de operaciones y entender la justificación de análisis
detrás de cada una, no solo el resultado

**Criterios de aceptación:**

- [ ] CA-026: Al crear un `Trade` dentro del flujo real de ejecución, su `decisionId` queda
  seteado con el id de la `AgentDecision` que originó la orden (test de integración con mocks de
  persistencia, sin BD real).
- [ ] CA-027: La migración que agrega `decisionId` a `Trade` lo declara nullable y no backfillea
  filas históricas — verificable inspeccionando el SQL de la migración (no hay `UPDATE` de
  backfill; el `ALTER TABLE` permite `NULL`).
- [ ] CA-028: Un `Trade` generado por un camino sin `AgentDecision` asociada no falla al
  persistirse: `decisionId` queda en `null` y la operación se registra igual (test).

**Prioridad:** Alta
**Estimación:** S

---

### HU-02-08: Que un bloqueo real de riesgo nunca se ignore por cómo está redactado

**Como** dueño del bot
**Quiero** que cuando AEGIS bloquee una operación por una razón estructurada, ese bloqueo se
respete siempre, sin depender de las palabras exactas que el modelo eligió para explicarlo
**Para** no perder protección de riesgo por una casualidad de redacción del LLM, ni por el
motivo inverso: un bloqueo mal justificado que se ignora solo porque la explicación no usó la
palabra esperada

**Criterios de aceptación:**

- [ ] CA-029: Con el campo tipado de la respuesta de AEGIS indicando un motivo de bloqueo
  distinto al caso de falso positivo de concentración, el `BLOCK` se respeta sin importar el
  texto libre de `reason` — probado con distintos textos, incluyendo uno que contendría la
  palabra "concentración" sin serlo (test unitario).
- [ ] CA-030: Con el campo tipado indicando el motivo estructurado que `architect.md` define como
  falso positivo de concentración, el override se aplica leyendo ese campo — nunca haciendo
  matching sobre el texto de `reason` (test unitario).
- [ ] CA-031: Al cierre del ciclo, no existe en el árbol de código fuente ninguna referencia a
  `isFalseConcentrationBlock` ni una expresión regular evaluando el campo `reason` de la decisión
  de AEGIS (verificación estática en CI, ej. grep dirigido como parte del pipeline de tests).

**Prioridad:** Alta
**Estimación:** M

---

### HU-02-09 (follow-up cycle-01): Que una colisión de concurrencia no me deje sin evaluación

**Como** dueño del bot
**Quiero** que si dos intentos de registrar la evaluación de la misma decisión chocan entre sí,
el sistema no falle el proceso completo
**Para** que mi scorecard de decisiones no tenga huecos causados por un error técnico de
concurrencia en vez de por falta real de datos

**Criterios de aceptación:**

- [ ] CA-032: Dado un intento de crear una evaluación duplicada (mismo `decisionId` +
  `horizonMinutes`) que dispara una violación de restricción única (P2002) en un mock del
  cliente Prisma, `EvaluationProcessor.evaluate` resuelve como no-op explícito — sin propagar una
  excepción no manejada ni fallar el job (test unitario con mock de Prisma simulando P2002).

**Prioridad:** Media
**Estimación:** XS

---

### HU-02-10 (follow-up cycle-01): Que la resolución de modelo por agente no dependa de atajos de tipado inseguros

**Como** dueño del bot
**Quiero** que el código que decide qué modelo LLM usa cada agente esté escrito de forma
consistente, sin conversiones de tipo forzadas entre piezas que deberían ser una sola
**Para** reducir el riesgo de que un bug de tipos rompa silenciosamente la resolución de
modelo/agente y afecte las decisiones que se toman sobre mi dinero

**Criterios de aceptación:**

- [ ] CA-033: `ResolvedAgentConfig` y `ResolvedAgentClient` quedan unificados en una sola
  estructura — verificable porque el build/typecheck pasa con una única definición referenciada
  desde ambos usos previos.
- [ ] CA-034: Cero apariciones de `as unknown as AgentId` en el código fuente del borde
  `resolveClient → resolveConfig` (verificación estática en CI).
- [ ] CA-035: Los 3 consumidores identificados en el brief (`agent-config.controller.ts`,
  `admin-agent-config.controller.ts`, `market.service.ts`) usan `ModelSlotId` en vez del
  vocabulario anterior — build y lint verdes, más verificación estática de que el vocabulario
  viejo no aparece en esos archivos.

**Prioridad:** Baja
**Estimación:** S

---

### HU-02-11 (follow-up cycle-01): Saber qué pasa con los datos que el sistema ya no escribe

**Como** dueño del bot
**Quiero** que el equipo defina y deje documentada una decisión explícita sobre las tablas que
quedaron sin ningún proceso que les escriba tras la poda del cycle-01
**Para** tener claro qué información del sistema puedo confiar como historial de mis operaciones
y agentes, y cuál es un resabio sin mantenimiento activo

**Criterios de aceptación:**

- [ ] CA-036: Existe en `architect.md` una decisión explícita sobre `agent_tool_invocations`
  (+ enum `AgentToolName`) y `agent_model_policies`: o hay una migración que las elimina, o queda
  una justificación escrita de por qué se conservan sin escritores — verificable revisando
  `architect.md` y, si aplica, el directorio de la migración.
- [ ] CA-037: Si la decisión es eliminar, la migración es aditiva y reversible, con su nombre de
  directorio registrado en `sdd/schema.json`, y `pnpm nx run-many -t test lint` queda verde tras
  el cambio de `schema.prisma` correspondiente.

**Prioridad:** Baja
**Estimación:** S

---

## Requisitos funcionales

### RF-01: Política de corte de pérdida por señal

**Descripción:** El veto absoluto de `minProfitPct` sobre el SELL se reemplaza por una política
configurable: el SELL en pérdida se permite cuando la confianza del agente de señal supera un
umbral configurable en `TradingConfig`. `minProfitPct` se conserva como piso independiente del
camino de toma de ganancia.

**Reglas de negocio:**

- RN-01: El corte de pérdida por señal y el piso de toma de ganancia (`minProfitPct`) son dos
  caminos de decisión distintos, evaluados por separado.
- RN-02: El default de migración del umbral de corte de pérdida reproduce el comportamiento
  actual (veto efectivo) hasta que el dueño del bot lo configure explícitamente.

**Casos de error:**

- CE-01: Confianza de señal ausente o inválida → se trata como si no hubiera corte de pérdida
  aplicable (ver HU-02-01).

**Origen:** spec §3 Cycle-02 punto 1; spec §1 hallazgo B; brief.yaml scope punto 1.

---

### RF-02: Sizing modulado con techo inviolable

**Descripción:** El tamaño de orden deja de ser `balance × maxTradePct` fijo y pasa a usar ese
valor como techo, modulado por `positionSizeMultiplier` de AEGIS y el sizing de FORGE. El
verdict `REDUCE` de AEGIS se implementa como reducción de tamaño, no como bloqueo.

**Reglas de negocio:**

- RN-03: El techo (`maxTradePct × balance`) nunca se supera, sea cual sea la combinación de
  multiplicador, sizing de FORGE o verdict.
- RN-04: `REDUCE` reduce tamaño; solo `BLOCK` impide la operación por completo.

**Casos de error:**

- No aplica input externo directo; el riesgo es de cálculo y está cubierto por RN-03 y CA-009.

**Origen:** spec §3 Cycle-02 punto 2; spec §1 hallazgo B; brief.yaml scope punto 2 y 3.

---

### RF-03: Órdenes de protección nativas del exchange

**Descripción:** El cliente REST de Binance implementa LIMIT, STOP_LOSS_LIMIT y OCO (hoy solo
MARKET), respetando lot-size/minNotional/tick-size. Al abrir una posición spot, SL/TP se colocan
como órdenes reales en el exchange, no solo se verifican por polling.

**Reglas de negocio:**

- RN-05: Toda posición abierta por el bot tiene, inmediatamente después de la compra, un intento
  de colocación de su orden de protección.
- RN-06: Una compra ejecutada sin que su orden de protección quede confirmada deja la posición en
  un estado explícitamente distinguible como "desprotegida" — nunca indistinguible de una
  posición protegida.

**Casos de error:**

- CE-02: Rechazo del exchange por lot-size/minNotional/tick-size → rechazo local previo al envío
  (CA-011).
- CE-03: Compra ejecutada, orden de protección rechazada o con error de red → RN-06 aplica
  (CA-013).

**Origen:** spec §3 Cycle-02 punto 3; spec §5 Riesgos (reglas de lot-size/notional); brief.yaml
scope punto 5; environment_constraints (reinterpretación del CA "OCO en testnet").

---

### RF-04: Reconciliación de estado al inicio de ciclo

**Descripción:** Antes de tomar decisiones nuevas, el ciclo consulta el estado real de las
órdenes abiertas en el exchange y concilia con `Position`/`Trade` locales.

**Reglas de negocio:**

- RN-07: La reconciliación corre antes de cualquier decisión nueva del ciclo.
- RN-08: La reconciliación es idempotente: correrla más de una vez sobre el mismo estado no
  duplica trades ni cambia el resultado.

**Casos de error:**

- CE-04: Orden de protección ya no vigente (cancelada o ejecutada fuera de ciclo) → la posición
  local se actualiza o se marca desprotegida según corresponda (CA-014, CA-015).

**Origen:** spec §3 Cycle-02 punto 3; brief.yaml scope punto 6.

---

### RF-05: Herramientas de ganancia configurables

**Descripción:** Trailing stop, take-profit escalonado (venta parcial + stop a breakeven) y
salida por tiempo máximo de posición, configurables en `TradingConfig` con default apagado o
neutro.

**Reglas de negocio:**

- RN-09: Cada herramienta se activa de forma independiente por config; ninguna se activa por
  default en la migración.
- RN-10: El trailing stop nunca mueve el nivel de stop en contra del dueño de la posición (solo
  hacia el sentido que protege ganancia).

**Casos de error:**

- No aplica input externo directo; el riesgo es de regresión de comportamiento y está cubierto
  por RN-09 y CA-017/CA-021.

**Origen:** spec §3 Cycle-02 punto 4; brief.yaml scope punto 7.

---

### RF-06: Límites de riesgo agregado por usuario

**Descripción:** Exposición total por activo entre todas las `TradingConfig` de un usuario,
pérdida diaria máxima y drawdown que pausa agentes automáticamente, aplicados en el camino real
de ejecución vía `RiskBudgetService` y `PortfolioContextService`.

**Reglas de negocio:**

- RN-11: Los límites se evalúan por usuario, agregando entre todas sus configs — no por bot
  aislado.
- RN-12: Un límite agregado en su valor por defecto no cambia el resultado de ningún escenario
  ya cubierto por tests pre-existentes.

**Casos de error:**

- No aplica input externo directo; cubierto por RN-12 y CA-025.

**Origen:** spec §3 Cycle-02 punto 5; spec §1 hallazgo B; brief.yaml scope punto 8.

---

### RF-07: Trazabilidad de Trade a AgentDecision

**Descripción:** `Trade.decisionId` referencia a la `AgentDecision` que justificó la operación.
Campo nullable, sin backfill de filas históricas.

**Reglas de negocio:**

- RN-13: Todo `Trade` creado por el flujo real de ejecución posterior a este ciclo setea
  `decisionId` cuando existe una `AgentDecision` asociada.
- RN-14: La migración no backfillea filas históricas.

**Casos de error:**

- CE-05: `Trade` sin `AgentDecision` asociada → `decisionId` queda `null`, la persistencia no
  falla (CA-028).

**Origen:** spec §3 Cycle-02 punto 6; spec §1 hallazgo B; brief.yaml scope punto 9.

---

### RF-08: Regla estructurada para el override de BLOCK

**Descripción:** `isFalseConcentrationBlock` (regex sobre `reason`) se reemplaza por un campo
tipado en la respuesta del agente AEGIS más una regla estructurada evaluable sobre ese campo.

**Reglas de negocio:**

- RN-15: El override de un `BLOCK` se decide exclusivamente por el campo tipado, nunca por
  matching de texto libre.
- RN-16: Un `BLOCK` legítimo no se anula por cómo esté redactado el `reason`.

**Casos de error:**

- No aplica input externo directo; cubierto por RN-15/RN-16 y CA-029/CA-030.

**Origen:** spec §3 Cycle-02 punto 7; spec §1 hallazgo B; brief.yaml scope punto 4.

---

### RF-09: No-op explícito ante colisión P2002 en evaluación

**Descripción:** `EvaluationProcessor.evaluate` maneja de forma explícita la violación de la
restricción única `(decisionId, horizonMinutes)` en vez de dejar que falle el job.

**Reglas de negocio:**

- RN-17: Una colisión P2002 en la creación de una evaluación se resuelve como no-op, no como
  excepción no manejada.

**Casos de error:**

- CE-06: Colisión de concurrencia detectada por P2002 → no-op (CA-032).

**Origen:** brief.yaml scope, follow-up cycle-01 (P2002 en EvaluationProcessor).

---

### RF-10: Unificación de ResolvedAgentConfig/ResolvedAgentClient

**Descripción:** `ResolvedAgentConfig` y `ResolvedAgentClient` se fusionan en una sola
estructura; se elimina el cast `as unknown as AgentId` en el borde `resolveClient →
resolveConfig`; los 3 consumidores identificados migran a `ModelSlotId`.

**Reglas de negocio:**

- RN-18: Solo existe una definición de la estructura resultante, referenciada desde ambos usos
  previos.
- RN-19: Cero casts inseguros de tipo en el borde `resolveClient → resolveConfig`.

**Casos de error:**

- No aplica input externo; riesgo de regresión de tipos cubierto por build/lint (CA-033 a
  CA-035).

**Origen:** brief.yaml scope, follow-up cycle-01 (fusión ResolvedAgentConfig/ResolvedAgentClient).

---

### RF-11: Decisión sobre tablas huérfanas

**Descripción:** Decisión explícita y documentada sobre `agent_tool_invocations` (+ enum
`AgentToolName`) y `agent_model_policies`, sin escritores desde el cycle-01.

**Reglas de negocio:**

- RN-20: La decisión (eliminar con migración propia o conservar con justificación escrita) queda
  registrada en `architect.md` de este ciclo — no puede quedar sin decidir por tercer ciclo
  consecutivo.

**Casos de error:**

- No aplica input externo; riesgo de proceso cubierto por RN-20 y CA-036.

**Origen:** brief.yaml scope, follow-up cycle-01 (destino de tablas huérfanas); spec §1
hallazgo A (subsistemas registrados sin caller).

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| `minProfitPct` | Piso de ganancia mínima de `TradingConfig`. Hoy actúa como veto absoluto del SELL; tras este ciclo, es el piso del camino de toma de ganancia, separado del corte de pérdida por señal. |
| Corte de pérdida por señal | Camino de decisión nuevo: permite vender en pérdida cuando la confianza del agente de señal supera un umbral configurable. |
| `positionSizeMultiplier` | Campo de la respuesta de AEGIS (`dto/decision-synthesis.dto.ts`) que modula hacia abajo el tamaño de orden calculado. |
| Verdict `REDUCE` | Resultado posible de AEGIS que hoy no tiene manejo; tras este ciclo, reduce el tamaño de la orden en vez de bloquearla o ser ignorado. |
| `maxTradePct` | Porcentaje del balance que define el techo de tamaño de orden; nunca se supera sea cual sea la modulación aplicada. |
| Sizing de FORGE | `maxTradeSize` sugerido por el agente FORGE (`sub-agent.service.ts`), hoy visible solo en analytics. |
| Protección nativa del exchange | Órdenes LIMIT, STOP_LOSS_LIMIT u OCO colocadas realmente en Binance al abrir una posición, en vez de verificarse solo por polling periódico. |
| Lot-size / minNotional / tick-size | Reglas de Binance spot sobre cantidad mínima, valor nominal mínimo y granularidad de precio que una orden debe cumplir para ser aceptada. |
| Reconciliación de estado | Proceso al inicio de cada ciclo que consulta el estado real de las órdenes en el exchange y actualiza `Position`/`Trade` locales en consecuencia. |
| Posición desprotegida | Estado explícito de una posición cuya compra se ejecutó pero cuya orden de protección no está confirmada como colocada. |
| Trailing stop | Nivel de stop-loss que se mueve a favor de la posición a medida que el precio avanza, sin retroceder nunca. |
| Take-profit escalonado | Venta parcial de la posición al alcanzar un umbral de ganancia, moviendo el stop remanente a breakeven. |
| Breakeven | Nivel de stop igual (o cercano) al precio de entrada, que asegura no perder capital sobre la porción remanente de la posición. |
| Riesgo agregado por usuario | Límites de exposición por activo, pérdida diaria y drawdown evaluados sobre el conjunto de bots/configs de un mismo usuario, no por bot aislado. |
| `RiskBudgetService` | Servicio de dominio (rescatado en cycle-01) que calcula presupuesto de riesgo; en este ciclo pasa a tener callers reales. |
| `PortfolioContextService` | Servicio de dominio (rescatado en cycle-01) que calcula contexto de portfolio; en este ciclo pasa a tener callers reales. |
| `simulateTrade` | Función de `libs/trading-engine/src/lib/risk/` que simula una operación y devuelve, entre otros datos, `riskRewardRatio`, usado por la política de SELL de este ciclo. |
| `Trade.decisionId` | FK nueva, nullable, de `Trade` a la `AgentDecision` que justificó la operación ejecutada. |
| `isFalseConcentrationBlock` | Función eliminada en este ciclo que anulaba un `BLOCK` de AEGIS por regex sobre el texto libre de `reason`. |
| Campo tipado de bloqueo | Campo estructurado en la respuesta de AEGIS que reemplaza al regex para decidir si un `BLOCK` corresponde a un falso positivo de concentración. |
| P2002 | Código de error de Prisma por violación de restricción única; en `EvaluationProcessor` puede ocurrir por colisión concurrente sobre `(decisionId, horizonMinutes)`. |
| `ModelSlotId` | Vocabulario unificado que reemplaza las referencias sueltas a `AgentId` en la resolución de config/cliente de agente. |
| Tablas huérfanas | `agent_tool_invocations` (+ enum `AgentToolName`) y `agent_model_policies`: sin ningún proceso que les escriba desde la poda del cycle-01. |
