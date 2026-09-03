# Spec e-burgos-009 — Configuración avanzada del agente y entradas descansando en la SPA

> **Autor:** e-burgos · **Fecha:** 2026-09-03 · **Estado:** in-progress
> **Módulo:** agent-advanced-config-ui
> **Subproyectos:** `apps/web`, `libs/shared`, `libs/ui`

## 1. Contexto y diagnóstico

Cuatro specs (001, 004, 005 y 008) agregaron al backend capas enteras de comportamiento del bot:
corte de pérdida por señal, sizing inteligente, protección nativa, trailing, take-profit parcial,
gate determinístico, loop reactivo con caps y, en spec-005 cycle-02, órdenes de entrada descansando
en el exchange. **Todas nacieron apagadas y todas se encienden hoy únicamente por API.** La SPA nunca
las alcanzó: la deuda de UI se difirió explícitamente en spec-001 y volvió a diferirse en spec-005.

### Hallazgos (verificados contra el código el 2026-09-03)

**A. La SPA expone 11 de los 40 campos de configuración.** `CreateTradingConfigDto`
(`apps/api/src/trading/dto/trading-config.dto.ts`) declara 40 campos. El stepper de alta
(`apps/web/src/components/config/new-agent-stepper-modal.tsx`, pasos preset → identity →
thresholds → risk → timing → review) y el modal de edición (`edit-agent-modal.tsx`) exponen
exactamente los 11 originales: `name, asset, pair, mode, buyThreshold, sellThreshold, stopLossPct,
takeProfitPct, minProfitPct, maxTradePct, maxConcurrentPositions, minIntervalMinutes, intervalMode,
orderPriceOffsetPct, riskProfile`. Ninguno de los 26 interruptores y parámetros posteriores tiene
control: `lossCut*`, `smartSizing*`, `nativeProtectionEnabled`, `closeOnProtectionFailure`,
`stopLimitOffsetPct`, `trailingStop*`, `partialTp*`, `moveStopToBreakevenAfterPartial`,
`maxPositionHoldMinutes`, `deterministicGateEnabled`, `gatePriceChangePct`, `reactiveLoopEnabled`,
`maxActionsPerHour`, `minActionIntervalSec`, `entryOrderMode`, `entryOrderTtlMinutes`,
`entryTrailingDeltaBips`.

**B. `apps/web` redeclara el wire de configuración.** `apps/web/src/hooks/use-trading.ts:11`
declara una `interface TradingConfig` local con los 11 campos, y `libs/shared` sólo ofrece
`TradingConfigData` (`interfaces.ts:151`), congelada en los 14 campos de la primera versión. La
constitución de `apps/web` §3 lo prohíbe con razón: fue una interfaz local del wire de agentes la que
dejó pasar un renombre del backend hasta romper producción. Hoy cualquier campo nuevo del backend es
invisible para el typecheck del monorepo.

**C. Nada consume EP-017 ni los eventos de entradas.** `GET /trading/entry-orders` (spec-005
cycle-02) no tiene ningún lector en `apps/web` (`grep entryOrder apps/web/src` → 0 archivos). Los
eventos WebSocket `entry-order:placed|filled|expired|cancelled|missing|skipped` no están en
`use-websocket.ts`, y las notificaciones `entryOrderPlaced`, `entryOrderFilled` y
`entryOrderMissing` no tienen clave en `locales/es.ts` ni `en.ts`: i18next muestra la clave literal.

**D. El bot TESTNET de prueba lo confirma en producción.** El 2026-09-03 se creó por API un bot
`LIMIT_MAKER` en TESTNET; corrió sus ciclos correctamente, pero desde el dashboard no hay forma de
ver que su modo de entrada no es `MARKET`, ni de cambiarlo, ni de ver una entrada descansando si
el LLM decidiera BUY.

**E. `libs/ui` ya tiene las piezas.** `toggle-switch`, `slider-field`, `form-field`, `select`,
`info-tooltip`, `badge`, `data-table`, `filter-pills`, `pagination`, `tabs`, `key-value-row`,
`info-card` y `stepper` existen. El trabajo es de composición, no de primitivas nuevas.

## 2. Objetivo

Que el trader pueda **ver y operar desde la SPA todo lo que el bot ya sabe hacer**: configurar en el
alta y en la edición los interruptores y parámetros de protección, reflejos, loop reactivo y
entrada, agrupados y explicados, siempre apagados por defecto; y seguir las **entradas descansando**
del bot (nivel, estado, vencimiento, fill) en tiempo real, con sus notificaciones traducidas.

Sin cambiar ni un endpoint del backend: la spec consume EP-006, EP-007 y EP-017 tal como existen.

## 3. Alcance por ciclo

### Cycle-01 — Wire compartido y configuración avanzada del agente

1. **Wire único.** `libs/shared` publica el tipo del wire de `TradingConfig` completo (los 40 campos
   del DTO más los de lectura: `id`, `isRunning`, `createdAt`, `updatedAt`) y los DTOs de alta y
   edición como tipos; `apps/web` importa de ahí y elimina su `interface TradingConfig` local. El
   typecheck del monorepo vuelve a proteger el wire.
