# Planner — Cycle 1: Wire compartido y configuración avanzada del agente

> **Input:** `sdd/specs/spec-e-burgos-009-agent-advanced-config-ui/cycles/cycle-01/brief.yaml` +
> `functional.md`
> **Output:** este archivo y `tasks.json`
> **Generado por:** sdd-planner

> ⚠️ El sdd-architect escribe `architect.md` en paralelo con este documento y yo no lo veo. Toda
> vez que una task depende de un nombre que el architect fija (el tipo del wire en `libs/shared`,
> el mecanismo de D2 para que `apps/api` reutilice ese tipo sin tocar sus decoradores, si las
> cuatro secciones viven en un paso "Avanzado" nuevo o repartidas en los pasos existentes — D1 —,
> el nombre de los cuatro componentes de sección, y el mecanismo de "sólo lo cambiado" del `PUT` —
> D3), esta descripción dice **"el nombre/mecanismo que fije architect.md §X"** en lugar de
> inventarlo. El orquestador reconcilia `planner.md`/`tasks.json` contra la versión final de
> `architect.md` antes de habilitar al implementador.

---

## Resumen del ciclo

| Campo | Valor |
| --- | --- |
| Ciclo | 1 |
| Módulo | agent-advanced-config-ui |
| Fase | shared-wire-and-advanced-config |
| Apps | `apps/web`, `libs/shared`, `apps/api` (solo el mecanismo de D2, sin tocar decoradores ni comportamiento), `libs/ui` (solo si D1/D2 de `architect.md` exige una primitiva nueva) |
| Tasks (filas en `tasks.json`) | 18 |
| Horas de trabajo estimadas | **72h** |
| Story points estimados | **95** |
| Duración estimada (serial) | ~9 días hábiles (72h a 8h/día) |
| Duración estimada (explotando los carriles paralelos, 3 implementadores) | ~3.5–4 días hábiles |
| HUs cubiertas | US-1-001 .. US-1-015 (15/15) |
| CAs de la spec cubiertos | CA-001, CA-002, CA-003, CA-004, CA-007 (CA-005/006/008 son de cycle-02) |

**Interruptor de todo el ciclo:** ningún interruptor de las cuatro secciones nace en `true`. Toda
task que renderiza un control dependiente lo hace `disabled` mientras su interruptor está apagado
(constitución de `apps/api` §4, heredada, no negociable).

---

## Orden de las capas (regla no negociable, heredada del brief)

1. **`libs/shared`** primero (TASK-001) — el wire completo del `TradingConfig` no depende de nada
   y todo lo demás lo importa.
2. **`apps/api` (D2, sin endpoints/DTOs nuevos)** y **`apps/web` hooks** pueden avanzar **en
   paralelo** entre sí desde que TASK-001 cierra: ambos solo dependen del tipo publicado, no uno
   del otro (TASK-002 ‖ TASK-003).
3. **Locales** (TASK-004) solo depende de TASK-001 (los nombres de campo salen del wire/DTO, no de
   ningún componente) — corre en paralelo a TASK-002/003 y **antes** de los componentes de sección,
   porque cada sección llama `t()` con claves reales desde su primer commit.
4. **Form-state hook/reducer** (TASK-005) depende de TASK-001 (tipos) y corre en paralelo a
   TASK-002/003/004 — es el único archivo nuevo que las cuatro secciones importan.
5. **Los cuatro componentes de sección** (TASK-006..009) dependen de TASK-004 (locales) y TASK-005
   (hook) — desde ahí son **cuatro carriles paralelos, archivos propios**, sin dependencia entre
   sí (ninguna sección lee ni escribe estado de otra, US-1-002 a US-1-005 son independientes por
   diseño).
6. **Stepper** (TASK-010 → TASK-011) solo empieza cuando las cuatro secciones (capa 5) están en
   verde — el paso/agrupación "Avanzado" las importa a las cuatro.
7. **Edición** (TASK-012 → TASK-013) también depende de las cuatro secciones (capa 5) más
   TASK-003 (los hooks ya sirven el wire completo) — puede avanzar **en paralelo** al Stepper
   (archivos distintos: `new-agent-stepper-modal.tsx` vs `edit-agent-modal.tsx`).
8. **Detalle** (TASK-014) solo depende de TASK-001/003/004 — **no** depende de las cuatro
   secciones de alta/edición porque es de solo lectura y puede usar presenters propios; corre en
   paralelo a Stepper y Edición.
9. **Tests de comportamiento cross-cutting** (TASK-015 fixtures/property tests, TASK-016 E2E)
   dependen de las cuatro secciones (capa 5) y, en el caso de TASK-016, del Stepper (recorre el
   flujo de alta completo).
10. **Cierre** (TASK-017 fragmento de `libs/shared`/`libs/ui`, TASK-018 fragmento de `apps/web` +
    journal + usage) va al final, cuando el resto de las capas cerró.

---

## Tasks

