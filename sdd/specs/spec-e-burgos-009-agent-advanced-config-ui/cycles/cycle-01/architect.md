# Architect — Cycle 1: Wire compartido y configuración avanzada del agente

> **Input:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-01/architect.md
> **Generado por:** sdd-architect · 2026-09-03

---

## 0. Cómo leer este documento

Este ciclo no crea tablas ni endpoints: crea **un tipo** (el wire de `TradingConfig` en
`libs/shared`), **un mecanismo** (el diff de draft que decide qué viaja en el POST y en el PUT) y
**una superficie** (cuatro secciones de configuración avanzada en alta, edición y detalle). Todo lo
demás es composición sobre lo que ya existe.

Orden de lectura para el implementador: §2 (decisiones) → §3 (tipos compartidos) → §6 (modelo de
estado) → §4 (catálogo de campos) → §5 (componentes) → §12 (tests). Las §1 y §11 son para el
orquestador y el reviewer.

### Reparto arquitectónico (invariante del ciclo)

| Capa | Qué le toca | Prohibido |
| --- | --- | --- |
| `libs/shared` | `TradingConfigWire`, `CreateTradingConfigInput`, `UpdateTradingConfigInput`, `UpdateTradingConfigPayload`, las listas `TRADING_CONFIG_BASE_FIELDS` / `TRADING_CONFIG_ADVANCED_FIELDS` y los helpers de tipo `ExactKeys` / `AssertNoKeyDrift` | React, Nest, class-validator, cualquier dependencia |
| `apps/api` | **Sólo** dos líneas `implements` y dos aliases de tipo de verificación en `trading-config.dto.ts`. Decoradores, mensajes, rangos y comportamiento: intactos | Cambiar un decorador, un rango, un default o el servicio (todo eso es FIX, ver §1) |
| `libs/ui` | Extensión **aditiva** de props de `SliderField` y `ToggleSwitch` (§2 D8). Nada más | Conocer campos de trading, i18n, hooks de datos |
| `apps/web` | Catálogo de campos, draft y diff, cuatro componentes de sección, paso del stepper, bloque de edición, resumen del detalle, locales, tests | Redeclarar el wire; escribir un rango que no salga del DTO; texto fuera de `t()` |

---

## 1. Hallazgos que cambian el contrato (verificados contra el código, 2026-09-03)

Los cuatro se verificaron leyendo el código, no inferidos. Ninguno lo resuelve este ciclo tocando
`apps/api` (out_of_scope del brief); los dos primeros exigen registro en el FIX GATE **antes** de
que el implementador cierre las tasks del alta.

### H1 (BLOQUEANTE para el alta) — `createConfig` acepta 22 de los 25 campos avanzados y los descarta

`apps/api/src/trading/trading.service.ts:255-274` construye el `prisma.tradingConfig.create({ data: … })`
**campo por campo**: `userId, name, asset, pair, mode, buyThreshold, sellThreshold, stopLossPct,
takeProfitPct, minProfitPct, maxTradePct, maxConcurrentPositions, minIntervalMinutes, intervalMode,
orderPriceOffsetPct, riskProfile, entryOrderMode, entryOrderTtlMinutes, entryTrailingDeltaBips`.

Consecuencia medible: un `POST /trading/config` con `nativeProtectionEnabled: true` responde **201**
y persiste `false` (default de la columna en `schema.prisma:263`). El `ValidationPipe` lo acepta
—el campo está declarado en el DTO— y el servicio lo ignora en silencio. Los **22** campos
descartados son todos los avanzados menos los tres de entrada:

`lossCutEnabled, lossCutConfidenceThreshold, lossCutMinLossPct, lossCutMinEdgeRatio,
smartSizingEnabled, reduceSizeFactor, nativeProtectionEnabled, closeOnProtectionFailure,
stopLimitOffsetPct, trailingStopEnabled, trailingStopPct, trailingActivationPct, partialTpEnabled,
partialTpTriggerPct, partialTpSellPct, moveStopToBreakevenAfterPartial, maxPositionHoldMinutes,
deterministicGateEnabled, gatePriceChangePct, reactiveLoopEnabled, maxActionsPerHour,
minActionIntervalSec`.

Sin arreglarlo, US-1-002 a US-1-004 **son una mentira en el alta**: el trader enciende, la pantalla
confirma y el bot nace apagado. `updateConfig` (`:288-291`, `data: { ...dto }`) sí los persiste, así
que la edición funciona hoy.

**Registro pedido al orquestador — FIX-A (`[BUGFIX]`, apps/api):** agregar los 22 campos al `data`
del `create`, con la forma `campo: dto.campo ?? undefined` (dejar que la columna aplique su default
cuando el DTO no lo trae) y `maxPositionHoldMinutes: dto.maxPositionHoldMinutes ?? null`. No cambia
ningún default, ningún rango ni el chequeo de duplicados. Test del fix: `POST` con los 22 campos en
un valor distinto del default ⇒ la fila persistida los tiene.

**Fallback documentado si FIX-A no se autoriza en este ciclo** (segunda opción, no recomendada): el
alta hace `POST` y, **sólo si** el diff avanzado no está vacío, un `PUT` inmediato con ese diff
(§6.4 ya produce exactamente ese objeto). Costo: dos requests, un modo de falla nuevo (creado con
defaults + error de PUT) y un E2E extra. CA-002 no se ve afectada por ninguna de las dos ramas: en
el camino por default el diff es vacío y no hay segundo request.

### H2 — `UpdateTradingConfigDto.isActive` no tiene columna: un PUT que lo incluya rompe

`UpdateTradingConfigDto` declara `isActive?: boolean` (`trading-config.dto.ts:613-615`) y
`model TradingConfig` **no tiene** esa columna (`schema.prisma:250-300`). `updateConfig` hace
`data: { ...dto } as any`: el cast apaga el chequeo del cliente Prisma y un `isActive` en el cuerpo
termina en un `PrismaClientValidationError` en runtime (500), no en un 400.

La `interface TradingConfig` local de `apps/web` (`use-trading.ts:26`) declara `isActive: boolean`
como si el GET lo devolviera. **No lo devuelve**: `getConfigs` (`:178-183`) hace un `findMany` crudo.
Es exactamente el tipo local mintiendo que la constitución de `apps/web` §3 prohíbe.

**Contrato de este ciclo:** `TradingConfigWire` **no tiene** `isActive` (el GET no lo trae) y
`UpdateTradingConfigInput` **sí** lo declara (espeja el DTO, es la única forma de que el chequeo de
deriva sea exacto), pero `UpdateTradingConfigPayload` —el tipo con el que `apps/web` arma el
cuerpo— lo excluye por construcción (§3.4). Ningún camino de la UI puede enviarlo.
**Registro pedido — FIX-B (`[IMPROVEMENT]`, apps/api, no bloqueante):** borrar `isActive` del
`UpdateTradingConfigDto` o darle columna. Mientras no se resuelva, queda anotado en `api.json`.

### H3 — Son **25** campos avanzados, no 26

`CreateTradingConfigDto` tiene 40 campos = **15 base** (`name, asset, pair, mode, buyThreshold,
sellThreshold, stopLossPct, takeProfitPct, minProfitPct, maxTradePct, maxConcurrentPositions,
minIntervalMinutes, intervalMode, orderPriceOffsetPct, riskProfile`) + **25 avanzados** (11 Protección
+ 8 Señal y tamaño + 3 Loop reactivo + 3 Entrada). El "26" de la spec y del brief es un error de
conteo; el "11 de 40" del hallazgo A de la spec en realidad enumera 15 campos. Donde la spec dice 26,
leer 25: las cuatro secciones de este documento cubren el 100% de los campos no-base del DTO, que es
lo que la spec pide. `UpdateTradingConfigDto` tiene 39 = los 25 avanzados + 13 base (sin `asset`/`pair`)
+ `isActive` (H2).

### H4 — El tipo TS de los dos campos limpiables es más angosto que el contrato de wire

`maxPositionHoldMinutes?: number` y `entryTrailingDeltaBips?: number` en el DTO, pero `api.json`
documenta ambos como `… | null` y las columnas son `Int?`. En runtime `null` **funciona**:
`@IsOptional()` saltea la validación con `null` y con `undefined`, y el campo está en el whitelist.
Es la única forma de volver a "sin límite" / "nivel fijo" desde la edición. Resuelto sin tocar
`apps/api` con `UpdateTradingConfigPayload` (§3.4). Anotado en `api.json` como discrepancia.

---

## 2. Decisiones técnicas

### D1 — Las cuatro secciones viven en un paso `advanced` nuevo, entre `timing` y `review`

**Decisión.** `STEPS` (`apps/web/src/components/config/constants.tsx:170-177`) pasa de 6 a 7 entradas:
`preset → identity → thresholds → risk → timing → advanced → review`. El paso `advanced` renderiza
`<AdvancedConfigSections mode="create">`: cuatro `Collapsible` de `libs/ui`, **todos cerrados**, cada
uno con su interruptor raíz apagado. El paso `review` gana **una sola** fila nueva: "Configuración
avanzada — sin cambios" o "N ajustes" según `countAdvancedChanges(draft)`.

**Justificación** (se adopta la recomendación del brief, con la salvedad de §12.3):

1. **CA-002 queda garantizada por el mecanismo, no por la ubicación.** El payload sale de un diff
   contra el draft por default (D5/§6.4): entrar al paso, abrir una sección, encender y volver a
   apagar un interruptor emite **cero** claves. Un "touched flag" no da esa propiedad.
2. **Un solo dueño por sección.** Repartir Protección en `risk` y Loop reactivo en `timing` deja a
   Entrada sin paso natural (habría que crear uno igual) y obliga a que tres pasos distintos
   conozcan el draft avanzado; el modal de edición tendría que recomponer a mano ese reparto.
   Con un componente por sección, el stepper, la edición y el detalle consumen las mismas piezas.
3. **No reordena nada** (restricción de la spec §4): los seis pasos existentes conservan su orden,
   su contenido y sus claves de i18n. Se agrega uno.
4. El paso es **opcional de hecho**: "Siguiente" lo atraviesa sin tocar nada, igual que hoy.

