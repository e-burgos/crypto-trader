# FIX-e-burgos-027 — UpdateTradingConfigDto.isActive no tiene columna en TradingConfig: un PUT que lo incluya responde 500

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-027                                   |
| **Tipo**      | BUGFIX                                   |
| **Severidad** | low                                   |
| **Keyword**   | [BUGFIX]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
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

> Cerrado por el sdd-reviewer al cerrar spec-e-burgos-009 cycle-02 (2026-09-04).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Validado originalmente al cerrar cycle-01 (2026-09-03) con
> `trading-config.dto.spec.ts`: `isActive` queda rechazado como `whitelistValidation` por el
> `ValidationPipe` real y ausente de las propiedades del DTO, sin regresión en los 25 tests de
> validación de body. Commit `0a277d97`.
> El último emisor pendiente que anotaba el fix — el tipo local del wire en `apps/web` — lo borró
> cycle-01 al publicar `TradingConfigWire` en `libs/shared`, y cycle-02 confirma que no volvió:
> ningún archivo de `apps/web` declara el shape del response. Sin seguimiento pendiente.
