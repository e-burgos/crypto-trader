# FIX-e-burgos-018 — Retirar Railway y GitHub Pages del repo tras borrar la cuenta de Railway

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-018                        |
| **Tipo**      | IMPROVEMENT                             |
| **Severidad** | low                                     |
| **Keyword**   | [IMPROVEMENT]                           |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level, cierre de spec-e-burgos-008) |

## Problema

El dev borró la cuenta de Railway (2026-09-02). Desde spec-e-burgos-008 la API y la SPA viven en
el VPS de Hetzner en el mismo origen, pero el repo seguía cargando el rastro del esquema anterior:

- `railway.toml` en la raíz (builder y healthcheck de un servicio que ya no existe).
- `.github/workflows/deploy-web.yml`, que en cada push a `main` publicaba la SPA en GitHub Pages
  con `vars.VITE_API_URL` apuntando a la API de Railway: un frontend público contra una API muerta.
- README y `.env.example` describiendo Railway y GitHub Pages como producción.

## Justificación del bypass

Limpieza sin comportamiento de aplicación. Dejarlo publica una SPA rota en Pages en cada push.

## Solución aplicada

- Borrados `railway.toml` y `.github/workflows/deploy-web.yml`.
- README: tabla de stack, árbol de apps y tabla de despliegue apuntan al VPS y a `deploy.yml`.
- `.env.example`: el comentario de `TRUST_PROXY_HOPS` ya no menciona Railway.
- Los documentos históricos (`docs/CONSTITUTION.md`, `docs/plans`, `docs/specs`,
  `docs/infra/migration-hetzner-cloudflare.md`) y los registros SDD de spec-008 **no se tocan**: son
  historia, y así lo fija `CLAUDE.md`.

### Pendiente del dev (fuera del repo)

- Desinstalar la GitHub App de Railway del repositorio (el check `crypto-trader - api` que sigue
  apareciendo en cada commit).
- Deshabilitar GitHub Pages en los settings del repo, o borrar el sitio publicado.

### Archivos modificados

- `railway.toml` (borrado), `.github/workflows/deploy-web.yml` (borrado), `README.md`, `.env.example`

### Test de validación

- **Referencia:** `grep -ri railway README.md .env.example` sin resultados; el siguiente push a `main`
  ya no ejecuta "Deploy Web to GitHub Pages".

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** `grep -ri railway README.md .env.example` sin resultados; `railway.toml` y `.github/workflows/deploy-web.yml` ausentes (`.github/workflows/` = `ci.yml`, `deploy.yml`, `e2e.yml`, `sdd-validate.yml`); en el commit `98eeb204` el endpoint de status devuelve 0 contexts y los check-runs son sólo de `github-actions` (Build, Lint & Test, Validate SDD registries, Playwright E2E): ya no aparece ningún check de Railway.
>
> **Seguimiento:** Pendiente del dev fuera del repo: confirmar que GitHub Pages quedó deshabilitado (no verificable desde el repo; el check de Railway ya no aparece).
