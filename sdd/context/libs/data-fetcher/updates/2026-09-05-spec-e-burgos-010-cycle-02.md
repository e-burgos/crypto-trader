# spec-e-burgos-010 cycle-02 — 2026-09-05

## Estado

- La lib dejó de exponer el transporte del `listenKey` y expone en su lugar el cliente de la
  **WebSocket API** de Binance. resuelve: todo lo que el contexto base describe sobre
  `createListenKey`/`keepAliveListenKey`/`closeListenKey` y `BinanceUserDataStreamClient`.
- Borrados: `binance-user-data-stream.client.ts`, su spec, su harness TESTNET, y los tres helpers
  REST del ciclo de vida del `listenKey` en `BinanceRestClient` (con sus tests).
- El transporte nuevo se verificó **contra el exchange real de TESTNET** en su mitad sin
  credenciales: `ping` 200, `time` 200 con `serverTime`, y `userDataStream.subscribe` sin sesión
  rechazado con `-1193`. La mitad autenticada queda bloqueada por la ausencia de la clave Ed25519.

## Estructura

- `binance-ws-api.client.ts` — `BinanceWsApiClient` sobre `wss://ws-api.binance.com/ws-api/v3`
  (TESTNET `wss://ws-api.testnet.binance.vision/ws-api/v3`, constantes exportadas
  `BINANCE_WS_API_URL` / `BINANCE_WS_API_TESTNET_URL`). Correlación request/response por `id` con
  timeout por request, rechazo de todas las pendientes al cerrarse el socket, reconexión con
  backoff y jitter, ping aplicativo, y eventos `connected` / `disconnected` / `heartbeat` /
  `execution-report` / `session-lost` / `error`. Métodos: `connect`, `time`, `logon`, `logout`,
  `subscribeUserDataStream`, `unsubscribeUserDataStream`, `ping`, `disconnect`, `getBaseUrl`.
- `BinanceWsApiError` lleva `status`, `code`, `method` y el `msg` del exchange — **nunca** el
  request que falló, para que un log de error genérico no vuelque `apiKey` ni `signature`.
- `ed25519-signer.ts` — `buildSignaturePayload()` (claves ordenadas ascendente, `k=v` unidos por
  `&`, sin percent-encoding), `createEd25519Signer(pem, passphrase?)` que rechaza cualquier clave
  cuyo `asymmetricKeyType` no sea `ed25519`, y `redactWsApiRequest()` que enmascara `apiKey` y
  `signature`. El signer cierra sobre la clave y serializa a `{}`.
- `execution-report.ts` — `extractUserDataEvent()` acepta las dos envolturas posibles del evento
  empujado (`{ event: { e: 'executionReport', … } }` y el payload desnudo) e ignora respuestas
  request/response y cualquier otro `e`; `parseExecutionReport()` es el parser movido de cycle-01.
- `binance-ws-api.testnet.spec.ts` — harness opt-in (`BINANCE_TESTNET_E2E=1`), dividido en una
  mitad sin credenciales y una mitad autenticada que se auto-skipea con un mensaje explícito
  cuando falta la clave Ed25519. Aborta si la URL base no es la de TESTNET (WS y REST).

## Dependencias

- Sin dependencias npm nuevas: firma con `node:crypto`, socket con el `ws` que la lib ya usaba.

## Qué sigue

- La mitad autenticada del harness (`session.logon`, `subscribe` con sesión, `executionReport`
  real de un fill IOC, renovación y reconexión) sigue sin ejecutarse hasta que exista la clave
  Ed25519 de TESTNET.
- Los pesos de rate limit de la WebSocket API no se midieron: la sonda del orquestador solo
  observó `REQUEST_WEIGHT limit 6000`.
