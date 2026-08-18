# spec-e-burgos-001 cycle-03 — 2026-08-18

## Estado

La lib pasa a ser la fuente única de dos contratos que antes se declaraban por duplicado en cada
consumidor: el **wire de agentes** y las **huellas (fingerprints)** que alimentan el gate
determinista. Cierra la spec `spec-e-burgos-001`.

## Estructura

- `src/types/agent-wire.ts` — contrato compartido del wire de agentes:
  `AGENT_SLOT_WIRE_IDS` / `AgentSlotWireId`, `ResolutionSource`
  (`override | user | admin | preset | credential`), `ResolvedAgentModelWire`,
  `AgentHealthItemWire`, `AgentHealthReportWire`.
  Existe por una causa concreta: `apps/web` declaraba su propia interfaz del response, así que el
  typecheck no detectó que cycle-02 había renombrado `agentId` → `slot` y `'fallback'` →
  `'preset'`, y la pantalla de agentes quedó rota en producción hasta este ciclo. Cualquier cambio
  del wire de agentes se hace **acá primero**; declarar la forma del response en el consumidor es
  el anti-patrón que este archivo previene.
- `src/utils/fingerprint.ts` — función pura `fingerprint()` (content-addressed, estable ante
  reordenamiento) usada para las huellas de posiciones, noticias y macro con las que el gate
  compara ciclo contra ciclo.

## Qué sigue

- El wire de **admin** (`/admin/agent-configs`) sigue con vocabulario `agentId` propio y no está
  cubierto por `agent-wire.ts`. Si se toca, unificarlo acá antes de que repita la misma clase de
  desalineamiento silencioso.
- `IndicatorSnapshot` (`src/types/interfaces.ts`) **no tiene `close`** — solo `Candle` lo tiene.
  Hay código que lo lee vía cast esperando un campo que en runtime nunca está poblado. Al
  consumirlo, pasar el precio de cierre explícito desde el último candle.