**Costo aceptado y explícito:** llegar a `review` pasa de 4 a 5 clicks en "Next". Eso rompe dos
helpers de E2E que hoy están en verde y **este ciclo los arregla** (§12.3). No hay forma de agregar
un paso sin ese cambio; esconderlo sería peor.

**Descartado:** un paso `advanced` **después** de `review` (rompe el significado de "revisar y
crear"); un botón "Configuración avanzada" que abre un modal anidado sobre el `TabModal` (dos capas
de modal, foco imposible de manejar con teclado).

### D2 — `libs/shared` define el wire y `apps/api` lo ata con `implements` + un chequeo de exactitud de claves

**Decisión.** Tres piezas, ninguna de ellas runtime en `apps/api`:

```ts
// libs/shared/src/types/trading-config-wire.ts
export type ExactKeys<A, B> = Exclude<keyof A, keyof B> | Exclude<keyof B, keyof A>;
export type AssertNoKeyDrift<T extends never> = T;
```

```ts
// apps/api/src/trading/dto/trading-config.dto.ts  (único cambio permitido en apps/api)
import type {
  CreateTradingConfigInput,
  UpdateTradingConfigInput,
  ExactKeys,
  AssertNoKeyDrift,
} from '@crypto-trader/shared';

export class CreateTradingConfigDto implements CreateTradingConfigInput { /* sin cambios */ }
export class UpdateTradingConfigDto implements UpdateTradingConfigInput { /* sin cambios */ }

export type _CreateTradingConfigWireIsExact = AssertNoKeyDrift<
  ExactKeys<CreateTradingConfigDto, CreateTradingConfigInput>
>;
export type _UpdateTradingConfigWireIsExact = AssertNoKeyDrift<
  ExactKeys<UpdateTradingConfigDto, UpdateTradingConfigInput>
>;
```

Los dos aliases se **exportan** a propósito (un alias local sin uso puede caer bajo
`noUnusedLocals`). Son tipos: el `.js` emitido no cambia en un byte, y el import es `import type`,
así que `apps/api` no adquiere dependencia de runtime con `libs/shared` por esto.

**Por qué `implements` solo no alcanza, y qué agrega cada mitad** (probado con el `tsc` del repo,
con los flags de `apps/api/tsconfig.app.json`, que **no** tiene `strict`):

| Deriva introducida | Qué falla | Error exacto |
| --- | --- | --- |
| Campo nuevo **sólo en el DTO** (`apps/api` agrega `foo?: number`) | el alias de exactitud en `apps/api` | `TS2344: Type '"foo"' does not satisfy the constraint 'never'` |
| Campo nuevo **sólo en `libs/shared`** | el mismo alias en `apps/api` **y** el catálogo de `apps/web` (§6.2) | `TS2344` en `apps/api` + `TS2741: Property 'foo' is missing in type …` en `advanced-fields.ts` y en `DEFAULT_ADVANCED_DRAFT` |
| Mismo campo con **tipo distinto** (`?: string` vs `?: number`) | el `implements` | `TS2416: Property 'foo' in type 'CreateTradingConfigDto' is not assignable to the same property in base type` |
| Campo del wire que **nadie declara en la lista** `TRADING_CONFIG_ADVANCED_FIELDS` | `libs/shared` | `TS2344` en `_AdvancedFieldListIsExhaustive` |

`implements` por sí solo **no detecta nada** de la primera fila: con todos los campos opcionales,
una clase puede implementar una interfaz y tener miembros de más. El chequeo de claves es la mitad
que ata; `implements` es la mitad que ata los **tipos** de las claves compartidas. Se necesitan las dos.

**Compatibilidad de enums verificada, no supuesta.** El DTO declara `asset!: AssetEnum`,
`entryOrderMode?: EntryOrderModeEnum`, etc., con enums **propios de `apps/api`**. El wire usa uniones
de literales. Un miembro de un `string enum` **es** asignable a su literal correspondiente, así que
`implements` pasa; dos `enum` distintos (p. ej. el `Asset` de `libs/shared` contra el `AssetEnum` de
`apps/api`) **no** son mutuamente asignables. Por eso el wire usa uniones de literales y **nunca**
los enums de `libs/shared`. Probado con `tsc --target es2021 --module esnext --moduleResolution bundler`
(sin `strict`) y con `--strict`: mismo resultado.

**El punto de falla en `apps/web` (lo que CA-001 pide literalmente)** no es el `implements` sino las
dos exhaustividades del §6.2: `ADVANCED_FIELDS: Record<TradingConfigAdvancedField, AdvancedFieldSpec>`
y `DEFAULT_ADVANCED_DRAFT: AdvancedDraft`. Un campo nuevo en el DTO ⇒ el chequeo de `apps/api` obliga
a declararlo en `libs/shared` ⇒ el `Record` de `apps/web` queda incompleto ⇒ `pnpm typecheck` falla en
`apps/web`. La cadena es lo que devuelve la protección, no un solo archivo.

**Descartado:** derivar los tipos desde el DTO (`type CreateTradingConfigInput = CreateTradingConfigDto`)
— pondría a `libs/shared` dependiendo de `apps/api`, invirtiendo el grafo. Descartado también el test
de igualdad de claves en runtime **como único mecanismo**: `Object.keys()` sobre una clase con todos
los campos opcionales y sin inicializar devuelve `[]`; habría que leer `Reflect.getMetadata` de
class-validator, que es frágil y no protege a `apps/web`. Sí queda un test de listas (§12.1), pero
como complemento.

### D3 — El PUT lleva **sólo lo cambiado**, y el diff se calcula en espacio de draft contra un baseline congelado

**Estado actual verificado.** `edit-agent-modal.tsx:69-81` arma **siempre** los 11 campos visibles;
`updateConfig` hace `data: { ...dto }`, así que Prisma toca exactamente las claves presentes: el
backend soporta el PUT parcial **hoy**, es el front el que no lo aprovecha.

**Decisión — modelo de cambio.**

1. Al abrir la edición se calcula **una vez** `baseline = toDraft(cfg)` y se guarda como snapshot
   inmutable (`useRef`/`useState` inicializado por función, nunca recalculado en cada render).
2. `current` es el draft editable, del mismo tipo que `baseline`.
3. Al guardar: `payload = diffToUpdatePayload(baseline, current)` — recorre **las claves del draft**,
   compara `baseline[k] !== current[k]` (comparación de `string | boolean | EntryOrderMode`, sin
   epsilon de floats: los valores viven en el draft como strings en unidad de UI) y para cada clave
   distinta escribe la conversión a wire.
4. `payload` vacío ⇒ **no se dispara el PUT**: el modal cierra sin request (el reviewer lo verifica).
5. Aplica a **todos** los campos, los 25 nuevos y los 13 base editables. No hay dos mecanismos: el
   mismo `diff` sirve al alta con `baseline = DEFAULT_DRAFT` (D5). Un mecanismo, dos baselines.

**Por qué en espacio de draft y no contra la config persistida.** El formulario redondea al
mostrar (`(c.stopLossPct * 100).toFixed(1)`). Una config con `stopLossPct: 0.0325` se muestra `3.3`
y volvería a wire como `0.033`: comparar contra el valor **persistido** marcaría sucio un campo que
el trader no tocó, y empezaría a enviar cambios fantasma. Comparar contra el **draft inicial**
—producido por la misma transformación— da `false` exacto para todo lo no tocado, sin epsilon y sin
excepciones por campo. Es la propiedad que hace el test de CA-003 trivial y determinista.

**Efecto colateral deseado sobre el nombre:** hoy `name: form.name || undefined` hace imposible
borrar el nombre de un agente. Con el diff, borrarlo produce `{ "name": "" }` (el DTO acepta
`string` de hasta 50, la columna tiene `@default("")`).

### D4 — Campos opcionales sin interruptor hermano: interruptor **sintético**, sólo en el estado del formulario

`maxPositionHoldMinutes` y `entryTrailingDeltaBips` no tienen booleano hermano en el DTO. La UI
sintetiza uno **que nunca viaja en el payload**:

| Campo | Interruptor sintético | Apagado significa | Encendido | Qué viaja |
| --- | --- | --- | --- | --- |
| `maxPositionHoldMinutes` | `maxPositionHoldEnabled` (default `false`) | texto `t('config.advanced.protection.maxPositionHoldMinutes.noLimit')` = "Sin límite", control numérico `disabled` | control numérico habilitado, valor inicial `1440` | encendido ⇒ el entero; apagado **y el baseline traía un valor** ⇒ `null`; apagado y el baseline también ⇒ nada |
| `entryTrailingDeltaBips` | `entryTrailingDeltaEnabled` (default `false`) | texto `…entry.entryTrailingDeltaBips.fixedLevel` = "Nivel fijo", control `disabled` | habilitado sólo si además `entryOrderMode === 'OCO'`, valor inicial `100` | idéntico al anterior (`null` para volver a nivel fijo) |

Reglas duras:

- Los dos sintéticos son claves de `AdvancedDraft` (`SyntheticSwitchKey`) y **no** de
  `TradingConfigAdvancedField`: por construcción el diff no puede emitirlas. `diffToUpdatePayload`
  itera `TRADING_CONFIG_ADVANCED_FIELDS` y las claves base, nunca `Object.keys(draft)`.
- `toDraft(cfg)` los deriva del wire: `maxPositionHoldEnabled = cfg.maxPositionHoldMinutes !== null`,
  `entryTrailingDeltaEnabled = cfg.entryTrailingDeltaBips !== null`. Así la edición muestra el
  estado real sin adivinar (US-1-007).
- `null` sólo aparece en el `PUT` (`UpdateTradingConfigPayload`, §3.4). En el `POST` del alta el
  baseline es "apagado", así que el caso "limpiar" no existe y `CreateTradingConfigInput` se queda
  con `number` opcional, espejando el DTO.
- **Descartado** un valor especial en el control (`0` = sin límite): `0` está fuera del rango `5..43200`
  del DTO, obligaría a un caso especial en la validación y a un control que muestra un número que el
  backend rechazaría si se enviara. El interruptor separa "no aplica" de "un valor" sin ambigüedad.

### D5 — Lectura de CA-002: **cero claves nuevas** en el POST del camino por default

