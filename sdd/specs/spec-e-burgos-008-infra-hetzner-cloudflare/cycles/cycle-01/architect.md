# Architect — Cycle 01: Servidor, datos y red de seguridad

> Spec: `spec-e-burgos-008-infra-hetzner-cloudflare` | Fases 1-3 | 2026-08-31
> Referencia portada: `e-burgos/display-ads` — `docker-compose.prod.yml`, `infra/scripts/db-backup.sh`

Este ciclo **no toca `sdd/schema.json` ni `sdd/api.json`**: no crea tablas ni endpoints. El
contrato que define es de infraestructura.

---

## 1. Decisiones técnicas

### DEC-01 — Una sola base, `crypto_trader`

`display-ads` aloja dos bases en un Postgres (`display_ads` y `landing_commercial`) porque tiene
una Landing con dominio comercial propio. crypto-trader tiene una sola aplicación: una base, un
rol de aplicación. Todo lo que en la referencia está parametrizado por base acá queda con un solo
valor, pero **los scripts conservan la forma de iterar sobre una lista** — agregar una segunda base
después no debe ser una reescritura.

### DEC-02 — Redis: `noeviction` + AOF. **La adaptación más importante del ciclo.**

`display-ads` corre Redis con:

```
--save 60 1 --maxmemory 1gb --maxmemory-policy allkeys-lru
```

**Eso no se copia.** Ahí Redis es cache y rate limiting: desalojar una clave vieja es correcto.
Acá Redis sostiene **las colas de Bull con los ciclos de agentes** y los leases de coordinación
del loop reactivo (`rx:v1:owner`, `rx:v1:window`, `rx:v1:advance`, `rx:v1:bot`). Con
`allkeys-lru`, bajo presión de memoria Redis **desaloja jobs encolados y leases sin decir nada** —
exactamente el hallazgo G de la spec: las colas dejan de procesar en silencio.

Configuración adoptada:

```
--appendonly yes --appendfsync everysec
--maxmemory 512mb --maxmemory-policy noeviction
--save 900 1 --loglevel warning
```

| Elección | Por qué |
| --- | --- |
| `noeviction` | Es la política que Bull requiere. Bajo presión, Redis **falla la escritura con error** en vez de descartar un job. Un error se ve; un desalojo silencioso no. |
| `appendonly yes` | RDB con `--save 60 1` pierde hasta 60 s. Con dinero real en ciclos encolados, se persiste cada segundo. `display-ads` tiene "Redis AOF backup" como **pendiente** en su propio checklist §13 — acá nace hecho. |
| `maxmemory 512mb` | Con 3,7 GiB totales, Postgres pide ~1,2 GiB y la API de Node otro tanto. 512 MB alcanza de sobra para colas y leases, y es un techo que hace visible una fuga. |

> **Consecuencia operativa que hay que aceptar:** con `noeviction`, un Redis lleno hace fallar
> encolados en vez de degradar. Es deliberado, y refuerza que la decisión abierta §7.4 de la spec
> (monitoreo de Redis) llegue a CA-008.

### DEC-03 — Postgres y Redis **sin `ports:`**, nunca

Ninguno publica puertos al host. Se copia literal la advertencia de la referencia: **no agregar
`ports:` "para debuggear", ni siquiera bindeado a `127.0.0.1`**. Para eso está
`docker compose exec postgres psql` desde el propio VPS por SSH. Cierra US-01-003 y RN-03.

### DEC-04 — El healthcheck de Postgres verifica la base real, no `pg_isready`

Se porta la decisión `DEC-87-001 §1.4` de la referencia: un `pg_isready` genérico **da falso verde
durante `initdb`**, cuando Postgres levanta un servidor temporal en socket unix. El healthcheck
ejecuta un `SELECT 1` contra la base de aplicación por TCP:

```yaml
test: ['CMD-SHELL', 'PGPASSWORD="$$POSTGRES_PASSWORD" psql -h 127.0.0.1 -p 5432 -U "$$POSTGRES_USER" -d crypto_trader -c "SELECT 1" >/dev/null 2>&1']
interval: 10s
timeout: 5s
retries: 12
start_period: 60s
```

La API depende de `postgres: { condition: service_healthy }` — no arranca contra una base no sana.

### DEC-05 — `pg_dump -Fc` por base, **jamás `pg_dumpall`**

Portada tal cual, con su razonamiento, que no es de gusto: un `pg_dumpall` produce un stream SQL
con `CREATE DATABASE`/`\connect` embebidos, **se auto-direcciona**, y su destino natural es la
base de producción. Un dump `-Fc` de una sola base no contiene el nombre de destino: `pg_restore`
exige `--dbname` explícito.

**"Restaurar no puede pisar la base viva" queda garantizado por el formato del artefacto, no por
la disciplina del operador.**

Tampoco se dumpean globals (`--globals-only`): los roles se reconstruyen desde `00-init.sql` y los
Secrets, y así **no viajan hashes SCRAM al bucket**.