### Capa 1 — `libs/shared` (wire único)

#### TASK-001: Wire completo de `TradingConfig` + tipos de alta/edición en `libs/shared`

**Historias:** US-1-001
**App:** libs/shared
**Descripción:** Publicar en `libs/shared/src/types/interfaces.ts` (o el archivo del barrel que
corresponda) el tipo completo del wire de `TradingConfig`: los 40 campos de configuración leídos
tal cual de `apps/api/src/trading/dto/trading-config.dto.ts` (nunca inferidos ni copiados de la
`TradingConfig` local de `apps/web/src/hooks/use-trading.ts:11`) más los campos de lectura `id`,
`isRunning`, `createdAt`, `updatedAt`. Publicar también los tipos de alta (equivalente a
`CreateTradingConfigDto`) y edición (equivalente a `UpdateTradingConfigDto`) como tipos — nombres
exactos de architect.md (D2 puede exigir que el tipo de alta sea la base de la que el DTO real
`implements`/`satisfies`, lo que fija el shape exacto). Reusar `EntryOrderMode` ya exportado
(`interfaces.ts:281`) en vez de redeclararlo. Todo exportado por el barrel existente
(`export * from './types'`) — sin romper ningún import actual de `TradingConfigData` (que queda
congelada, US-1-001 no la toca).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] El tipo nuevo compila y queda exportado desde `@crypto-trader/shared` (import de smoke desde
      un archivo temporal en `apps/web` y en `apps/api`).
- [ ] El tipo incluye los 40 campos de configuración citados en `functional.md` US-1-002 a US-1-005
      (Protección, Señal y tamaño, Loop reactivo, Entrada) más `id`, `isRunning`, `createdAt`,
      `updatedAt` — verificado campo a campo contra `trading-config.dto.ts`, no contra el DTO local
      de `apps/web`.
- [ ] `TradingConfigData` (`interfaces.ts:151`) no cambia de shape — solo se agregan tipos nuevos
      (constitución de `libs/shared`: cambios aditivos).
- [ ] `nx run shared:build` (o el target de typecheck del subproyecto) pasa en verde.

---

### Capa 2 — `apps/api` (D2) ‖ `apps/web` hooks (carriles paralelos, archivos distintos)

#### TASK-002: `apps/api` reutiliza el wire de `libs/shared` sin tocar decoradores (D2, CA-001)

**Historias:** US-1-001
**App:** apps/api
**Descripción:** Atar `CreateTradingConfigDto`/`UpdateTradingConfigDto`
(`apps/api/src/trading/dto/trading-config.dto.ts`) al tipo de alta/edición publicado en TASK-001
por el mecanismo que fije architect.md §D2 (`implements`, `satisfies`, o un test de igualdad de
claves) — **sin agregar, quitar ni modificar un solo decorador `class-validator`** de las clases
existentes: este ciclo no cambia el DTO del backend, solo lo ata al wire compartido para que un
campo nuevo en un solo lado rompa el build o el test. Fuera de alcance de esta task cualquier
cambio de comportamiento o de endpoint (`out_of_scope` del brief) — si el mecanismo elegido
revela un campo genuinamente ininteligible para la UI, se registra como fix, no se resuelve acá.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] Agregar al DTO del backend un campo que todavía no existe en el tipo de `libs/shared` hace
      fallar el typecheck del monorepo o un test dedicado de igualdad de claves (elegido por
      architect.md §D2) — verificado agregando un campo de prueba temporal y confirmando el rojo,
      después revirtiéndolo.
- [ ] Ningún decorador de `CreateTradingConfigDto`/`UpdateTradingConfigDto` cambió de línea
      (diff del archivo limitado a la declaración de tipo/implements, cero cambios en los
      `@IsEnum`/`@Min`/`@Max`/`@IsOptional` existentes).
- [ ] La suite de tests existente de `trading-config.dto.spec.ts` sigue en verde sin cambios de
      comportamiento observable.

---

#### TASK-003: `apps/web` — los hooks importan el wire y se borra la interfaz local

**Historias:** US-1-001
**App:** apps/web
**Descripción:** `apps/web/src/hooks/use-trading.ts:11` borra su `interface TradingConfig` local
(y el `TradingConfigDto` local si existe con el mismo problema) e importa el tipo completo y los
tipos de alta/edición desde `@crypto-trader/shared` (TASK-001). Actualizar cada consumidor directo
del tipo local (`new-agent-stepper-modal.tsx`, `edit-agent-modal.tsx`, `agent-detail-modal.tsx`,
`constants.tsx`) para que compile contra el tipo importado — sin todavía agregar UI para los 26
campos nuevos (eso es capa 5 en adelante): esta task es puramente de tipos, cero cambio de
comportamiento visible.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `apps/web` no declara ningún `interface`/`type` que redeclare el shape de `TradingConfig`,
      `CreateTradingConfigDto` ni `UpdateTradingConfigDto` — grep de `interface TradingConfig` en
      `apps/web/src` no encuentra nada.