**Decisión.** El `POST` del alta sin tocar la sección avanzada tiene **exactamente** el mismo
conjunto de claves que hoy: las 15 base (14 en el wire cuando el nombre está vacío, porque
`JSON.stringify` descarta `undefined`). Ninguna clave avanzada viaja, ni con su default.

**Justificación.**

1. Es la única lectura que hace el test **un igualdad exacta de objeto** contra un fixture congelado
   del payload previo al ciclo, sin lista de excepciones que mantener (el funcional pedía un único
   payload esperado).
2. Con H1 sin resolver, mandar defaults sería mandar 22 claves que el backend descarta: ruido puro.
   Con H1 resuelto, mandar `false`/defaults es indistinguible de no mandarlos —la columna tiene el
   mismo default— así que la opción con menos superficie gana.
3. `entryOrderMode: 'MARKET'` **tampoco** viaja. El funcional lo permitía en cualquiera de las dos
   formas; `MARKET` es el default de la columna y del `DEFAULTS` del servicio, así que omitirlo
   preserva el comportamiento y mantiene la regla "cero claves nuevas" sin excepciones.
4. Sale gratis del mecanismo de D3: `baseline = DEFAULT_DRAFT` ⇒ diff vacío ⇒ ninguna clave.

**Corolario que el reviewer verifica:** ningún booleano nace en `true` en el payload, porque
**ningún** booleano nace en el payload.

### D6 — `moveStopToBreakevenAfterPartial` es el único booleano que se **muestra** encendido, y aun así no viaja

Es el único avanzado cuyo default es `true` (DTO `example: true`, columna `@default(true)`). No es un
interruptor de familia: es un modificador del TP parcial. Decisión:

- Se **renderiza `checked`** y `disabled` mientras `partialTpEnabled` está apagado. Mostrarlo en
  `false` sería mentir: es lo que el backend va a hacer si el trader enciende el TP parcial, y el
  detalle del agente lo mostraría en `true` acto seguido, contradiciendo al alta.
- **No viaja** en el POST del alta (default = baseline ⇒ no está en el diff), así que RN-01
  ("ningún interruptor nace encendido") se cumple en el payload, que es donde importa: el alta no
  enciende ninguna familia de comportamiento.
- Si el trader lo apaga explícitamente con el TP parcial encendido, el diff emite
  `moveStopToBreakevenAfterPartial: false`.

### D7 — Validación de rango: clamp en el control + guarda de submit; el payload nunca sale de rango

El funcional dejaba la elección abierta. Decisión: **las dos**, con roles distintos.

- Los controles numéricos son `input[type="range"]` con `min`/`max`/`step` derivados del catálogo:
  el navegador ya impide salirse, y `clampToRange(spec, value)` se aplica igual en `onChange` para
  cubrir un `fill()` de Playwright o un cambio programático.
- `isDraftWithinRanges(draft)` corre antes de armar el payload. Si devuelve `false` el botón de
  crear/guardar queda `disabled` y la sección muestra `t('config.advanced.common.rangeError')` en el
  campo ofensor. No es el camino esperado: es la red por si un `step` mal puesto deja pasar un valor.
- El conversor de unidad redondea: `toWire = roundTo(uiValue / 100, 6)` para los campos porcentuales
  y `Math.round` para los enteros. Verificado que las conversiones del catálogo son exactas en
  doble precisión (`0.3/100 === 0.003`, `5/100 === 0.05`, `0.05/100 === 0.0005`).
- Los enteros (`maxActionsPerHour`, `minActionIntervalSec`, `entryOrderTtlMinutes`,
  `entryTrailingDeltaBips`, `maxPositionHoldMinutes`) usan `step` entero **y** `Math.round` al
  convertir: un decimal no puede llegar al payload (US-1-004).

### D8 — `libs/ui`: extensión aditiva de dos componentes, ninguna primitiva nueva

Regla 3 de `frontend-component-rules` pide crear en `libs/ui` lo reutilizable y presentacional. Acá
lo reutilizable **ya existe** y le faltan dos props; extenderlo es más barato y más consistente que
duplicarlo en `apps/web`. Cambios permitidos, todos retrocompatibles (props opcionales):

| Componente | Prop nueva | Por qué |
| --- | --- | --- |
| `SliderField` (`composites/slider-field.tsx`) | `disabled?: boolean` | 20 controles numéricos dependen de un interruptor; sin esto no hay forma de cumplir el `disabled` que piden US-1-002 a US-1-005. Aplica `disabled` al `input` y atenúa el bloque. |
| `SliderField` | `id?: string`, `hint?: string`, `tooltip?: string`, `formatValue?: (v: number) => string` | `id` para asociar `label`/`aria-describedby`; `hint`/`tooltip` para la explicación de una línea que pide el funcional; `formatValue` para mostrar `2%` a partir de `2` sin duplicar el componente. |
| `ToggleSwitch` (`primitives/toggle-switch.tsx`) | `id?: string`, `ariaLabel?: string`, `describedById?: string` | Hoy el `label` textual envuelve un `<button role="switch">`: un `<label>` **no** nombra a un `button`, así que el control queda sin nombre accesible y `getByRole('switch', { name })` no lo encuentra. Con `aria-label={ariaLabel ?? label}` el nombre es explícito y los tests pueden buscar por rol+nombre (§9, §12.2). |

Prohibido en este ciclo: mover `StepperSlider`/`SliderField` de `apps/web/src/components/config/constants.tsx`
a `libs/ui` (refactor de superficie, sin dueño en este ciclo) y agregar cualquier archivo nuevo a
`libs/ui`.

### D9 — El detalle del agente muestra las cuatro secciones con un componente de solo lectura

`agent-detail-modal.tsx` conserva sus 10 filas y su edición de nombre, y suma
`<AgentAdvancedSummary cfg={cfg} />`: cuatro bloques (`SectionTitle` + `KeyValueRow` de `libs/ui`), 25
filas, orden idéntico al catálogo. Reglas:

- Un interruptor apagado se muestra como `t('config.advanced.common.disabled')` — la fila **no** se
  omite.
- Un parámetro cuyo interruptor está apagado muestra `t('config.advanced.common.notApplicable')`
  atenuado, **nunca** su número (evita el "valor engañoso" de US-1-011).
- `maxPositionHoldMinutes: null` ⇒ "Sin límite". `entryTrailingDeltaBips: null` ⇒ "Nivel fijo".
- `entryOrderMode` pasa por `resolveEntryOrderMode(value): EntryOrderMode | 'unknown'`; `'unknown'`
  renderiza `t('config.advanced.common.unknown')` en tono neutro y **no** afecta a las otras 24 filas
  (constitución `apps/web` §4).
- Cero handlers: ninguna interacción en estas filas dispara mutaciones.

### D10 — i18n: un solo namespace `config.advanced`, paridad garantizada por test

Todas las claves nuevas de las cuatro secciones cuelgan de `config.advanced.*` con la convención
`seccion.componente.elemento` (§8), y las tres de notificación de `notificationMessages.*` (donde el
renderer las busca: `notification-utils.ts:78` hace `t('notificationMessages.' + parsed.key)` con el
JSON del backend como parámetros de interpolación). La paridad `es`/`en` la verifica un test que
**recorre el árbol** (§12.1), no una lista escrita a mano.

### D11 — El `mode` que manda la regla de SANDBOX es el **modo resuelto del bot**, y llega por prop

- Alta: `NewAgentStepperModal` ya recibe `defaultMode={platformMode}` de `config.tsx:285` y lo guarda
  en `form.mode` (solo lectura en el formulario). `AdvancedConfigSections` recibe
  `resolvedMode={form.mode}`.
- Edición y detalle: `resolvedMode={cfg.mode}` (el modo persistido del bot, que puede diferir del
  modo global de la plataforma; el bot `LIMIT_MAKER` en TESTNET del diagnóstico es justo ese caso).
- `AdvancedConfigSections` **no** llama a `usePlatformMode()`: el modo entra por props para que los
  tests de comportamiento no necesiten montar el árbol de queries del perfil.

### D12 — Un único hook de draft, compartido por alta y edición

`useAdvancedDraft(baseline)` (en `apps/web/src/components/config/advanced/use-advanced-draft.ts`)
devuelve `{ draft, setField, isFieldEnabled, changedFields, isWithinRanges }`. `useState` +
`setField` tipado por clave; no hace falta un reducer con acciones —hay una sola clase de
transición: "un campo cambió"— y un reducer agregaría ceremonia sin cerrar ningún caso.
`changedFields` es memoizado sobre `(baseline, draft)`.

---

## 3. Tipos compartidos — `libs/shared/src/types/trading-config-wire.ts` (archivo nuevo)

Se agrega `export * from './trading-config-wire';` a `libs/shared/src/types/index.ts`.
`libs/shared/src/dtos/trading.dto.ts` (que declara unas `CreateTradingConfigDto`/`UpdateTradingConfigDto`
de 10 y 8 campos, congeladas y **sin ningún importador** en todo el repo) **no se toca**: cambio
aditivo, y el nombre nuevo no colisiona. Queda anotado para una limpieza posterior.

### 3.1 Uniones de literales del wire

```ts
export type TradingAssetWire = 'BTC' | 'ETH';
export type TradingQuoteWire = 'USDT' | 'USDC';
export type TradingModeWire = 'LIVE' | 'SANDBOX' | 'TESTNET';
export type TradingIntervalModeWire = 'AGENT' | 'CUSTOM';
export type TradingRiskProfileWire = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
```

`entryOrderMode` reutiliza el `EntryOrderMode` que ya existe (`interfaces.ts:281`). **No** se usan
los `enum` de `libs/shared/src/types/enums.ts`: dos enums distintos no son mutuamente asignables y
el `implements` de `apps/api` fallaría (D2).

### 3.2 `TradingConfigWire` — lo que devuelve `GET /trading/config` (EP-005) y `POST`/`PUT`

45 campos: la fila de `trading_configs` serializada. Todos presentes y no opcionales; los dos
enteros limpiables son `number | null`.

