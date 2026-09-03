# spec-e-burgos-009 cycle-01 — 2026-09-03

## Estructura

- `src/types/trading-config-wire.ts` (nuevo): el wire completo de configuración del bot vive acá y
  sólo acá. `TradingConfigWire` (lo que devuelve `GET/POST/PUT /trading/config`),
  `CreateTradingConfigInput` (espejo exacto de los 40 campos de `CreateTradingConfigDto`),
  `UpdateTradingConfigInput` (38, espejo de `UpdateTradingConfigDto`: como Create pero sin `asset`
  ni `pair`; `isActive`, que no tiene columna, ya no existe en el DTO tras FIX-e-burgos-027) y
  `UpdateTradingConfigPayload` (lo que emite la UI: omite `mode` y admite `null` para limpiar
  `maxPositionHoldMinutes` y `entryTrailingDeltaBips`). Uniones de literales `TradingAssetWire`, `TradingQuoteWire`,
  `TradingModeWire`, `TradingIntervalModeWire`, `TradingRiskProfileWire`; `entryOrderMode` reusa
  `EntryOrderMode`.
- Particiones `TRADING_CONFIG_BASE_FIELDS` (15) y `TRADING_CONFIG_ADVANCED_FIELDS` (25) con sus
  tipos derivados, y los helpers de compilación `ExactKeys`/`AssertNoKeyDrift`: `apps/api` ata sus
  DTOs con `implements` + un alias de exactitud de claves, y `apps/web` deriva su catálogo y su draft
  de la partición. **Un campo agregado en un solo lado rompe el typecheck** (`TS2344`) — es el
  mecanismo que reemplaza a la interfaz local que `apps/web` mantenía desde el inicio.
- `TradingConfigData` (14 campos, previa) sigue existiendo para los consumidores viejos; los nuevos
  usan el wire.

## Qué sigue

- Retirar `TradingConfigData` cuando ningún consumidor la importe.
