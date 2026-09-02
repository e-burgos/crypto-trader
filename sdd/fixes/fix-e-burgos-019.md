# FIX-e-burgos-019 — El workflow E2E fallaba en el login desde abril: base de API sin `/api` y el admin aterriza en `/admin`

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-019                        |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | medium                                  |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | implemented                             |
| **Spec**      | N/A (repo-level, CI)                    |

## Problema

`E2E Tests / Playwright E2E` fallaba en **todos** los runs desde 2026-04-13 (15 runs consecutivos
en `main` y en ramas). Los tres setups de autenticación (`e2e/global.setup*.ts`) agotaban el
`waitForURL('**/dashboard**')` y toda la suite quedaba sin ejecutar. No era una regresión del ciclo
de spec-005: el primer run tras ese merge sólo lo hizo visible.

Dos causas independientes, verificadas ejecutando la suite localmente:

1. **`e2e.yml` construía la SPA con `VITE_API_URL: http://localhost:3000`.** `apps/web/src/lib/api.ts`
   toma esa variable como base REST **con** el prefijo `/api` (`... || 'http://localhost:3000/api'`), así
   que el login iba a `http://localhost:3000/auth/login` → 404 y la página nunca navegaba. La captura
   del run muestra el formulario intacto y el ticker sin datos, coherente con todas las llamadas
   fallando.
2. **`global.setup-admin.ts` esperaba `/dashboard`**, pero el rol ADMIN aterriza en `/admin` desde
   que existe el panel de administración.

## Justificación del bypass

CI sin cobertura E2E durante cinco meses; dos líneas de configuración y un selector de URL, sin
código de aplicación.

## Solución aplicada

- `.github/workflows/e2e.yml`: `VITE_API_URL: http://localhost:3000/api` y `timeout-minutes: 60` (el primer
  run con el login arreglado fue cancelado por el tope de 30 min: la suite completa con `retries: 2`
  no entra en ese tiempo en el runner de GitHub).
- `e2e/global.setup-admin.ts`: `waitForURL(/\/(admin|dashboard)/)` y `toHaveURL(/\/(admin|dashboard)/)`.
- `playwright.config.ts`: el proyecto `headed-debug` (`headless: false`, `slowMo`) corría en todo
  `playwright test` sin `--project`, duplicando los specs multi-agent con un browser **visible** sobre
  las pantallas del dev. Queda incluido sólo con `PLAYWRIGHT_HEADED_DEBUG=1`.

### Archivos modificados

- `.github/workflows/e2e.yml`, `e2e/global.setup-admin.ts`, `playwright.config.ts`

### Test de validación

- **Local (2026-09-02):** API local + `pnpm exec playwright test` completa: **88 passed, 22 skipped,
  0 failed** en 9,4 min (antes de los cambios: los tres setups fallaban y nada corría).
- **CI:** el run de `E2E Tests` en `main` posterior a este commit.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
