# FIX-e-burgos-030 — El modal de estado del agente muestra Detenido para un agente corriendo: pasa isActive false literal

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-030                                                      |
| **Tipo**      | BUGFIX                                                                |
| **Severidad** | medium                                                                |
| **Keyword**   | [BUGFIX]                                                              |
| **Fecha**     | 2026-09-04                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | validated                                                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (seguimiento del reviewer, cycle-02) |

## Problema

`AgentCurrentStateModal` (`apps/web/src/components/bot-analysis/agent-state-modal.tsx`) envuelve el
`AgentStateModal` de `libs/ui` y le pasa `config={{ ...config, isActive: false }}` como literal. El
wire `TradingConfigWire` ya trae `isRunning`, así que la fila **Estado** de la pestaña Estado muestra
"Detenido" aunque el agente esté corriendo.

## Justificación del bypass

Comportamiento visible incorrecto en la SPA. Es una línea que mapea `isRunning` a `isActive`; el
reviewer de spec-009 cycle-02 lo dejó como seguimiento porque la spec ya estaba cerrada.

## Solución aplicada

`config={{ ...config, isActive: config.isRunning }}` en el wrapper: la fila Estado del modal refleja
el estado real del agente. Fix puramente correctivo: sin cambios de contexto (no toca estructura,
patrones ni dependencias del subproyecto).

### Archivos modificados

- `apps/web/src/components/bot-analysis/agent-state-modal.tsx`
- `apps/web/src/components/bot-analysis/agent-state-modal.spec.tsx`

### Test de validación

- **Referencia:** `apps/web/src/components/bot-analysis/agent-state-modal.spec.tsx` — dos casos
  (`isRunning: true` → "Active", `isRunning: false` → "Stopped"). `pnpm nx test web -- agent-state-modal`
  2/2; `pnpm nx typecheck web` y `pnpm nx lint web` sin errores.

### Decisión del Reviewer

> Validado el 2026-09-04 tras reproducir el test en el main loop (2/2) y revisar el diff de una línea.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
