#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Restore de un dump de la base a una base EXPLÍCITA.
# Contrato: spec-e-burgos-008 cycle-01, architect DEC-05/DEC-06.
# Portado de e-burgos/display-ads, adaptado a una sola base.
#
# --dbname ES OBLIGATORIO Y NO TIENE DEFAULT. Es la decisión central de este
# script: el dump es `-Fc` de una sola base y no contiene el nombre de destino,
# así que `pg_restore` exige que alguien lo diga en voz alta. Poner un default
# —aunque fuera una base de prueba— convertiría un tipeo en una restauración
# sobre producción.
#
# ADEMÁS: el script se NIEGA a restaurar sobre la base de producción salvo que
# se pase --force-production. Un restore sobre la base viva no es "recuperar":
# es pisar datos que quizá sean más nuevos que el dump.
#
# Entradas (entorno):
#   COMPOSE_DIR    default /opt/crypto-trader
#   BACKUP_DIR     default ${COMPOSE_DIR}/backups
#   PROD_DB        default crypto_trader   (la base protegida)
#   DB_RESTORE_DRY_RUN=1  imprime lo que haría y sale sin tocar nada
#
# Uso:
#   bash db-restore.sh --file <dump> --dbname <destino> [--create] [--force-production]
#   bash db-restore.sh --from-r2 <clave remota> --dbname <destino> [--create]
#
# Sale 0 si el restore terminó y la base destino tiene tablas.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
BACKUP_DIR="${BACKUP_DIR:-${COMPOSE_DIR}/backups}"
ENV_BACKUP_FILE="${ENV_BACKUP_FILE:-${COMPOSE_DIR}/.env.backup}"
PROD_DB="${PROD_DB:-crypto_trader}"
DRY_RUN="${DB_RESTORE_DRY_RUN:-0}"
PG_IMAGE="${DB_BACKUP_PG_IMAGE:-pgvector/pgvector:pg16}"
RCLONE_IMAGE="${DB_BACKUP_RCLONE_IMAGE:-rclone/rclone:1.68.2}"

log() { printf '[db-restore] %s\n' "$1"; }
fail() {
  printf '[db-restore] FATAL: %s\n' "$1" >&2
  exit 1
}

FILE=''
FROM_R2=''
DBNAME=''
CREATE=0
FORCE_PROD=0
while [ $# -gt 0 ]; do
  case "$1" in
  --file) FILE="${2:?--file necesita un valor}"; shift 2 ;;
  --from-r2) FROM_R2="${2:?--from-r2 necesita un valor}"; shift 2 ;;
  --dbname) DBNAME="${2:?--dbname necesita un valor}"; shift 2 ;;
  --create) CREATE=1; shift ;;
  --force-production) FORCE_PROD=1; shift ;;
  *) fail "argumento desconocido: $1" ;;
  esac
done

[ -n "$DBNAME" ] || fail "--dbname es obligatorio y no tiene default. El dump no dice a dónde va: decilo vos."
[ -n "$FILE" ] || [ -n "$FROM_R2" ] || fail "hace falta --file o --from-r2."
[ -z "$FILE" ] || [ -z "$FROM_R2" ] || fail "--file y --from-r2 son excluyentes."

if [ "$DBNAME" = "$PROD_DB" ] && [ "$FORCE_PROD" != '1' ]; then
  fail "el destino '${DBNAME}' es la base de PRODUCCIÓN. Un restore ahí pisa datos que pueden ser más nuevos que el dump. Si es lo que querés de verdad, repetí con --force-production. No se tocó nada."
fi

cd "$COMPOSE_DIR" || fail "no existe ${COMPOSE_DIR}"
[ -f docker-compose.yml ] || fail "no hay docker-compose.yml en ${COMPOSE_DIR}"

