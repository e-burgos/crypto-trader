#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Backup de la base del Postgres del VPS a Cloudflare R2.
# Contrato: spec-e-burgos-008 cycle-01, architect DEC-05/DEC-06/DEC-07.
# Portado de e-burgos/display-ads (infra/scripts/db-backup.sh), adaptado a una
# sola base y a un RPO de 1 hora (docs/infra/rpo-decision.md).
#
# POR QUÉ ESTE ARCHIVO ES VERSIONADO
# ----------------------------------
# (1) Es la única forma de ejecutar el backup fuera del cron — verificarlo
# leyendo un YAML no cuenta como evidencia. (2) El MISMO código corre en la
# verificación y en producción.
#
# DECISIONES QUE NO SON DE GUSTO
# ------------------------------
# · `pg_dump -Fc` POR BASE, jamás `pg_dumpall`. Un `pg_dumpall` produce un
#   stream SQL con `CREATE DATABASE`/`\connect` embebidos: se AUTO-DIRECCIONA,
#   y su destino natural es la base de producción. Un dump `-Fc` de una sola
#   base no contiene el nombre de destino: `pg_restore` exige `--dbname`
#   explícito. "Restaurar no puede pisar la base viva" queda garantizado por el
#   FORMATO del artefacto, no por la disciplina del operador.
# · No se dumpean globals (`--globals-only`): los roles se reconstruyen con
#   00-init.sql + los Secrets, y así no viajan hashes SCRAM al bucket.
# · Sin herramientas nuevas en el host: `pg_dump`/`pg_restore` salen del
#   contenedor de Postgres que ya corre; `rclone` sale de un contenedor
#   efímero. El host no recibe pg_dump, ni rclone, ni aws.
# · Se valida ANTES de subir. Un dump truncado se detecta acá, no seis meses
#   después cuando alguien intente restaurarlo.
# · NO se porta el conmutador `DB_BACKEND` de display-ads: allá existe porque
#   Neon quedó como pata de vuelta atrás. Acá la base nace autoalojada y no hay
#   a qué conmutar.
#
# Entradas (entorno; `.env.backup` del COMPOSE_DIR se lee como fallback):
#   COMPOSE_DIR                 default /opt/crypto-trader
#   BACKUP_DIR                  default ${COMPOSE_DIR}/backups
#   BACKUP_R2_ACCESS_KEY_ID     secret. Sin él → backup SÓLO local
#   BACKUP_R2_SECRET_ACCESS_KEY secret
#   CLOUDFLARE_ACCOUNT_ID       de acá SALE el endpoint de R2; el bucket no
#                               gasta un secret propio
#   BACKUP_R2_BUCKET            default crypto-trader-db-backups
#   DB_BACKUP_KEEP_LOCAL        default 2 (copias locales por base)
#   DB_BACKUP_DRY_RUN=1         imprime lo que haría y sale sin tocar nada
#   DB_BACKUP_FAKE_TS           timestamp fijo, SÓLO para los tests
#
# Uso:  bash db-backup.sh
# Sale 0 si la base quedó dumpeada y validada (y subida, si hay R2).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
BACKUP_DIR="${BACKUP_DIR:-${COMPOSE_DIR}/backups}"
ENV_BACKUP_FILE="${ENV_BACKUP_FILE:-${COMPOSE_DIR}/.env.backup}"
KEEP_LOCAL="${DB_BACKUP_KEEP_LOCAL:-2}"
DRY_RUN="${DB_BACKUP_DRY_RUN:-0}"

# Imágenes fijadas por versión: nada se instala en el host.
PG_IMAGE="${DB_BACKUP_PG_IMAGE:-pgvector/pgvector:pg16}"
RCLONE_IMAGE="${DB_BACKUP_RCLONE_IMAGE:-rclone/rclone:1.68.2}"

# Hoy hay una sola base. Se mantiene como array a propósito: agregar una
# segunda no debe ser una reescritura del script (architect DEC-01).
BASES=(crypto_trader)

log() { printf '[db-backup] %s\n' "$1"; }
warn() { printf '[db-backup] WARN: %s\n' "$1"; }
fail() {
  printf '[db-backup] FATAL: %s\n' "$1" >&2
  exit 1
}

# ── Paso 1 — ubicación ───────────────────────────────────────────────────────
cd "$COMPOSE_DIR" || fail "no existe el directorio ${COMPOSE_DIR}. No se tocó nada."
[ -f docker-compose.yml ] || fail "no hay docker-compose.yml en ${COMPOSE_DIR}: el VPS no está desplegado. No se tocó nada."

