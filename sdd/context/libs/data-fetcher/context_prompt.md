# Context Prompt — libs/data-fetcher

> Entry point para agentes que trabajen sobre `libs/data-fetcher`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-30
> Fragmentos consolidados: spec-e-burgos-001 cycle-02 (2026-08-17) + spec-e-burgos-005 cycle-01 (2026-08-30)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD.
  - **spec-e-burgos-001** (2 ciclos): el cycle-01 sumó el rango temporal opcional de `BinanceRestClient.getKlines()` (lo usa `MarketService.getPriceAt` de `apps/api`); el **cycle-02** llevó el cliente de 1 a 8 operaciones de trading con validación local de filtros antes de firmar.
  - **spec-e-burgos-005 cycle-01** — `BinanceWsClient` dejó de ser capacidad dormida y pasó a ser el riel de mercado en vivo: heartbeat propio, suscripción dinámica e `isConnected()`. Las extensiones fueron **aditivas** — los 7 tests que ya existían siguen pasando sin tocarse y la suite del cliente WS pasó de 7 a 22 tests. 103 tests en verde en la lib. Ver `constitution.md` §3.
- **Sin acceso a testnet ni credenciales:** todo se verifica contra un mock de la capa de transporte —payload exacto, firma presente y consistente, y **assert de que el mock no fue invocado** cuando la orden se rechaza localmente. Los tests de heartbeat usan timers falsos y un doble del socket. Mantener ese criterio para cualquier operación nueva.
- Rol: Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).
- Testear: `pnpm nx test data-fetcher`. Lint: `pnpm nx lint data-fetcher`.

## Qué sigue

- El cliente sigue siendo específico de Binance spot: nada generalizó la interfaz. Futuros, leverage y `positionSide` siguen fuera de alcance (`spec-e-burgos-002`).
