# spec-e-burgos-010 cycle-01 — 2026-09-04

> ⚠️ Ciclo **in-progress, no aprobado**. El transporte que sigue está implementado y con tests
> unitarios verdes, pero **no funciona contra la Binance de hoy**: `POST /api/v3/userDataStream`
> devuelve `410 Gone` desde nginx, en `testnet.binance.vision` **y** en `api.binance.com`. El
> endpoint está retirado a nivel de infraestructura — no es un problema de firma, de API key ni
> de IP. Sin `listenKey` no hay socket. El consumidor en `apps/api` se entrega con el interruptor
> apagado. **No asumir que este cliente puede conectarse.**

## Estado

- `BinanceRestClient` expone el ciclo de vida del `listenKey`: `createListenKey()`,
  `keepAliveListenKey(listenKey)`, `closeListenKey(listenKey)`, sobre un `keyedRequest` privado
  "con API key y sin firma" (el header `X-MBX-APIKEY` ya lo pone el interceptor del constructor).
  Los tres devuelven `410` hoy.
- `BinanceUserDataStreamClient` nuevo: socket single-stream `/ws/<listenKey>`, parseo de
  `executionReport` a `ExecutionReportEvent` tipado, heartbeat ping/pong con `terminate()` al
  vencer el pong, reconexión con backoff exponencial + jitter, y evento `stream-expired` con
  razón `LISTEN_KEY_EXPIRED` o `RECONNECT_EXHAUSTED`. **Nunca se conectó a un stream real.**
- Harness TESTNET opt-in `binance-user-data-stream.testnet.spec.ts`, gateado por
  `BINANCE_TESTNET_E2E=1` y con aborto si `getBaseUrl()` no es la URL de testnet. Su única
  corrida abortó en `createListenKey` con el `410`. Queda `skipped` en la suite normal.

## Estructura

- `binance/binance-user-data-stream.client.ts` — el cliente WS. El `listenKey` entra como
  **argumento de `connect()`**, se guarda en un campo privado `#listenKey`, sin getter y sin
  `toJSON`: la única forma de que se filtre sería loguear el objeto de error de axios, y por eso
  el consumidor sólo loguea `getBinanceErrorCode(err)` + `err.message`.
- `binance/index.ts` — exporta el cliente, `BINANCE_USER_STREAM_WS_URL`,
  `BINANCE_TESTNET_USER_STREAM_WS_URL` y los tipos de evento (`ExecutionReportEvent`,
  `StreamExpiredEvent`, …).
- `ENDPOINT_WEIGHTS` — tres entradas nuevas para `/api/v3/userDataStream` (POST/PUT/DELETE) con
  peso **2 declarado, no medido**: medirlo exige un `listenKey` vivo, que hoy no se puede obtener.

## Dependencias

Ninguna nueva. `ws` y `axios` ya estaban en el manifiesto de la lib.

## Qué sigue

- La alternativa viva de Binance es el user data stream de la **WebSocket API**
  (`userDataStream.subscribe` sobre el socket de la API, autenticado con **Ed25519**), un
  transporte distinto que necesita una clave que el dev debe crear. Es una decisión humana
  pendiente, no un pendiente técnico de la lib.
- `BinanceUserDataStreamClient` emite `'error'` sin que su consumidor registre listener para ese
  evento — en `EventEmitter` de Node eso tira la excepción y voltea el proceso. Mismo patrón
  preexistente entre `BinanceWsClient` y `MarketStreamService`; conviene cerrarlo en los dos.
