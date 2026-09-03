# FIX-e-burgos-016 — El workflow de deploy no puede abrir SSH al VPS: el firewall sólo admite la IP del operador

| Campo         | Valor                                   |
| ------------- | --------------------------------------- |
| **ID**        | FIX-e-burgos-016                        |
| **Tipo**      | HOTFIX                                  |
| **Severidad** | high                                    |
| **Keyword**   | [HOTFIX]                                |
| **Fecha**     | 2026-09-02                              |
| **Autor**     | e-burgos                                |
| **Estado**    | validated                               |
| **Spec**      | N/A (repo-level, infra de spec-e-burgos-008) |

## Problema

El primer push a `main` con `deploy.yml` activo (cierre de spec-e-burgos-005 cycle-02, commit
`60d3333c`) construyó y publicó las dos imágenes en GHCR y **falló en "Copiar compose, nginx, SQL de
init y scripts al VPS"** con `dial tcp 2.29.24.221:22: i/o timeout`. Causa verificada contra la API
de Hetzner: el firewall `crypto-trader-prod` (id `11552165`) admite TCP 22 **sólo desde
`181.87.108.160/32`**, la IP residencial del operador. Ningún runner de GitHub Actions puede alcanzar
`sshd`. El workflow **nunca había desplegado desde Actions**: `gh run list` muestra este run como el
único en `main`. Producción quedó intacta con la imagen anterior (healthy).

## Justificación del bypass

Producción bloqueada para cualquier deploy automático y la release de cycle-02 (interruptor apagado)
sin poder salir. Un archivo de workflow y un secret; sin entidades, endpoints ni código de aplicación.

## Solución aplicada

Dos pasos nuevos en `.github/workflows/deploy.yml`, con `FIREWALL_ID` en `env`:

1. **"Abrir SSH del firewall de Hetzner para la IP del runner"**, antes de la copia por SCP: lee la IP
   pública del runner (`api.ipify.org`), obtiene las reglas vigentes del firewall por API, descarta
   cualquier regla previa `gh-runner-*` (limpieza de corridas abortadas), agrega
   `in tcp 22 <runner_ip>/32` con descripción `gh-runner-<run_id>`, aplica con
   `actions/set_rules` y espera hasta 60 s a que el puerto responda.
2. **"Cerrar SSH del firewall para el runner"**, `if: always()`, último paso: vuelve a leer las
   reglas, elimina todas las `gh-runner-*` y aplica. La regla del operador no se toca.

Requiere el secret **`HETZNER_API_TOKEN`** en el repositorio (el token ya existe en
`.env.production`; **no** estaba en el mapa de `infra/scripts/github-secrets-sync.sh`, que se
actualiza en este fix para que futuras sincronizaciones lo incluyan).

### Archivos modificados

- `.github/workflows/deploy.yml` — apertura y cierre transitorios del puerto 22 para el runner
- `infra/scripts/github-secrets-sync.sh` — `HETZNER_API_TOKEN` agregado al mapa de secrets
- `docs/infra/hetzner-server.md` — nota en §3 Firewall sobre la regla transitoria `gh-runner-*`

### Test de validación

- **Referencia:** el propio run de `deploy.yml` en `main` tras el fix: pasos "Abrir SSH…" y
  "Verificar desde internet" en verde, y `GET /v1/firewalls/11552165` sin reglas `gh-runner-*` al
  terminar. No hay test unitario posible: es infraestructura.

### Decisión del Reviewer

> Revisado por sdd-reviewer el **2026-09-03** — evidencia ejecutada, no leída.
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia:** Runs de `deploy.yml` en `main` **33757979227** (2026-09-03) y **33696910696** (2026-09-02), job `build-and-deploy` en `success` con los pasos 10 "Abrir SSH del firewall de Hetzner para la IP del runner", 12 "Desplegar", 13 "Verificar desde internet" y 14 "Cerrar SSH del firewall para el runner" los cuatro en `success`; `GET /api/health` a través de internet → 200 `{"status":"ok","database":"up","redis":"up"}` (2026-09-03T17:05:55Z). El firewall no se tocó durante la revisión.
