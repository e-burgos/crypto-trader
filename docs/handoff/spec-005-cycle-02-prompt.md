# Prompt de arranque — spec-e-burgos-005 cycle-02

> Pegá todo lo que sigue como primer mensaje de la sesión nueva.
> Generado 2026-09-01. Repo en `main`, HEAD `7c558ee1`, árbol limpio.

---

Vengo de una sesión donde cerramos la migración de infraestructura a Hetzner
(`spec-e-burgos-008`, 4 ciclos, completada). Ahora queda **la última spec abierta del
repo**: `spec-e-burgos-005-reactive-execution-loop`, cuyo **cycle-02 nunca se hizo**.

Quiero hacerlo **punta a punta**: abrir el ciclo, implementarlo, verificarlo y cerrarlo con
el reviewer. Y quiero que lo verifiques **contra Binance TESTNET antes de que ese código
toque una clave LIVE** — abajo te explico por qué no es una precaución genérica.

## Lo primero que tenés que leer

1. `CLAUDE.md` — la metodología SDD que rige el repo (SPEC GATE, FIX GATE, CONTEXTO GATE,
   MEMORIA GATE, y la regla de código sin comentarios narrativos).
2. `sdd/memory/lessons.md` — 101 líneas, se lee entero al inicio de cada sesión. Varias
   lecciones de ahí salieron de la sesión anterior y aplican directo a este trabajo.
3. `sdd/specs/spec-e-burgos-005-reactive-execution-loop/spec-e-burgos-005-reactive-execution-loop.spec.md`
   — la spec, con especial atención a **§3 Cycle-02** y a **§5 Restricciones de diseño**.
4. `sdd/context/apps/api/constitution.md` §3.4 y `sdd/context/libs/trading-engine/constitution.md`
   — los invariantes del loop reactivo y del motor de órdenes.

## El alcance real: §3 ítem 6 — "Reacción empujada al exchange"

> *Órdenes condicionales descansando también en la **entrada**: `LIMIT_MAKER` en nivel, OCO de
> entrada y `trailingDelta`, para que la reacción dispare en Binance aunque el servicio esté
> caído o reiniciando.*

Estado verificado del código al 2026-09-01:

```
trailingDelta        →  0 ocurrencias en todo el repo
LIMIT_MAKER          →  existe SOLO como `aboveType` interno del OCO de venta
                        (libs/data-fetcher/src/lib/binance/binance-rest.client.ts:666),
                        no como orden colocable
OCO                  →  `side: 'SELL'` hardcodeado (misma clase, línea 664)
OrderExecutorPort    →  9 métodos, ninguno de entrada condicional
                        (placeMarketOrder, getBalance, getPrice, placeLimitOrder,
                         placeStopLossLimitOrder, placeProtectionOrder,
                         getProtectionOrderStatus, cancelProtectionOrder, getOpenOrders)
```

La spec lo dice explícito y conviene tomarlo en serio: **no es un cableado, es una extensión
real** de `BinanceRestClient` y de `OrderExecutorPort` — y el port tiene **dos**
implementaciones, `LiveOrderExecutor` y `SandboxOrderExecutor` (`libs/trading-engine/src/lib/order-executor.ts:86` y `:326`),
así que todo lo que agregues va por duplicado.

## Buena noticia: la deuda del ciclo anterior ya está pagada

El `reviewer_report` de cycle-01 agendó **8 follow-ups a cycle-02**. Los verifiqué uno por uno
contra el código y **los 8 están resueltos** por fixes posteriores. **Esa lista está
desactualizada: no la tomes como trabajo pendiente.**

| # | Follow-up | Dónde quedó |
| --- | --- | --- |
| 1 | Sacar EP-015 del `TradingController` | Existe `StreamHealthController` propio en `src/reactive/` |
| 2 | `TradingModule` re-exporta `BullModule` | Está en `exports` |
| 3 | Query del ledger al service | `botAction.findMany` en `trading.service.ts:615` |
| 4 | `PassthroughActionGate` y params opcionales | Ninguno existe ya |
| 5 | Escenarios `LEVEL_BREAK` / `VOLUME_SPIKE` | Ambos en `cost-harness/scenarios.fixture.ts` |
| 6 | Unificar `$transaction` de wallet SANDBOX | Usa `positionAction.creditSandboxWallet` |
| 7 | `notifiedDegradations` antes del `await` | Revierte con `.delete()` en el `catch` |
| 8 | `BINANCE_KEY_ENCRYPTION_KEY` en tests | `FIX-e-burgos-005`, implementado |

