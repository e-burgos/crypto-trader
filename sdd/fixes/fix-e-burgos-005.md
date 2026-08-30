# FIX-e-burgos-005 — Un clon fresco no puede correr los tests de `apps/api`: `BINANCE_KEY_ENCRYPTION_KEY` no tiene default en el setup de Jest

| Campo         | Valor            |
| ------------- | ---------------- |
| **ID**        | FIX-e-burgos-005 |
| **Tipo**      | BUGFIX           |
| **Severidad** | medium           |
| **Keyword**   | [BUGFIX]         |
| **Fecha**     | 2026-08-30       |
| **Autor**     | e-burgos         |
| **Estado**    | pending          |
| **Spec**      | N/A (repo-level) |

## Problema

`apps/api/src/users/trader-data-sources.controller.spec.ts` falla en **todo clon fresco**
del repositorio, sin relación con la spec que se esté trabajando:

```
$ env -u BINANCE_KEY_ENCRYPTION_KEY pnpm exec jest --config apps/api/jest.config.js \
    apps/api/src/users/trader-data-sources.controller.spec.ts

● UsersController — Trader Data Sources (Phase B) › setMyDataSourceCredential ›
  should save encrypted key and return masked value

    BINANCE_KEY_ENCRYPTION_KEY must be exactly 32 characters
      at getKey (src/users/utils/encryption.util.ts:10:11)
      at encrypt (src/users/utils/encryption.util.ts:19:44)

Tests: 1 failed, 4 passed, 5 total
```

`getKey()` (`apps/api/src/users/utils/encryption.util.ts:8-13`) exige
`process.env.BINANCE_KEY_ENCRYPTION_KEY` con exactamente 32 caracteres. Ese spec es el
único que llega a `encrypt()` real sin setear la clave por su cuenta (los demás que tocan
cifrado la definen inline, p. ej. `users.service.spec.ts` con
`'dev-encryption-key-32-chars-long'`).

**Por qué nadie lo ve hasta que lo ve:**

| Entorno                     | Fuente de la variable                     | Resultado |
| --------------------------- | ----------------------------------------- | --------- |
| CI (`ci.yml:48`)            | `env:` del job (FIX-e-burgos-003)         | verde     |
| Local con `.env` completado | `.env` del dev                            | verde     |
| **Clon fresco sin `.env`**  | **ninguna — `apps/api/jest.config.js` no declara `setupFiles`** | **rojo**  |

`apps/api/jest.config.js` no tiene `setupFiles` ni `globalSetup`, y la variable solo aparece
documentada en `.env.example:19` como
`BINANCE_KEY_ENCRYPTION_KEY="<exactly-32-chars-secret-key-here>"` — un placeholder que ni
siquiera tiene 32 caracteres, así que copiar `.env.example` a `.env` **tampoco** arregla la
corrida.

Es la tercera aparición de la misma familia de defecto (FIX-e-burgos-003 en `ci.yml`,
FIX-e-burgos-004 en `e2e.yml`): aquellos dos corrigieron el **valor** de la clave en los
workflows; ninguno corrigió la **ausencia de un default** para la corrida local. El síntoma
es exactamente el que hizo perder el diagnóstico en FIX-003 — verde en local del autor,
rojo en otra máquina — solo que con los polos invertidos.

## Justificación del bypass

Defecto de infraestructura de tests, no de un contrato de negocio: no toca entidades,
endpoints ni componentes, y no hay historia de usuario que lo cubra. Un archivo de setup y
una línea en `jest.config.js`. Mismo precedente que FIX-e-burgos-003 y FIX-e-burgos-004.

No se arregló dentro de `spec-e-burgos-005` cycle-01 a propósito: el defecto es anterior al
ciclo y ajeno a su alcance (el spec que falla es de `spec-e-burgos-004`), y meterlo en el
cierre habría mezclado el diff del ciclo con una corrección de tooling.

## Solución propuesta

Dar a la suite de `apps/api` un default propio, para que no dependa del entorno del dev:

1. Crear `apps/api/src/test-setup.ts` que setee un valor de 32 caracteres **solo si la
   variable no viene ya del entorno**, de modo que CI siga usando el suyo:

   ```ts
   process.env.BINANCE_KEY_ENCRYPTION_KEY ||= 'test-encryption-key-32-chars-ok!';
   ```

2. Declararlo en `apps/api/jest.config.js`:

   ```js
   setupFiles: ['<rootDir>/src/test-setup.ts'],
   ```

3. Corregir el placeholder de `.env.example:19` por uno que efectivamente tenga 32
   caracteres, para que copiar el archivo deje un repo funcional.

**Criterio de aceptación del fix:**
`env -u BINANCE_KEY_ENCRYPTION_KEY pnpm exec jest --config apps/api/jest.config.js apps/api/src`
debe dar 666/666 en verde (hoy da 665/666 con 1 suite fallada).

### Archivos afectados (previstos)

- `apps/api/src/test-setup.ts` — nuevo
- `apps/api/jest.config.js` — `setupFiles`
- `.env.example` — placeholder de 32 caracteres reales
- `sdd/fixes.json` — registro de este fix
- `sdd/fixes/fix-e-burgos-005.md` — este documento

### Test de validación

- **Referencia:** `apps/api/src/users/trader-data-sources.controller.spec.ts`
  (`UsersController — Trader Data Sources (Phase B) › setMyDataSourceCredential › should
  save encrypted key and return masked value`) — es el único spec del repo que ejercita
  `encrypt()` sin declarar la clave, y por lo tanto el que reproduce y verifica el fix.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el próximo ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