2. **Configuración avanzada en el alta y la edición**, agrupada en secciones con el mismo lenguaje
   que la documentación del producto: *Protección* (`nativeProtectionEnabled`,
   `closeOnProtectionFailure`, `stopLimitOffsetPct`, `trailingStopEnabled`, `trailingStopPct`,
   `trailingActivationPct`, `partialTpEnabled`, `partialTpTriggerPct`, `partialTpSellPct`,
   `moveStopToBreakevenAfterPartial`, `maxPositionHoldMinutes`), *Señal y tamaño* (`lossCut*`,
   `smartSizingEnabled`, `reduceSizeFactor`, `deterministicGateEnabled`, `gatePriceChangePct`),
   *Loop reactivo* (`reactiveLoopEnabled`, `maxActionsPerHour`, `minActionIntervalSec`) y *Entrada*
   (`entryOrderMode`, `entryOrderTtlMinutes`, `entryTrailingDeltaBips`). Cada interruptor muestra su
   estado real, arranca apagado en el alta, y los parámetros dependientes sólo se editan con el
   interruptor encendido. Los rangos del cliente son los del DTO.
3. **Reglas de coherencia visibles**: `entryOrderMode ≠ MARKET` sólo tiene efecto en LIVE/TESTNET
   (en SANDBOX se muestra deshabilitado con su explicación); `entryTrailingDeltaBips` sólo aplica a
   `OCO`; el modo de operación global manda sobre el `mode` del bot, como ya hace el stepper.
4. **Detalle del agente** (`agent-detail-modal.tsx`) muestra las cuatro secciones con sus valores.
5. **Locales** `es`/`en` completos para todo lo anterior y para las tres claves de notificación que
   faltan.

### Cycle-02 — Entradas descansando en el dashboard

6. **Vista de entradas** sobre EP-017: pestaña propia en Posiciones (o sección equivalente, decide el
   funcional) con nivel, estado, notional comprometido, vencimiento, y, si llenó, pierna y precio;
   filtros por estado y por bot; paginado por cursor; estados desconocidos degradan a neutro.
7. **Tiempo real**: `use-websocket.ts` invalida la consulta de entradas ante `entry-order:*`, y el
   detalle del agente muestra su entrada `RESTING` vigente si la hay.
8. **Notificaciones** `entryOrderPlaced`, `entryOrderFilled`, `entryOrderMissing` traducidas y
   con enlace a la vista.
9. **E2E**: la suite cubre las cuatro secciones nuevas y la vista de entradas, headless, sin depender
   de claves externas.

## 4. No-objetivos (fuera de esta spec)

- Cualquier cambio de endpoint, DTO o comportamiento del backend. Si un campo del DTO resulta
  ininteligible para la UI, se registra como fix, no se cambia acá.
- Encender ningún interruptor por defecto. Nacen apagados en el alta; la edición muestra el estado real.
- Cancelar una entrada descansando desde la UI: exige un endpoint nuevo (no existe `DELETE
  /trading/entry-orders/:id`); va a una spec posterior si se justifica.
- Nuevas primitivas en `libs/ui` salvo que una composición lo exija y la regla 3 de
  `frontend-component-rules` lo mande.
- Rediseño del stepper: se agregan pasos o secciones, no se reordena lo existente.

## 5. Restricciones de diseño (heredadas, no negociables)

- `frontend-component-rules`: catálogo de `libs/ui` primero; componentes con lógica de negocio en
  `apps/web/src/components/<feature>/`; las páginas no contienen subcomponentes internos.
- Constitución de `apps/web`: datos del servidor sólo por TanStack Query; todo texto por `t()`;
  tipos del wire desde `@crypto-trader/shared`, nunca redeclarados; un valor de wire fuera del union
  degrada a `unknown`, jamás rompe el render; criterio de done = test de comportamiento sobre un
  fixture del wire real, no sólo `tsc`.
- Constitución de `libs/shared`: cambios aditivos; `apps/api` y `apps/web` importan el mismo tipo.
- Todo interruptor de trading nace apagado (constitución de `apps/api` §4): la UI no puede
  preseleccionar `true` en el alta.
- Código sin comentarios narrativos; `pnpm sdd:validate` verde tras cada escritura en `sdd/`.
- Nada de esta spec toca el exchange; la verificación es de UI: Vitest sobre fixtures del wire y E2E
  headless contra la API local. Nunca abrir browsers visibles en la máquina del dev.

## 6. Criterios de aceptación de la spec

- **CA-001** El typecheck del monorepo falla si `apps/api` agrega un campo al DTO de configuración
  y `apps/web` no lo contempla: `apps/web` no declara ningún tipo local del wire de configuración.
- **CA-002** Un agente creado desde el stepper sin tocar la configuración avanzada produce
  exactamente el mismo `POST /trading/config` que hoy (mismos campos, ningún interruptor en `true`).
- **CA-003** Cada uno de los 26 campos avanzados se puede leer y modificar desde la edición, y el
  `PUT` resultante contiene sólo los campos cambiados, dentro de los rangos del DTO.
- **CA-004** Con `mode = SANDBOX` el control de `entryOrderMode` está deshabilitado y explica por qué;
  con `LIVE`/`TESTNET` ofrece `MARKET | LIMIT_MAKER | OCO`, y el `trailingDelta` sólo con `OCO`.
- **CA-005** La vista de entradas renderiza un fixture con los cinco estados y un estado desconocido
  sin romper, con filtros y paginado por cursor funcionando sobre EP-017.
- **CA-006** Un evento `entry-order:*` recibido por WebSocket refresca la vista sin recargar.
- **CA-007** Las tres claves de notificación existen en `es` y `en`; ninguna pantalla muestra una
  clave literal de i18n.
- **CA-008** E2E en CI verde con los nuevos specs, headless, sin claves externas.
