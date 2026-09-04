# Context Prompt — libs/shared

> Entry point para agentes que trabajen sobre `libs/shared`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-09-04
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-005 cycle-01 (2026-08-30) + spec-e-burgos-005 cycle-02 (2026-09-01) + spec-e-burgos-009 cycle-01 (2026-09-03) + spec-e-burgos-009 cycle-02 (2026-09-04)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **7 ciclos SDD la tocaron**, todos aditivos — nada retrocompatible se rompió:
  - **spec-e-burgos-001 cycle-02** — `ExchangeOrderState`/`ExchangeOrderStatus` y `TradeRecord.decisionId`.
  - **spec-e-burgos-001 cycle-03** — `agent-wire.ts` (contrato único del wire de agentes) y `utils/fingerprint.ts` (huellas del gate determinista). Ver `constitution.md` §3.
  - **spec-e-burgos-004 cycle-01** — `TraderDataSourceInfo` (EP-011).
  - **spec-e-burgos-005 cycle-01** — vocabulario del riel de mercado en vivo (`MarketTick`, `MarketCandleTick`, `StreamHealthState`, `StreamHealthRecord`). Ver `constitution.md` §3.
  - **spec-e-burgos-005 cycle-02** — vocabulario de órdenes de entrada descansando en el exchange (`EntryOrderMode`, `EntryOrderRequest/Ref/Result`, `EntryOrderExchangeState/Status`). Ver `constitution.md` §3.
  - **spec-e-burgos-009 cycle-01** — `trading-config-wire.ts`: wire completo de configuración del bot (40 campos), particiones base/avanzado y helpers `ExactKeys`/`AssertNoKeyDrift` que atan DTOs de `apps/api` y catálogo de `apps/web`. Ver `constitution.md` §3.
  - **spec-e-burgos-009 cycle-02** — `entry-order-wire.ts`: wire de EP-017 con listas congeladas de estados, motivos, campos y eventos WS. Ver `constitution.md` §3.
- Rol: Types, DTOs, constantes y utilidades compartidas entre backend y frontend.
- Testear: `pnpm nx test shared`. Lint: `pnpm nx lint shared`.

## Qué sigue

- Retirar `TradingConfigData` cuando ningún consumidor la importe: convive con `TradingConfigWire` y es la única ambigüedad sobre cuál es el wire de configuración.
- La UI todavía no consume `StreamHealthState` — observable por `EP-015` y por el evento WS `market:stream-health`, sin pantalla que lo muestre.