- [ ] Cero `as any` ni `as unknown as TradingConfig` en `apps/web/src/components/config/` ni en
      `use-trading.ts` para sortear el tipo importado.
- [ ] `pnpm nx run web:typecheck` pasa en verde con cero cambio de comportamiento: el `POST`/`PUT`
      emitidos por el stepper/edición actuales (sin las secciones nuevas, que todavía no existen)
      son byte-idénticos a los de antes de esta task — test de regresión sobre el fixture existente
      del stepper.

---

### Capa 3 — Locales (paralelo a la capa 2, solo depende de TASK-001)

#### TASK-004: Locales `es`/`en` — las cuatro secciones + claves de notificación faltantes

**Historias:** US-1-013
**App:** apps/web
**Descripción:** Agregar en `apps/web/src/locales/es.ts` y `apps/web/src/locales/en.ts` todas las
claves de las cuatro secciones con la convención `seccion.componente.elemento` (ej.
`config.advanced.protection.nativeProtectionEnabled.label`, `...hint`, `...rangeError` — el
segmento `componente` exacto lo fija architect.md con el nombre real de cada sección) para los 26
campos de US-1-002 a US-1-005 (label + hint de una línea + mensaje de error de rango donde
aplique) y los textos de coherencia de US-1-012 (`config.advanced.entry.sandboxDisabled`, etc.).
Agregar bajo `notificationMessages` (`es.ts:1850`) las tres claves ausentes: `entryOrderPlaced`,
`entryOrderFilled`, `entryOrderMissing` (CA-007 de la spec, verificadas ausentes en ambos locales).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] `entryOrderPlaced`, `entryOrderFilled`, `entryOrderMissing` existen bajo
      `notificationMessages` en `es.ts` y en `en.ts` (CA-007).
- [ ] Toda clave nueva de las cuatro secciones existe en ambos locales — ningún valor vacío.
- [ ] Test de comportamiento (Vitest) que recorre el árbol de claves nuevas y confirma paridad
      exacta de conjunto de keys entre `es.ts` y `en.ts` (US-1-013, último criterio).
- [ ] Ninguna clave existente (`notificationMessages` u otra) se modifica de valor — el diff de
      esta task es solo adición de claves.

---

### Capa 4 — Form-state hook/reducer (paralelo a la capa 2, depende solo de TASK-001)

#### TASK-005: Hook/reducer de estado del formulario avanzado — defaults apagados + reglas de dependencia

**Historias:** US-1-002, US-1-003, US-1-004, US-1-005, US-1-012
**App:** apps/web
**Descripción:** Un hook/reducer propio (nombre y ubicación exacta de architect.md, ej.
`apps/web/src/components/config/use-advanced-config-form.ts`) que centraliza el estado de los 26
campos avanzados para el alta: estado inicial con **todo apagado** (ningún interruptor en `true`,
cada parámetro numérico en su default de la tabla de `functional.md`), una función pura
`isFieldEnabled(field, state)` parametrizada por los pares (campo, dependencia) de US-1-002 a
US-1-005 — la misma función la van a usar los cuatro componentes de sección (capa 5) y el test
parametrizado de TASK-015, para no duplicar la tabla de dependencias en cinco lugares. Resuelve
también el mecanismo para los dos campos opcionales sin interruptor propio en el DTO
(`maxPositionHoldMinutes`, `entryTrailingDeltaBips`) que el functional dejó abierto — el mecanismo
exacto (interruptor sintético de UI vs. valor especial) lo fija architect.md.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-001
**Criterio de done:**

- [ ] El estado inicial del reducer no tiene ningún campo booleano en `true` (test de propiedad
      sobre el estado inicial completo, no campo por campo).
- [ ] `isFieldEnabled` es pura (mismo input → mismo output, sin leer el DOM ni el store) y cubre
      los 20 pares (campo, dependencia) documentados en `functional.md` — un test parametrizado por
      esa tabla, no un test por campo hardcodeado (reusable luego por TASK-015).
- [ ] Encender un interruptor raíz en el reducer no muta el estado de ningún campo de otra sección
      (test de aislamiento, US-1-003 último criterio).
- [ ] El mecanismo elegido para `maxPositionHoldMinutes`/`entryTrailingDeltaBips` queda documentado
      en un comentario de una línea con referencia a `architect.md` (única excepción de comentario
      permitida: regla de negocio contra-intuitiva con referencia a spec).

---

### Capa 5 — Cuatro componentes de sección (carriles paralelos, archivos propios, sin dependencia entre sí)

> Cada sección es un componente contenedor con lógica en `apps/web/src/components/config/`
> (regla 4 de `frontend-component-rules`) que arma su UI con presenters de `libs/ui`
> (`toggle-switch`, `slider-field`, `form-field`, `select`, `info-tooltip` — catálogo ya existente,
> ninguna primitiva nueva prevista salvo que architect.md diga lo contrario). Las cuatro dependen
> de TASK-004 (claves i18n reales) y TASK-005 (hook/reducer + `isFieldEnabled`).