### DEC-06 — Ninguna herramienta nueva en el host

`pg_dump`/`pg_restore` salen del contenedor de Postgres que ya corre (imagen ya descargada);
`rclone` sale de un contenedor efímero. El host no recibe `pg_dump`, ni `rclone`, ni `aws`. Menos
superficie, y **el mismo binario que produce el dump es el que lo restaura** — sin desajustes de
versión entre host e imagen.

### DEC-07 — Bucket de R2 y la guarda H-9

- Bucket **privado**, nombre fijo por diseño: `crypto-trader-db-backups`.
- El endpoint de R2 se deriva de `CLOUDFLARE_ACCOUNT_ID`; el bucket no gasta un secret propio.
- Se porta la **guarda H-9**: el script aborta si el nombre del bucket destino contiene `media`.
  En `display-ads` existe porque el bucket público de medios se llama así; acá crypto-trader no
  tiene bucket de medios, pero **la guarda se conserva igual** — cuesta cero y protege contra el
  día que exista uno.
- Credenciales R2 **acotadas a este bucket**, distintas de cualquier otra clave de Cloudflare.

### DEC-08 — Tuning de Postgres para 3,7 GiB con swap de 2 GiB

Se parte de los valores de la referencia (mismo tamaño de máquina) con dos diferencias: acá no hay
contenedor Next.js compitiendo, pero sí embeddings de pgvector.

```
-c timezone=UTC -c log_timezone=UTC
-c max_connections=60 -c superuser_reserved_connections=3
-c shared_buffers=256MB -c effective_cache_size=1GB
-c work_mem=8MB -c maintenance_work_mem=128MB
-c max_wal_size=1GB -c min_wal_size=128MB
-c checkpoint_completion_target=0.9
-c random_page_cost=1.1 -c effective_io_concurrency=200
-c max_worker_processes=2 -c max_parallel_workers=2 -c max_parallel_workers_per_gather=0
-c idle_in_transaction_session_timeout=60000
-c log_min_duration_statement=1000 -c log_lock_waits=on
```

`max_connections=60` (la referencia usa 80) porque acá hay un solo consumidor y el pool de Prisma
se dimensiona explícito; conexiones ociosas de más son RAM sin uso en una máquina de 4 GB.

`POSTGRES_INITDB_ARGS: '--data-checksums --auth-host=scram-sha-256'` — checksums para detectar
corrupción silenciosa de disco, que es justamente lo que un backup no detecta si se archiva ya
corrompido.

### DEC-09 — `logging` acotado en todos los servicios

`json-file` con `max-size: 10m` y `max-file: 3`. **El disco son 40 GB y no se puede achicar.**
Postgres loguea queries lentas y la API es verbosa: sin tope, los logs compiten con los dumps.

### DEC-10 — Dos archivos de entorno separados

| Archivo | Contenido | Quién lo escribe |
| --- | --- | --- |
| `.env.db` | `POSTGRES_PASSWORD`, `APP_DB_PASSWORD` | El deploy, desde GitHub Secrets |
| `.env.production` | Todo lo que consume la API | El deploy, desde GitHub Secrets |

Separados a propósito: el contenedor de Postgres **no necesita ver** las claves de Binance, los
JWT ni `BINANCE_KEY_ENCRYPTION_KEY`. Un `env_file` único se los daría a los cinco contenedores.

> Esto corrige de raíz el problema que ya apareció en local: el `docker-compose.yml` de desarrollo
> hace `env_file: .env` en el servicio `api`, de modo que todo lo que se agregue a ese archivo
> —incluido un token de Hetzner— termina dentro del contenedor de la API.

---

## 2. Topología de red

```
                internet
                    |
        [ firewall Hetzner: 22 (IP del dev), 80, 443 ]
                    |
              +-----+------+
              |   nginx    |  :80 :443   (Fase 5)
              +-----+------+
                    |  red interna del compose — sin puertos publicados
        +-----------+-----------+
        |           |           |
    +---+---+  +----+----+  +---+----+
    |  api  |  | postgres|  | redis  |
    | :3000 |  |  :5432  |  | :6379  |
    +-------+  +---------+  +--------+
                    |            |
              postgres_data  redis_data   (volúmenes con nombre)
```

**Solo nginx publica puertos.** En este ciclo nginx todavía no existe (llega en la Fase 5): al
cerrar cycle-01 el servidor no expone nada más que SSH.

> ⛔ **`docker compose down -v` se lleva la base entera.** El flag `-v` borra los volúmenes con
> nombre. Nunca se usa en el VPS.

---

## 3. Contrato de los scripts de `infra/scripts/`

Todos: `bash`, `set -euo pipefail`, idempotentes, sin secretos embebidos, y **fallan explícitamente
si falta una variable requerida** (`: "${VAR:?}"`).