```ts
export interface TradingConfigWire {
  id: string;
  userId: string;
  name: string;
  asset: TradingAssetWire;
  pair: TradingQuoteWire;
  mode: TradingModeWire;
  buyThreshold: number;
  sellThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  minProfitPct: number;
  maxTradePct: number;
  maxConcurrentPositions: number;
  minIntervalMinutes: number;
  intervalMode: TradingIntervalModeWire;
  orderPriceOffsetPct: number;
  riskProfile: TradingRiskProfileWire;
  isRunning: boolean;
  lossCutEnabled: boolean;
  lossCutConfidenceThreshold: number;
  lossCutMinLossPct: number;
  lossCutMinEdgeRatio: number;
  smartSizingEnabled: boolean;
  reduceSizeFactor: number;
  deterministicGateEnabled: boolean;
  gatePriceChangePct: number;
  nativeProtectionEnabled: boolean;
  closeOnProtectionFailure: boolean;
  stopLimitOffsetPct: number;
  trailingStopEnabled: boolean;
  trailingStopPct: number;
  trailingActivationPct: number;
  partialTpEnabled: boolean;
  partialTpTriggerPct: number;
  partialTpSellPct: number;
  moveStopToBreakevenAfterPartial: boolean;
  maxPositionHoldMinutes: number | null;
  reactiveLoopEnabled: boolean;
  maxActionsPerHour: number;
  minActionIntervalSec: number;
  entryOrderMode: EntryOrderMode;
  entryOrderTtlMinutes: number;
  entryTrailingDeltaBips: number | null;
  createdAt: string;
  updatedAt: string;
}
```

`isActive` **no** existe acá (H2): el GET no lo devuelve.

### 3.3 `CreateTradingConfigInput` — espejo exacto de `CreateTradingConfigDto` (40 campos)

```ts
export interface CreateTradingConfigInput {
  name?: string;
  asset: TradingAssetWire;
  pair: TradingQuoteWire;
  mode: TradingModeWire;
  buyThreshold?: number;
  sellThreshold?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  minProfitPct?: number;
  maxTradePct?: number;
  maxConcurrentPositions?: number;
  minIntervalMinutes?: number;
  orderPriceOffsetPct?: number;
  intervalMode?: TradingIntervalModeWire;
  riskProfile?: TradingRiskProfileWire;
  lossCutEnabled?: boolean;
  lossCutConfidenceThreshold?: number;
  lossCutMinLossPct?: number;
  lossCutMinEdgeRatio?: number;
  smartSizingEnabled?: boolean;
  reduceSizeFactor?: number;
  nativeProtectionEnabled?: boolean;
  closeOnProtectionFailure?: boolean;
  stopLimitOffsetPct?: number;
  trailingStopEnabled?: boolean;
  trailingStopPct?: number;
  trailingActivationPct?: number;
  partialTpEnabled?: boolean;
  partialTpTriggerPct?: number;
  partialTpSellPct?: number;
  moveStopToBreakevenAfterPartial?: boolean;
  maxPositionHoldMinutes?: number;
  deterministicGateEnabled?: boolean;
  gatePriceChangePct?: number;
  reactiveLoopEnabled?: boolean;
  maxActionsPerHour?: number;
  minActionIntervalSec?: number;
  entryOrderMode?: EntryOrderMode;
  entryOrderTtlMinutes?: number;
  entryTrailingDeltaBips?: number;
}
```

El **orden de las propiedades espeja el del DTO** a propósito: la revisión de deriva se hace leyendo
los dos archivos en paralelo.

### 3.4 `UpdateTradingConfigInput` (39, espejo del DTO) y `UpdateTradingConfigPayload` (lo que emite la UI)

```ts
export interface UpdateTradingConfigInput {
  name?: string;
  mode?: TradingModeWire;
  buyThreshold?: number;
  sellThreshold?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  minProfitPct?: number;
  maxTradePct?: number;
  maxConcurrentPositions?: number;
  minIntervalMinutes?: number;
  orderPriceOffsetPct?: number;
  intervalMode?: TradingIntervalModeWire;
  isActive?: boolean;
  riskProfile?: TradingRiskProfileWire;
  // …los 25 avanzados, idénticos a CreateTradingConfigInput
}

export type UpdateTradingConfigPayload = Omit<
  UpdateTradingConfigInput,
  'isActive' | 'mode' | 'maxPositionHoldMinutes' | 'entryTrailingDeltaBips'
> & {
  maxPositionHoldMinutes?: number | null;
  entryTrailingDeltaBips?: number | null;
};
```

- `isActive` fuera: no tiene columna, enviarlo rompe (H2).
- `mode` fuera: el modo del bot no se edita desde el formulario (RN-05 del funcional).
- Los dos enteros pasan a `number | null`: es el contrato real del wire (`api.json` ya lo documenta
  así) y la única forma de volver a "sin límite"/"nivel fijo" (H4, D4). `UpdateTradingConfigInput`
  sigue siendo el espejo exacto del DTO, así que el chequeo de deriva de D2 no se debilita.

### 3.5 Particiones de campos (base vs avanzado) y su exhaustividad

```ts
export const TRADING_CONFIG_BASE_FIELDS = [
  'name', 'asset', 'pair', 'mode',
  'buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct', 'minProfitPct',
  'maxTradePct', 'maxConcurrentPositions', 'minIntervalMinutes',
  'intervalMode', 'orderPriceOffsetPct', 'riskProfile',
] as const;

export const TRADING_CONFIG_ADVANCED_FIELDS = [
  'nativeProtectionEnabled', 'stopLimitOffsetPct', 'closeOnProtectionFailure',
  'trailingStopEnabled', 'trailingStopPct', 'trailingActivationPct',
  'partialTpEnabled', 'partialTpTriggerPct', 'partialTpSellPct',
  'moveStopToBreakevenAfterPartial', 'maxPositionHoldMinutes',
  'lossCutEnabled', 'lossCutConfidenceThreshold', 'lossCutMinLossPct', 'lossCutMinEdgeRatio',
  'smartSizingEnabled', 'reduceSizeFactor',
  'deterministicGateEnabled', 'gatePriceChangePct',
  'reactiveLoopEnabled', 'maxActionsPerHour', 'minActionIntervalSec',
  'entryOrderMode', 'entryOrderTtlMinutes', 'entryTrailingDeltaBips',
] as const;

export type TradingConfigBaseField = (typeof TRADING_CONFIG_BASE_FIELDS)[number];
export type TradingConfigAdvancedField = (typeof TRADING_CONFIG_ADVANCED_FIELDS)[number];

export type _AdvancedFieldsPartitionIsExact = AssertNoKeyDrift<
  | Exclude<keyof CreateTradingConfigInput, TradingConfigBaseField | TradingConfigAdvancedField>
  | Exclude<TradingConfigBaseField | TradingConfigAdvancedField, keyof CreateTradingConfigInput>
>;
```

El orden de `TRADING_CONFIG_ADVANCED_FIELDS` es el orden de render de las secciones (Protección,
Señal y tamaño, Loop reactivo, Entrada) y el del resumen del detalle: una sola fuente para el orden.
El alias de exhaustividad hace fallar el typecheck de `libs/shared` si un campo del input no está en
ninguna de las dos listas.

---

## 4. Catálogo de campos por sección

Rangos y defaults **leídos de los decoradores del DTO** (`trading-config.dto.ts`) y de
`schema.prisma`. `unidad UI` es lo que ve el trader; `wire` es lo que viaja. Clave i18n =
`config.advanced.<sección>.<campo>.label` / `.hint` (se cita sólo el sufijo del campo).

### 4.1 Protección — `config.advanced.protection` (11 campos)

| # | Campo (wire) | Control (`libs/ui`) | Rango wire (DTO) | Rango UI | step | Default | Depende de |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `nativeProtectionEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 2 | `stopLimitOffsetPct` | `SliderField` | `0 .. 0.05` | `0 .. 5 %` | 0.1 | `0.002` (0.2 %) | `nativeProtectionEnabled` |
| 3 | `closeOnProtectionFailure` | `ToggleSwitch` | boolean | — | — | `false` | `nativeProtectionEnabled` |
| 4 | `trailingStopEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 5 | `trailingStopPct` | `SliderField` | `0.001 .. 1` | `0.1 .. 100 %` | 0.1 | `0.02` (2 %) | `trailingStopEnabled` |
| 6 | `trailingActivationPct` | `SliderField` | `0.001 .. 1` | `0.1 .. 100 %` | 0.1 | `0.01` (1 %) | `trailingStopEnabled` |
| 7 | `partialTpEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 8 | `partialTpTriggerPct` | `SliderField` | `0.001 .. 1` | `0.1 .. 100 %` | 0.1 | `0.02` (2 %) | `partialTpEnabled` |
| 9 | `partialTpSellPct` | `SliderField` | `0.05 .. 1` | `5 .. 100 %` | 1 | `0.5` (50 %) | `partialTpEnabled` |
| 10 | `moveStopToBreakevenAfterPartial` | `ToggleSwitch` | boolean | — | — | `true` (D6) | `partialTpEnabled` |
| 11 | `maxPositionHoldMinutes` | `ToggleSwitch` sintético + `SliderField` | `5 .. 43200` int \| `null` | `5 .. 43200 min` | 5 | `null` = sin límite; al encender, `1440` | `maxPositionHoldEnabled` (D4) |

### 4.2 Señal y tamaño — `config.advanced.signal` (8 campos)

| # | Campo (wire) | Control | Rango wire | Rango UI | step | Default | Depende de |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `lossCutEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 2 | `lossCutConfidenceThreshold` | `SliderField` | `0 .. 1` | `0 .. 100 %` | 1 | `0.85` (85 %) | `lossCutEnabled` |
| 3 | `lossCutMinLossPct` | `SliderField` | `0 .. 0.5` | `0 .. 50 %` | 0.1 | `0.005` (0.5 %) | `lossCutEnabled` |
| 4 | `lossCutMinEdgeRatio` | `SliderField` | `0 .. 100` | `0 .. 100 ×` | 0.1 | `2` (2 ×) | `lossCutEnabled` |
| 5 | `smartSizingEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 6 | `reduceSizeFactor` | `SliderField` | `0.05 .. 1` | `5 .. 100 %` | 1 | `0.5` (50 %) | `smartSizingEnabled` |
| 7 | `deterministicGateEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 8 | `gatePriceChangePct` | `SliderField` | `0.0005 .. 0.05` | `0.05 .. 5 %` | 0.05 | `0.005` (0.5 %) | `deterministicGateEnabled` |

