# spec-e-burgos-005 cycle-01 — 2026-08-30

## Estado

Carpeta nueva `src/lib/reactive/` con las dos decisiones puras del loop reactivo de `apps/api`:
qué cuenta como evento material y cuándo el stream está sano. Mismo criterio que
`src/lib/gate/`: funciones síncronas, sin `fetch`/`prisma`/`await`, que reciben snapshots ya
construidos por el llamador. 158 tests en verde (`pnpm nx test analysis`).

## Estructura

- `src/lib/reactive/reactive-thresholds.ts` — `MaterialEventThresholds` +
  `DEFAULT_MATERIAL_EVENT_THRESHOLDS`. Mismo patrón que `DEFAULT_GATE_THRESHOLDS`: **ningún
  umbral lo elige el implementor, todos viven acá con nombre y default**. Excepción a la regla:
  `priceChangePct` se inyecta desde `TradingConfig.gatePriceChangePct` en runtime — el `0.005`
  del archivo es solo el espejo del default de la columna, no el valor efectivo.
- `src/lib/reactive/material-event.ts` — `detectMaterialEvent(input)`, tres tipos de evento:
  `PRICE_MOVED` (movimiento contra la referencia de la última decisión), `LEVEL_BREAK` (cruce
  confirmado de soporte/resistencia) y `VOLUME_SPIKE` (volumen de la vela en curso sobre el
  esperado). Devuelve **como máximo un evento** y **siempre** el `MaterialEventState` siguiente.
  - Es una función de estado explícito: `state` entra y sale, nunca se muta el objeto de entrada
    (hay test que lo consagra). El dueño del símbolo en `apps/api` guarda ese estado.
  - El umbral de precio es **el mismo `gatePriceChangePct` del gate determinista**, no uno
    propio: la spec prohíbe un segundo umbral de precio que compita con el existente.
  - `LEVEL_BREAK` usa histéresis (`levelConfirmDistancePct`): un precio dentro de la banda del
    nivel no confirma lado y no dispara, para que el ruido alrededor del nivel no genere N
    eventos.
  - `VOLUME_SPIKE` compara contra el volumen esperado **normalizado por la fracción transcurrida
    de la vela** (con piso `volumeMinElapsedFraction` para no dividir por ~0 al abrirla), y
    dispara **una sola vez por vela** (`lastVolumeEventCandleOpenTime`). No es un umbral
    absoluto: siempre relativo al propio símbolo.
  - Fail-closed: sin referencia, con referencia más vieja que `referenceMaxAgeMs`, o con
    `reference.close <= 0`, no hay evento.
- `src/lib/reactive/stream-health.ts` — `resolveStreamHealth(input)`. `UNKNOWN/NO_RECORD` cuando
  no hay registro, `DEGRADED/TICK_STALE` o `DEGRADED/HEARTBEAT_STALE` por antigüedad. **El
  estado nunca se infiere de que el precio no se mueva** (hallazgo F de la spec): se decide por
  edad del último tick y del último heartbeat, y quien lo lee trata `UNKNOWN` igual que
  `DEGRADED`.
- Barrels: `src/lib/reactive/index.ts` (nuevo) reexportado desde `src/index.ts`. El barrel
  público de esta lib es **`libs/analysis/src/index.ts`** — `libs/analysis/src/lib/index.ts` no
  existe (a diferencia de `libs/trading-engine`, que sí tiene el suyo en `src/lib/`).

## Dependencias

- `stream-health.ts` importa `StreamHealthRecord` / `StreamHealthState` de
  `@crypto-trader/shared`. Es la primera dependencia de esta lib sobre `shared` fuera de
  `src/lib/gate/`.

## Qué sigue

- Los 12 escenarios congelados del harness de costo (`apps/api/src/orchestrator/cost-harness/`)
  solo ejercitan `PRICE_MOVED`: 11 de ellos tienen extremos de precio estables y el único que
  adelanta es `broken-price-spike`. `LEVEL_BREAK` y `VOLUME_SPIKE` están cubiertos por los tests
  unitarios de esta lib, no por el harness. Ampliar los escenarios impacta también al harness
  hermano de costo de LLM: es trabajo de un ciclo, no de una task suelta.
