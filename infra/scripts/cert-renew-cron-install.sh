#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instala el cron de renovacion del certificado. IDEMPOTENTE.
# Contrato: spec-e-burgos-008 cycle-02, Fase 5.
#
# Dos veces por dia, a las 03:17 y 15:17 UTC. Los minutos son deliberadamente
# "feos": Let's Encrypt pide no concentrar el trafico en la hora en punto.
# certbot solo renueva si faltan menos de 30 dias, asi que dos corridas diarias
# dan ~60 oportunidades de exito antes de que el certificado venza — margen de
# sobra para notar una falla antes de que el sitio deje de cargar.
#
# Entradas: COMPOSE_DIR (default /opt/crypto-trader)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
SCRIPT="${COMPOSE_DIR}/cert-renew.sh"
# El log NO va bajo certbot/: ese arbol es de root (lo crea certbot dentro del
# contenedor) y el cron corre como el usuario no-root. Una redireccion que falla
# aborta la linea entera del cron ANTES de ejecutar nada, asi que el certificado
# se vencería sin que ninguna corrida haya llegado a intentarse.
LOGFILE="${COMPOSE_DIR}/logs/cert-renew.log"
MARKER="# crypto-trader cert-renew (spec-e-burgos-008)"

[ -f "$SCRIPT" ] || { echo "FATAL: no existe $SCRIPT" >&2; exit 1; }
mkdir -p "$(dirname "$LOGFILE")"

ENTRY="17 3,15 * * * cd ${COMPOSE_DIR} && /bin/bash ${SCRIPT} >> ${LOGFILE} 2>&1 ${MARKER}"

# Falla ruidosamente si el usuario del cron no puede escribir el log, en vez de
# instalar una linea que jamas va a ejecutarse.
touch "$LOGFILE" || { echo "FATAL: no puedo escribir $LOGFILE como $(whoami)" >&2; exit 1; }

( crontab -l 2>/dev/null | grep -vF "$MARKER" || true; printf '%s\n' "$ENTRY" ) | crontab -

echo "cron de renovacion instalado:"
crontab -l | grep -F "$MARKER"