`lossCutMinEdgeRatio` es un **múltiplo**, no un porcentaje: `scale: 'raw'`, sufijo `×`. Es el único
numérico no porcentual y no entero de las cuatro secciones.

### 4.3 Loop reactivo — `config.advanced.reactive` (3 campos)

| # | Campo (wire) | Control | Rango wire | Rango UI | step | Default | Depende de |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `reactiveLoopEnabled` | `ToggleSwitch` | boolean | — | — | `false` | — (raíz) |
| 2 | `maxActionsPerHour` | `SliderField` | `1 .. 60` int | `1 .. 60` | 1 | `6` | `reactiveLoopEnabled` |
| 3 | `minActionIntervalSec` | `SliderField` | `5 .. 3600` int | `5 .. 3600 s` | 5 | `60` | `reactiveLoopEnabled` |

### 4.4 Entrada — `config.advanced.entry` (3 campos)

| # | Campo (wire) | Control | Rango wire | Rango UI | step | Default | Depende de |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `entryOrderMode` | `Select` | `MARKET \| LIMIT_MAKER \| OCO` | 3 opciones con `description` | — | `MARKET` | `resolvedMode !== 'SANDBOX'` (RN-06) |
| 2 | `entryOrderTtlMinutes` | `SliderField` | `5 .. 1440` int | `5 .. 1440 min` | 5 | `120` | `entryOrderMode !== 'MARKET'` (RN-08) |
| 3 | `entryTrailingDeltaBips` | `ToggleSwitch` sintético + `SliderField` | `10 .. 2000` int \| `null` | `10 .. 2000 bips` | 10 | `null` = nivel fijo; al encender, `100` | `entryOrderMode === 'OCO'` **y** `entryTrailingDeltaEnabled` (RN-07, D4) |

---

## 5. Estructura de componentes

Todos con lógica de negocio (catálogo, dependencias, i18n) ⇒ regla 4: viven en
`apps/web/src/components/config/advanced/`. Los presenters (`ToggleSwitch`, `SliderField`, `Select`,
`Collapsible`, `FormField`, `InfoTooltip`, `KeyValueRow`, `SectionTitle`, `Callout`, `Badge`) salen
de `@crypto-trader/ui`. Ninguna página define subcomponentes inline (regla 5).

```
apps/web/src/components/config/advanced/
├── advanced-fields.ts              ADVANCED_FIELDS: Record<TradingConfigAdvancedField, AdvancedFieldSpec>
├── advanced-draft.ts               AdvancedDraft, DEFAULT_ADVANCED_DRAFT, toDraft, toWire, diff, clamp
├── use-advanced-draft.ts           useAdvancedDraft(baseline)  (D12)
├── advanced-field-control.tsx      AdvancedFieldControl  — un spec → el control correcto, con disabled + razón
├── advanced-section.tsx            AdvancedSection       — Collapsible + título + lista de controles
├── advanced-config-sections.tsx    AdvancedConfigSections — las cuatro secciones (alta y edición)
├── agent-advanced-summary.tsx      AgentAdvancedSummary  — solo lectura para el detalle (D9)
└── index.ts
```

| Componente | Props | Responsabilidad |
| --- | --- | --- |
| `AdvancedConfigSections` | `{ draft, onChange(key, value), resolvedMode, surface: 'create' \| 'edit' }` | Renderiza las cuatro `AdvancedSection` en el orden del catálogo. En `create` todas cerradas; en `edit`, una sección arranca abierta si algún campo suyo difiere del default del DTO. |
| `AdvancedSection` | `{ sectionId, fields, draft, onChange, resolvedMode }` | `Collapsible` con el título/hint de la sección y un `AdvancedFieldControl` por campo. Sin estado propio más que el abierto/cerrado. |
| `AdvancedFieldControl` | `{ spec, draft, onChange, resolvedMode }` | Elige control según `spec.kind`, calcula `disabled = !isFieldEnabled(...)`, aplica el clamp y renderiza la razón del `disabled` cuando la regla es de coherencia (SANDBOX / OCO), no de dependencia simple. |
| `AgentAdvancedSummary` | `{ cfg: TradingConfigWire }` | 25 `KeyValueRow` agrupadas en cuatro bloques, solo lectura (D9). |

Cambios en componentes existentes:

| Archivo | Cambio |
| --- | --- |
| `constants.tsx` | `STEPS` suma `{ id: 'advanced', icon: SlidersHorizontal }` antes de `review`; `StepId` suma `'advanced'`; `ConfigForm` **no** cambia (el draft avanzado es un estado aparte, no se mezcla con los strings del form base). |
| `new-agent-stepper-modal.tsx` | `useAdvancedDraft(DEFAULT_ADVANCED_DRAFT)`; bloque del paso `advanced`; fila de resumen en `review`; `handleSubmit` pasa a `{ ...baseCreateInput(form), ...diffToCreateInput(DEFAULT_ADVANCED_DRAFT, draft) }`. |
| `edit-agent-modal.tsx` | `baseline` congelado (`toDraft(cfg)` + draft base de los 13 campos), `AdvancedConfigSections surface="edit"`, `handleSave` pasa a `diffToUpdatePayload(baseline, current)` y no dispara PUT con payload vacío. |
| `agent-detail-modal.tsx` | suma `<AgentAdvancedSummary cfg={cfg} />` bajo las filas actuales. |
| `use-trading.ts` | borra `interface TradingConfig` y `interface TradingConfigDto`; re-exporta los tipos del wire; `useCreateConfig` recibe `CreateTradingConfigInput` y `useUpdateConfig` recibe `UpdateTradingConfigPayload`. `queryKey ['trading','config']` sin cambios. |

---

## 6. Modelo de estado del formulario

### 6.1 `AdvancedFieldSpec`

```ts
export type AdvancedSectionId = 'protection' | 'signal' | 'reactive' | 'entry';

export type AdvancedDependency =
  | { kind: 'switch'; field: BooleanAdvancedField }
  | { kind: 'syntheticSwitch'; field: SyntheticSwitchKey }
  | { kind: 'entryMode'; anyOf: readonly EntryOrderMode[] }
  | { kind: 'notSandbox' };

export type AdvancedFieldSpec =
  | { kind: 'switch'; section: AdvancedSectionId; dependsOn: AdvancedDependency[] }
  | {
      kind: 'number';
      section: AdvancedSectionId;
      scale: 'percent' | 'raw';
      integer: boolean;
      uiMin: number;
      uiMax: number;
      uiStep: number;
      unit: 'percent' | 'times' | 'minutes' | 'seconds' | 'bips' | 'count';
      wireMin: number;
      wireMax: number;
      nullable: boolean;
      syntheticSwitch?: SyntheticSwitchKey;
      dependsOn: AdvancedDependency[];
    }
  | {
      kind: 'enum';
      section: AdvancedSectionId;
      options: readonly EntryOrderMode[];
      dependsOn: AdvancedDependency[];
    };
```

`dependsOn` es una **lista**: `entryTrailingDeltaBips` tiene dos condiciones
(`{ entryMode: ['OCO'] }` y `{ syntheticSwitch: 'entryTrailingDeltaEnabled' }`) y `entryOrderMode`
tiene `{ notSandbox }`. `wireMin`/`wireMax` se declaran además de los de UI para que
`isDraftWithinRanges` valide en la unidad que viaja, no en la que se muestra.

### 6.2 Los dos puntos de exhaustividad de `apps/web` (esto es lo que hace fallar el build, CA-001)

```ts
export const ADVANCED_FIELDS: Record<TradingConfigAdvancedField, AdvancedFieldSpec> = { /* 25 */ };
export const DEFAULT_ADVANCED_DRAFT: AdvancedDraft = { /* 25 + 2 sintéticos */ };
```

Un campo nuevo en `libs/shared` (obligado por el chequeo de D2 cuando el DTO cambia) deja los dos
incompletos: `TS2741: Property 'x' is missing in type …`.

### 6.3 `AdvancedDraft` — derivado, no escrito a mano

```ts
export type SyntheticSwitchKey = 'maxPositionHoldEnabled' | 'entryTrailingDeltaEnabled';

type BooleanAdvancedField = {
  [K in TradingConfigAdvancedField]: NonNullable<CreateTradingConfigInput[K]> extends boolean
    ? K
    : never;
}[TradingConfigAdvancedField];

type AdvancedDraftValue<K extends TradingConfigAdvancedField> =
  K extends BooleanAdvancedField ? boolean
  : K extends 'entryOrderMode' ? EntryOrderMode
  : string;

export type AdvancedDraft = { [K in TradingConfigAdvancedField]: AdvancedDraftValue<K> } & {
  [S in SyntheticSwitchKey]: boolean;
};
```

Los numéricos viven como **string en unidad de UI** (igual que el `ConfigForm` actual): es lo que
`input[type=range]` maneja y lo que hace que la comparación del diff sea exacta sin epsilon (D3).

### 6.4 Las cuatro funciones puras del draft (`advanced-draft.ts`)

| Función | Firma | Contrato |
| --- | --- | --- |
| `toAdvancedDraft` | `(cfg: TradingConfigWire) => AdvancedDraft` | Booleanos tal cual; numéricos a string en unidad de UI (`percent` ⇒ `String(roundTo(v * 100, 4))`); `maxPositionHoldEnabled = cfg.maxPositionHoldMinutes !== null` (idem trailing); si el valor es `null`, el string queda en el default del catálogo y el sintético en `false`. |
| `isFieldEnabled` | `(key, draft, resolvedMode) => boolean` | `spec.dependsOn.every(...)`: `switch` ⇒ `draft[dep.field] === true`; `syntheticSwitch` ⇒ idem; `entryMode` ⇒ `dep.anyOf.includes(draft.entryOrderMode)`; `notSandbox` ⇒ `resolvedMode !== 'SANDBOX'`. |
| `diffToCreateInput` | `(baseline: AdvancedDraft, current: AdvancedDraft) => Partial<CreateTradingConfigInput>` | Itera `TRADING_CONFIG_ADVANCED_FIELDS`; si `baseline[k] !== current[k]`, escribe `toWireValue(k, current[k])`. **Nunca** emite `null` ni claves sintéticas. |
| `diffToUpdatePayload` | `(baseline, current, baseDiff) => UpdateTradingConfigPayload` | Igual, más: si `spec.nullable` y el sintético pasó de `true` a `false`, emite `k: null`. Fusiona el diff de los 13 campos base. |

