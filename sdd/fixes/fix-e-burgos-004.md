# FIX-e-burgos-004 — `BINANCE_KEY_ENCRYPTION_KEY` de `e2e.yml` tiene 35 caracteres y no 32 (mismo defecto que FIX-003)

| Campo         | Valor            |
| ------------- | ---------------- |
| **ID**        | FIX-e-burgos-004 |
| **Tipo**      | BUGFIX           |
| **Severidad** | medium           |
| **Keyword**   | [BUGFIX]         |
| **Fecha**     | 2026-08-30       |
| **Autor**     | e-burgos         |
| **Estado**    | validated        |
| **Spec**      | N/A (repo-level) |

## Problema

Al validar el cierre de FIX-e-burgos-003 se detectó el mismo defecto en un segundo
workflow. `.github/workflows/e2e.yml` exporta:

```yaml
BINANCE_KEY_ENCRYPTION_KEY: ci-encryption-key-exactly-32-chars!
```

Ese valor tiene **35 caracteres**, no 32. `getKey()` en
`apps/api/src/users/utils/encryption.util.ts` exige `KEY_LENGTH = 32` exacto y lanza
`BINANCE_KEY_ENCRYPTION_KEY must be exactly 32 characters` tanto para `encrypt()` como para
`decrypt()`.

`decrypt()` (que consume esta misma clave) se usa en `agent-config-resolver.service.ts`,
`provider-health.service.ts`, `llm-models.service.ts`, `trading.processor.ts`,
`trading.service.ts`, `chat.service.ts`, `data-source-credential-resolver.service.ts` y
`market.service.ts` — todos ellos en la ruta de código que las suites E2E de
`e2e/llm-provider-dashboard.spec.ts` y `e2e/dashboard.spec.ts` ejercitan contra el usuario
seed `admin@crypto.com`, que el propio spec documenta con credenciales GROQ ya guardadas.
El workflow **sí** necesita una clave de 32 caracteres válida — no es un valor decorativo
sin consumidor real.

`e2e.yml` está en `workflow_dispatch` (no corre en push/PR), lo que explica por qué el
defecto no bloqueó ningún merge todavía, a diferencia de FIX-003 que sí rompió CI. El
`fix_document` de FIX-e-burgos-003 declara como alcance únicamente
`.github/workflows/ci.yml` — no incluye `e2e.yml` — así que este es un fix nuevo y no una
ampliación de aquel.

## Justificación del bypass

Un archivo, una línea, sin contratos de API ni entidades nuevas: mismo precedente que
FIX-e-burgos-003. No justifica un ciclo SDD propio. No es bloqueante de producción (el
workflow no corre automáticamente todavía), pero es la misma clase de defecto latente que
FIX-003 corrigió en `ci.yml`: se corrige ahora para que la próxima corrida manual de E2E no
repita el diagnóstico.

## Solución aplicada

Reemplazar el valor por el mismo valor de 32 caracteres ya usado en `ci.yml` (consistencia
entre workflows):

```yaml
BINANCE_KEY_ENCRYPTION_KEY: ci-encryption-key-32-chars-long!
```

### Archivos modificados

- `.github/workflows/e2e.yml` — valor de `BINANCE_KEY_ENCRYPTION_KEY` a 32 caracteres
- `sdd/fixes.json` — registro de este fix
- `sdd/fixes/fix-e-burgos-004.md` — este documento

### Test de validación

- **Referencia:** no hay suite E2E corriendo en CI (workflow en `workflow_dispatch`), así
  que no hay test automático que reproduzca la falla en este repo. Verificación manual:
  ```
  python3 -c "print(len('ci-encryption-key-exactly-32-chars!'))"  # 35 (valor viejo)
  python3 -c "print(len('ci-encryption-key-32-chars-long!'))"      # 32 (valor nuevo)
  ```
  El mismo valor ya está validado en producción por el fix hermano: es el que
  `trader-data-sources.controller.spec.ts` ejercita en `ci.yml` (FIX-e-burgos-003).

### Decisión del Reviewer

> **`validated`** — sdd-reviewer, 2026-08-30, al cerrar
> `spec-e-burgos-005-reactive-execution-loop` cycle-01.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> Verificación ejecutada por el reviewer:
> `grep -rn BINANCE_KEY_ENCRYPTION_KEY .github/workflows/` devuelve el mismo valor de 32
> caracteres (`ci-encryption-key-32-chars-long!`) en `ci.yml:48` y en `e2e.yml:50` — los dos
> workflows quedaron consistentes y no queda ninguna otra ocurrencia del valor de 35.
>
> **Alcance que este fix NO cubre y que quedó abierto:** los dos fixes corrigieron la clave
> en los workflows, no la ausencia de un default en el setup de Jest. Un clon fresco sin
> `.env` sigue fallando `trader-data-sources.controller.spec.ts` en local. Se registró como
> FIX-e-burgos-005.

---
