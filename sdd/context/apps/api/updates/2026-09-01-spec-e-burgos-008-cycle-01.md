# spec-e-burgos-008 cycle-01 — 2026-09-01

## Estado

**`apps/api` ya no corre en Railway.** Su base y su cola viven en un VPS propio de Hetzner
(CX23, Helsinki), y el ciclo **no tocó una sola línea de `src/`**: todo lo que sigue es
infraestructura alrededor de la app.

- **Postgres `pgvector/pgvector:pg16`** con las 37 migraciones aplicadas y la extensión `vector`.
- **Redis 7** con **AOF y `noeviction`**.
- Ninguno de los dos publica puertos: sólo existen en la red interna del compose.
- **Backups horarios a Cloudflare R2 con restore verificado** en una base descartable.

Inventario del servidor y línea de base medida: [`docs/infra/hetzner-server.md`](../../../../docs/infra/hetzner-server.md).

## Estructura

### `infra/` (nuevo)

| Archivo | Para qué |
| --- | --- |
| `scripts/provision-01-base.sh` | Usuario no-root, swap, Docker, `unattended-upgrades` |
| `scripts/provision-02-sshd.sh` | Apaga la auth por contraseña |
| `scripts/provision-03-firewall.sh` | Firewall de Hetzner por API |
| `scripts/db-backup.sh` · `db-restore.sh` | Cadena de backup a R2 |
| `scripts/db-backup-cron-install.sh` | Cron horario, idempotente |
| `scripts/db-migrate.sh` | Migraciones desde contenedor efímero |
| `scripts/verify-network-isolation.sh` | Comprueba desde AFUERA que los puertos de datos no responden |
| `scripts/*.test.sh` | 49 aserciones que el CI corre **antes** de construir |
| `db/initdb/00-init.sql` | Base, rol de aplicación y extensión |

`docker-compose.prod.yml` en la raíz. **Sólo `nginx` publica puertos.**

### Decisiones que un cambio futuro no puede romper

- **Redis en `noeviction` + AOF, NO `allkeys-lru`.** En `display-ads` Redis es cache y desalojar es
  correcto; acá sostiene **las colas de Bull y los leases `rx:v1:*` del loop reactivo**. Con
  `allkeys-lru`, bajo presión de memoria Redis descarta jobs y leases **en silencio**.
- **Postgres y Redis sin `ports:`, nunca.** Ni siquiera bindeados a `127.0.0.1` "para debuggear":
  para eso está `docker compose exec postgres psql` desde el propio VPS.
- **El healthcheck de Postgres consulta la base real**, no `pg_isready`: un `pg_isready` genérico da
  **falso verde durante `initdb`**, cuando Postgres levanta un servidor temporal en socket unix.
- **`pg_dump -Fc` por base, jamás `pg_dumpall`.** Un `pg_dumpall` lleva `CREATE DATABASE`/`\connect`
  embebidos: **se auto-direcciona**, y su destino natural es producción. Un dump `-Fc` no contiene
  el destino, así que `pg_restore` exige `--dbname`. *"Restaurar no puede pisar la base viva"* queda
  garantizado por **el formato del artefacto**, no por la disciplina del operador.
- **`.env.db` separado de `.env.production`.** El contenedor de Postgres no necesita ver las claves
  de Binance ni los JWT; un `env_file` único se las daría a los cinco contenedores.

### Datos

Ninguna tabla nueva. **La base de producción arranca vacía**: los datos de Railway se descartaron
(spec §7, DEC-DATOS) porque el trial venció y no había forma técnica de extraerlos sin levantar el
servicio.

## Dependencias

- **Cloudflare R2** para los dumps, cuenta `cryptotradereb@gmail.com`. Es lo único de Cloudflare que
  se usa: DNS y TLS quedaron fuera (DEC-DOM).
- **Hostinger** sirve el DNS de `estebanburgos.com.ar`.
- Ninguna dependencia nueva de npm.

## Qué sigue

- **La IP del operador es residencial y cambia.** Cuando pase, el 22 deja de responder hasta editar
  la regla en el panel de Hetzner. Es el precio de administrar el firewall **fuera** de la VM, y es
  el correcto: una regla de `ufw` mal puesta es un servidor perdido.
- **El disco de 40 GB es el número a vigilar.** Pasó de 4 % a 30 % sólo con desplegar (imágenes
  3,26 GB) y Hetzner **no permite achicar**. Los dumps horarios y los embeddings crecen sobre eso.
- **Un backup que falla tiene que ser visible.** Con RPO de 1 hora hay 24 oportunidades diarias de
  fallar en silencio; hoy la verificación es manual. Entra en el alcance de CA-008.
- El archivado continuo de WAL quedó descartado a conciencia, con su razón escrita en
  [`docs/infra/rpo-decision.md`](../../../../docs/infra/rpo-decision.md): si el archivado se traba,
  Postgres retiene los segmentos y en 40 GB eso termina con la base detenida — **el mecanismo que
  protege pasa a ser el que tumba**.