Invariantes que los tests fijan (§12.1):

- `diffToCreateInput(DEFAULT_ADVANCED_DRAFT, DEFAULT_ADVANCED_DRAFT)` ⇒ `{}` (D5, CA-002).
- Encender y apagar un interruptor ⇒ `{}` (idempotencia del diff).
- Ninguna salida contiene una clave de `SyntheticSwitchKey` ni `isActive` ni `mode`.
- Todo valor numérico emitido cumple `wireMin <= v <= wireMax` (D7).

### 6.5 Reglas de habilitación (tabla completa, es la fuente del test parametrizado)

| Campo | Habilitado si | Razón visible cuando está deshabilitado |
| --- | --- | --- |
| `stopLimitOffsetPct`, `closeOnProtectionFailure` | `nativeProtectionEnabled` | dependencia (hint de la sección) |
| `trailingStopPct`, `trailingActivationPct` | `trailingStopEnabled` | dependencia |
| `partialTpTriggerPct`, `partialTpSellPct`, `moveStopToBreakevenAfterPartial` | `partialTpEnabled` | dependencia |
| `maxPositionHoldMinutes` | `maxPositionHoldEnabled` | `…maxPositionHoldMinutes.noLimit` ("Sin límite") |
| `lossCutConfidenceThreshold`, `lossCutMinLossPct`, `lossCutMinEdgeRatio` | `lossCutEnabled` | dependencia |
| `reduceSizeFactor` | `smartSizingEnabled` | dependencia |
| `gatePriceChangePct` | `deterministicGateEnabled` | dependencia |
| `maxActionsPerHour`, `minActionIntervalSec` | `reactiveLoopEnabled` | dependencia |
| `entryOrderMode` | `resolvedMode !== 'SANDBOX'` | `config.advanced.entry.sandboxDisabled` en un `Callout` **visible** (no sólo tooltip) — CA-004 |
| `entryOrderTtlMinutes` | `entryOrderMode !== 'MARKET'` | `config.advanced.entry.ttlMarketOnly` vía `InfoTooltip` |
| `entryTrailingDeltaBips` | `entryOrderMode === 'OCO'` **y** `entryTrailingDeltaEnabled` | `config.advanced.entry.trailingOcoOnly` (modo ≠ OCO) o `…entryTrailingDeltaBips.fixedLevel` (sintético apagado) |

Los tres interruptores raíz de Señal y tamaño son independientes entre sí, y ninguna dependencia
cruza de sección: la tabla no tiene una sola fila que lo haga (US-1-003).

En SANDBOX el `Select` se renderiza `disabled` **y** fijo en `MARKET`; sus dos dependientes quedan
deshabilitados por la regla de `entryMode`, sin ningún caso especial.

---

## 7. Contrato de wire

**Sin endpoints nuevos ni cambios de contrato.** EP-006 `POST /trading/config` y EP-007
`PUT /trading/config/{id}` tal como están.

### 7.1 POST del camino por default (CA-002) — cuerpo exacto

Alta completada con el preset `balanced` (el preseleccionado), nombre "Mi bot", BTC/USDT, modo global
SANDBOX, **sin abrir el paso `advanced`**:

```json
{
  "name": "Mi bot",
  "asset": "BTC",
  "pair": "USDT",
  "mode": "SANDBOX",
  "buyThreshold": 72,
  "sellThreshold": 68,
  "stopLossPct": 0.03,
  "takeProfitPct": 0.05,
  "minProfitPct": 0.003,
  "maxTradePct": 0.1,
  "maxConcurrentPositions": 3,
  "intervalMode": "AGENT",
  "minIntervalMinutes": 60,
  "orderPriceOffsetPct": 0,
  "riskProfile": "MODERATE"
}
```

Byte a byte el de hoy: mismas 15 claves, mismo orden de construcción, mismos valores. Sin nombre, la
clave `name` desaparece del JSON (`name: form.name || undefined`, comportamiento heredado que **no**
cambia). **Cero** claves de las cuatro secciones. Respuesta `201` con la config creada.

### 7.2 POST con configuración avanzada tocada (US-1-002 a US-1-005)

Las claves base idénticas, más **sólo** lo que el trader cambió. Ejemplo: enciende protección nativa
con offset 0.5 %, enciende el loop reactivo y deja el resto intacto:

```json
{
  "…": "las 15 claves base de 7.1",
  "nativeProtectionEnabled": true,
  "stopLimitOffsetPct": 0.005,
  "reactiveLoopEnabled": true
}
```

`maxActionsPerHour`/`minActionIntervalSec` **no** viajan: quedaron en su default. Ver H1: hasta que
FIX-A esté mergeado, el backend responde 201 y persiste `false`/defaults para estos tres.

### 7.3 PUT de edición (CA-003) — sólo lo cambiado

Config guardada con `trailingStopEnabled: false`, `trailingStopPct: 0.02`,
`maxPositionHoldMinutes: 720`, `entryOrderMode: 'LIMIT_MAKER'`. El trader enciende el trailing, lo
deja en 3 %, saca el límite de tiempo y no toca nada más:

```
PUT /trading/config/cfg_123
```

```json
{
  "trailingStopEnabled": true,
  "trailingStopPct": 0.03,
  "maxPositionHoldMinutes": null
}
```

`entryOrderMode` no viaja (no se tocó), `name` no viaja, ni ninguno de los otros 11 campos base que
hoy se enviaban siempre. Respuesta `200` con la config actualizada. Sin cambios ⇒ **ningún** request.

### 7.4 Anotaciones en `sdd/api.json`

Sin cambios de contrato. Se agregan **notas de changelog** en EP-006 y EP-007 documentando H1, H2 y
H4, con `updated_in_cycle: 1` y el status `updated` que ya tenían. No se crean ni se modifican
endpoints; `sdd/schema.json` no se toca (ninguna tabla cambia).

---

## 8. Árbol de claves i18n (`config.advanced.*`, convención `seccion.componente.elemento`)

Se agrega a `apps/web/src/locales/es.ts` bajo `config` (que arranca en `es.ts:1341`) y el espejo en
`en.ts`. Toda clave existe en **los dos** locales, con valor no vacío (test en §12.1).

```
config.advanced
├── step.title            "Configuración avanzada"            / "Advanced settings"
├── step.hint             una línea: todo apagado por default, opcional
├── summary.title         "Configuración avanzada"
├── summary.none          "Sin cambios"                        / "No changes"
├── summary.count         "{{count}} ajustes"                  / "{{count}} settings"
├── common.enabled        "Activado"      | common.disabled "Desactivado"
├── common.notApplicable  "No aplica"     | common.unknown  "Desconocido"
├── common.rangeError     "Valor fuera del rango permitido ({{min}}–{{max}})"
├── protection.title / protection.hint
├── protection.nativeProtectionEnabled.label / .hint
├── protection.stopLimitOffsetPct.label / .hint
├── protection.closeOnProtectionFailure.label / .hint
├── protection.trailingStopEnabled.label / .hint
├── protection.trailingStopPct.label / .hint
├── protection.trailingActivationPct.label / .hint
├── protection.partialTpEnabled.label / .hint
├── protection.partialTpTriggerPct.label / .hint
├── protection.partialTpSellPct.label / .hint
├── protection.moveStopToBreakevenAfterPartial.label / .hint
├── protection.maxPositionHoldMinutes.label / .hint / .toggleLabel / .noLimit
├── signal.title / signal.hint
├── signal.lossCutEnabled.label / .hint
├── signal.lossCutConfidenceThreshold.label / .hint
├── signal.lossCutMinLossPct.label / .hint
├── signal.lossCutMinEdgeRatio.label / .hint
├── signal.smartSizingEnabled.label / .hint
├── signal.reduceSizeFactor.label / .hint
├── signal.deterministicGateEnabled.label / .hint
├── signal.gatePriceChangePct.label / .hint
├── reactive.title / reactive.hint
├── reactive.reactiveLoopEnabled.label / .hint
├── reactive.maxActionsPerHour.label / .hint
├── reactive.minActionIntervalSec.label / .hint
├── entry.title / entry.hint
├── entry.entryOrderMode.label / .hint
├── entry.entryOrderMode.options.MARKET / .LIMIT_MAKER / .OCO
├── entry.entryOrderMode.descriptions.MARKET / .LIMIT_MAKER / .OCO
├── entry.entryOrderTtlMinutes.label / .hint
├── entry.entryTrailingDeltaBips.label / .hint / .toggleLabel / .fixedLevel
├── entry.sandboxDisabled   "La entrada descansando no aplica en SANDBOX: el bot compra a mercado simulado."
├── entry.ttlMarketOnly     "El vencimiento aplica sólo a una entrada que descansa en el exchange."
└── entry.trailingOcoOnly   "El trailing de la pierna de ruptura existe sólo en modo OCO."
```

Unidades (sufijos reutilizables, un nivel arriba para no repetirlos 20 veces):

```
config.advanced.units.percent "%" · units.times "×" · units.minutes "min" · units.seconds "s" · units.bips "bips" · units.count ""
```

Y las tres de notificación que faltan en ambos locales (CA-007), con los parámetros exactos que
manda el backend (`entry-order.service.ts:220-231, 350-360, 430-440`):

```
notificationMessages.entryOrderPlaced   ES: "Entrada {{entryMode}} colocada: {{qty}} {{asset}} @ ${{price}} ({{mode}})"
                                        EN: "{{entryMode}} entry placed: {{qty}} {{asset}} @ ${{price}} ({{mode}})"
notificationMessages.entryOrderFilled   ES: "Entrada ejecutada: COMPRA {{qty}} {{asset}} @ ${{price}} ({{mode}})"
                                        EN: "Entry filled: BUY {{qty}} {{asset}} @ ${{price}} ({{mode}})"
notificationMessages.entryOrderMissing  ES: "Entrada {{entryOrderId}} de {{symbol}} no aparece en el exchange: revisá el estado del bot"
                                        EN: "Entry {{entryOrderId}} on {{symbol}} is missing on the exchange: check the bot state"
```

---

## 9. Requisitos de accesibilidad

