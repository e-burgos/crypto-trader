# spec-e-burgos-001 cycle-03 — 2026-08-18

## Estado

Cierra el follow-up de riesgo que cycle-02 dejó como degradación aceptada: la orden de protección
nativa **ya se re-arma** cuando el trailing o el breakeven mueven el stop
(resuelve: "Qué sigue" de cycle-02 — la OCO obsoleta con take-profit zombie).
Último ciclo de la spec `spec-e-burgos-001`.

## Estructura

- `src/lib/position-manager.ts` — `resolveProtectionRearm(input): ProtectionRearmDecision`, función
  pura que decide `REARM` vs `NONE` con razón tipada (`DISABLED`, `SANDBOX`, `NOT_PROTECTED`,
  `NO_STOP`, `BELOW_THRESHOLD`). Umbral `PROTECTION_REARM_MIN_STOP_DELTA_PCT` = 0.1 % sobre el stop
  vigente, para no recolocar en cada tick. Rechaza explícitamente valores no finitos o ≤ 0 en vez
  de dejarlos propagar como `NaN`.
- El reparto es deliberado: la lib **solo decide**; cancelar y recolocar contra el exchange es
  orquestación de `apps/api` (`TradingProcessor.ensureNativeProtection`). La lib no conoce el
  cliente del exchange ni la persistencia.

## Qué sigue

- El contrato asume que quien orquesta trata la cancelación fallida como **posición desprotegida**
  y **no** recoloca: recolocar con la OCO vieja todavía viva es el camino a un `-2010` del
  exchange. Si aparece otro llamador de `resolveProtectionRearm`, debe respetar esa secuencia.
- `resolvePartialTakeProfit` sigue soportando **un solo** escalón de take-profit parcial por
  diseño; múltiples escalones quedan fuera de esta spec.
