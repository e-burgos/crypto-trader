# Functional — Cycle 1: Wire compartido y configuración avanzada del agente

> **Input:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-01/brief.yaml
> **Output:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-01/functional.md
> **Generado por:** sdd-functional

---

## Contexto de negocio

El bot ya sabe protegerse (OCO nativo, trailing stop, take-profit parcial), filtrar señales
ruidosas (corte de pérdida por confianza, gate determinista), modular el tamaño de sus compras
(sizing inteligente) y reaccionar por evento en vez de esperar el ciclo del LLM (loop reactivo con
sus caps de frecuencia), y además puede dejar una entrada descansando en el exchange en lugar de
comprar a mercado (`entryOrderMode`). Todo ese comportamiento nació apagado por diseño y **hoy sólo
se enciende por API**: el stepper de alta y el modal de edición de `apps/web` exponen 11 de los 40
campos de `CreateTradingConfigDto`/`UpdateTradingConfigDto`. Los 26 restantes son invisibles para
el trader, que no puede verlos, encenderlos ni entender qué hacen desde la SPA — incluido el bot
`LIMIT_MAKER` en TESTNET que corre en producción hoy mismo sin que el dashboard pueda mostrar su
modo de entrada.

A esa deuda de superficie se suma una deuda de tipos: `apps/web/src/hooks/use-trading.ts` declara
su propia `interface TradingConfig` con esos 11 campos, mientras que `libs/shared` sólo ofrece
`TradingConfigData` con 14 campos, congelada desde la primera versión. El typecheck del monorepo no
protege este wire — ya pasó antes con el wire de agentes, que dejó pasar un renombre del backend
hasta producción (`libs/shared/constitution.md` §3) — y cualquier campo que `apps/api` agregue de
acá en más seguirá siendo invisible para `apps/web` sin que ningún build lo marque en rojo.

Este ciclo cierra ambas deudas para la configuración del agente, sin tocar ni un endpoint del
backend: `libs/shared` pasa a publicar el wire completo del `TradingConfig` (los 40 campos del DTO
más los de lectura) y los tipos de alta/edición, `apps/web` importa de ahí y borra su interfaz
local; y las cuatro familias de comportamiento — *Protección*, *Señal y tamaño*, *Loop reactivo* y
*Entrada* — quedan configurables desde el alta, la edición y visibles en el detalle del agente,
agrupadas con el mismo lenguaje que ya usa la documentación del producto, siempre apagadas por
defecto y con los rangos del DTO como validación del lado del cliente.

El riesgo central de este ciclo es de UX, no de mercado: preseleccionar cualquier interruptor en
`true` en el alta cambiaría el comportamiento de todos los bots nuevos sin que el trader lo haya
pedido. Por eso todo criterio de este documento es una **propiedad verificable** sobre un fixture
del wire real o sobre el payload emitido (campos presentes, valor de un booleano, estado
`disabled` de un control, clave de i18n existente) — nunca el valor de un precio o de una decisión
de mercado.

**Actores de este ciclo:**

- **Trader dueño del bot** — configura protección, señal y tamaño, loop reactivo y entrada desde
  la SPA, en vez de hacerlo por API a mano; ve el estado real de cada interruptor en la edición y en
  el detalle de su agente.
- **Desarrollador de `apps/web`** — deja de mantener una interfaz local del wire de configuración;
  el typecheck del monorepo vuelve a avisarle si un campo del DTO cambia de forma.

---

## Historias de usuario

### US-1-001: El wire de configuración vive una sola vez, en `libs/shared`

**Como** desarrollador de `apps/web`
**Quiero** importar el tipo completo del `TradingConfig` (y los tipos de alta/edición) desde
`@crypto-trader/shared` en vez de mantener mi propia interfaz
**Para** que un campo nuevo o renombrado en el DTO del backend rompa mi build en vez de fallar en
silencio en producción

**Criterios de aceptación:**

- [ ] `apps/web` no declara ningún tipo (`interface` o `type`) que redeclare el shape del wire de
      `TradingConfig`, de `CreateTradingConfigDto` ni de `UpdateTradingConfigDto`: todos se importan
      de `@crypto-trader/shared`.
- [ ] El tipo publicado en `libs/shared` incluye los 40 campos de configuración de
      `CreateTradingConfigDto` (leídos de `apps/api/src/trading/dto/trading-config.dto.ts`, no
      inferidos) más los campos de lectura `id`, `isRunning`, `createdAt`, `updatedAt`.
- [ ] Agregar al DTO del backend un campo que no exista todavía en el tipo de `libs/shared` hace
      fallar el typecheck del monorepo (`pnpm nx run-many -t typecheck` o equivalente) en al menos
      un punto de `apps/web` — la propiedad exacta que hace fallar el build es responsabilidad del
      architect (ver D2 en "Preguntas abiertas").
- [ ] Ningún componente de `apps/web/src/components/config/` ni `apps/web/src/hooks/use-trading.ts`
      referencia un campo por su nombre sin que ese campo exista en el tipo importado (cero `as any`
      ni `as unknown as TradingConfig` para sortear el tipo).