1. **Nombre accesible obligatorio en todo control.** `ToggleSwitch` recibe `ariaLabel={t(label)}`
   (D8): un `<label>` no nombra a un `<button role="switch">`. Criterio verificable:
   `screen.getByRole('switch', { name: /…/ })` encuentra los 12 interruptores (10 reales + 2
   sintéticos) de las cuatro secciones.
2. **`role="switch"` + `aria-checked`** reflejando el estado (heredado de `libs/ui`, verificado en
   uso).
3. **Sliders**: `input[type="range"]` con `id`, `aria-label` (o `FormField htmlFor`) y
   `aria-describedby` apuntando al `hint`. Operables con flechas; `disabled` real (no sólo opacidad),
   así que salen del orden de tabulación.
4. **`Select` de `entryOrderMode`**: `aria-disabled` + `disabled` en SANDBOX, y el texto de
   `entry.sandboxDisabled` en un `Callout` **visible** asociado por `aria-describedby` — CA-004 pide
   que explique, no sólo que deshabilite. Ningún control queda deshabilitado sin razón visible o en
   `InfoTooltip` (US-1-012).
5. **Sin trampa de foco**: `Collapsible` es el de Radix (ya maneja `aria-expanded`/`aria-controls`);
   el contenido cerrado no recibe foco.
6. **Movimiento**: la única animación nueva es la de apertura del `Collapsible` que ya trae
   `libs/ui` (`animate-in/out`, < 300 ms). No se introduce ninguna transición nueva; nada ignora
   `prefers-reduced-motion` (constitución `apps/web` §4, RN-15).
7. **Contraste del estado deshabilitado**: el `disabled` no se comunica **sólo** por opacidad —
   siempre hay texto ("No aplica", "Sin límite", "Nivel fijo") o el `Callout` de la regla.

---

## 10. Registro SDD

- `sdd/schema.json`: **sin cambios** (ninguna tabla nueva ni modificada).
- `sdd/api.json`: **sin cambios de contrato**; notas de changelog en EP-006 y EP-007 (§7.4).
- `sdd/components.json`: entradas nuevas bajo `apps/web`, `status: "defined"`,
  `created_in_cycle: 1`, `consumes: ["EP-006","EP-007"]` donde corresponde:

| id | name | type | path |
| --- | --- | --- | --- |
| COMP-009 | `AdvancedConfigSections` | component | `src/components/config/advanced/advanced-config-sections.tsx` |
| COMP-010 | `AdvancedSection` | component | `src/components/config/advanced/advanced-section.tsx` |
| COMP-011 | `AdvancedFieldControl` | component | `src/components/config/advanced/advanced-field-control.tsx` |
| COMP-012 | `AgentAdvancedSummary` | component | `src/components/config/advanced/agent-advanced-summary.tsx` |
| COMP-013 | `useAdvancedDraft` | hook | `src/components/config/advanced/use-advanced-draft.ts` |
| COMP-014 | `NewAgentStepperModal` | component | `src/components/config/new-agent-stepper-modal.tsx` |
| COMP-015 | `EditAgentModal` | component | `src/components/config/edit-agent-modal.tsx` |
| COMP-016 | `AgentDetailModal` | component | `src/components/config/agent-detail-modal.tsx` |
| COMP-017 | `useTrading` | hook | `src/hooks/use-trading.ts` |

Los cinco primeros son nuevos; los cuatro últimos ya existían sin registrar y este ciclo los
modifica: entran con `status: "defined"` y su changelog explica el cambio (el registro sólo tenía
componentes de spec-001 y spec-004; no se puede fingir un `created_in_cycle` anterior a este ciclo
para un componente que el registro nunca tuvo).

`libs/ui` **no** tiene sección en `components.json` y este ciclo **no** la crea: sus dos cambios son
extensiones de props de componentes preexistentes, documentados en D8 y en el fragmento de contexto
de `libs/ui`.

---

## 11. Contrato de tests

Vitest corre en jsdom con `apps/web/vite.config.mts` (`environment: 'jsdom'`, setup
`src/test/setup.ts`). Patrón del repo verificado en `agent-cost-panel.spec.tsx`: los especs que
renderizan componentes con `useTranslation` hacen `import '../../lib/i18n';` y el idioma por default
en jsdom es **`en`** (`localStorage` vacío ⇒ `fallbackLng: 'en'`), así que las aserciones de texto van
en inglés. Ningún spec abre un browser.

### 11.1 Fixtures (compartidos, tipados por el wire)

`apps/web/src/test/fixtures/trading-config.ts`:

| Fixture | Tipo | Contenido |
| --- | --- | --- |
| `CONFIG_ALL_OFF` | `TradingConfigWire` | Los 25 avanzados en su default del DTO (todos los booleanos `false` salvo `moveStopToBreakevenAfterPartial: true`), `maxPositionHoldMinutes: null`, `entryTrailingDeltaBips: null`, `entryOrderMode: 'MARKET'`, `mode: 'SANDBOX'`. |
| `CONFIG_ALL_ON_EDGES` | `TradingConfigWire` | Todos los interruptores en `true` y **todos** los numéricos en un extremo del rango del DTO (`stopLimitOffsetPct: 0.05`, `trailingStopPct: 1`, `partialTpSellPct: 0.05`, `lossCutMinEdgeRatio: 100`, `gatePriceChangePct: 0.0005`, `maxActionsPerHour: 60`, `minActionIntervalSec: 5`, `maxPositionHoldMinutes: 43200`, `entryOrderMode: 'OCO'`, `entryOrderTtlMinutes: 1440`, `entryTrailingDeltaBips: 2000`), `mode: 'TESTNET'`. |
| `CONFIG_UNKNOWN_ENTRY_MODE` | `TradingConfigWire` | igual a `CONFIG_ALL_OFF` con `entryOrderMode: 'TWAP' as EntryOrderMode`. |
| `POST_BODY_BEFORE_CYCLE` | `Readonly<Record<string, unknown>>` | El objeto de §7.1, congelado (`Object.freeze`). Es el contrato de CA-002. |

Los tres primeros se declaran `satisfies TradingConfigWire` / con anotación de tipo — nunca objetos
literales sin tipo (US-1-015).

### 11.2 Especificaciones Vitest

| Archivo | Aserciones clave (CA) |
| --- | --- |
| `libs/shared/src/types/trading-config-wire.spec.ts` | Las dos listas de campos **particionan** las 40 claves: sin intersección, sin duplicados, `15 + 25 === 40` contra una lista congelada de las 40 claves del DTO. (CA-001) |
| `advanced-fields.spec.ts` | `Object.keys(ADVANCED_FIELDS)` set-igual a `TRADING_CONFIG_ADVANCED_FIELDS`; todo `spec.uiMin/uiMax` convierte exactamente a `wireMin/wireMax`; **todo interruptor tiene default `false`** en `DEFAULT_ADVANCED_DRAFT` salvo `moveStopToBreakevenAfterPartial` (D6, y el test lo nombra para que un cambio futuro sea deliberado); ninguna `dependsOn` referencia un campo de otra sección. (CA-002, US-1-003) |
| `advanced-draft.spec.ts` | `diffToCreateInput(DEFAULT, DEFAULT) === {}`; encender+apagar ⇒ `{}`; `diffToUpdatePayload` con un solo campo tocado ⇒ **exactamente** una clave; apagar el sintético con baseline no nulo ⇒ `{ campo: null }`; ningún diff contiene `maxPositionHoldEnabled`, `entryTrailingDeltaEnabled`, `isActive` ni `mode`; `toAdvancedDraft(CONFIG_ALL_ON_EDGES)` → `diffToUpdatePayload(baseline, baseline)` ⇒ `{}` (ida y vuelta sin cambios fantasma); todo valor emitido dentro de `[wireMin, wireMax]`. (CA-002, CA-003, D7) |
| `advanced-config-sections.spec.tsx` | **Test parametrizado sobre la tabla de §6.5** (`it.each` sobre los pares campo/dependencia, leídos de `ADVANCED_FIELDS`, no hardcodeados): con la dependencia apagada el control está `disabled`; encendida, habilitado. Encender un interruptor raíz no cambia el `disabled` de ningún control de otra sección. Con `resolvedMode="SANDBOX"`: el select de `entryOrderMode` está `disabled` **y** el texto de `entry.sandboxDisabled` está en el DOM (CA-004); con `TESTNET` ofrece las tres opciones. Con `entryOrderMode='LIMIT_MAKER'`: TTL habilitado y trailing deshabilitado; con `'OCO'` y el sintético encendido: ambos habilitados (RN-07/08). Los 12 interruptores se obtienen con `getByRole('switch', { name })` (§9). |
| `new-agent-stepper-modal.spec.tsx` | Recorre los 7 pasos sin tocar la sección avanzada y compara el cuerpo del POST (mock de `../../lib/api`) por **igualdad exacta de objeto** contra `POST_BODY_BEFORE_CYCLE` (CA-002). Segundo caso: enciende un interruptor de cada sección y el cuerpo suma **exactamente** esas 4 claves con `true`, ninguna más. Tercer caso: en el paso `advanced` los 12 interruptores están `aria-checked="false"` salvo `moveStopToBreakevenAfterPartial` (D6). |
| `edit-agent-modal.spec.tsx` | Con `CONFIG_ALL_ON_EDGES` precargada, cada control refleja el valor persistido (US-1-007 a US-1-010); guardar sin tocar nada ⇒ `api.put` **no se llama**; tocar un solo slider ⇒ el cuerpo del PUT tiene esa única clave (CA-003); apagar el sintético de `maxPositionHoldMinutes` ⇒ `{ maxPositionHoldMinutes: null }`. |
| `agent-advanced-summary.spec.tsx` | 25 filas presentes con `CONFIG_ALL_OFF`; un interruptor apagado se muestra como "Disabled" y su dependiente como "Not applicable" (nunca el número); `maxPositionHoldMinutes: null` ⇒ "No limit"; `CONFIG_UNKNOWN_ENTRY_MODE` ⇒ esa fila cae a "Unknown" y **las otras 24 siguen renderizadas** (US-1-011, constitución §4); ningún click dispara `api.put`. |
| `advanced-i18n.spec.ts` | Recorre el **árbol** `config.advanced` de `es` y de `en` (walk recursivo a rutas planas) y afirma: mismo conjunto de rutas, ningún valor vacío, ningún valor idéntico a su clave. Idem para las tres rutas `notificationMessages.entryOrder*` (CA-007). Además: para cada clave de `ADVANCED_FIELDS`, existen `…<section>.<field>.label` y `.hint` en ambos locales (el catálogo genera la lista, no una lista a mano). |

