# Context Prompt — libs/data-fetcher

> Entry point para agentes que trabajen sobre `libs/data-fetcher`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD — sin ciclos SDD completados todavía.
- Rol: Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).
- Testear: `pnpm nx test data-fetcher`. Lint: `pnpm nx lint data-fetcher`.