#### TASK-006: Componente de sección — Protección (US-1-002)

**Historias:** US-1-002, US-1-012, US-1-014
**App:** apps/web
**Descripción:** Componente (nombre de architect.md, ej. `ProtectionSection`) para los once campos
de la tabla de US-1-002: `nativeProtectionEnabled`, `stopLimitOffsetPct`,
`closeOnProtectionFailure`, `trailingStopEnabled`, `trailingStopPct`, `trailingActivationPct`,
`partialTpEnabled`, `partialTpTriggerPct`, `partialTpSellPct`, `moveStopToBreakevenAfterPartial`,
`maxPositionHoldMinutes`. Recibe el estado/dispatch del reducer de TASK-005, usa `isFieldEnabled`
para el atributo `disabled` de cada control dependiente, clampea o bloquea el submit para un valor
fuera de rango del DTO (a elección del architect, US-1-002 último criterio) y muestra el
`InfoTooltip` de coherencia cuando corresponda (US-1-012).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-001, TASK-004, TASK-005
**Criterio de done:**

- [ ] Con `nativeProtectionEnabled` apagado, `stopLimitOffsetPct` y `closeOnProtectionFailure` se
      renderizan `disabled`; con `trailingStopEnabled` apagado, sus dos dependientes también; con
      `partialTpEnabled` apagado, sus tres dependientes también (US-1-002, tres primeros criterios).
- [ ] Encender cada interruptor habilita exactamente sus dependientes listados — ningún control de
      esta sección afecta otro fuera de su propio árbol de dependencia.
- [ ] Un valor fuera de rango del DTO (`stopLimitOffsetPct` > 0.05, `trailingStopPct` > 1, etc.) no
      llega a integrar el estado que se leería para el payload — test por el mecanismo elegido
      (clamp o bloqueo de submit).
- [ ] `ToggleSwitch` es alcanzable por `Tab`, expone `role="switch"`/`aria-checked`; cada slider es
      operable con flechas de teclado; cada `label` está asociado a su control (US-1-014, tres
      primeros criterios aplicados a esta sección).

---

#### TASK-007: Componente de sección — Señal y tamaño (US-1-003)

**Historias:** US-1-003, US-1-012, US-1-014
**App:** apps/web
**Descripción:** Componente (nombre de architect.md, ej. `SignalSizingSection`) para los ocho
campos de US-1-003: `lossCutEnabled` + sus tres dependientes, `smartSizingEnabled` +
`reduceSizeFactor`, `deterministicGateEnabled` + `gatePriceChangePct`. Mismo patrón de
`isFieldEnabled` que TASK-006; los tres interruptores raíz son independientes entre sí.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-001, TASK-004, TASK-005
**Criterio de done:**

- [ ] Con cada interruptor raíz apagado, sus dependientes exactos se renderizan `disabled`
      (US-1-003, tres criterios de habilitación).
- [ ] Encender un interruptor raíz no habilita ni deshabilita los controles de los otros dos
      (US-1-003, último criterio — test de aislamiento).
- [ ] Mismos tres criterios de accesibilidad de TASK-006 aplicados a esta sección (US-1-014).

---

#### TASK-008: Componente de sección — Loop reactivo (US-1-004)

**Historias:** US-1-004, US-1-012, US-1-014
**App:** apps/web
**Descripción:** Componente (nombre de architect.md, ej. `ReactiveLoopSection`) para los tres
campos de US-1-004: `reactiveLoopEnabled`, `maxActionsPerHour`, `minActionIntervalSec`. Ambos
parámetros dependientes se validan como enteros — un valor con decimales no llega a integrar el
estado (redondeo en el control o bloqueo de submit, mismo mecanismo que TASK-006).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-001, TASK-004, TASK-005
**Criterio de done:**

- [ ] Con `reactiveLoopEnabled` apagado, `maxActionsPerHour` y `minActionIntervalSec` se renderizan
      `disabled` (US-1-004, segundo criterio).
- [ ] Un valor con decimales en cualquiera de los dos parámetros no llega a integrar el estado leído
      para el payload (US-1-004, tercer criterio).
- [ ] Mismos tres criterios de accesibilidad de TASK-006 aplicados a esta sección (US-1-014).

---

#### TASK-009: Componente de sección — Entrada (US-1-005)

