# FIX-e-burgos-011 — El modo de plataforma del usuario no se hace cumplir: se puede crear y arrancar un bot por encima de el

> Tipo: BUGFIX | Severidad: medium | Estado: implemented | Creado: 2026-08-31 | Resuelto: 2026-08-31

## Problema

`User.platformOperationMode` (SANDBOX/TESTNET/LIVE) se valida al cambiarlo: `users.service.ts:61` exige que existan las keys de Binance del modo destino. Pero ningun punto del backend impide crear, editar o arrancar una `TradingConfig` cuyo `mode` sea mas riesgoso que el modo de plataforma del usuario — `trading.service.ts` (`createConfig`, `updateConfig`, `startAgent`) nunca leia `platformOperationMode`.

Hoy el modo de plataforma es una preferencia de interfaz, no un limite. El frontend lo fuerza (el stepper de alta muestra el modo como campo de solo lectura tomado del modo global, y el selector de modo detiene los agentes del modo saliente antes de cambiar), pero un request directo a la API salta las dos barreras: se puede crear un bot LIVE con la plataforma en SANDBOX y arrancarlo.

## Decision de producto: el modo de plataforma es un techo

Se implemento la interpretacion conservadora — **techo**, no preferencia — con el orden `SANDBOX < TESTNET < LIVE`. Evidencia en el codigo que la sostiene:

1. `apps/web/src/components/config/new-agent-stepper-modal.tsx:296-325` — en el alta de un bot el modo **no es elegible**: se muestra en un recuadro de solo lectura con el texto "El modo se configura automaticamente segun el modo de operacion global seleccionado en el header", alimentado por `defaultMode={platformMode}` (`config.tsx:290`). El producto ya decidio que el modo del bot lo manda el modo de plataforma; lo que falta es que el backend lo sostenga.
2. `apps/web/src/containers/mode-selector.tsx:378-412` — cambiar de modo con agentes corriendo abre un modal "Detener y cambiar" que llama `stop-by-mode` **antes** del switch. La regla "no queden bots corriendo fuera del modo de plataforma" ya existe, pero solo del lado del cliente.
3. `docs/specs/branches/32-operation-mode-selector.md:23` — la spec que introdujo el campo declara como problema a resolver exactamente este riesgo: *"Un usuario podria creer que esta operando en SANDBOX cuando realmente su configuracion activa es LIVE"*.
4. Todas las vistas (`overview`, `positions`, `agent-log`, `trade-history`, `bot-analysis`) filtran por `platformMode`: un bot por encima del techo opera **invisible** para el usuario, que no lo ve en ninguna pantalla.

Contraevidencia registrada, y por que no cambia la decision: la misma spec 32 (lineas 241-242) pedia "pre-seleccionar el modo global como valor por defecto" y "warning visual si el usuario crea una config LIVE pero el modo global es SANDBOX" — es decir, preferencia + aviso. Pero (a) `docs/` esta explicitamente supersedido por el arnes `sdd/` y es referencia historica, y (b) la implementacion que finalmente se shippeo endurecio esa decision: no hay warning porque no hay eleccion, el campo es de solo lectura. Se siguio el codigo vigente, no el documento superado.

**Techo y no igualdad estricta:** un bot SANDBOX puede arrancar con la plataforma en LIVE. Prohibirlo no agrega seguridad (se estaria bloqueando la simulacion, que es el caso menos riesgoso) y romperia el uso legitimo de dejar un bot de prueba corriendo.

**Que pasa con los bots ya creados si el usuario baja el modo de plataforma:** se **rechaza el cambio** mientras haya agentes corriendo por encima del techo nuevo, con un mensaje que dice cuantos son. Se descarto pausarlos automaticamente: detener un bot deja sus posiciones abiertas sin cobertura (el propio `stop-all` lo advierte en su descripcion de API), y esa es una decision que le corresponde al usuario. Rechazar nunca produce el estado peligroso ni toma una accion destructiva por su cuenta, y el flujo del frontend ya detiene los agentes antes de pedir el cambio, asi que la UI no se ve afectada. Las configs guardadas **no** se borran ni se degradan: siguen existiendo, simplemente no arrancan hasta que la plataforma vuelva a su modo.

