# Constitución — libs/data-fetcher

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).

## 2. Stack tecnológico

- TypeScript, `rss-parser`, clientes HTTP/WS de Binance.

## 3. Estructura y patrones

- Depende solo de `libs/shared`. Consumida por `apps/api`, `libs/analysis` y `libs/trading-engine`.

## 4. Convenciones propias

- Tests: `pnpm nx test data-fetcher`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
