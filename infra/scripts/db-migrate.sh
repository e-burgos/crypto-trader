#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Aplica las migraciones de Prisma contra el Postgres del VPS.
# Contrato: spec-e-burgos-008 cycle-01, architect §3. Cubre US-01-003 / CA-002.
#
# Corre desde el VPS. Usa un contenedor EFÍMERO conectado a la red del compose
# (architect DEC-06: ninguna herramienta nueva en el host — ni node, ni prisma).
# Por eso también se conecta a `postgres:5432` por nombre de servicio y no por
# un puerto publicado: no hay puerto publicado, y no debe haberlo (DEC-03).
#
# Prisma 7 no toma la URL del schema —el datasource sólo declara el provider—
# sino de prisma.config.ts, que la lee de DATABASE_URL del entorno.
#
# Entradas (entorno):
#   COMPOSE_DIR   default /opt/crypto-trader
#   PRISMA_DIR    default ${COMPOSE_DIR}/prisma   (schema + migrations + config)
#   DATABASE_URL  obligatoria
#   MIGRATE_CMD   default "deploy"; "status" para sólo consultar sin aplicar
#
# Uso:  DATABASE_URL=... bash db-migrate.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
PRISMA_DIR="${PRISMA_DIR:-${COMPOSE_DIR}/prisma}"
MIGRATE_CMD="${MIGRATE_CMD:-deploy}"
PRISMA_VERSION="${PRISMA_VERSION:-7.8.0}"
: "${DATABASE_URL:?falta DATABASE_URL}"

[ -d "$PRISMA_DIR/migrations" ] || { echo "FATAL: no existe $PRISMA_DIR/migrations" >&2; exit 1; }

# La red la crea el compose como <dir>_default. Se resuelve en vez de asumirse:
# el nombre depende del directorio y cambiar de ruta rompería el script en silencio.
NETWORK="$(docker network ls --format '{{.Name}}' | grep -E '^crypto-trader_default$' | head -1)"
[ -n "$NETWORK" ] || { echo "FATAL: no encuentro la red del compose" >&2; exit 1; }

docker run --rm \
  --network "$NETWORK" \
  -v "$PRISMA_DIR":/work/prisma:ro \
  -v "$PRISMA_DIR/prisma.config.ts":/work/prisma.config.ts:ro \
  -w /work \
  -e DATABASE_URL="$DATABASE_URL" \
  node:22-alpine \
  sh -c "npm i -s --no-fund --no-audit prisma@${PRISMA_VERSION} >/dev/null 2>&1 && npx prisma migrate ${MIGRATE_CMD}"
