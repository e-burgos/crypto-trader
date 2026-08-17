# Context Prompt — libs/data-fetcher

> Entry point para agentes que trabajen sobre `libs/data-fetcher`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **1 ciclo SDD completado** (spec-e-burgos-001 cycle-01): un único cambio, aditivo y retrocompatible — `BinanceRestClient.getKlines()` acepta un rango temporal opcional, que habilita consultar precio histórico en un instante dado (lo usa `MarketService.getPriceAt` de `apps/api` para evaluar decisiones contra precio real de mercado).
- Rol: Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).
- Testear: `pnpm nx test data-fetcher`. Lint: `pnpm nx lint data-fetcher`.

## Qué sigue

- `BinanceRestClient` solo implementa órdenes MARKET. El **cycle-02** agrega LIMIT / STOP_LOSS_LIMIT / OCO para protección nativa del exchange (spot), con sus reglas propias de lot-size y notional.
- `BinanceWsClient` sigue exportado y sin importadores. **No se podó a propósito**: se evalúa junto con la abstracción de exchange en `spec-e-burgos-002`.