---

### US-1-002: Protección — ver y encender la protección nativa de la posición

**Como** trader dueño del bot
**Quiero** ver y encender desde el alta y la edición los interruptores y parámetros de protección
de una posición abierta
**Para** decidir si mi bot coloca un OCO real al abrir, cuánto tolera de trailing, si toma
ganancia parcial y cuándo cierra por tiempo, sin tener que hacerlo por API

**Campos de la sección** (fuente: `CreateTradingConfigDto`, rangos citados tal cual):

| Campo (wire) | Explicación de una línea | Control | Rango (DTO) | Default | Depende de |
| --- | --- | --- | --- | --- | --- |
| `nativeProtectionEnabled` | Coloca un OCO real (stop-loss + take-profit) en el exchange al abrir la posición; se ignora en SANDBOX | interruptor | boolean | `false` | — (switch raíz de la sección) |
| `stopLimitOffsetPct` | Distancia entre el precio de stop y el precio límite de la pierna de stop-loss del OCO nativo | slider | `0..0.05` (0%–5%) | `0.002` (0.2%) | `nativeProtectionEnabled` |
| `closeOnProtectionFailure` | Si el OCO nativo no se puede colocar tras los reintentos, cierra la posición a mercado en vez de dejarla sin protección | interruptor | boolean | `false` | `nativeProtectionEnabled` |
| `trailingStopEnabled` | El stop persigue el precio a medida que sube, en vez de quedar fijo; mientras está activo, el take-profit fijo (`takeProfitPct`) queda desactivado | interruptor | boolean | `false` | — (switch propio) |
| `trailingStopPct` | Distancia del stop respecto del máximo visto desde que se activó el trailing | slider | `0.001..1` (0.1%–100%) | `0.02` (2%) | `trailingStopEnabled` |
| `trailingActivationPct` | Ganancia mínima no realizada para que el trailing empiece a seguir el precio | slider | `0.001..1` (0.1%–100%) | `0.01` (1%) | `trailingStopEnabled` |
| `partialTpEnabled` | Vende una fracción de la posición al llegar a una ganancia intermedia, antes del take-profit final | interruptor | boolean | `false` | — (switch propio) |
| `partialTpTriggerPct` | Ganancia no realizada que dispara la venta parcial | slider | `0.001..1` (0.1%–100%) | `0.02` (2%) | `partialTpEnabled` |
| `partialTpSellPct` | Fracción de la posición que se vende en ese disparo | slider | `0.05..1` (5%–100%) | `0.5` (50%) | `partialTpEnabled` |
| `moveStopToBreakevenAfterPartial` | Tras la venta parcial, sube el stop al punto de equilibrio neto de comisiones | interruptor | boolean | `true` (nace `true` **sólo si** `partialTpEnabled` está en `true`; ver nota) | `partialTpEnabled` |
| `maxPositionHoldMinutes` | Antigüedad máxima de una posición abierta antes de cerrarla por tiempo; sin límite si se deja apagado | número | `5..43200` minutos, opcional (`null`/omitido = sin límite) | sin límite | — (nullable sin switch propio en el DTO; ver "Preguntas abiertas") |

**Criterios de aceptación:**

- [ ] En el alta, los once campos de esta tabla no aparecen en el `POST /trading/config` si el
      trader no tocó la sección: ni como clave presente con el default, ni con ningún otro valor
      (ver US-1-006).
- [ ] Con `nativeProtectionEnabled` apagado, `stopLimitOffsetPct` y `closeOnProtectionFailure` se
      renderizan deshabilitados (atributo `disabled`, sin foco ni cambio de valor posible).
- [ ] Con `trailingStopEnabled` apagado, `trailingStopPct` y `trailingActivationPct` se renderizan
      deshabilitados.
- [ ] Con `partialTpEnabled` apagado, `partialTpTriggerPct`, `partialTpSellPct` y
      `moveStopToBreakevenAfterPartial` se renderizan deshabilitados.
- [ ] Encender cada interruptor habilita exactamente los controles listados como dependientes en la
      tabla, sin habilitar ni deshabilitar ningún control de otra sección.
- [ ] Un valor ingresado fuera del rango del DTO no llega a integrar el payload emitido: el control
      lo clampea al límite más cercano o el botón de guardar/crear queda deshabilitado con un mensaje
      de validación (`t('config.advanced.protection.*.rangeError')`), a elección del architect —
      pero en ningún caso el fixture de test observa un valor fuera de rango en el payload.

---

### US-1-003: Señal y tamaño — filtrar señales ruidosas y modular el tamaño de la compra

**Como** trader dueño del bot
**Quiero** ver y encender desde el alta y la edición el corte de pérdida por señal, el gate
determinista y el sizing inteligente
**Para** decidir si mi bot puede vender en pérdida cuando el LLM tiene alta confianza, si filtra
ciclos sin movimiento de precio antes de llamar al LLM, y si reduce el tamaño de sus compras
cuando el contexto lo amerita

**Campos de la sección:**