# ── Paso 2 — credenciales de R2. Sin bucket → backup SÓLO local ─────────────
# `.env.backup` lo escribe el deploy desde los Secrets: el cron corre
# desatendido y no tiene de dónde sacarlas si no están en disco.
if [ -f "$ENV_BACKUP_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  . "$ENV_BACKUP_FILE"
  set +a
fi

R2_BUCKET="${BACKUP_R2_BUCKET:-crypto-trader-db-backups}"
R2_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID:-}"
R2_SECRET="${BACKUP_R2_SECRET_ACCESS_KEY:-}"
R2_ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"

# Guarda H-9, heredada de display-ads. Allá existe porque su bucket de medios
# es PÚBLICO y un dump ahí sería la base entera expuesta en internet.
# crypto-trader todavía no tiene bucket de medios; la guarda se conserva igual
# porque cuesta cero y protege el día que exista. Es estructural: no hay flag
# que la desactive.
case "$R2_BUCKET" in
*media*)
  fail "el bucket de destino es '${R2_BUCKET}': un bucket cuyo nombre contiene 'media' sirve contenido al público y un dump ahí expondría la base entera en internet (H-9). Los backups van SÓLO a un bucket privado dedicado. No se tocó nada."
  ;;
esac

R2_ENABLED=0
if [ -n "$R2_KEY_ID" ] || [ -n "$R2_SECRET" ]; then
  # Con media credencial no se sube a ciegas: se corta antes de dumpear.
  [ -n "$R2_KEY_ID" ] || fail "falta BACKUP_R2_ACCESS_KEY_ID (hay secreto pero no access key). No se tocó nada."
  [ -n "$R2_SECRET" ] || fail "falta BACKUP_R2_SECRET_ACCESS_KEY (hay access key pero no secreto). No se tocó nada."
  [ -n "$R2_ACCOUNT" ] || fail "falta CLOUDFLARE_ACCOUNT_ID: de ese secret sale el endpoint de R2. No se tocó nada."
  R2_ENABLED=1
fi

if [ "$R2_ENABLED" = '1' ]; then
  log "destino remoto: bucket privado '${R2_BUCKET}' (endpoint derivado de CLOUDFLARE_ACCOUNT_ID)"
else
  warn "R2 no configurado — backup SÓLO local en ${BACKUP_DIR}. La plataforma NO tiene copia fuera del host: si se pierde el VPS, se pierde todo."
fi

# ── Paso 3 — timestamp UTC (el servidor y el cron corren en Etc/UTC) ────────
TS="${DB_BACKUP_FAKE_TS:-$(date -u +%Y%m%dT%H%M%SZ)}"
Y="${TS:0:4}"
M="${TS:4:2}"
D="${TS:6:2}"
H="${TS:9:2}"
log "sello de esta corrida (UTC): ${TS}"

umask 077
mkdir -p "$BACKUP_DIR" || fail "no se pudo crear ${BACKUP_DIR}"

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# r2_copyto <archivo local> <clave remota> — contenedor efímero, sin instalar
# nada. Los secretos viajan por `-e` del `docker run` y NUNCA se imprimen: el
# log muestra la clave de destino, no las credenciales.
r2_copyto() {
  local src="$1" key="$2" base
  base="$(basename "$src")"
  log "  → r2:${R2_BUCKET}/${key}"
  if [ "$DRY_RUN" = '1' ]; then
    printf '[db-backup]     (dry-run) rclone copyto /data/%s r2:%s/%s\n' "$base" "$R2_BUCKET" "$key"
    return 0
  fi
  docker run --rm --user 0:0 \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_REGION=auto \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT}.r2.cloudflarestorage.com" \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET" \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    -v "${BACKUP_DIR}:/data:ro" \
    "$RCLONE_IMAGE" copyto "/data/${base}" "r2:${R2_BUCKET}/${key}"
}

ERRORES=0