| Script | Responsabilidad | Entradas | Salida 0 cuando |
| --- | --- | --- | --- |
| `provision-01-base.sh` | Usuario no-root, swap, Docker, `unattended-upgrades`, `/opt/crypto-trader` | `DEPLOY_USER`, `APP_DIR`, `SWAP_SIZE` | `docker run hello-world` corre |
| `provision-02-sshd.sh` | Apaga auth por contraseña, `PermitRootLogin prohibit-password` | — | `sshd -T` refleja la config y `sshd -t` valida |
| `provision-03-firewall.sh` | Crea y aplica el firewall de Hetzner por API | `HETZNER_API_TOKEN`, `DEV_IP`, `SERVER_ID` | El firewall queda `applied` |
| `db-backup.sh` | `pg_dump -Fc` de `crypto_trader` → local → R2 | `COMPOSE_DIR`, `BACKUP_R2_*`, `CLOUDFLARE_ACCOUNT_ID`, `DB_BACKUP_KEEP_LOCAL` | El dump quedó validado y subido |
| `db-restore.sh` | `pg_restore` a una base **explícita** | `--dbname` obligatorio | La base destino tiene los datos |
| `db-backup-cron-install.sh` | Instala el cron según el RPO decidido | `RPO_HOURS` | El cron queda registrado |

**Los tests de shell (`*.test.sh`) corren antes de construir cualquier imagen.** Se porta el patrón
de `deploy-api.yml` de la referencia: si el script de backup está roto, no hay deploy.

`db-backup.sh` conserva de la referencia:
- `DB_BACKUP_DRY_RUN=1` — imprime lo que haría y sale sin tocar nada.
- `DB_BACKUP_FAKE_TS` — timestamp fijo, **solo para los tests**.
- `DB_BACKUP_KEEP_LOCAL` (default 2) — copias locales por base. Es el número que consume disco.

**No se porta el conmutador `DB_BACKEND`.** En `display-ads` existe porque Neon quedó como pata de
vuelta atrás; acá no hay dos backends: la base nace autoalojada y no hay a qué conmutar.

---

## 4. Nombres y retención en R2

```
crypto-trader-db-backups/            (privado)
└── crypto_trader/
    └── YYYY/MM/DD/
        └── crypto_trader-YYYYMMDDTHHMMSSZ.dump
```

Prefijo por base desde el día uno aunque hoy haya una sola (DEC-01). Timestamps en UTC, formato
ordenable — el servidor corre en `Etc/UTC` y el drift medido contra Binance es de −140 ms.

**La retención se define por reglas de lifecycle del bucket, no borrando desde el script.** Un
script que borra es un script que puede borrar de más; una regla de lifecycle es declarativa y
auditable. Los valores concretos dependen de DEC-11.

### DEC-11 — RPO · **DECISIÓN ABIERTA, bloquea el cron y el lifecycle**

`display-ads` corre cuatro backups por día: se pueden perder hasta 6 horas y no hay recuperación a
un punto en el tiempo. Para una plataforma que ejecuta órdenes con dinero real hay que decidir
explícitamente si eso alcanza.

| Opción | RPO | Costo |
| --- | --- | --- |
| Cada 6 h (esquema de la referencia) | ≤ 6 h | Ninguno. Es portar el cron. |
| Cada 1 h | ≤ 1 h | 24 dumps/día en disco y R2. El disco de 40 GB es la restricción. |
| Archivado continuo de WAL a R2 | Minutos | **Trabajo nuevo**, no portable de la referencia. |

Sin esta decisión, `db-backup-cron-install.sh` no se puede escribir. **Es la primera pregunta del
ciclo.**

---

## 5. Dependencias externas

| Dependencia | Para qué | Estado |
| --- | --- | --- |
| Cloudflare R2 | Bucket privado de backups | ⛔ **Bloqueada por spec §7.2** — falta decidir la cuenta |
| Hetzner Cloud API | Firewall, snapshots | ✅ `HETZNER_API_TOKEN` disponible |
| `pgvector/pgvector:pg16` | Imagen de Postgres | ✅ pública |
| `redis:7-alpine` | Imagen de Redis | ✅ pública |
| `rclone/rclone` | Subida a R2 desde contenedor efímero | ✅ pública |

> **La Fase 3 no puede cerrar hasta que se resuelva qué cuenta de Cloudflare se usa.** Las Fases 1
> y 2 no dependen de eso y avanzan igual.

---

## 6. Lo que este ciclo deliberadamente NO hace

- **No arregla el health check** (hallazgo D). Pertenece a la Fase 5, con la API en el aire.
- **No toca `TRUST_PROXY_HOPS`** (hallazgo B). Sin nginx todavía, no hay saltos que declarar.
- **No borra las cuentas de la semilla** (hallazgo H). Se hace en la Fase 4, sobre los datos ya
  migrados, para que el conteo de verificación sea contra un estado conocido.
- **No abre 80/443** en el firewall. Nada escucha ahí hasta la Fase 5, y en la Fase 7 se acotan a
  los rangos de Cloudflare.