| Campo (wire) | Explicación de una línea | Control | Rango (DTO) | Default | Depende de |
| --- | --- | --- | --- | --- | --- |
| `lossCutEnabled` | Permite vender en pérdida cuando el LLM lo decide con alta confianza; apagado, se mantiene el veto actual de `minProfitPct` | interruptor | boolean | `false` | — (switch raíz) |
| `lossCutConfidenceThreshold` | Confianza mínima del LLM (0–100%) para habilitar una venta en pérdida | slider | `0..1` (0%–100%) | `0.85` (85%) | `lossCutEnabled` |
| `lossCutMinLossPct` | Pérdida mínima para considerar el corte — evita vender por ruido de precio | slider | `0..0.5` (0%–50%) | `0.005` (0.5%) | `lossCutEnabled` |
| `lossCutMinEdgeRatio` | Múltiplo de la fricción de salida (fees + slippage) que la pérdida evitada debe superar para justificar el corte | slider | `0..100` | `2` | `lossCutEnabled` |
| `smartSizingEnabled` | Modula el tamaño de la próxima compra según el contexto de riesgo; apagado, cada compra usa el tamaño base sin ajuste | interruptor | boolean | `false` | — (switch raíz) |
| `reduceSizeFactor` | Factor que reduce el tamaño de la compra cuando el contexto de riesgo lo indica | slider | `0.05..1` (5%–100%) | `0.5` (50%) | `smartSizingEnabled` |
| `deterministicGateEnabled` | Si el mercado no se movió lo suficiente desde la última decisión, resuelve `HOLD` sin llamar al LLM (ahorra costo de LLM) | interruptor | boolean | `false` | — (switch raíz) |
| `gatePriceChangePct` | Umbral de cambio de precio que el gate exige para dejar pasar la llamada al LLM | slider | `0.0005..0.05` (0.05%–5%) | `0.005` (0.5%) | `deterministicGateEnabled` |

**Criterios de aceptación:**

- [ ] En el alta sin tocar la sección, ninguno de los ocho campos aparece en el `POST` (ver
      US-1-006).
- [ ] Con `lossCutEnabled` apagado, `lossCutConfidenceThreshold`, `lossCutMinLossPct` y
      `lossCutMinEdgeRatio` se renderizan deshabilitados.
- [ ] Con `smartSizingEnabled` apagado, `reduceSizeFactor` se renderiza deshabilitado.
- [ ] Con `deterministicGateEnabled` apagado, `gatePriceChangePct` se renderiza deshabilitado.
- [ ] Los tres interruptores raíz de esta sección son independientes entre sí: encender uno no
      habilita ni deshabilita los controles de los otros dos.

---

### US-1-004: Loop reactivo — operar por evento con caps de frecuencia

**Como** trader dueño del bot
**Quiero** ver y encender desde el alta y la edición el loop reactivo y sus caps de frecuencia
**Para** decidir si mi bot puede reaccionar a un evento de mercado fuera de su ciclo periódico, y
con qué límite de acciones por hora y de tiempo mínimo entre acciones

**Campos de la sección:**

| Campo (wire) | Explicación de una línea | Control | Rango (DTO) | Default | Depende de |
| --- | --- | --- | --- | --- | --- |
| `reactiveLoopEnabled` | Permite que el bot actúe fuera de su ciclo periódico ante un evento de mercado relevante; apagado, sólo actúa en su ciclo LLM | interruptor | boolean | `false` | — (switch raíz) |
| `maxActionsPerHour` | Máximo de acciones que el loop reactivo puede ejecutar en una hora móvil | slider | `1..60` (entero) | `6` | `reactiveLoopEnabled` |
| `minActionIntervalSec` | Tiempo mínimo en segundos entre dos acciones del loop reactivo | slider | `5..3600` (entero) | `60` | `reactiveLoopEnabled` |

**Criterios de aceptación:**

- [ ] En el alta sin tocar la sección, ninguno de los tres campos aparece en el `POST` (ver
      US-1-006).
- [ ] Con `reactiveLoopEnabled` apagado, `maxActionsPerHour` y `minActionIntervalSec` se renderizan
      deshabilitados.
- [ ] Ambos parámetros se validan como enteros: un valor con decimales no llega a integrar el
      payload (se redondea en el control o el submit se bloquea).

---

### US-1-005: Entrada — elegir cómo el bot coloca su compra en el exchange

**Como** trader dueño del bot
**Quiero** ver y elegir desde el alta y la edición si mi bot compra a mercado, deja una entrada
descansando en el soporte, o coloca un OCO de entrada con `trailingDelta` opcional
**Para** poder entrar en un nivel mejor que el precio de mercado del momento cuando mi bot corre
en `LIVE`/`TESTNET`

**Campos de la sección:**

