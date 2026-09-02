# FIX-e-burgos-020 — La suite E2E está desactualizada contra la UI actual

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-020                        |
| **Tipo**      | BUGFIX                                  |
| **Severidad** | medium                                  |
| **Keyword**   | [BUGFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | en curso                                |
| **Spec**      | N/A (repo-level, CI)                    |

## Problema

Con el login arreglado (FIX-e-burgos-019), `E2E Tests` ejecutó por fin la suite y falló en 10 de los
20 archivos de `e2e/`: 30 fallos en el primer corte de CI (`maxFailures: 30`, run 33640820190) y 286
en la corrida completa de 60 minutos. Reproducido headless en local contra el build de producción:
son **selectores y textos que ya no coinciden con la UI**, no problemas de entorno. Ejemplos:
`getByLabel(/password/i)` matchea dos elementos (input y botón de mostrar contraseña) y Playwright
lo rechaza en modo estricto; `/docs` no tiene heading que matchee `help|faq|guide|docs`; textos y
rutas del panel de agentes cambiaron. Los specs se escribieron en abril contra un entorno local con
claves y no se actualizaron con los cambios de UI de las specs 001 a 008.

## Justificación del bypass

CI sin cobertura E2E útil: el check falla siempre. Mantenimiento de tests, sin cambios de aplicación
salvo que un test destape un bug real, que se registra aparte.

## Solución aplicada

- **Gate de clave LLM en CI:** `llm-key-guard.tsx` redirige toda ruta autenticada a
  `/dashboard/settings/llms` si el usuario no tiene ninguna credencial LLM activa; en CI los usuarios
  sembrados no tenían ninguna y todo test autenticado fallaba, mientras en local el trader sí tenía
  claves. `seed.ts` siembra ahora, sólo con cuentas demo, una credencial OpenRouter **placeholder**
  (`upsert` con `update: {}`, nunca pisa una clave real). El helper `hasUsableLlmProvider` de E2E pasa
  a exigir `validate-all` con un proveedor `ACTIVE` verificado en vivo, así la clave placeholder no
  habilita los bloques que necesitan un LLM real.

Se actualizan los specs para que afirmen el comportamiento vigente, sin debilitar aserciones para
"que pasen": selectores estrictos, textos actuales, rutas actuales, y `test.skip` con motivo cuando un
test depende de claves externas que CI no tiene. Todo se corre **headless**; el proyecto
`headed-debug` queda fuera salvo `PLAYWRIGHT_HEADED_DEBUG=1`.

### Archivos modificados

- `e2e/*.spec.ts`, `e2e/page-objects/*.ts` (los que correspondan)

### Test de validación

- **Referencia:** `CI=1 pnpm exec playwright test` headless contra API y build de la SPA locales con
  0 failed, y el run de `E2E Tests` en `main` posterior al cierre en verde.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
