# Context Prompt — libs/data-fetcher

> Entry point para agentes que trabajen sobre `libs/data-fetcher`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-02 (2026-08-17) + spec-e-burgos-005 cycle-01 (2026-08-30) + spec-e-burgos-005 cycle-02 (2026-09-01) + spec-e-burgos-010 cycle-01 (2026-09-04)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD.
  - **spec-e-burgos-001** (2 ciclos): el cycle-01 sumó el rango temporal opcional de `BinanceRestClient.getKlines()` (lo usa `MarketService.getPriceAt` de `apps/api`); el **cycle-02** llevó el cliente de 1 a 8 operaciones de trading con validación local de filtros antes de firmar.
  - **spec-e-burgos-005 cycle-01** — `BinanceWsClient` dejó de ser capacidad dormida y pasó a ser el riel de mercado en vivo: heartbeat propio, suscripción dinámica e `isConnected()`. Las extensiones fueron **aditivas** — los 7 tests que ya existían siguen pasando sin tocarse y la suite del cliente WS pasó de 7 a 22 tests. 103 tests en verde en la lib. Ver `constitution.md` §3.
  - **spec-e-burgos-005 cycle-02** — el cliente pasó de 8 a 12 operaciones de trading para soportar entradas descansando en el exchange (`LIMIT_MAKER`/OCO de compra), con el filtro `TRAILING_DELTA` y el harness verificado **ejecutando** contra Binance TESTNET (`testnet-write-probe.md`). Primera vez que esta lib corre contra el exchange real, no contra un mock. Ver `constitution.md` §3-4.
  - **spec-e-burgos-010 cycle-01, cerrado sin aprobar (DEC-001).** El cliente sumó el ciclo de vida del `listenKey` (`createListenKey`/`keepAliveListenKey`/`closeListenKey`) y `BinanceUserDataStreamClient` para el user data stream clásico, implementados y con tests unitarios verdes contra dobles, pero **inertes**: Binance retiró `POST /api/v3/userDataStream` (`410 Gone` en TESTNET y en producción). DEC-001 mueve el transporte a la WebSocket API de Binance en cycle-02. Ver `constitution.md` §3.
- **Ya hay verificación contra TESTNET real** (harness `binance-rest.client.testnet.spec.ts`, §4) además del mock de transporte: todo lo que **no** se ejecuta contra testnet se verifica contra un mock de la capa de transporte —payload exacto, firma presente y consistente, y **assert de que el mock no fue invocado** cuando la orden se rechaza localmente. Los tests de heartbeat usan timers falsos y un doble del socket. Mantener ese criterio para cualquier operación nueva.
- Rol: Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).
- Testear: `pnpm nx test data-fetcher`. Lint: `pnpm nx lint data-fetcher`.

## Qué sigue

- El cliente sigue siendo específico de Binance spot: nada generalizó la interfaz. Futuros, leverage y `positionSide` siguen fuera de alcance (`spec-e-burgos-002`).
- El camino `STOP_LOSS_LIMIT` BUY con `trailingDelta` **sin** `stopPrice` queda soportado por el cliente (lo usa el harness de testnet) pero `apps/api` no lo usa todavía: el ciclo eligió siempre `stopPrice` + `trailingDelta` juntos para que el precio de disparo sea conocido de antemano.
- `BinanceUserDataStreamClient` emite `'error'` sin que su consumidor en `apps/api` registre listener para ese evento — en `EventEmitter` de Node eso tira la excepción y voltea el proceso. Mismo patrón preexistente entre `BinanceWsClient` y `MarketStreamService`; conviene cerrarlo en los dos.