| Campo (wire) | Explicación de una línea | Control | Rango (DTO) | Default | Depende de |
| --- | --- | --- | --- | --- | --- |
| `entryOrderMode` | `MARKET` compra a mercado (comportamiento actual); `LIMIT_MAKER` deja una entrada descansando en el soporte; `OCO` deja soporte + ruptura a la vez | select | `MARKET \| LIMIT_MAKER \| OCO` | `MARKET` | Ver US-1-010/RN-06 (deshabilitado en SANDBOX) |
| `entryOrderTtlMinutes` | Minutos desde que se coloca la entrada hasta que vence y se cancela si nadie la llenó | slider | `5..1440` (entero, 5 min–24 h) | `120` | `entryOrderMode ≠ MARKET` |
| `entryTrailingDeltaBips` | Delta en BIPS (100 = 1%) para que la pierna de ruptura del OCO persiga el precio en vez de dispararse en un nivel fijo; omitido, la pierna queda en nivel fijo | número | `10..2000` (entero), opcional | sin valor (nivel fijo) | `entryOrderMode = OCO` (ver RN-07) |

**Criterios de aceptación:**

- [ ] En el alta sin tocar la sección, `entryOrderMode` no aparece en el `POST`, o aparece con el
      valor `MARKET` — ninguno de los dos casos cambia el comportamiento actual (ver US-1-006 y
      RN-01 de `spec-e-burgos-005 cycle-02`, heredada).
- [ ] Con `entryOrderMode = MARKET`, `entryOrderTtlMinutes` y `entryTrailingDeltaBips` se renderizan
      deshabilitados.
- [ ] Con `entryOrderMode = LIMIT_MAKER`, `entryOrderTtlMinutes` se habilita y `entryTrailingDeltaBips`
      permanece deshabilitado (no aplica a esta pierna, ver RN-07).
- [ ] Con `entryOrderMode = OCO`, ambos `entryOrderTtlMinutes` y `entryTrailingDeltaBips` se
      habilitan.

---

### US-1-006: Crear un agente sin tocar la configuración avanzada no cambia nada

**Como** trader dueño del bot
**Quiero** que si nunca abro ni toco la sección avanzada del alta, mi agente se cree exactamente
igual que antes de este ciclo
**Para** no verme afectado por una funcionalidad que no pedí, sólo porque existe en la pantalla

**Criterios de aceptación:**

- [ ] **CA-002 (spec).** El conjunto de claves del `POST /trading/config` emitido al completar el
      alta sin abrir/tocar ninguna de las cuatro secciones avanzadas es exactamente el mismo conjunto
      de claves que emitía el stepper antes de este ciclo: `name?, asset, pair, mode, buyThreshold,
      sellThreshold, stopLossPct, takeProfitPct, minProfitPct, maxTradePct, maxConcurrentPositions,
      minIntervalMinutes, intervalMode, orderPriceOffsetPct, riskProfile` — ninguna clave de las
      cuatro secciones nuevas está presente, salvo que el architect defina explícitamente que alguna
      viaja con su default documentado (a resolver en `architect.md`, no en este documento).
- [ ] Si el architect decide que algún campo nuevo viaja siempre con su default (en vez de omitirse),
      ese valor nunca es `true` para un campo booleano — ningún interruptor nace encendido.
- [ ] Un test de comportamiento (Vitest) sobre un fixture congelado del wire real reproduce el flujo
      completo del stepper sin interacción con la sección avanzada y compara el payload emitido por
      igualdad exacta de objeto contra el fixture del payload de "antes de este ciclo".

---

### US-1-007: Editar Protección con el estado real precargado

**Como** trader dueño del bot
**Quiero** que al abrir la edición de mi agente, la sección Protección muestre el valor real que
tiene guardado cada interruptor y cada parámetro
**Para** saber qué tiene encendido mi bot hoy antes de cambiar algo

**Criterios de aceptación:**

- [ ] Al abrir la edición, cada uno de los once controles de Protección (US-1-002) refleja el valor
      persistido de la config (`nativeProtectionEnabled: true` en la config ⇒ interruptor mostrado
      encendido; no adivina ni asume un default si el campo vino en la respuesta).
- [ ] El estado `disabled` de los parámetros dependientes en la edición se computa de la misma forma
      que en el alta (US-1-002): dependen del valor real de su interruptor, no de si el trader lo
      tocó en esta sesión de edición.
- [ ] Modificar un valor de esta sección y guardar produce un `PUT /trading/config/{id}` cuyo cuerpo
      incluye el/los campo(s) modificado(s) con el nuevo valor, dentro del rango del DTO (ver
      US-1-010 para el criterio exacto de "sólo lo cambiado" y la pregunta abierta D3).

---

### US-1-008: Editar Señal y tamaño con el estado real precargado

**Como** trader dueño del bot
**Quiero** que la edición de mi agente muestre el valor real de cada interruptor y parámetro de
Señal y tamaño
**Para** ajustar el corte de pérdida, el sizing o el gate determinista sin perder lo que ya tenía
configurado

**Criterios de aceptación:**

- [ ] Los ocho controles de Señal y tamaño (US-1-003) reflejan el valor persistido de la config al
      abrir la edición.
- [ ] El estado `disabled` de los parámetros dependientes se computa igual que en el alta.

---

### US-1-009: Editar Loop reactivo con el estado real precargado

**Como** trader dueño del bot
**Quiero** que la edición de mi agente muestre si el loop reactivo está encendido y con qué caps
**Para** ajustar la frecuencia de reacción de mi bot sin perder lo ya configurado