### 11.3 E2E (Playwright, headless, sin claves externas)

**Cambios obligatorios en especs existentes** (consecuencia de D1, verificados línea por línea):

| Archivo | Línea | Cambio |
| --- | --- | --- |
| `e2e/trading.spec.ts` | 100-114, test "the last step offers Create Agent" | el array de títulos suma `'Advanced settings'` **antes** de `'Review and create'` |
| `e2e/agent-flow.spec.ts` | 61-63, helper `createSandboxAgent` | el `for (let i = 0; i < 4; i++)` pasa a `< 5` |

Ningún otro spec depende del conteo de pasos (verificado: sólo esos dos archivos usan
`name: 'Next'`).

**Spec nuevo** `e2e/agent-advanced-config.spec.ts` (proyecto `chromium-trader`, storage state
sembrado, modo global SANDBOX):

| Escenario | Aserción | CA |
| --- | --- | --- |
| Abrir el alta, llegar al paso `advanced` | las cuatro secciones están presentes y **cerradas**; ningún interruptor visible en `aria-checked="true"` | CA-002 |
| Abrir Protección y encender `nativeProtectionEnabled` | el slider de `stopLimitOffsetPct` pasa de `disabled` a habilitado en el DOM | US-1-002 |
| Idem en Señal y tamaño, Loop reactivo | el dependiente correspondiente se habilita | US-1-003, US-1-004 |
| En SANDBOX, abrir Entrada | el select de `entryOrderMode` está deshabilitado y el texto de `sandboxDisabled` es visible | CA-004 |
| Atravesar el paso sin tocar nada y crear | intercepta el `POST /trading/config` y afirma que el **conjunto de claves** del cuerpo es el de §7.1 | CA-002 |
| Abrir la edición del agente creado y guardar sin cambios | no se observa ningún `PUT /trading/config/*` | CA-003 |
| Abrir el detalle | las cuatro secciones del resumen están visibles con sus 25 filas | US-1-011 |

`PLAYWRIGHT_HEADED_DEBUG` no interviene: el proyecto `headed-debug` sigue gateado.

---

## 12. Lectores a enumerar — todo lo que toca `TradingConfig` en `apps/web`

Al borrar `interface TradingConfig` y `interface TradingConfigDto` de `use-trading.ts` (líneas 11-49)
hay que migrar **exactamente** estos puntos. Verificado con grep, no inferido:

| Archivo | Línea(s) | Qué usa | Migración |
| --- | --- | --- | --- |
| `src/hooks/use-trading.ts` | 11-30, 32-49 | declara `TradingConfig` y `TradingConfigDto` | se borran; `useTradingConfigs` pasa a `useQuery<TradingConfigWire[]>`, `useCreateConfig` a `CreateTradingConfigInput`, `useUpdateConfig` a `UpdateTradingConfigPayload` |
| `src/hooks/use-trading.ts` | 5-9 | `TradingMode`, `TradingAsset`, `TradingPair`, `IntervalMode`, `RiskProfile` locales | pasan a re-export con alias de las uniones del wire (`export type { TradingModeWire as TradingMode, … } from '@crypto-trader/shared'`) — sin shape declarada, así que 18 importadores siguen compilando sin tocarse |
| `src/components/config/agent-detail-modal.tsx` | 5, 15 | `cfg: TradingConfig` | `TradingConfigWire` |
| `src/components/config/delete-agent-modal.tsx` | 3, 11 | `cfg: TradingConfig` | `TradingConfigWire` |
| `src/components/config/edit-agent-modal.tsx` | 22, 25, 36, 44, 69 | `TradingConfig`, `Partial<TradingConfigDto>` | `TradingConfigWire`, `UpdateTradingConfigPayload` |
| `src/components/config/new-agent-stepper-modal.tsx` | 24, 74 | `TradingConfigDto` | `CreateTradingConfigInput` |
| `src/components/config/constants.tsx` | 19-23 | las cinco uniones | sin cambios (llegan por el re-export) |
| `src/pages/dashboard/config.tsx` | 13, 35, 38, 41 | `useState<TradingConfig \| null>` ×3 | `TradingConfigWire` |
| `src/components/bot-analysis/agent-countdown-card.tsx` | 6, 16, 181 | `config: TradingConfig`, `configs: TradingConfig[]` | `TradingConfigWire` |
| `src/components/bot-analysis/agent-state-modal.tsx` | 3, 11 | `config: TradingConfig` | `TradingConfigWire` |
| `src/pages/dashboard/bot-analysis.tsx` | 19, 56 | `useTradingConfigs()` | inferido, sin cambios |
| `src/pages/dashboard/overview.tsx` | — | `useTradingConfigs()` | inferido, sin cambios |
| `src/components/market-intelligence/agent-verdicts-banner.tsx` | 27, 156 | `useTradingConfigs()` | inferido, sin cambios |
| `src/containers/mode-selector.tsx` | 23 | `TradingMode` | sin cambios (re-export) |

**Riesgo concreto de la migración, medido:** el tipo local declara `isActive: boolean` y el GET no lo
devuelve (H2). Ningún archivo de `apps/web` lee `config.isActive` (verificado: los hits de `isActive`
son de data sources y LLM keys), así que borrarlo del tipo no rompe nada — y a partir de ahora el
typecheck impide volver a leerlo.

Fuera de alcance, anotado: `src/hooks/use-user.ts:8` y `src/components/onboarding/types.ts:1`
declaran su propio `TradingMode`. Son preexistentes y ajenos al wire de configuración; este ciclo no
los toca.

---

## 13. Criterios funcionales reescritos como ejecutables

| Origen | Criterio original | Reescritura ejecutable |
| --- | --- | --- |
| US-1-001 | "hace fallar el typecheck del monorepo en al menos un punto de `apps/web`" | El punto de falla es `ADVANCED_FIELDS: Record<TradingConfigAdvancedField, AdvancedFieldSpec>` y `DEFAULT_ADVANCED_DRAFT: AdvancedDraft` (§6.2), con error `TS2741`. Como un build roto no puede vivir verde en el repo, la verificación en CI es el test de partición de §11.2 (las dos listas cubren las 40 claves) y el reviewer corre **una vez** la prueba negativa: agregar `foo?: boolean` a `CreateTradingConfigInput`, `pnpm typecheck`, esperar `TS2344` en `apps/api` + `TS2741` en `apps/web`, revertir. |
| US-1-002 (último CA) | "clampea o el botón queda deshabilitado, **a elección del architect**" | Las dos: clamp en `onChange` (`clampToRange`) **y** guarda `isDraftWithinRanges` que deshabilita crear/guardar mostrando `config.advanced.common.rangeError`. El test afirma la propiedad observable: ningún valor emitido cae fuera de `[wireMin, wireMax]` (§11.2). |
| US-1-005 / CA-002 | "`entryOrderMode` no aparece en el POST **o** aparece con `MARKET`" | Se cierra en una sola rama: **no aparece** (D5). El fixture esperado es único. |
| US-1-006 | "si el architect decide que algún campo viaja con su default…" | No viaja ninguno (D5). La cláusula condicional queda sin efecto. |
| US-1-007 a US-1-010 | "el `PUT` incluye el/los campo(s) modificado(s)" | `diffToUpdatePayload(baseline, current)` y payload vacío ⇒ **sin request**; el test afirma la cardinalidad exacta de claves, no sólo la presencia (§11.2). |
| US-1-011 | "una fila por cada uno de los **26** campos avanzados" | **25** filas (H3), agrupadas en cuatro bloques en el orden de `TRADING_CONFIG_ADVANCED_FIELDS`. |
| US-1-011 | "un parámetro dependiente se muestra atenuado **o** con 'no aplica'" | Siempre `t('config.advanced.common.notApplicable')`, nunca el número (D9): "atenuado con su valor" es indistinguible de un valor vigente. |
| US-1-014 | "cada interruptor es alcanzable y expone `role=switch`/`aria-checked`" | Se suma el nombre accesible explícito (`ariaLabel`, D8): sin él `getByRole('switch', { name })` no encuentra el control y el criterio no es verificable. |
| US-1-015 | "un test de propiedad parametrizado por los pares (campo, dependencia)" | Los pares se leen de `ADVANCED_FIELDS` (§6.5 es su fuente): agregar un campo al catálogo agrega su caso de test automáticamente. |
| Spec CA-003 | "cada uno de los 26 campos avanzados se puede leer y modificar desde la edición" | 25 campos, y **modificar desde el alta** depende de FIX-A (H1): sin ese fix el alta valida y el backend descarta 22 de ellos. El reviewer no puede dar CA-003 por cumplida en el camino del alta sin FIX-A mergeado. |

---

## 14. Dependencias externas

Ninguna. Cero paquetes nuevos en `apps/web`, `libs/ui` y `libs/shared`; `@radix-ui/react-collapsible`
ya es dependencia de `libs/ui`.

---

## 15. Handoff

**Para el orquestador (antes de que el implementador toque el alta):** registrar FIX-A (`[BUGFIX]`,
bloqueante para US-1-002..US-1-004 en el alta) y FIX-B (`[IMPROVEMENT]`, no bloqueante) según §1.

**Para el planner:** el orden de dependencia es `libs/shared` (§3) → `apps/api` (§2 D2, dos líneas)
→ `libs/ui` (§2 D8) → `use-trading.ts` + migración de los 10 lectores (§12) → catálogo y draft (§6)
→ componentes de sección (§5) → paso del stepper → edición → detalle → locales (§8) → Vitest (§11.2)
→ E2E (§11.3, incluidos los dos arreglos de especs existentes). El catálogo y el draft son la task
más pesada y son prerequisito de todo lo visual.

**Para el reviewer:** `pnpm typecheck`, `pnpm nx test web`, `pnpm nx test shared`, la suite E2E en CI,
la prueba negativa de US-1-001 (§13), la verificación de que FIX-A esté mergeado antes de dar CA-003
por cumplida, y `pnpm sdd:validate` en verde.