**El ciclo es sólo la funcionalidad.**

## Por qué TESTNET primero — el argumento concreto

No es cautela de manual. Tres hechos que cambiaron desde que la spec se escribió:

1. **Hay dinero real conectado y verificado.** La cuenta trader tiene credenciales Binance
   LIVE activas; el balance leído desde el VPS fue **75,19 USDT reales**. TESTNET también está
   configurado, con 10.000 USDT + 10.000 USDC.
2. **El servidor se reinicia en cada deploy.** El workflow de GitHub Actions reconstruye y
   levanta la API en cada push a `main`. La ventana "servicio caído o reiniciando" que esta
   capa viene a cubrir **ocurre de verdad y seguido**.
3. **Esta capa es la única cuyo fallo no se puede deshacer desde el código.** Una orden mal
   colocada queda descansando en Binance y dispara sola. El resto del sistema, si se equivoca,
   se corrige con un deploy; esto no.

Además, la sesión anterior encontró **tres defectos críticos que llevaban meses en el árbol y
que ninguna suite detectaba** — entre ellos que el gate de riesgo AEGIS **fallaba abierto**
(`FIX-e-burgos-014`). Los tres aparecieron **ejecutando**, no leyendo. Asumí que este código
puede tener defectos que los tests no van a mostrar.

**Cómo quiero que se verifique, en este orden:**

1. Tests unitarios contra un mock de la capa de transporte. Es el criterio que
   `libs/data-fetcher` ya tiene y que su constitución exige: *"sin acceso a testnet ni
   credenciales, todo se verifica contra un mock — payload exacto, firma presente y
   consistente, y **assert de que el mock no fue invocado** cuando la orden se rechaza
   localmente"*.
2. **Contra TESTNET real**, con las credenciales que ya están cargadas en el usuario trader.
   Colocar, consultar y **cancelar** cada tipo de orden nuevo. Verificar que los filtros de
   símbolo (`LOT_SIZE`, `PRICE_FILTER`, `NOTIONAL`) se apliquen antes de firmar.
3. **Nunca en LIVE durante el ciclo.** Ni una sola orden. Si en algún momento creés que hace
   falta, pará y preguntame.
4. Antes de dar el ciclo por cerrado: **dejar el interruptor apagado**. Todo interruptor de
   comportamiento de trading nace apagado en la migración — es una regla del repo, no una
   sugerencia (`sdd/context/apps/api/constitution.md` §4).

## Restricciones que no se negocian

De `sdd/context/libs/data-fetcher/constitution.md` y `libs/trading-engine/constitution.md`:

- **`libs/trading-engine` NUNCA depende de `libs/data-fetcher`.** `LiveOrderExecutor` tipa su
  constructor **estructuralmente**; el vocabulario común de órdenes vive en `libs/shared`. Si
  necesitás un tipo nuevo compartido entre esas dos libs, va a `libs/shared`.
- **Se rechaza antes de firmar.** `getSymbolFilters` valida cantidad y precio contra
  `LOT_SIZE`/`PRICE_FILTER`/`NOTIONAL` y lanza `OrderValidationError` tipado. Toda orden nueva
  tiene que pasar por ahí — reintentar un `-1013` o un `-2010` es quemar el rate limit sin
  ninguna chance de éxito.
- **OCO por `/api/v3/orderList/oco`** (API vigente, `aboveType`/`belowType`), no el legacy.
- **`ENDPOINT_WEIGHTS` lleva los pesos reales.** Si agregás endpoints, agregá su peso.
- **Cancelar la protección antes de vender** sigue valiendo: una OCO viva bloquea el balance
  base. Cualquier camino nuevo que cierre posición tiene que llamar `releaseProtectionIfNeeded`.
- **`ActionGateService.authorizeAndRun` es la ÚNICA puerta de toda acción automática.**
  Cualquier punto de ejecución nuevo pasa por ahí, nunca llama al executor directo. Una orden
  condicional que dispara en el exchange **no pasa por esa puerta**, así que hay que decidir
  explícitamente cómo se contabiliza en `bot_actions` — no lo dejes implícito.

## Proceso SDD que espero que sigas