**Historias:** US-1-005, US-1-012, US-1-014
**App:** apps/web
**Descripción:** Componente (nombre de architect.md, ej. `EntrySection`) para `entryOrderMode`
(select `MARKET | LIMIT_MAKER | OCO`), `entryOrderTtlMinutes` y `entryTrailingDeltaBips`. Recibe
como prop el modo de operación resuelto del bot (dato de solo lectura, heredado — nunca editable
acá, US-1-012 segundo criterio): con `SANDBOX` el select se renderiza `disabled` fijo en `MARKET`
con `InfoTooltip`/texto (`t('config.advanced.entry.sandboxDisabled')`, CA-004); con `LIVE`/
`TESTNET` ofrece las tres opciones. `entryOrderTtlMinutes` habilitado con `entryOrderMode ≠ MARKET`;
`entryTrailingDeltaBips` habilitado únicamente con `entryOrderMode = OCO` y modo resuelto distinto
de `SANDBOX`.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-004, TASK-005
**Criterio de done:**

- [ ] **CA-004.** Con modo resuelto `SANDBOX`, el select está `disabled`, fijo en `MARKET`, con
      explicación visible; con `LIVE`/`TESTNET` ofrece las tres opciones habilitadas (US-1-005,
      primer criterio; US-1-010, segundo criterio).
- [ ] Con `entryOrderMode = MARKET`, ambos parámetros dependientes están `disabled`; con
      `LIMIT_MAKER`, solo `entryOrderTtlMinutes` se habilita; con `OCO` (y modo ≠ `SANDBOX`), ambos
      se habilitan (US-1-005, tres últimos criterios; US-1-010, tercer criterio).
- [ ] El modo de operación del bot nunca se renderiza como campo editable dentro de esta sección
      (US-1-012, segundo criterio).
- [ ] Mismos tres criterios de accesibilidad de TASK-006 aplicados a esta sección (US-1-014).

---

### Capa 6 — Stepper de alta (depende de las cuatro secciones)

#### TASK-010: Integrar las cuatro secciones en el stepper de alta (D1)

**Historias:** US-1-002, US-1-003, US-1-004, US-1-005, US-1-006
**App:** apps/web
**Descripción:** Cablear las cuatro secciones (TASK-006..009) en
`apps/web/src/components/config/new-agent-stepper-modal.tsx` según la ubicación que fije
architect.md §D1 (un paso "Avanzado" nuevo y opcional con las cuatro secciones colapsadas, o
repartidas en los pasos existentes `risk`/`timing`) — sin reordenar los pasos existentes
(`preset → identity → thresholds → risk → timing → review`, `out_of_scope` del brief). El estado
del reducer de TASK-005 nace con todo apagado y arma el fragmento del payload del `POST` que se
agrega **solo** si el trader tocó la sección — si el architect elige que algún campo viaje siempre
con su default (en vez de omitirse), ese valor nunca es `true` para un booleano (US-1-006, segundo
criterio).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-003, TASK-006, TASK-007, TASK-008, TASK-009
**Criterio de done:**

- [ ] Con las cuatro secciones sin abrir/tocar, ninguna de sus 26 claves aparece en el `POST`
      emitido — o aparece solo la(s) que architect.md documentó explícitamente con su default
      (US-1-006, primer criterio; CA-002).
- [ ] Tocar un campo de una sección agrega esa clave (y solo esa, o las de su grupo de dependencia)
      al payload con el valor elegido, dentro del rango del DTO.
- [ ] Con `prefers-reduced-motion: reduce`, la apertura/cierre de la agrupación "Avanzado" (o de
      cada sección, según D1) no introduce una transición que ignore la media query ni supere
      300ms (US-1-014, último criterio).

---

#### TASK-011: Test de equivalencia CA-002 — alta sin tocar lo avanzado es byte-idéntica