## Archivos afectados

- `apps/api/src/common/platform-operation-mode.ts` (nuevo)
- `apps/api/src/trading/trading.service.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/chat/chat.service.ts`

## Criterio de aceptacion

El modo de plataforma actua como techo (SANDBOX < TESTNET < LIVE): ninguna config puede crearse, editarse a un modo mas alto ni arrancarse por encima del modo de plataforma vigente del usuario, y el modo de plataforma no puede bajarse mientras haya bots corriendo por encima del techo nuevo.

## Resolucion

`apps/api/src/common/platform-operation-mode.ts` centraliza el orden de riesgo de los modos y expone `isModeWithinPlatformCeiling`, `modesAbovePlatformCeiling` y `assertModeWithinPlatformCeiling` (que lanza `BadRequestException`). Es una funcion pura, sin DI, para que la use cualquier modulo sin acoplar servicios.

Puntos de aplicacion — se cubrieron **las cuatro** rutas por las que un bot puede nacer o arrancar:

- `trading.service.createConfig` — antes de cualquier otra validacion.
- `trading.service.updateConfig` — solo si el update trae `mode`; un update que no toca el modo no paga la consulta.
- `trading.service.startAgent` — despues de resolver la config y antes de marcar `isRunning`.
- `chat.service.executeTool('start_agent')` — la rama de fallback que escribe `isRunning: true` directo cuando `TradingService` no esta inyectado (`@Optional()`); sin esto quedaba un bypass del techo por la herramienta de chat. La rama que delega en `TradingService.startAgent` queda cubierta por el gate anterior.

`users.service.updateOperationMode` suma el guard de bajada: cuenta las configs corriendo en los modos por encima del destino y rechaza el cambio si hay alguna. Se ejecuta **despues** de la validacion de keys existente, para no alterar el orden de errores que ya observaban los tests.

Fuera de alcance a proposito: `POST /trading/trigger-analysis` no se gateo — corre el ciclo multi-agente **sin ejecutar ordenes** (asi lo declara `triggerAnalysis`), asi que no puede mover dinero y bloquearlo seria endurecer mas alla del hallazgo. El `trading.processor` tampoco revalida el techo en cada ciclo: con el guard de bajada, un bot corriendo por encima del techo ya no puede existir.

## Verificacion

- `apps/api/src/trading/trading.service.platform-mode-ceiling.spec.ts` (nuevo, 8 tests): `startAgent` rechaza un bot LIVE con la plataforma en SANDBOX y en TESTNET, sin tocar la cola ni `isRunning`; arranca el bot cuyo modo coincide con la plataforma; **arranca un bot SANDBOX con la plataforma en LIVE**, que ancla el techo como techo y no como igualdad. `createConfig` rechaza la config LIVE bajo plataforma SANDBOX sin llegar al `create`. `updateConfig` rechaza subir el modo por encima del techo y no consulta el modo de plataforma cuando el update no toca `mode`.
- `apps/api/src/users/users.service.platform-mode-ceiling.spec.ts` (nuevo, 3 tests): no se puede bajar a SANDBOX con un agente corriendo por encima; si se puede cuando no hay ninguno; subir a LIVE no consulta agentes corriendo.
- `apps/api/src/chat/chat.start-agent-ceiling.spec.ts` (nuevo, 2 tests): la rama de `start_agent` que no delega en `TradingService` respeta el mismo techo.
- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 720/720 (682 de linea base + 38 nuevos entre este fix y FIX-e-burgos-010).
- `pnpm nx build api` compila; `pnpm nx lint api` sin errores.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: trading.service.platform-mode-ceiling.spec.ts: startAgent rechaza un bot LIVE con la plataforma en SANDBOX y en TESTNET sin tocar la cola ni isRunning, arranca el bot cuyo modo coincide y arranca un bot SANDBOX con la pl…
