# FIX-e-burgos-027 — UpdateTradingConfigDto.isActive no tiene columna en TradingConfig: un PUT que lo incluya responde 500

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-027                                   |
| **Tipo**      | BUGFIX                                   |
| **Severidad** | low                                   |
| **Keyword**   | [BUGFIX]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | implemented                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (hallazgo del architect, cycle-01) |

## Problema

UpdateTradingConfigDto declara isActive (trading-config.dto.ts ~615) pero el modelo TradingConfig no tiene esa columna; como updateConfig hace data: { ...dto } con as any, un PUT con isActive termina en PrismaClientValidationError (500). El tipo local de apps/web lo declaraba como si el GET lo devolviera (architect de spec-009, H2).

## Justificación del bypass

Un PUT valido segun el DTO no puede responder 500. Un campo del DTO.

### Archivos a modificar

- `apps/api/src/trading/dto/trading-config.dto.ts`
- `apps/api/src/trading/trading.service.ts`

### Test de validación

- **Referencia:** Test unitario: un PUT con isActive responde 400 (campo retirado del DTO, forbidNonWhitelisted) o se ignora explicitamente; el spread hacia prisma nunca incluye claves fuera del modelo.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