**Historias:** US-1-006
**App:** apps/web
**Descripción:** Test de comportamiento (Vitest) sobre un fixture congelado del wire real que
reproduce el flujo completo del stepper sin interacción con la sección avanzada y compara el
payload emitido por igualdad exacta de objeto contra el fixture del payload "de antes de este
ciclo": `name?, asset, pair, mode, buyThreshold, sellThreshold, stopLossPct, takeProfitPct,
minProfitPct, maxTradePct, maxConcurrentPositions, minIntervalMinutes, intervalMode,
orderPriceOffsetPct, riskProfile` (US-1-006, lista exacta de claves de `functional.md`).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] El test compara por igualdad exacta de objeto (no solo `toContainKeys`) el payload emitido
      contra el fixture congelado — falla si aparece una clave nueva o si falta una existente.
- [ ] El test corre contra el tipo importado de `@crypto-trader/shared` (TASK-001), no contra un
      objeto literal sin tipo (US-1-015, primer criterio aplicado a este caso).

---

### Capa 7 — Edición (en paralelo al Stepper, depende de las cuatro secciones)

#### TASK-012: Integrar las cuatro secciones en la edición, precargadas con el estado real

**Historias:** US-1-007, US-1-008, US-1-009, US-1-010
**App:** apps/web
**Descripción:** Cablear las cuatro secciones (TASK-006..009) en
`apps/web/src/components/config/edit-agent-modal.tsx`, alimentadas con el reducer de TASK-005
inicializado desde la config real (`nativeProtectionEnabled: true` en la config ⇒ interruptor
mostrado encendido, nunca un default asumido — US-1-007, primer criterio). El estado `disabled` de
cada dependiente se computa con la misma `isFieldEnabled` de TASK-005, sobre el valor real del
interruptor, no sobre si el trader lo tocó en esta sesión. El select de `entryOrderMode` recibe el
modo resuelto real del bot (incluye el caso TESTNET `LIMIT_MAKER` en producción del diagnóstico).
**Estimación:** 6h · **Story points:** 8
**Dependencias:** TASK-003, TASK-006, TASK-007, TASK-008, TASK-009
**Criterio de done:**

- [ ] Al abrir la edición, los 26 controles reflejan el valor persistido de la config real (US-1-007
      a US-1-010, primer criterio de cada uno).
- [ ] El estado `disabled` de cada dependiente en la edición coincide con el que produciría
      `isFieldEnabled` sobre ese mismo valor en el alta — mismo test parametrizado de TASK-005
      reaplicado con fixtures de edición.
- [ ] El select de `entryOrderMode` en modo `SANDBOX` está `disabled` y en `LIVE`/`TESTNET` ofrece
      las tres opciones, igual que en TASK-009 (US-1-010, segundo criterio).

---

#### TASK-013: `PUT` de edición envía solo los campos cambiados (D3, CA-003)

**Historias:** US-1-007, US-1-008, US-1-009, US-1-010
**App:** apps/web
**Descripción:** Reemplazar el `handleSave` actual de `edit-agent-modal.tsx` (que hoy arma un
objeto con los once campos visibles completos en cada guardado) por el mecanismo de diff que fije
architect.md §D3 — trackear qué tocó el trader desde que abrió el modal, o comparar contra la
config original al armar el payload — aplicado a los 26 campos nuevos y, si architect.md lo decide
así, también a los 11 existentes. El backend ya soporta un `PUT` parcial (`trading.service.ts:288`
hace spread de `dto` sobre Prisma) y el `ValidationPipe` global rechaza cualquier clave no
declarada en `UpdateTradingConfigDto` — este ciclo no toca ninguno de los dos.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-012
**Criterio de done:**

- [ ] **CA-003.** Modificar un único campo de una sección y guardar produce un `PUT` cuyo cuerpo
      contiene únicamente ese campo (o el grupo mínimo que architect.md defina), nunca los 26/37
      campos completos.
- [ ] Modificar campos de dos secciones distintas en la misma sesión de edición produce un `PUT`
      con exactamente esos campos, dentro del rango del DTO citado en cada tabla de `functional.md`.
- [ ] Abrir la edición y guardar sin tocar nada produce un `PUT` vacío o no dispara el `PUT`
      (a definir por architect.md, pero nunca reenvía los 26 campos sin cambios).

---

### Capa 8 — Detalle del agente (en paralelo a Stepper/Edición, solo depende de la capa 1/2/3)

#### TASK-014: Detalle del agente muestra las cuatro secciones de solo lectura

**Historias:** US-1-011
**App:** apps/web
**Descripción:** `agent-detail-modal.tsx` gana una fila o agrupación legible (presenters de
`libs/ui` como `key-value-row`/`info-card`, sin lógica de habilitación porque es de solo lectura)
por cada uno de los 26 campos avanzados, con el valor real de la config persistida. Un interruptor
apagado se muestra como tal (no se omite la fila); un parámetro dependiente de un interruptor
apagado se muestra atenuado o "no aplica" — nunca un valor engañoso. Un `entryOrderMode` fuera del
union esperado degrada esa fila a `unknown` sin romper el resto del render (constitución de
`apps/web` §4).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-001, TASK-003, TASK-004
**Criterio de done:**

- [ ] Las 26 filas nuevas muestran el valor real persistido; ninguna se omite cuando su interruptor
      está apagado (US-1-011, primer y segundo criterio).
- [ ] Ninguna interacción de estas 26 filas dispara un `PUT` — la edición del nombre del agente
      sigue funcionando sin cambios (US-1-011, tercer criterio).
- [ ] Un fixture con `entryOrderMode: 'BOGUS' as any` degrada esa fila a `unknown` sin lanzar y sin
      afectar el render de las demás filas (US-1-011, cuarto criterio).

---

### Capa 9 — Tests cross-cutting (dependen de la capa 5; TASK-016 también de la capa 6)

#### TASK-015: Fixtures Vitest por sección + test de propiedad de las reglas de dependencia

**Historias:** US-1-015
**App:** apps/web
**Descripción:** Un fixture por sección (Protección, Señal y tamaño, Loop reactivo, Entrada)
construido a partir del tipo importado de `@crypto-trader/shared` (TASK-001), cubriendo el caso
"todo apagado" y el caso "todo encendido con valores en el límite del rango del DTO". Un test de
propiedad parametrizado por los pares (campo, dependencia) — reusa `isFieldEnabled` de TASK-005,
no un test hardcodeado por campo — que verifica `disabled` cuando la dependencia está apagada y
habilitado en caso contrario, para los 20 pares de las cuatro secciones.
**Estimación:** 5h · **Story points:** 8
**Dependencias:** TASK-006, TASK-007, TASK-008, TASK-009
**Criterio de done:**

- [ ] Cuatro fixtures (uno por sección) tipados contra `@crypto-trader/shared`, ninguno un objeto
      literal sin tipo (US-1-015, primer criterio).
- [ ] El test de propiedad recorre los 20 pares (campo, dependencia) documentados en
      `functional.md` US-1-002 a US-1-005 desde una tabla de datos, no 20 tests copiados a mano
      (US-1-015, segundo criterio).
- [ ] Ningún test de esta task abre un navegador — corre en jsdom/node (US-1-015, último criterio).

---

#### TASK-016: E2E headless — alta enciende un interruptor por sección y confirma la habilitación en el DOM

**Historias:** US-1-015
**App:** apps/web
**Descripción:** Spec Playwright nuevo que abre el alta, entra a la agrupación "Avanzado" (o a los
pasos donde D1 repartió las secciones), enciende un interruptor de cada una de las cuatro secciones
y confirma en el DOM que el control dependiente correspondiente pasa a habilitado. Corre en CI sin
`PLAYWRIGHT_HEADED_DEBUG` y sin depender de ninguna clave externa — mismo patrón que
`e2e/agent-flow.spec.ts` existente.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-010
**Criterio de done:**

- [ ] El spec corre headless en CI (verificado en el mismo run que la suite existente, sin agregar
      el proyecto `headed-debug`).
- [ ] Para cada una de las cuatro secciones, encender su interruptor raíz habilita en el DOM al
      menos un control dependiente verificado por el test (US-1-015, cuarto criterio).
- [ ] El spec no abre un navegador visible en la máquina del desarrollador ni depende de una clave
      externa (US-1-015, último criterio; `harness_rules` del brief).

---

### Cierre

#### TASK-017: Fragmento de contexto aditivo — `libs/shared` (+ `libs/ui` si se tocó)

**Historias:** US-1-001
**App:** libs/shared
**Descripción:** Crear
`sdd/context/libs/shared/updates/2026-09-03-spec-e-burgos-009-cycle-01.md` (patrón append-only de
la sección 🧩 del `CLAUDE.md`) documentando el wire completo publicado y los tipos de alta/edición.
Si TASK-006..009 terminó agregando una primitiva nueva a `libs/ui` (no previsto por el catálogo
actual, solo si `frontend-component-rules` regla 3 lo exigió), crear también
`sdd/context/libs/ui/updates/2026-09-03-spec-e-burgos-009-cycle-01.md`. No editar directamente
`constitution.md`/`context_prompt.md` de ninguna de las dos libs.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** TASK-001, TASK-006, TASK-007, TASK-008, TASK-009
**Criterio de done:**

- [ ] El fragmento de `libs/shared` existe, con las secciones no vacías correspondientes, corto y
      solo el delta.
- [ ] `constitution.md`/`context_prompt.md` de `libs/shared` (y de `libs/ui` si aplica) no
      cambiaron una línea.
- [ ] Si no se tocó `libs/ui`, no se crea ningún fragmento para esa lib (evitar ruido).

---

#### TASK-018: Fragmento de contexto aditivo `apps/web` + journal (si aplica) + usage consolidado

**Historias:** US-1-001
**App:** apps/web
**Descripción:** Crear `sdd/context/apps/web/updates/2026-09-03-spec-e-burgos-009-cycle-01.md`
con el delta de este ciclo: wire importado desde `@crypto-trader/shared`, cuatro secciones nuevas
en `apps/web/src/components/config/`, hook/reducer de estado avanzado, mecanismo de `PUT` parcial.
Si al cerrar el ciclo hubo una lección real (filtro anti-ruido de la sección 🧠 MEMORIA GATE),
crear `sdd/memory/journal/2026-09-03-spec-e-burgos-009-cycle-01.md`. Confirmar que cada task de
este `tasks.json` cerró con su `usage.model_tier` registrado (regla `harness_rules` del brief)
antes de que el reviewer cierre el `cycle.json`.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-011, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017
**Criterio de done:**

- [ ] El fragmento de `apps/web` existe, es corto y solo el delta; `constitution.md`/
      `context_prompt.md` de `apps/web` no cambiaron una línea.
- [ ] Si se creó entrada de journal, pasa el filtro anti-ruido (cambiaría el comportamiento de un
      agente futuro) — si no hay lección real, no se crea ninguna entrada.
- [ ] `pnpm sdd:validate` no reporta ninguna task de este `tasks.json` sin `usage`.

---

## Orden de ejecución

```
Capa 1 (libs/shared)
  TASK-001
       │
       ├───────────────┬───────────────────┬───────────────────┐
       ▼                ▼                   ▼                   ▼