**Criterios de aceptación:**

- [ ] Los tres controles de Loop reactivo (US-1-004) reflejan el valor persistido de la config al
      abrir la edición.
- [ ] El estado `disabled` de `maxActionsPerHour` y `minActionIntervalSec` se computa igual que en
      el alta.

---

### US-1-010: Editar Entrada con las reglas de coherencia aplicadas

**Como** trader dueño del bot
**Quiero** que la edición de mi agente muestre el modo de entrada real, y que el control respete
las mismas reglas de coherencia que el alta según el modo de operación de mi bot
**Para** entender por qué no puedo elegir un modo de entrada distinto de `MARKET` en un bot
SANDBOX, y para configurar el `trailingDelta` sólo cuando corresponde

**Criterios de aceptación:**

- [ ] El select de `entryOrderMode` refleja el valor persistido de la config al abrir la edición
      (incluye el caso del bot TESTNET `LIMIT_MAKER` mencionado en el diagnóstico de la spec).
- [ ] **CA-004 (spec).** Con el `mode` resuelto del bot en `SANDBOX`, el select de `entryOrderMode`
      se renderiza deshabilitado y muestra un texto explicativo (`t('config.advanced.entry.sandboxDisabled')`)
      indicando que la entrada descansando no aplica en SANDBOX; con `LIVE` o `TESTNET`, el select
      ofrece las tres opciones (`MARKET`, `LIMIT_MAKER`, `OCO`) habilitadas.
- [ ] `entryTrailingDeltaBips` se renderiza habilitado únicamente cuando `entryOrderMode = OCO` y el
      modo resuelto del bot no es `SANDBOX`; en cualquier otra combinación está deshabilitado.
