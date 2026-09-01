#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instala el cron de backup segun el RPO decidido en docs/infra/rpo-decision.md.
# Contrato: spec-e-burgos-008 cycle-01, TASK-011. IDEMPOTENTE.
#
# El cron corre en UTC porque el servidor corre en Etc/UTC: el sello de cada
# dump y la hora del cron tienen que hablar el mismo idioma, o el prefijo
# daily/ (que se activa a la hora 00) se escribiria a destiempo.
#
# Entradas (entorno):
#   COMPOSE_DIR   default /opt/crypto-trader
#   RPO_HOURS     default 1   (1 = cada hora en el minuto 0)
#   CRON_USER     default el usuario que corre el script
#
# Uso:  bash db-backup-cron-install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
RPO_HOURS="${RPO_HOURS:-1}"
SCRIPT="${COMPOSE_DIR}/db-backup.sh"
LOGFILE="${COMPOSE_DIR}/backups/cron.log"
MARKER="# crypto-trader db-backup (spec-e-burgos-008)"

[ -f "$SCRIPT" ] || { echo "FATAL: no existe $SCRIPT" >&2; exit 1; }

case "$RPO_HOURS" in
1) SCHEDULE="0 * * * *" ;;
*) SCHEDULE="0 */${RPO_HOURS} * * *" ;;
esac

ENTRY="${SCHEDULE} cd ${COMPOSE_DIR} && /bin/bash ${SCRIPT} >> ${LOGFILE} 2>&1 ${MARKER}"

mkdir -p "$(dirname "$LOGFILE")"

# Idempotencia: se borra la linea previa por su marcador y se reescribe.
( crontab -l 2>/dev/null | grep -vF "$MARKER" || true; printf '%s\n' "$ENTRY" ) | crontab -

echo "cron instalado (RPO ${RPO_HOURS}h):"
crontab -l | grep -F "$MARKER"