Capa 2a (apps/api,   Capa 2b (apps/web    Capa 3 (locales,    Capa 4 (form-state
 D2, archivo propio   hooks, archivo       archivos propios,   hook, archivo propio,
 — PARALELO)          propio — PARALELO)   PARALELO)           PARALELO)
  TASK-002             TASK-003             TASK-004             TASK-005
                            │                    │                    │
                            └────────┬───────────┴───────────┬────────┘
                                     ▼                        ▼
                     Capa 5 (cuatro secciones — CUATRO CARRILES PARALELOS,
                              archivos propios, sin dependencia entre sí)
                       TASK-006 (Protección) ‖ TASK-007 (Señal y tamaño) ‖
                       TASK-008 (Loop reactivo) ‖ TASK-009 (Entrada)
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                  ▼
       Capa 6 (Stepper, archivo propio)     Capa 7 (Edición, archivo propio
        TASK-010 (usa las 4 secciones)       — PARALELO a la capa 6)
             │                                TASK-012 (usa las 4 secciones)
             ▼                                       │
        TASK-011 (CA-002)                            ▼
             │                                TASK-013 (CA-003, D3)
             │                                       │
             ▼                                       │
        TASK-016 (E2E, usa el stepper)               │
                    │                                 │
       Capa 8 (Detalle, PARALELO a 6/7 — solo depende de capa 1/2b/3)
        TASK-014
                    │
       Capa 9 (fixtures/property test, PARALELO a 6/7/8 — depende solo de capa 5)
        TASK-015
                    │
        ┌───────────┴────────────────────────────────────────────┐
        ▼                                                          ▼
   TASK-017 (cierre libs, depende de 001+006..009)          TASK-018 (cierre apps/web,
                                                              depende de 011+013+014+015+016+017)
