# spec-e-burgos-004 cycle-01 — 2026-08-19

## Estructura

`types/market-data-sources.ts` agrega `TraderDataSourceInfo`, el contrato del listado de fuentes
de datos que ve un trader (EP-011). Expone `hasOwnCredential` y `hasSharedCredential` como
booleanos ya derivados en el servidor: el frontend no infiere el estado de acceso ni recibe la
identidad del admin que comparte la credencial, ni la key.
