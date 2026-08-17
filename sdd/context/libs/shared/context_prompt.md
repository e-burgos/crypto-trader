# Context Prompt — libs/shared

> Entry point para agentes que trabajen sobre `libs/shared`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: cycle-02 | Fecha: 2026-08-17

- **Tipo:** lib
- **Estado:** proyecto pre-existente adoptado por el arnés SDD. **1 ciclo SDD completado** (spec-e-burgos-001 cycle-02, primero que toca esta lib): cambio pequeño y puramente aditivo — `ExchangeOrderState`/`ExchangeOrderStatus` y `TradeRecord.decisionId`. Nada retrocompatible se rompió.
- Rol: Types, DTOs, constantes y utilidades compartidas entre backend y frontend.
- Testear: `pnpm nx test shared`. Lint: `pnpm nx lint shared`.
