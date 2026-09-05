# FIX-e-burgos-032 — CI en rojo en main: el test double de coordinación reactiva entra en el typecheck de la app y no conoce jest

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **ID**        | FIX-e-burgos-032                                                      |
| **Tipo**      | HOTFIX                                                                |
| **Severidad** | high                                                                  |
| **Keyword**   | [HOTFIX]                                                              |
| **Fecha**     | 2026-09-05                                                            |
| **Autor**     | e-burgos                                                              |
| **Estado**    | validated                                                             |
| **Spec**      | spec-e-burgos-010-user-data-stream-fills (follow-up del reviewer, cycle-02) |

## Problema

`apps/api/src/reactive/reactive-coordination.test-double.ts` (extraído en spec-010 cycle-01, commit
`6c0a76bf5`) usa `jest.fn()`, pero su nombre no matchea ninguna exclusión de
`apps/api/tsconfig.app.json` (`*.spec.ts`, `*.test.ts`, `__mocks__`). `pnpm typecheck:api` falla con
6 × `TS2304: Cannot find name 'jest'`, y como el job **CI** corre `pnpm typecheck`, `main` está en
rojo desde ese commit. `nx lint test` no lo detecta porque `tsconfig.spec.json` sí incluye el archivo.

## Justificación del bypass

CI bloqueado en `main`: ningún PR puede ponerse verde hasta corregirlo. Una línea de configuración.

## Solución aplicada

`src/**/*.test-double.ts` se suma a `exclude` de `apps/api/tsconfig.app.json`, al lado de `*.spec.ts`,
`*.test.ts` y `__mocks__`. El archivo sigue incluido por `tsconfig.spec.json` (`src/**/*.ts`), así
que los cuatro specs que lo importan compilan igual. Fix puramente correctivo: sin cambios de contexto.

### Archivos modificados

- `apps/api/tsconfig.app.json`

### Test de validación

- **Referencia:** `pnpm typecheck:api` exit 0; `pnpm nx test api --testPathPatterns=reactive-module-wiring|entry-fill-watch`
  en verde. El rojo previo: job CI "Typecheck all projects" en los runs de `main` de `8dc05abab` a `2c250ea54`.

### Decisión del Reviewer

> Validado el 2026-09-05 en el main loop: typecheck reproducido en rojo, en verde tras el cambio, tests de los consumidores en verde.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
