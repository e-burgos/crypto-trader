# spec-e-burgos-005 cycle-01 — 2026-08-30

## Estado

**`BinanceWsClient` dejó de ser capacidad dormida: ya tiene consumidor en producción.**
`apps/api/src/reactive/market-stream.service.ts` lo usa como riel de mercado en vivo.
_resuelve: `context_prompt.md` → "Qué sigue" → "`BinanceWsClient` sigue exportado y sin
importadores"._

Las extensiones fueron **aditivas**: los 7 tests que ya existían siguen pasando sin tocarse; la
suite del cliente WS pasó de 7 a 22 tests. 103 tests en verde en la lib
(`pnpm nx test data-fetcher`).

## Estructura

Cuatro capacidades nuevas en `src/lib/binance/binance-ws.client.ts`, todas opt-in por
configuración o por llamada explícita:

- **Heartbeat propio.** `ws.ping()` cada `wsPingIntervalMs` (default 30 s); si no llega `pong`
  en `wsPongTimeoutMs` (default 10 s) se hace `ws.terminate()` para que el `autoReconnect` que
  ya existía actúe. Resuelve el modo de falla real que tenía el cliente: **un socket TCP medio
  abierto produce silencio permanente y `close` nunca llega, así que `autoReconnect` no se
  disparaba nunca**. `on('ping')` y `on('pong')` emiten `heartbeat` `{ at }`.
- **`addStreams(streams)` / `removeStreams(streams)`.** Con el socket conectado envían
  `{ method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params, id }`; sin conectar solo actualizan la lista
  pendiente. Antes el conjunto de suscripciones **solo se podía fijar antes de `connect()`**, y
  el conjunto de símbolos activos cambia cada vez que un bot arranca o para.
- **`isConnected(): boolean`.**
- `BinanceWsConfig` suma `wsPingIntervalMs` y `wsPongTimeoutMs` (ambos opcionales).

Streams que consume `apps/api` por símbolo: `{symbol}@miniTicker` (precio, ~1/s) y
`{symbol}@kline_1h` (vela en curso). El intervalo de la kline **debe coincidir con el timeframe
del `IndicatorSnapshot`** (`getKlines('1h', 200)`): cambiarlo de un lado sin el otro deja al
detector de eventos comparando contra una referencia de otro timeframe.

## Dependencias

Ninguna nueva. El heartbeat usa la API de `ws` que ya estaba en el árbol.

## Qué sigue

- El criterio de la lib no cambió: **sin acceso a testnet ni credenciales**, todo se verifica
  contra un mock de la capa de transporte. Los tests de heartbeat usan timers falsos y un doble
  del socket; mantener ese criterio para cualquier operación nueva.
- El cliente sigue siendo específico de Binance spot. Futuros, leverage y `positionSide` siguen
  fuera de alcance.
