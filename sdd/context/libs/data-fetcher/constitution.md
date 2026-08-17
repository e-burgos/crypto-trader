# Constitución — libs/data-fetcher

> Versión 1.1 | Última actualización: cycle-01 | Fecha: 2026-08-17

## 1. Propósito

- **Tipo:** lib
- **Rol en el sistema:** Obtención de datos externos: velas OHLCV y tickers de Binance (REST + WebSocket), noticias (CryptoPanic, NewsData.io) y RSS (CoinDesk, Cointelegraph, Decrypt).

## 2. Stack tecnológico

- TypeScript, `rss-parser`, clientes HTTP/WS de Binance.

## 3. Estructura y patrones

- Depende solo de `libs/shared`. Consumida por `apps/api`, `libs/analysis` y `libs/trading-engine`.
- `BinanceRestClient.getKlines()` acepta un rango temporal opcional (aditivo y retrocompatible; las llamadas de `getOhlcv`, `getSnapshot` y el trading engine no cambiaron):

  ```ts
  async getKlines(
    symbol: string,
    interval: CandleInterval,
    limit = 200,
    range?: { startTime?: number; endTime?: number },
  ): Promise<Candle[]>
  ```

  `startTime`/`endTime` se pasan tal cual a `/api/v3/klines` y solo se agregan a los params cuando vienen definidos. Patrón de uso para precio histórico en un instante: pedir 3 velas de `1m` acotadas a `[at − 60s, at + 60s]` y quedarse con la que cumple `openTime <= at <= closeTime`; si ninguna la contiene, el dato no existe (gap del proveedor) y el llamador debe tratarlo como "no evaluable", **nunca como precio 0**.
- `BinanceRestClient` implementa hoy solo órdenes MARKET. LIMIT/STOP_LOSS_LIMIT/OCO son alcance del cycle-02.

## 4. Convenciones propias

- Tests: `pnpm nx test data-fetcher`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