# ── Bajar de R2 si hace falta ────────────────────────────────────────────────
if [ -n "$FROM_R2" ]; then
  if [ -f "$ENV_BACKUP_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; . "$ENV_BACKUP_FILE"; set +a
  fi
  R2_BUCKET="${BACKUP_R2_BUCKET:-crypto-trader-db-backups}"
  : "${BACKUP_R2_ACCESS_KEY_ID:?falta BACKUP_R2_ACCESS_KEY_ID}"
  : "${BACKUP_R2_SECRET_ACCESS_KEY:?falta BACKUP_R2_SECRET_ACCESS_KEY}"
  : "${CLOUDFLARE_ACCOUNT_ID:?falta CLOUDFLARE_ACCOUNT_ID}"
  FILE="${BACKUP_DIR}/$(basename "$FROM_R2")"
  log "bajando r2:${R2_BUCKET}/${FROM_R2}"
  if [ "$DRY_RUN" = '1' ]; then
    printf '[db-restore]   (dry-run) rclone copyto r2:%s/%s /data/%s\n' "$R2_BUCKET" "$FROM_R2" "$(basename "$FILE")"
  else
    mkdir -p "$BACKUP_DIR"
    docker run --rm --user 0:0 \
      -e RCLONE_CONFIG_R2_TYPE=s3 \
      -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
      -e RCLONE_CONFIG_R2_REGION=auto \
      -e RCLONE_CONFIG_R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" \
      -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
      -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
      -v "${BACKUP_DIR}:/data" \
      "$RCLONE_IMAGE" copyto "r2:${R2_BUCKET}/${FROM_R2}" "/data/$(basename "$FILE")" ||
      fail "no se pudo bajar ${FROM_R2} del bucket."
  fi
fi

case "$FILE" in
/*) : ;;
*) FILE="${BACKUP_DIR}/${FILE}" ;;
esac
[ "$DRY_RUN" = '1' ] || [ -f "$FILE" ] || fail "no existe el dump ${FILE}"
DUMP_NAME="$(basename "$FILE")"

# ── Verificar el checksum si hay sidecar ────────────────────────────────────
if [ "$DRY_RUN" != '1' ] && [ -f "${FILE}.sha256" ]; then
  log "verificando checksum de ${DUMP_NAME}"
  (cd "$(dirname "$FILE")" && sha256sum -c "${DUMP_NAME}.sha256" >/dev/null) ||
    fail "el checksum de ${DUMP_NAME} NO coincide: el archivo está corrupto o incompleto. No se restaura nada."
  log "  checksum OK"
fi

# ── Validar el dump antes de tocar la base destino ──────────────────────────
if [ "$DRY_RUN" != '1' ]; then
  TOC_COUNT="$(docker run --rm --user 0:0 -v "$(dirname "$FILE")":/backups:ro "$PG_IMAGE" \
    pg_restore --list "/backups/${DUMP_NAME}" 2>/dev/null | grep -c '^[0-9]' || true)"
  [ -n "$TOC_COUNT" ] && [ "$TOC_COUNT" -ge 1 ] ||
    fail "el dump no valida (pg_restore --list no devolvió entradas). No se restaura nada."
  log "dump válido: ${TOC_COUNT} objetos en el índice"
fi

# `${FORCE_PROD:+...}` expandiria tambien con "0", que es no-vacio: el log
# diria que se forzo cuando no se forzo. En un restore ese log importa.
if [ "$FORCE_PROD" = '1' ]; then
  log "destino: base '${DBNAME}' — FORZADO SOBRE PRODUCCIÓN"
else
  log "destino: base '${DBNAME}'"
fi

if [ "$DRY_RUN" = '1' ]; then
  log "(dry-run) createdb ${DBNAME}; pg_restore --dbname ${DBNAME} ${DUMP_NAME}"
  exit 0
fi

# ── Crear la base destino si se pidió ───────────────────────────────────────
if [ "$CREATE" = '1' ]; then
  log "creando la base '${DBNAME}' si no existe"
  docker compose exec -T postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname='"'"''"${DBNAME}"''"'"'" | grep -q 1' ||
    docker compose exec -T postgres sh -c \
      'PGPASSWORD="$POSTGRES_PASSWORD" createdb -h 127.0.0.1 -U "$POSTGRES_USER" '"${DBNAME}" ||
      fail "no se pudo crear la base ${DBNAME}"
  # La extensión la crea el superusuario, igual que en 00-init.sql: el dump la
  # pide pero el rol de aplicación no puede crearla.
  docker compose exec -T postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d '"${DBNAME}"' -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector"' >/dev/null ||
    fail "no se pudo crear la extensión vector en ${DBNAME}"
fi

# ── Restore ─────────────────────────────────────────────────────────────────
# --no-owner / --no-privileges: los roles se reconstruyen con 00-init.sql y los
# Secrets, no viajan en el dump (no se dumpean globals).
log "pg_restore --dbname ${DBNAME} ${DUMP_NAME}"
docker run --rm --user 0:0 \
  --network "$(docker network ls --format '{{.Name}}' | grep -E '^crypto-trader_default$' | head -1)" \
  -v "$(dirname "$FILE")":/backups:ro \
  -e PGPASSWORD="$(docker compose exec -T postgres printenv POSTGRES_PASSWORD | tr -d '\r\n')" \
  "$PG_IMAGE" \
  pg_restore --no-owner --no-privileges --exit-on-error \
  -h postgres -p 5432 -U postgres --dbname "$DBNAME" "/backups/${DUMP_NAME}" ||
  fail "el pg_restore falló contra '${DBNAME}'."

# ── Verificación: la base destino tiene que tener tablas ───────────────────
TABLES="$(docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d '"${DBNAME}"' -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='"'"'public'"'"'"' | tr -d '\r\n ')"
[ "${TABLES:-0}" -ge 1 ] || fail "el restore terminó pero '${DBNAME}' no tiene tablas."

log "restore completo: ${TABLES} tablas en '${DBNAME}'."
exit 0
