# Context Prompt — libs/shared

> Entry point para agentes que trabajen sobre `libs/shared`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-01 | Fecha: 2026-08-19
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19)

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **3 ciclos SDD la tocaron**, todos aditivos — nada retrocompatible se rompió:
  - **spec-e-burgos-001 cycle-02** — `ExchangeOrderState`/`ExchangeOrderStatus` y `TradeRecord.decisionId`.
  - **spec-e-burgos-001 cycle-03** — `agent-wire.ts` (contrato único del wire de agentes) y `utils/fingerprint.ts` (huellas del gate determinista). Ver `constitution.md` §3.
  - **spec-e-burgos-004 cycle-01** — `TraderDataSourceInfo` (EP-011).
- Rol: Types, DTOs, constantes y utilidades compartidas entre backend y frontend.
- Testear: `pnpm nx test shared`. Lint: `pnpm nx lint shared`.
