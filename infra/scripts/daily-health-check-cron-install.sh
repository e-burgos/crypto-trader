#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instala el cron del chequeo diario. IDEMPOTENTE.
# Contrato: spec-e-burgos-008 cycle-04.
#
# A las 08:00 UTC, o sea las 05:00 en Argentina: el chequeo tiene que llegar
# ANTES de que el operador empiece el dia, no despues.
#
# El log va a logs/ y NO bajo certbot/ ni backups/: esos arboles pueden ser de
# root, y una redireccion que falla aborta la linea entera del cron ANTES de
# ejecutar nada. Ya paso una vez con la renovacion del certificado.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
SCRIPT="${COMPOSE_DIR}/daily-health-check.sh"
LOGFILE="${COMPOSE_DIR}/logs/health-check.log"
MARKER="# crypto-trader daily-health-check (spec-e-burgos-008)"

[ -f "$SCRIPT" ] || { echo "FATAL: no existe $SCRIPT" >&2; exit 1; }
mkdir -p "$(dirname "$LOGFILE")"
touch "$LOGFILE" || { echo "FATAL: no puedo escribir $LOGFILE como $(whoami)" >&2; exit 1; }

ENTRY="0 8 * * * cd ${COMPOSE_DIR} && /bin/bash ${SCRIPT} >> ${LOGFILE} 2>&1 ${MARKER}"
( crontab -l 2>/dev/null | grep -vF "$MARKER" || true; printf '%s\n' "$ENTRY" ) | crontab -
echo "cron del chequeo diario instalado:"
crontab -l | grep -F "$MARKER"
