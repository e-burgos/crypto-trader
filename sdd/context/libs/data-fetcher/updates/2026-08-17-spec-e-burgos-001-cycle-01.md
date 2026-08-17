# spec-e-burgos-001 cycle-01 — 2026-08-17

## Estado

Un solo cambio, aditivo y retrocompatible: `BinanceRestClient.getKlines()` acepta un rango temporal
opcional. Habilita la consulta de **precio histórico en un instante dado**, que `apps/api`
(`MarketService.getPriceAt`) necesita para evaluar decisiones de agente contra precio real de mercado.

## Estructura

```ts
async getKlines(
  symbol: string,
  interval: CandleInterval,
  limit = 200,
  range?: { startTime?: number; endTime?: number },   // ← nuevo, opcional
): Promise<Candle[]>
```

`startTime`/`endTime` se pasan tal cual a `/api/v3/klines` y solo se agregan a los params cuando
vienen definidos. **Las 3 llamadas existentes (`getOhlcv`, `getSnapshot` y la del trading engine) no
cambian de firma ni de comportamiento.**

Patrón de uso desde el consumidor: pedir 3 velas de `1m` acotadas a `[at − 60s, at + 60s]` y quedarse
con la que cumple `openTime <= at <= closeTime`; si ninguna la contiene, el dato no existe (gap del
proveedor) y el llamador debe tratarlo como "no evaluable", no como precio 0.

## Dependencias

Ninguna nueva.

## Qué sigue

`BinanceWsClient` sigue exportado y sin importadores. **No se podó en este ciclo a propósito**: se
evalúa junto con la abstracción de exchange en `spec-e-burgos-002`.