for BASE in "${BASES[@]}"; do
  printf '\n'
  log "── base '${BASE}' ──"
  DUMP_NAME="${BASE}_${TS}.dump"
  DUMP_PATH="${BACKUP_DIR}/${DUMP_NAME}"

  # ── a. Dump lógico de UNA base, formato custom ────────────────────────────
  # La contraseña no viaja por la línea de comandos del host: se lee de la
  # variable que el contenedor YA tiene.
  DUMP_CMD='PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc --no-password -h 127.0.0.1 -U "$POSTGRES_USER" -d '"${BASE}"
  log "dump: docker compose exec -T postgres pg_dump -Fc -d ${BASE}  →  ${DUMP_NAME}"
  if [ "$DRY_RUN" = '1' ]; then
    printf '[db-backup]     (dry-run) %s\n' "$DUMP_CMD"
  else
    if ! docker compose exec -T postgres sh -c "$DUMP_CMD" >"$DUMP_PATH"; then
      rm -f "$DUMP_PATH"
      warn "el dump de '${BASE}' falló: no se sube nada de esta base."
      ERRORES=$((ERRORES + 1))
      continue
    fi
  fi

  # ── b. Validación ANTES de subir ──────────────────────────────────────────
  # `pg_restore --list` lee el índice del archivo: un dump truncado o corrupto
  # no devuelve entradas y se descarta acá mismo.
  log "validación: pg_restore --list ${DUMP_NAME}"
  if [ "$DRY_RUN" != '1' ]; then
    TOC_COUNT="$(docker run --rm --user 0:0 -v "${BACKUP_DIR}:/backups:ro" "$PG_IMAGE" \
      pg_restore --list "/backups/${DUMP_NAME}" 2>/dev/null | grep -c '^[0-9]' || true)"
    if [ -z "$TOC_COUNT" ] || [ "$TOC_COUNT" -lt 1 ]; then
      rm -f "$DUMP_PATH"
      warn "el dump de '${BASE}' NO valida (pg_restore --list no devolvió entradas): se descarta y NO se sube."
      ERRORES=$((ERRORES + 1))
      continue
    fi
    log "  dump válido: ${TOC_COUNT} objetos en el índice · $(du -h "$DUMP_PATH" | awk '{print $1}')"
  fi

  # ── c. Checksum sidecar ───────────────────────────────────────────────────
  SIDECAR_PATH="${DUMP_PATH}.sha256"
  log "checksum: ${DUMP_NAME}.sha256"
  if [ "$DRY_RUN" != '1' ]; then
    (cd "$BACKUP_DIR" && printf '%s  %s\n' "$(sha256_of "$DUMP_NAME")" "$DUMP_NAME" >"${DUMP_NAME}.sha256") ||
      fail "no se pudo escribir el checksum de ${DUMP_NAME}"
  fi

  # ── d. Subida escalonada ──────────────────────────────────────────────────
  # hourly/ en cada corrida; daily/ sólo la de las 00 UTC. Los dos prefijos
  # existen para que las reglas de lifecycle de R2 les den retención distinta
  # (TASK-011): hourly/ se poda rápido, daily/ se conserva.
  # display-ads usa 6h/ acá; con RPO de 1 hora el prefijo pasa a hourly/.
  if [ "$R2_ENABLED" = '1' ]; then
    KEY_HOURLY="hourly/${BASE}/${Y}/${M}/${D}/${DUMP_NAME}"
    if ! r2_copyto "$DUMP_PATH" "$KEY_HOURLY"; then
      warn "falló la subida de ${DUMP_NAME} a hourly/: la copia local queda en ${BACKUP_DIR}."
      ERRORES=$((ERRORES + 1))
      continue
    fi
    r2_copyto "$SIDECAR_PATH" "${KEY_HOURLY}.sha256" ||
      warn "falló la subida del sidecar de ${DUMP_NAME}."

    if [ "$H" = '00' ]; then
      KEY_DAILY="daily/${BASE}/${Y}/${M}/${DUMP_NAME}"
      r2_copyto "$DUMP_PATH" "$KEY_DAILY" ||
        warn "falló la copia diaria de ${DUMP_NAME}."
      r2_copyto "$SIDECAR_PATH" "${KEY_DAILY}.sha256" ||
        warn "falló la subida del sidecar diario de ${DUMP_NAME}."
    fi
  fi

  # ── e. Poda local por conteo ──────────────────────────────────────────────
  # `ls -t` ordena por mtime, los más nuevos primero. Se podan sólo los dumps
  # de ESTA base; los sidecars se van con su dump.
  if [ "$DRY_RUN" != '1' ]; then
    OLD="$(ls -t "${BACKUP_DIR}/${BASE}_"*.dump 2>/dev/null | tail -n +"$((KEEP_LOCAL + 1))" || true)"
    if [ -n "$OLD" ]; then
      printf '%s\n' "$OLD" | while IFS= read -r f; do
        rm -f "$f" "${f}.sha256"
        log "  poda local: $(basename "$f")"
      done
    fi
  fi
done

printf '\n'
if [ "$ERRORES" -gt 0 ]; then
  fail "${ERRORES} problema(s) durante el backup (ver arriba). Un backup que no valida o no sube NO cuenta como hecho."
fi

if [ "$R2_ENABLED" = '1' ]; then
  log "backup completo: ${#BASES[@]} base(s) dumpeada(s), validada(s) y subida(s) al bucket privado."
else
  log "backup completo: ${#BASES[@]} base(s) dumpeada(s) y validada(s). SÓLO LOCAL (ver el WARN de arriba)."
fi
log "RPO de esta política: como mucho se pierde lo escrito en la última hora."
exit 0