- [ ] Guardar un cambio en esta sección produce un `PUT` cuyo cuerpo respeta el rango del DTO citado
      en US-1-005 (ver también D3 en "Preguntas abiertas" para el alcance exacto de "sólo lo
      cambiado").

---

### US-1-011: Ver las cuatro secciones en el detalle del agente

**Como** trader dueño del bot
**Quiero** ver en el detalle de mi agente el estado de Protección, Señal y tamaño, Loop reactivo y
Entrada, no sólo los 11 campos que ya se mostraban
**Para** entender de un vistazo todo lo que mi bot tiene configurado, sin tener que abrir la
edición

**Criterios de aceptación:**

- [ ] El detalle del agente (`agent-detail-modal.tsx`) renderiza, además de las filas existentes,
      una fila o agrupación legible por cada uno de los 26 campos avanzados, con el mismo valor que
      tiene la config persistida.
- [ ] Un interruptor apagado se muestra como tal (no se omite la fila ni se muestra un valor
      numérico dependiente que no aplica); un parámetro dependiente de un interruptor apagado se
      muestra atenuado o con una indicación de "no aplica", nunca con un valor engañoso.
- [ ] El detalle es de solo lectura para estos 26 campos: ninguna interacción en esta vista dispara
      un `PUT` (la única edición existente, el nombre del agente, sigue funcionando sin cambios).
- [ ] Un valor de `entryOrderMode` fuera del union esperado (`MARKET | LIMIT_MAKER | OCO`) degrada
      esa fila a un estado neutro (`unknown`) sin romper el render del resto del detalle
      (constitución `apps/web` §4).

---

### US-1-012: Las reglas de coherencia son visibles, no sólo aplicadas

**Como** trader dueño del bot
**Quiero** que cuando un control esté deshabilitado por una regla de coherencia, la pantalla me
explique por qué
**Para** no interpretar un control apagado como un bug

**Criterios de aceptación:**

- [ ] Todo control deshabilitado por la regla SANDBOX/`entryOrderMode` (US-1-010) muestra su
      explicación mediante `InfoTooltip` o un texto visible junto al control — nunca sólo el atributo
      `disabled` sin contexto.
- [ ] El modo de operación (`mode`) del bot nunca se ofrece como campo editable en las cuatro
      secciones nuevas del alta ni de la edición: es el mismo dato de solo lectura que ya muestra el
      stepper (heredado, sin cambios de este ciclo).
- [ ] Ningún control de las cuatro secciones nuevas queda deshabilitado sin que exista una regla de
      dependencia documentada en este documento (US-1-002 a US-1-005) que lo explique.

---

### US-1-013: Los textos de la configuración avanzada están traducidos, sin excepción

**Como** trader dueño del bot que usa la SPA en español o en inglés
**Quiero** que cada interruptor, cada parámetro y cada mensaje de coherencia de las cuatro
secciones tenga su texto en mi idioma
**Para** entender qué estoy configurando sin ver una clave de i18n cruda ni texto en el idioma
equivocado

**Criterios de aceptación:**

- [ ] **CA-007 (spec).** `entryOrderPlaced`, `entryOrderFilled` y `entryOrderMissing` existen como
      claves bajo `notificationMessages` en `apps/web/src/locales/es.ts` y en `apps/web/src/locales/en.ts`
      (hoy ausentes en ambos — verificado contra el código).
- [ ] Toda clave nueva de las cuatro secciones sigue la convención `seccion.componente.elemento`
      (ej. `config.advanced.protection.nativeProtectionEnabled.label`,
      `...nativeProtectionEnabled.hint`) y existe en ambos locales — ninguna clave existe en `es.ts`
      sin su par en `en.ts` o viceversa.
- [ ] Ningún texto de las cuatro secciones nuevas está hardcodeado fuera de `t()`.
- [ ] Un test de comportamiento recorre el árbol de claves nuevas y confirma paridad de claves entre
      `es.ts` y `en.ts` (mismo conjunto de keys, ningún valor vacío).

---

### US-1-014: La configuración avanzada se usa con teclado y respeta el movimiento reducido

**Como** trader que navega la SPA con teclado o que configuró su sistema para reducir el movimiento
**Quiero** poder encender cada interruptor, mover cada slider y elegir cada opción sin mouse, y no
ver animaciones que mi sistema me pidió evitar
**Para** poder configurar mi agente sin depender de un dispositivo señalador ni sufrir movimiento
que no quiero ver

**Criterios de aceptación:**

- [ ] Cada interruptor (`ToggleSwitch`) es alcanzable por `Tab`, expone `role="switch"` y
      `aria-checked` reflejando su estado (heredado del componente de `libs/ui`, verificado en el uso
      dentro de las cuatro secciones nuevas).
- [ ] Cada slider y cada select de las cuatro secciones es operable con teclado (flechas para el
      slider nativo `type="range"`, `Enter`/flechas para el `Select` de `libs/ui`) sin trampa de foco.
- [ ] Toda etiqueta de un control (`label`) está asociada a su control mediante `FormField`/`htmlFor`
      o mediante el wrapper propio de `ToggleSwitch` — ningún control queda sin nombre accesible.
- [ ] Con `prefers-reduced-motion: reduce`, ninguna transición de apertura/cierre de una sección
      colapsable ni de habilitación de un control dependiente supera lo que ya permite la
      constitución de `apps/web` (animaciones ≤300ms, respeta la media query) — no se introduce una
      animación nueva que la ignore.

---

### US-1-015: La configuración avanzada tiene tests de comportamiento sobre el wire real

**Como** responsable de cerrar el ciclo
**Quiero** que cada regla de habilitación, cada payload y cada clave de i18n de este ciclo esté
cubierta por un test que corre sobre un fixture del wire real, y que la suite E2E lo ejercite
headless
**Para** tener evidencia de que el criterio de done de `apps/web` (test de comportamiento, no sólo
`tsc`) se cumple para estas cuatro secciones antes de cerrar el ciclo

**Criterios de aceptación:**

- [ ] Existe al menos un fixture Vitest por sección (Protección, Señal y tamaño, Loop reactivo,
      Entrada) construido a partir del tipo importado de `@crypto-trader/shared` (no de un objeto
      literal sin tipo), cubriendo el caso "todo apagado" y el caso "todo encendido con valores en el
      límite del rango del DTO".
- [ ] Un test de propiedad verifica, para cada campo dependiente listado en US-1-002 a US-1-005, que
      su control está `disabled` cuando el interruptor/valor del que depende está apagado, y
      habilitado en caso contrario — parametrizado por los pares (campo, dependencia) de este
      documento, no un test hardcodeado por campo.
- [ ] El test de US-1-006 (payload idéntico sin tocar lo avanzado) y el de CA-004 (SANDBOX
      deshabilita `entryOrderMode`) están automatizados en Vitest, no sólo descriptos en este
      documento.
- [ ] La suite E2E (Playwright) agrega al menos un spec headless que abre el alta, entra a la
      sección avanzada, enciende un interruptor de cada sección y confirma que el control dependiente
      correspondiente se habilita en el DOM — corre en CI sin `PLAYWRIGHT_HEADED_DEBUG` y sin
      depender de una clave externa.
- [ ] Ningún test de este ciclo abre un navegador visible en la máquina del desarrollador: Vitest
      corre en jsdom/node y Playwright corre headless.

---

## Reglas de negocio

**Interruptores y superficie de configuración**

1. Todo interruptor de las cuatro secciones nace apagado (`false`) en el alta; ningún valor
   `true` se preselecciona (constitución de `apps/api` §4, heredada, no negociable).
2. Un parámetro dependiente de un interruptor (tabla de cada sección en US-1-002 a US-1-005) se
   renderiza deshabilitado mientras ese interruptor está apagado; encenderlo habilita únicamente
   los parámetros que dependen de él, ninguno de otra sección.
3. Los rangos de validación del lado del cliente son exactamente los del DTO
   (`apps/api/src/trading/dto/trading-config.dto.ts`, decoradores `@Min`/`@Max`/`@IsInt`) citados en
   las tablas de este documento — no se inventa ni se amplía ningún rango.
4. El typecheck del monorepo es la primera línea de defensa contra un campo del DTO que la UI no
   contempla: `apps/web` importa el wire completo desde `@crypto-trader/shared` y no redeclara
   ningún tipo local (US-1-001, CA-001 de la spec).

**Reglas de coherencia**

5. El modo de operación (`mode`) del bot es de solo lectura en el formulario: lo decide la
   configuración global de operación del usuario (badge Sandbox/Live/Testnet del header), nunca un
   campo editable de las cuatro secciones nuevas (heredado, sin cambios de este ciclo).
6. Con el modo resuelto del bot en `SANDBOX`, `entryOrderMode` se muestra deshabilitado, fijo en
   `MARKET`, con una explicación visible de por qué; con `LIVE`/`TESTNET` ofrece las tres opciones
   (CA-004 de la spec).
7. `entryTrailingDeltaBips` sólo es editable cuando `entryOrderMode = OCO`; con `MARKET` o
   `LIMIT_MAKER` está deshabilitado y su valor no se envía en el payload (CA-004 de la spec,
   heredado de `spec-e-burgos-005 cycle-02` RN-05).
8. `entryOrderTtlMinutes` sólo es editable cuando `entryOrderMode ≠ MARKET` (aplica tanto a
   `LIMIT_MAKER` como a `OCO`, a diferencia de `entryTrailingDeltaBips`, exclusivo de `OCO`).

**Alta sin tocar lo avanzado**

9. Un agente creado sin abrir ni modificar ninguna de las cuatro secciones avanzadas produce
   exactamente el mismo `POST /trading/config` que producía el stepper antes de este ciclo, campo a
   campo (CA-002 de la spec).

**Convenciones heredadas del repo**

10. Todo texto visible pasa por `t('clave')`, con la convención `seccion.componente.elemento`;
    ninguna clave nueva existe en un locale sin su par en el otro (CA-007 de la spec).
11. El catálogo de `libs/ui` se revisa antes de escribir un componente nuevo
    (`frontend-component-rules` regla 1); un componente reutilizable y sin lógica de negocio que no
    exista todavía va a `libs/ui/src/lib/`, uno con lógica de negocio específica de esta feature va a
    `apps/web/src/components/config/` (reglas 2–4).
12. Ningún archivo de página (`apps/web/src/pages/**`) define un subcomponente inline; las cuatro
    secciones se implementan como componentes propios importados por el stepper, la edición y el
    detalle (regla 5 de `frontend-component-rules`).
13. Un valor de wire fuera del union esperado (ej. un `entryOrderMode` desconocido) degrada la
    fila o el control afectado a un estado neutro (`unknown`), nunca rompe el render de la pantalla
    entera (constitución `apps/web` §4).
14. El criterio de done de cualquier pantalla de este ciclo que consuma el wire compartido es un
    test de comportamiento en verde sobre un fixture del wire real, no sólo que `tsc` no marque error
    (constitución `apps/web` §4).
15. Ninguna animación introducida por este ciclo (apertura de sección, habilitación de un control)
    supera 300ms ni ignora `prefers-reduced-motion` (constitución `apps/web` §4).
16. Ningún test de este ciclo abre un navegador visible en la máquina del desarrollador: Vitest y
    Playwright corren siempre headless.
17. El código de este ciclo no lleva comentarios narrativos (regla del dual-harness, no negociable).

---

## Preguntas abiertas para el architect

- **D1 (brief) — Dónde viven las cuatro secciones en el alta.** Este documento describe las cuatro
  secciones como agrupaciones funcionales del alta y la edición, sin fijar si en el stepper viven en
  un paso "Avanzado" nuevo y opcional (colapsado por sección, como recomienda el brief) o repartidas
  en los pasos existentes (`risk`, `timing`). Los criterios de aceptación de este documento son
  válidos en cualquiera de los dos casos porque no dependen de en qué paso vive cada sección; el
  architect debe fijar la ubicación exacta y, si reparte, confirmar que ninguna sección queda
  huérfana de dueño de componente.
- **D2 (brief) — Cómo comparte `apps/api` el tipo del wire sin duplicar el DTO.** Este documento fija
  qué debe exponer `libs/shared` (US-1-001) pero no cómo se ata el DTO real del backend a ese tipo
  (`implements`, `satisfies`, o un test de igualdad de claves). El architect debe elegir el mecanismo
  que haga fallar el typecheck (o al menos un test) ante un campo nuevo en un solo lado, y ese
  mecanismo exacto es el que el criterio de US-1-001 sobre "hace fallar el build" termina de
  verificar.
- **D3 (brief) — Alcance exacto de "sólo lo cambiado" en el `PUT` de edición.** Verificado contra el
  código: `apps/api/src/trading/trading.service.ts:288-291` hace `this.prisma.tradingConfig.update({
  where, data: { ...dto } })` — Prisma sólo toca las claves presentes en `dto`, así que el backend ya
  soporta un `PUT` parcial hoy (más un `ValidationPipe` global con `whitelist: true,
  forbidNonWhitelisted: true` en `apps/api/src/main.ts:23`, que rechaza cualquier clave no declarada
  en `UpdateTradingConfigDto`). Pero `edit-agent-modal.tsx` **no** aprovecha eso: su `handleSave`
  arma hoy un objeto con los once campos visibles completos en cada guardado, no un diff de lo que el
  trader efectivamente tocó. CA-003 de la spec exige que el `PUT` "contenga sólo los campos
  cambiados" para los 26 campos nuevos — este documento fija el requisito (US-1-007 a US-1-010) pero
  no el mecanismo (¿el formulario trackea qué tocó el trader desde que abrió el modal? ¿se compara
  contra la config original en el momento de armar el payload?). Corresponde al architect definir ese
  mecanismo y si aplica también a los 11 campos existentes o sólo a los 26 nuevos.
- **Campos opcionales sin interruptor propio en el DTO.** `maxPositionHoldMinutes` (Protección) y
  `entryTrailingDeltaBips` (Entrada) son numéricos opcionales cuya ausencia/`null` tiene un
  significado de negocio ("sin límite", "nivel fijo") pero no existe un booleano hermano en el DTO
  que la UI pueda usar como interruptor. Este documento no resuelve si la UI sintetiza un interruptor
  propio (que vive sólo en el estado del formulario, nunca se envía) para representar "activo/sin
  límite", o si usa otro mecanismo (ej. un valor especial en el control). Pedimos al architect fijar
  el mecanismo antes de implementar, porque afecta el shape del estado del formulario de las dos
  secciones involucradas.
- **Si el alta agrega alguna clave nueva por default (US-1-006).** Este documento exige que el
  `POST` sin tocar lo avanzado sea idéntico al de hoy; no resuelve si eso significa "cero claves
  nuevas en el payload" o "claves nuevas presentes pero todas con su default documentado, ninguna en
  `true`". Ambas lecturas cumplen la letra de CA-002 (ningún interruptor en `true`), pero producen
  fixtures de test distintos — el architect debe elegir una y documentarla en `architect.md` para que
  el test de US-1-006 tenga un único payload esperado.

---

## Glosario del dominio

| Término | Definición |
| --- | --- |
| Interruptor | Campo booleano del `TradingConfig` que enciende/apaga una familia de comportamiento (ej. `nativeProtectionEnabled`); en la UI se representa con `ToggleSwitch` y nace siempre apagado en el alta. |
| Sección avanzada | Cada una de las cuatro agrupaciones de este ciclo — Protección, Señal y tamaño, Loop reactivo, Entrada — que exponen los 26 campos del DTO que hoy sólo existen por API. |
| Protección nativa | `nativeProtectionEnabled`: coloca un OCO real (stop-loss + take-profit) en el exchange al abrir la posición; sólo tiene efecto en `LIVE`/`TESTNET`. |
| Trailing stop | `trailingStopEnabled` + `trailingStopPct`/`trailingActivationPct`: el stop de una posición persigue el precio a medida que sube, en vez de quedar fijo; desactiva el take-profit fijo mientras está activo. |
| Take-profit parcial | `partialTpEnabled` + sus parámetros: vende una fracción de la posición al llegar a una ganancia intermedia, antes del take-profit final. |
| Corte de pérdida por señal | `lossCutEnabled` + sus parámetros: permite vender en pérdida cuando el LLM lo decide con alta confianza, en vez de mantener el veto de `minProfitPct`. |
| Sizing inteligente | `smartSizingEnabled` + `reduceSizeFactor`: modula el tamaño de la próxima compra según el contexto de riesgo, en vez de usar siempre el tamaño base. |
| Gate determinístico | `deterministicGateEnabled` + `gatePriceChangePct`: resuelve `HOLD` sin llamar al LLM cuando el mercado no se movió lo suficiente desde la última decisión. |
| Loop reactivo | `reactiveLoopEnabled`: permite que el bot actúe fuera de su ciclo periódico ante un evento de mercado relevante, sujeto a los caps de frecuencia. |
| Caps | `maxActionsPerHour` y `minActionIntervalSec`: los dos límites de frecuencia que acotan cuánto puede actuar el loop reactivo. |
| Entrada descansando | Orden de entrada (`LIMIT_MAKER` o `OCO`, `entryOrderMode ≠ MARKET`) que el bot deja colocada en el exchange en vez de comprar a mercado; vive en Binance independientemente de si el backend está corriendo (cubierta en profundidad en `spec-e-burgos-005 cycle-02`; en este ciclo sólo se configura, no se visualiza su ciclo de vida — eso es cycle-02 de esta spec). |
| `LIMIT_MAKER` | Tipo de orden límite que Binance rechaza si ejecutaría como taker; usado como entrada suelta o como pierna inferior de un OCO de entrada. |
| OCO | Par de órdenes contingentes: al llenarse una, Binance cancela la otra. En este ciclo, `entryOrderMode = OCO` combina una pierna `LIMIT_MAKER` (soporte) con una de ruptura. |
| `trailingDelta` / BIPS | Delta en BIPS (100 = 1%) que hace que la pierna de ruptura de un OCO de entrada persiga el precio en vez de dispararse en un nivel fijo; opcional, exclusivo de `entryOrderMode = OCO`. |
| Modo de operación global | El modo (`SANDBOX`/`LIVE`/`TESTNET`) que el usuario fija para su cuenta desde el header de la SPA; manda sobre el `mode` de cada bot nuevo y es de solo lectura en el formulario de configuración. |
