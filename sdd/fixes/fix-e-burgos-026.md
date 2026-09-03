# FIX-e-burgos-026 — createConfig descarta 22 de los 25 campos avanzados del DTO: el POST responde 201 y persiste los defaults

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-026                                   |
| **Tipo**      | BUGFIX                                   |
| **Severidad** | high                                   |
| **Keyword**   | [BUGFIX]                                 |
| **Fecha**     | 2026-09-03                              |
| **Autor**     | e-burgos                                |
| **Estado**    | in-progress                             |
| **Spec**      | spec-e-burgos-009-agent-advanced-config-ui (hallazgo del architect, cycle-01) |

## Problema

TradingService.createConfig (apps/api/src/trading/trading.service.ts ~255-274) arma el prisma.create campo por campo y solo copia los 15 base mas los 3 de entrada: un POST /trading/config con nativeProtectionEnabled true (o cualquiera de los otros 21 avanzados) responde 201 y persiste false. La edicion (updateConfig, spread del dto) si los toma. Descubierto por el architect de spec-009 cycle-01 (H1) al contrastar el DTO contra el create.

## Justificación del bypass

Bloquea el alta con configuracion avanzada de spec-009 cycle-01 y hoy hace que cualquier cliente de la API pierda campos en silencio. Un metodo del service.

### Archivos a modificar

- `apps/api/src/trading/trading.service.ts`
- `apps/api/src/trading/trading.service.spec.ts`

### Test de validación

- **Referencia:** Test unitario: createConfig con los 25 campos avanzados presentes pasa cada uno a prisma.tradingConfig.create; sin ellos, el create contiene exactamente los DEFAULTS actuales (equivalencia con el comportamiento previo).

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
