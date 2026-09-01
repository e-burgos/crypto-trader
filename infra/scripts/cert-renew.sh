#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Renovacion del certificado Let's Encrypt. IDEMPOTENTE.
# Contrato: spec-e-burgos-008 cycle-02, Fase 5.
#
# POR QUE ESTE ARCHIVO EXISTE
# ---------------------------
# El certificado se emitio con `certbot standalone`, que toma el puerto 80 para
# si. Eso servia cuando no habia nada escuchando, pero ahora lo ocupa nginx: un
# `standalone` hoy fallaria con "address already in use". La renovacion usa
# WEBROOT — certbot escribe el desafio en un directorio y nginx lo sirve por el
# location /.well-known/acme-challenge/ que ya esta en nginx.conf.
#
# Un certificado de Let's Encrypt dura 90 dias. Sin este cron el sitio deja de
# cargar, y no con un aviso sino con un error de certificado en el navegador.
# A diferencia de un Origin Certificate de Cloudflare (que dura anios), la
# renovacion es infraestructura propia que hay que monitorear (DEC-DOM).
#
# certbot solo renueva si faltan menos de 30 dias para el vencimiento, asi que
# correrlo dos veces por dia es barato y da 60 dias de margen para que alguien
# note una falla antes de que el sitio se caiga.
#
# Entradas (entorno):
#   COMPOSE_DIR       default /opt/crypto-trader
#   CERTBOT_IMAGE     default certbot/certbot:latest
#   CERT_RENEW_DRY_RUN=1  simula la renovacion sin pedir un certificado real
#
# Uso:  bash cert-renew.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:latest}"
DRY_RUN="${CERT_RENEW_DRY_RUN:-0}"

log() { printf '[cert-renew] %s\n' "$1"; }
fail() { printf '[cert-renew] FATAL: %s\n' "$1" >&2; exit 1; }

cd "$COMPOSE_DIR" || fail "no existe ${COMPOSE_DIR}"
[ -f docker-compose.yml ] || fail "no hay docker-compose.yml en ${COMPOSE_DIR}"
[ -d certbot/conf ] || fail "no existe ${COMPOSE_DIR}/certbot/conf: el certificado no fue emitido todavia"

DRY_FLAG=""
[ "$DRY_RUN" = '1' ] && DRY_FLAG="--dry-run"

log "renovando por webroot${DRY_FLAG:+ (dry-run)}"
docker run --rm \
  -v "${COMPOSE_DIR}/certbot/conf:/etc/letsencrypt" \
  -v "${COMPOSE_DIR}/certbot/www:/var/www/certbot" \
  "$CERTBOT_IMAGE" renew \
  --webroot --webroot-path /var/www/certbot \
  --non-interactive $DRY_FLAG ||
  fail "certbot renew fallo. El certificado vigente sigue en su lugar; revisar que el puerto 80 responda /.well-known/acme-challenge/ desde internet."

if [ "$DRY_RUN" = '1' ]; then
  log "dry-run OK: no se pidio ningun certificado y no se recargo nginx."
  exit 0
fi

# nginx cachea el certificado en memoria al arrancar: sin recarga sigue
# sirviendo el viejo hasta que alguien reinicie el contenedor por otro motivo.
log "recargando nginx para que tome el certificado"
docker compose exec -T nginx nginx -s reload ||
  fail "la renovacion funciono pero nginx no recargo: sigue sirviendo el certificado anterior."

EXPIRY="$(docker run --rm -v "${COMPOSE_DIR}/certbot/conf:/etc/letsencrypt:ro" \
  --entrypoint openssl "$CERTBOT_IMAGE" x509 -noout -enddate \
  -in /etc/letsencrypt/live/trader.estebanburgos.com.ar/fullchain.pem 2>/dev/null || echo '?')"
log "listo. ${EXPIRY}"
