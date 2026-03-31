# Spec 03 — Data Layer (Binance & News)

## Objetivo
Implementar librerías para fetch de datos de mercado (Binance) y agregación de noticias (CryptoPanic, CoinGecko, Reddit, RSS).

## Alcance
- `libs/data-fetcher/src/binance/`:
  - BinanceRestClient: OHLCV, balance, órdenes
  - BinanceWsClient: WebSocket de precios
  - BinanceRateLimiter
- `libs/data-fetcher/src/news/`:
  - CryptoPanicFetcher, CoinGeckoNewsFetcher, RedditFetcher, RssFetcher
  - NewsAggregator: dedup, cache Redis, tagging de sentimiento
- Tests unitarios: mocks HTTP, parsing, rate limit, cache

## Criterios de aceptación
- Todos los fetchers funcionan con mocks
- Agregador deduplica y cachea correctamente
- Branch: `feature/data-layer`

---

**Depende de:** 01-foundation
**Siguiente:** 04-trading-engine, 08-frontend-dashboard
