# spec-e-burgos-005 cycle-02 — 2026-09-01

## Estructura

- `OrderExecutorPort` pasa de **9 a 12 métodos**: `placeEntryOrder(req)` (un solo método con
  discriminante `mode`, `LIMIT_MAKER | OCO`), `getEntryOrderStatus(symbol, ref, { leg? })` y
  `cancelEntryOrder(symbol, ref)`. Los tipos viven en `libs/shared`.
- `LiveOrderExecutor` sigue tipando su dependencia **estructuralmente**: sumó cuatro firmas al objeto
  inline del constructor (`placeLimitMakerBuyOrder`, `placeOcoBuyOrder`, `getEntryOrderStatus`,
  `cancelEntryOrder`). `placeEntryOrder` ramifica por `req.mode`, mapea el OCO
  (`belowPrice = limitPrice`, `aboveStopPrice = stopPrice`, `abovePrice = stopLimitPrice`,
  `belowClientOrderId = cid-l`, `aboveClientOrderId = cid-s`) y **no valida ni redondea nada**: eso
  es del cliente. `trading-engine` sigue sin importar `data-fetcher`.
- `SandboxOrderExecutor` cumple el contrato en un `Map` en memoria (`sandbox-entry-{n}`, sin mover
  balances; `FILLED` cuando el precio seteado cruza `limitPrice` o `stopPrice`). Existe para testear
  el port: el modo SANDBOX **no** coloca entradas descansando (se construye nuevo en cada ciclo).
- **`src/lib/entry-levels.ts` — `resolveEntryLevels(input): EntryLevelPlan | null`**, pura. Soporte
  más cercano **estrictamente por debajo** de la referencia; fallback `ref × (1 + orderPriceOffsetPct)`
  usable **solo con offset negativo** (convención del repo: negativo = por debajo); sin pierna de
  abajo ⇒ `null` y el bot no compra (no cae a mercado). Para OCO, resistencia más cercana
  estrictamente por encima; sin pierna de arriba se **degrada** a `LIMIT_MAKER`
  (`degradedFromOco: true`). Verifica `limit < reference < stop` y no redondea (el tick es del
  cliente). `stopLimitPrice` no lo calcula: es `stopPrice × (1 + stopLimitOffsetPct)` en el llamador.
- `src/lib/risk/action-caps.ts`: `BotActionKind` suma **`ENTRY_CANCEL`** con exposición
  `REDUCING` — sale `allowed` antes de mirar cap alguno, como toda reducción. Colocación y fill de una
  entrada son ambos `kind: BUY` (distinguidos por `source`); no hay kind nuevo para el fill.
