# FIX-e-burgos-025 — `/market/snapshot` y `/market/enriched-snapshot` responden 500 cuando Binance no es alcanzable

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-025                        |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | low                                     |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level, api)                   |

## Problema

En los runners de GitHub Actions `api.binance.com` responde `451` (bloqueo geográfico). Con ese
upstream caído, `GET /api/market/snapshot/:symbol` y `GET /api/market/enriched-snapshot/:symbol`
responden **500 Internal Server Error** (trazas de red del run E2E 33696910664) en lugar de un
`503` con mensaje claro o un snapshot degradado. La SPA lo muestra como recurso fallido en consola
y el dashboard queda sin datos sin explicar por qué.

## Justificación del bypass

Bug real destapado por la suite E2E en CI (FIX-e-burgos-020). Se registra para no perderlo; los
monitores de consola de E2E ignoran mientras tanto los recursos de `/api/market/`.

### Archivos a modificar

- `apps/api/src/market/market.controller.ts` / `market.service.ts` (mapear el fallo del upstream a `503`)

### Test de validación

- **Referencia:** pendiente, test unitario del controller con el cliente de Binance rechazando.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `pnpm nx test api --testPathPatterns="market.service"` (2026-09-03): 4 suites / 26 tests passed. Contra producción con sesión TRADER el 2026-09-03: `GET /api/market/snapshot/FOOBAR` → **400** `Invalid symbol: FOOBAR. Must be one of BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC` (antes 500).