```

**Carriles paralelos explícitos (mismo momento, archivos distintos, al menos 3 implementadores):**

1. Tras TASK-001: **TASK-002 (apps/api)** ‖ **TASK-003 (apps/web hooks)** ‖ **TASK-004 (locales)**
   ‖ **TASK-005 (form-state hook)** — cuatro implementadores en simultáneo.
2. Tras TASK-004+005 (y TASK-001 transitivo): **TASK-006** ‖ **TASK-007** ‖ **TASK-008** ‖
   **TASK-009** — las cuatro secciones, cuatro implementadores, cero coordinación entre ellos.
3. Tras la capa 5: **Stepper (TASK-010→011→016)** ‖ **Edición (TASK-012→013)** ‖ **Detalle
   (TASK-014)** ‖ **Fixtures/property test (TASK-015)** — cuatro carriles, archivos totalmente
   distintos.

**Camino crítico (la cadena más larga que ningún paralelismo acorta):**
TASK-001 → TASK-005 → TASK-006 (o cualquiera de las cuatro secciones, misma duración crítica) →
TASK-012 → TASK-013 → TASK-018.
Horas del camino crítico: 4 + 5 + 6 + 6 + 5 + 2 = **28h** (~3.5 días hábiles); el resto del
trabajo (72h totales) cabe en los carriles paralelos sin extender esa cifra con al menos 3
implementadores trabajando el ciclo a la vez.

---

## Notas para el orquestador (reconciliación contra `architect.md`)

- **D1** (dónde viven las cuatro secciones en el stepper) solo afecta la forma exacta de
  TASK-010 — si el architect reparte las secciones en `risk`/`timing` en vez de un paso
  "Avanzado" nuevo, el resto del plan (TASK-006..009, TASK-012, TASK-014) no cambia porque los
  componentes de sección son agnósticos de en qué paso/lugar los monta el padre.
- **D2** (mecanismo de `apps/api`) es la única decisión que puede convertir TASK-002 en una task
  más chica (un test de igualdad de claves) o más grande (un `implements` que obligue a tocar
  varios tipos auxiliares del DTO) — si crece, el ajuste de horas es responsabilidad del
  orquestador al reconciliar, no una sorpresa para el implementador.
- **D3** (mecanismo de "solo lo cambiado") es la única decisión que puede convertir TASK-013 en
  una task de dos archivos (si el diff se computa en un hook compartido en vez de inline en
  `edit-agent-modal.tsx`) — el criterio de done no cambia, solo la ubicación del código.
- El mecanismo para `maxPositionHoldMinutes`/`entryTrailingDeltaBips` (pregunta abierta del
  funcional, resuelta por architect.md) afecta el shape del estado de TASK-005 y, en cascada, de
  TASK-006 (Protección) y TASK-009 (Entrada) — si el architect elige un interruptor sintético de
  UI, agrega un campo al estado del reducer pero no cambia la estimación de forma material.
- Si el architect decide que el `PUT` parcial de D3 también aplica a los 11 campos existentes (no
  solo a los 26 nuevos), TASK-013 gana alcance pero no cambia de task — el criterio de done ya
  cubre "modificar campos de dos secciones" de forma genérica.
