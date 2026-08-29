# FIX-e-burgos-003 — `BINANCE_KEY_ENCRYPTION_KEY` de `ci.yml` tiene 35 caracteres y no 32

| Campo         | Valor            |
| ------------- | ---------------- |
| **ID**        | FIX-e-burgos-003 |
| **Tipo**      | BUGFIX           |
| **Severidad** | high             |
| **Keyword**   | [BUGFIX]         |
| **Fecha**     | 2026-08-29       |
| **Autor**     | e-burgos         |
| **Estado**    | implemented      |
| **Spec**      | N/A (repo-level) |

## Problema

El job `Lint & Test` de `.github/workflows/ci.yml` exporta:

```yaml
BINANCE_KEY_ENCRYPTION_KEY: ci-encryption-key-exactly-32-chars!
```

Ese valor, pese a llamarse a sí mismo "exactly-32-chars", tiene **35 caracteres**.
`getKey()` en `apps/api/src/users/utils/encryption.util.ts` exige exactamente
`KEY_LENGTH = 32` y lanza:

```
BINANCE_KEY_ENCRYPTION_KEY must be exactly 32 characters
    at getKey (src/users/utils/encryption.util.ts:10:11)
```

El valor está mal desde que se escribió el workflow, pero nunca falló porque **ningún
test recorría el `encrypt()` real con el entorno de CI**: los specs que tocan cifrado
setean su propia clave (`users.service.spec.ts` usa `dev-encryption-key-32-chars-long`,
32 correctos). El primer test que llega a `encrypt()` sin setearla es
`trader-data-sources.controller.spec.ts`, de `spec-e-burgos-004`, y destapó la trampa.

De ahí la discrepancia que hacía difícil el diagnóstico: la corrida local del autor daba
**62/62 verde** —en local la clave sale del `.env`, que sí es válida— mientras CI daba
**1 failed / 517 passed**.

## Justificación del bypass

Bloquea el merge del PR #58 con una falla que no pertenece a esa spec: el defecto está en
la configuración de CI, no en el código del ciclo. Un archivo, una línea, sin contratos de
API ni entidades nuevas — no justifica un ciclo SDD propio.

Se aplica **sobre la branch del PR** en vez de un PR aparte contra `main` porque así el PR
queda verde de inmediato y el arreglo llega a `main` con el mismo merge, sin encadenar
dependencias entre PRs.

## Solución aplicada

Reemplazar el valor por uno de 32 caracteres exactos:

```yaml
BINANCE_KEY_ENCRYPTION_KEY: ci-encryption-key-32-chars-long!
```

No hace falta un guard estático contra la regresión: el propio
`trader-data-sources.controller.spec.ts` es ahora el test que falla si la clave de CI
vuelve a tener una longitud inválida.

### Archivos modificados

- `.github/workflows/ci.yml` — valor de `BINANCE_KEY_ENCRYPTION_KEY` a 32 caracteres
- `sdd/fixes.json` — registro de este fix
- `sdd/fixes/fix-e-burgos-003.md` — este documento

### Test de validación

- **Referencia:** `apps/api/src/users/trader-data-sources.controller.spec.ts`
  → *UsersController — Trader Data Sources (Phase B) › setMyDataSourceCredential ›
  should save encrypted key and return masked value*
- **Reproducción de la falla:** con el valor viejo (35 chars) el spec falla con el mismo
  error exacto de CI (1 failed / 4 passed).
- **Verificación del fix:** con el valor nuevo (32 chars) ese spec pasa (5/5), y la suite
  completa de `api` corrida con todo el entorno de CI da **62 suites / 518 tests en verde**.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
