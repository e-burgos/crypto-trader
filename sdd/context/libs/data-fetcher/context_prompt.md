# Context Prompt — libs/data-fetcher

> Entry point para agentes que trabajen sobre `libs/data-fetcher`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **2 ciclos SDD completados** (spec-e-burgos-001). El cycle-01 sumó el rango temporal opcional de `BinanceRestClient.getKlines()` (lo usa `MarketService.getPriceAt` de `apps/api`); el **cycle-02** llevó el cliente de 1 a 8 operaciones de trading con validación local de filtros antes de firmar. 88 tests en verde (61 solo del cliente REST).
- **Sin acceso a testnet ni credenciales:** todo se verifica contra un mock de la capa HTTP —payload exacto, firma presente y consistente, y **assert de que el mock no fue invocado** cuando la orden se rechaza localmente. Mantener ese criterio para cualquier operación nueva.
- Rol: Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).
- Testear: `pnpm nx test data-fetcher`. Lint: `pnpm nx lint data-fetcher`.

## Qué sigue

- `BinanceWsClient` sigue exportado y sin importadores. **No se podó a propósito**: se evalúa junto con la abstracción de exchange en `spec-e-burgos-002`.
- El cliente sigue siendo específico de Binance spot: nada generalizó la interfaz. Futuros, leverage y `positionSide` siguen fuera de alcance (`spec-e-burgos-002`).
