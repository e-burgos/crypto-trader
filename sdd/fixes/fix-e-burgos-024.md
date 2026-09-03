# FIX-e-burgos-024 — El seed importó un módulo de `src/` y tiró producción: la imagen no lo contiene

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-024                        |
| **Tipo**      | HOTFIX                                  |
| **Severidad** | critical                                |
| **Keyword**   | [HOTFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level, infra)                 |

## Problema

El commit `4f8bab68` (FIX-e-burgos-020) hizo que `apps/api/prisma/seed.ts` importara
`../src/users/utils/encryption.util` para sembrar una credencial LLM placeholder en las cuentas demo.
El `CMD` del Dockerfile corre `prisma db seed` en **cada arranque del contenedor** y la imagen de
producción **no incluye `src/`** (copia `dist/`, `prisma/` y `generated/`): el seed falló con
`Cannot find module`, el contenedor entró en bucle de reinicio y producción respondió **502**
durante ~25 minutos (23:05 → 23:28 UTC). El import se evaluaba al cargar el módulo, así que
`SEED_DEMO_ACCOUNTS=false` no lo evitaba.

## Justificación del bypass

Producción caída. Una función en el seed.

## Solución aplicada

- **Restauración inmediata en el VPS:** `docker-compose.override.yml` con un `command` para `api`
  que corre `prisma migrate deploy` y arranca la API **sin** el seed; `up -d --force-recreate api`,
  nginx recreado, health `ok` a las 23:28 UTC. El override se retira una vez desplegada la imagen
  corregida.
- **Fix:** `seed.ts` cifra con `node:crypto` (AES-256-GCM, IV de 12 bytes, authTag anexado,
  base64), el mismo formato que `encryption.util.ts`, verificado con un round-trip contra el
  `decrypt` real. Ya no importa nada fuera de `prisma/`, `generated/` y `node_modules`.

### Archivos modificados

- `apps/api/prisma/seed.ts`

### Test de validación

- **Referencia:** round-trip `encryptLikeTheApi → decrypt` verificado localmente; el run de
  `deploy.yml` posterior al commit con la API healthy **sin** override, y `GET /api/health` `ok`.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `grep --line-number "src/" apps/api/prisma/seed.ts` no devuelve ningún import (única coincidencia: la nota de una línea que documenta el inline); los imports del seed son sólo `dotenv/config`, `../generated/prisma/*`, `bcrypt`, `./seed/agents` y `node:crypto`. En el VPS el 2026-09-03: `docker-compose.override.yml` **ausente** ("sin override") y `crypto-trader-api-1 Up 4 hours (healthy)`; `GET /api/health` → `status: ok`. El seed corre en cada arranque sin el módulo faltante.
