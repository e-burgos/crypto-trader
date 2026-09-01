# Sprint Plan — Cycle 01: Servidor, datos y red de seguridad

> Spec: `spec-e-burgos-008-infra-hetzner-cloudflare` | Fases 1-3 | 2026-08-31

## Resumen del ciclo

| | |
| --- | --- |
| Tasks | 12 |
| Estimación | 24,5 h |
| Story points | 63 |
| Apps tocadas | `apps/api` (solo `infra/` y `.github/workflows/`; **cero archivos de `src/`**) |
| Criterios cubiertos | CA-001, CA-002, CA-003 |

**El ciclo tiene una particularidad:** la Fase 1 ya se ejecutó sobre el VPS el 2026-08-31, antes de
abrir la spec, porque no escribía nada en el repo. Sus tasks (TASK-001 a TASK-003) son de
**versionado y verificación**, no de ejecución: el trabajo existe, falta que sea reproducible.

## Orden de ejecución

```
TASK-001 ─┬─ TASK-002 ─── TASK-003          Fase 1: versionar lo ya hecho
          │
          └─ TASK-004 ─── TASK-005 ─── TASK-006 ─── TASK-007      Fase 2: base y cola
                                                        │
                              TASK-008 ────────────────┴─ TASK-009 ─┬─ TASK-010 ─── TASK-011
                              (decisión RPO, bloquea)                └─ TASK-012
                                                                        Fase 3: backups
```

**Dos bloqueos externos que no dependen del equipo:**

- **TASK-008 (RPO)** bloquea TASK-011: el cron no se puede escribir sin saber cada cuánto corre.
- **La cuenta de Cloudflare** (spec §7.2) bloquea TASK-010 a TASK-012 completas. Las Fases 1 y 2
  (TASK-001 a TASK-007) avanzan sin eso.

## Tasks

### Fase 1 — Versionar el provisioning

#### TASK-001: Llevar los scripts de provisioning al repo

Mover `provision-01-base.sh`, `provision-02-sshd.sh` y `provision-03-firewall.sh` desde el
scratchpad a `infra/scripts/`, con el encabezado de contrato del architect §3. Idempotencia
verificable: correrlos dos veces sobre el VPS no cambia nada.

`provision-02-sshd.sh` documenta **por qué** su archivo se llama `00-crypto-trader.conf`: el
`Include` está en la línea 24 de `sshd_config`, antes de `PermitRootLogin` (54), y en OpenSSH gana
el primer valor obtenido — un `99-` perdería contra `50-cloud-init.conf`, que trae
`PasswordAuthentication yes`.

- **US:** US-01-002 · **8 pts · 3 h**

#### TASK-002: Suite de shell del provisioning

`provision.test.sh`: verifica que los scripts son idempotentes (segunda corrida sin cambios), que
fallan si falta una variable requerida, y que ninguno contiene un secreto literal.

- **US:** US-01-002 · **5 pts · 2 h** · depende de TASK-001

#### TASK-003: Documentar el estado verificado del servidor

`docs/infra/hetzner-server.md`: inventario del CX23 (id, plan, región, SO, recursos), accesos,
firewall, y las mediciones de línea de base — latencia a `api.binance.com` (~263 ms), drift de
reloj (−140 ms), disco disponible. Es el punto de comparación cuando algo se degrade.

- **US:** US-01-001, US-01-002 · **3 pts · 1 h** · depende de TASK-001

### Fase 2 — Base y cola sin tráfico

#### TASK-004: `docker-compose.prod.yml` con Postgres y Redis

Los dos servicios según architect §1: `pgvector/pgvector:pg16` sin `ports:`, healthcheck que hace
`SELECT 1` contra `crypto_trader` (no `pg_isready`), tuning de DEC-08, volúmenes con nombre,
`logging` acotado. Redis con **`noeviction` + AOF** — la adaptación de DEC-02, que es lo que
distingue este compose del de la referencia.

- **US:** US-01-003 · **8 pts · 3 h** · depende de TASK-001