1. **SPEC GATE**: la spec ya existe y el módulo está en `in_progress_modules`. Falta crear
   `cycles/cycle-02/` con sus 6 documentos: `brief.yaml`, `functional.md`, `planner.md`,
   `architect.md`, `cycle.json` (con `status: "in-progress"` al abrir) y `tasks.json`.
2. Antes del brief, el orquestador **consolida los fragmentos pendientes** de
   `sdd/context/*/updates/` — hay varios de la migración sin consolidar.
3. `pnpm sdd:validate` tiene que quedar en verde después de **cada** escritura en `sdd/`.
   `pnpm sdd:rebuild-tasks-index` tras tocar `tasks.json`; `pnpm sdd:rebuild-catalog` tras
   tocar `sdd/memory/` o la estructura.
4. Al cerrar: fragmento aditivo en `updates/` de cada subproyecto tocado, entrada en
   `sdd/memory/journal/` **sólo si hubo lección real**, y `cycle.json` a `completed` con su
   `reviewer_report` y su `metrics.usage`.
5. Si aparece algo roto fuera del alcance del ciclo: **FIX GATE**, registrarlo en
   `sdd/fixes.json` + `sdd/fixes/` ANTES de tocar código. El próximo id libre es
   `FIX-e-burgos-016`.

## Estado del entorno

- **Producción andando**: `https://trader.estebanburgos.com.ar` — SPA en `/`, API en `/api`,
  WebSocket verificado. `GET /api/health` devuelve `{"status":"ok","database":"up","redis":"up"}`.
- **VPS Hetzner**: `ssh crypto-trader` (root) y `ssh crypto-trader-deploy`. Inventario completo
  y línea de base medida en `docs/infra/hetzner-server.md`.
- **Credenciales** en `.env.production` de la raíz (gitignoreado). `USER_USERNAME`/`USER_PASSWORD`
  son las del trader; `ADMIN_USERNAME`/`ADMIN_PASSWORD` las del admin.
- **`gh` requiere `gh auth switch --user e-burgos`** antes de cualquier operación, y volver a la
  cuenta original al terminar. Un 403 de `gh` es cuenta equivocada, no falta de permisos.
- **Deploy**: push a `main` dispara `.github/workflows/deploy.yml`, que construye, publica en
  GHCR, despliega y **verifica desde internet**. Los 11 secrets ya están cargados.
- **Suites**: `pnpm nx test api` da 755/755 en 88 suites. `apps/api/src/auth/auth.service.spec.ts`
  **es flaky bajo carga paralela** (bcrypt, 12 rondas): aislado pasa en ~5 s, en la suite completa
  llega a 29 s y a veces supera el timeout. Si falla sólo esa, reejecutala aislada antes de
  investigar.
- **CI bloquea**: lint, typecheck, `typecheck:api` y `test:all`.

## Gotchas que ya me costaron tiempo

- **Prisma 7 no toma la URL del schema**: el `datasource` sólo declara el provider y la URL sale
  de `apps/api/prisma.config.ts`.
- **El `CMD` del Dockerfile corre `prisma migrate deploy && prisma db seed`** antes de arrancar:
  las migraciones se aplican solas y no hay que duplicarlas en el workflow.
- **El typecheck no protege el `create` de Prisma en `trading.service.ts`** — hay un `any` de por
  medio. Un campo inexistente pasa el typecheck y estalla en runtime con
  `PrismaClientValidationError`.
- **Una columna creada por SQL crudo que no esté en `schema.prisma` la borra el próximo diff
  autogenerado.** Si agregás una, declarala (`Unsupported("tipo")` si Prisma no la tipa).
- **`apps/web` usa vitest, `apps/api` usa jest.** Los flags no son intercambiables.

## Cómo quiero que trabajes

- **Verificá antes de afirmar.** En la sesión anterior afirmé tres cosas con demasiada seguridad
  y las tres resultaron falsas. Si no lo comprobaste, decí que no lo comprobaste.
- **Ejecutá, no sólo leas.** Los defectos que importaron aparecieron corriendo el sistema. Un
  comentario o un test que afirma un invariante **no es evidencia**.
- **Decime qué necesitás de mí antes de cada tramo**, y no avances al siguiente sin el criterio
  de hecho del anterior.
- Cuando una decisión cambie el alcance, **registrala en la spec** como decisión con su
  razonamiento, no la resuelvas en silencio.

Arrancá leyendo lo que te indiqué y decime cómo pensás encarar el ciclo antes de escribir
código.