#### TASK-005: `infra/db/00-init.sql`

Crea la base `crypto_trader` y el rol de aplicación con su propia contraseña (`APP_DB_PASSWORD`),
sin privilegios de superusuario. La app **no se conecta como `postgres`**.

- **US:** US-01-003 · **3 pts · 1,5 h** · depende de TASK-004

#### TASK-006: Levantar el stack y aplicar las 37 migraciones

`docker compose up -d postgres redis` en el VPS y `prisma migrate deploy` desde un contenedor
efímero. Verificar que `CREATE EXTENSION vector` no falla — es lo que distingue esta imagen de
`postgres:16-alpine`, que muere con `P3018`.

- **US:** US-01-003 · **5 pts · 2 h** · depende de TASK-005

#### TASK-007: Verificar el aislamiento de red por evidencia

`prisma migrate status` al día, y **escaneo desde fuera del VPS** que confirma que 5432 y 6379 no
responden. RN-04: no alcanza con que el compose diga que no publica el puerto.

- **US:** US-01-003 · **3 pts · 1 h** · depende de TASK-006 · **cierra CA-002**

### Fase 3 — Backups antes que datos

#### TASK-008: Decidir y registrar el RPO

Presentar las tres opciones de architect §4 DEC-11 con su costo en disco y en trabajo, tomar la
decisión con el dueño y registrarla. **Bloquea TASK-011.**

- **US:** US-01-005 · **2 pts · 1 h** · sin dependencias — puede arrancar el día uno

#### TASK-009: Portar `db-backup.sh`

Adaptado a una sola base (DEC-01), conservando lo que no es de gusto: `pg_dump -Fc` por base y
nunca `pg_dumpall` (DEC-05), sin globals, sin herramientas nuevas en el host (DEC-06), guarda H-9,
`DRY_RUN` y `FAKE_TS`. **No se porta el conmutador `DB_BACKEND`**: acá no hay dos backends.

- **US:** US-01-004 · **8 pts · 3 h** · depende de TASK-006

#### TASK-010: Portar `db-restore.sh` y las dos suites de shell

`--dbname` obligatorio, sin default. Las suites `db-backup.test.sh` y `db-restore.test.sh` corren
sin red y sin base real, con `DRY_RUN` y `FAKE_TS`.

- **US:** US-01-004 · **5 pts · 2 h** · depende de TASK-009

#### TASK-011: Bucket privado en R2, lifecycle y cron

Crear el bucket `crypto-trader-db-backups`, credenciales acotadas a él, reglas de lifecycle según
el RPO de TASK-008, e instalar el cron. La retención se aplica **por lifecycle, no borrando desde
el script**.

- **US:** US-01-004, US-01-005 · **5 pts · 2 h** · depende de TASK-008 y TASK-010 · ⛔ bloqueada
  por la cuenta de Cloudflare

#### TASK-012: Restaurar en una base descartable

El criterio de cierre real: bajar un dump de R2, restaurarlo en una base vacía y verificar que los
datos están. Después, borrar la base descartable.

- **US:** US-01-004 · **8 pts · 3 h** · depende de TASK-011 · **cierra CA-003**

## Riesgos del plan

| Riesgo | Mitigación |
| --- | --- |
| La cuenta de Cloudflare no se decide y la Fase 3 se estanca | TASK-001 a TASK-009 no dependen de eso. El ciclo puede llegar hasta TASK-009 sin bloqueo. |
| El tuning de Postgres no entra en 3,7 GiB | Hay 2 GiB de swap agregados en la Fase 1. Si aparece presión, `shared_buffers` es la primera perilla. |
| `prisma migrate deploy` falla en una migración vieja | Se corre contra base vacía, sin datos que perder. Es el momento más barato para que falle. |
| Los dumps llenan el disco de 40 GB | `DB_BACKUP_KEEP_LOCAL=2` y lifecycle en R2. TASK-003 fija la línea de base para poder medir. |
