#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Chequeo diario de salud del VPS. Contrato: spec-e-burgos-008 cycle-04, CA-008.
#
# POR QUE EXISTE
# --------------
# Cada chequeo de abajo corresponde a un modo de falla que este proyecto
# demostro que ocurre EN SILENCIO — no a una lista generica de cosas que suelen
# monitorearse:
#
#   backups     el cron corre cada hora y escribe a un log que nadie lee: 24
#               oportunidades diarias de fallar sin que nadie se entere
#   certificado vence el 2026-11-30; si la renovacion falla, el sitio deja de
#               cargar con un error de certificado y sin aviso previo
#   disco       40 GB que Hetzner NO deja achicar; paso de 4% a 30% solo con
#               desplegar, y los dumps y embeddings crecen encima
#   contenedores  si la API queda unhealthy, nginx sigue en pie devolviendo 502
#   redis       sin el, las colas de Bull dejan de procesar en silencio
#   agentes     un sub-agente que trunca degrada la decision sin ningun error
#
# EL AVISO va a la tabla Notification de la propia plataforma, que ya existe y
# ya se muestra en la UI con su evento WebSocket. Es deliberado: agregar un
# servicio externo para avisar que algo fallo suma un punto de falla en vez de
# restarlo, y este script tiene que funcionar justamente cuando algo esta roto.
#
# Entradas (entorno):
#   COMPOSE_DIR        default /opt/crypto-trader
#   DISK_WARN_PCT      default 75   umbral de uso de disco
#   BACKUP_MAX_AGE_H   default 3    un backup horario con 3 h de atraso ya fallo
#   CERT_WARN_DAYS     default 21   certbot renueva a los 30: 21 deja margen
#   HEALTH_URL         default https://trader.estebanburgos.com.ar/api/health
#   DRY_RUN=1          reporta sin escribir notificaciones
#
# Sale 0 si no hay hallazgos, 1 si hay al menos uno.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
DISK_WARN_PCT="${DISK_WARN_PCT:-75}"
BACKUP_MAX_AGE_H="${BACKUP_MAX_AGE_H:-3}"
CERT_WARN_DAYS="${CERT_WARN_DAYS:-21}"
HEALTH_URL="${HEALTH_URL:-https://trader.estebanburgos.com.ar/api/health}"
DRY_RUN="${DRY_RUN:-0}"

cd "$COMPOSE_DIR" 2>/dev/null || { echo "FATAL: no existe $COMPOSE_DIR" >&2; exit 1; }

HALLAZGOS=()
anotar() { HALLAZGOS+=("$1"); printf '  [!] %s\n' "$1"; }
ok() { printf '  [ok] %s\n' "$1"; }

echo "── chequeo diario $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── 1. Disco ────────────────────────────────────────────────────────────────
uso=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')
libre=$(df -h --output=avail / 2>/dev/null | tail -1 | tr -d ' ')
if [ -n "$uso" ] && [ "$uso" -ge "$DISK_WARN_PCT" ]; then
  anotar "Disco al ${uso}% (quedan ${libre}). Hetzner no permite achicar: hay que podar imagenes o dumps."
else
  ok "disco ${uso}% usado, ${libre} libres"
fi

# ── 2. Contenedores ─────────────────────────────────────────────────────────
# Un contenedor caido o unhealthy no se nota desde afuera: nginx sigue en pie.
esperados="postgres redis api web nginx"
for s in $esperados; do
  cid=$(docker compose ps -q "$s" 2>/dev/null)
  if [ -z "$cid" ]; then
    anotar "El contenedor '${s}' no esta corriendo."
    continue
  fi
  estado=$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null)
  salud=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid" 2>/dev/null)
  if [ "$estado" != running ]; then
    anotar "El contenedor '${s}' esta en estado '${estado}'."
  elif [ "$salud" = unhealthy ]; then
    anotar "El contenedor '${s}' esta unhealthy."
  else
    ok "${s}: ${estado} (${salud})"
  fi
done

# ── 3. Backups ──────────────────────────────────────────────────────────────
# Un backup viejo es indistinguible de uno reciente hasta que se necesita.
ultimo=$(ls -t backups/*.dump 2>/dev/null | head -1)
if [ -z "$ultimo" ]; then
  anotar "No hay ningun dump local en ${COMPOSE_DIR}/backups: el backup horario no esta corriendo."
else
  edad_h=$(( ( $(date +%s) - $(stat -c %Y "$ultimo") ) / 3600 ))
  if [ "$edad_h" -ge "$BACKUP_MAX_AGE_H" ]; then
    anotar "El backup mas reciente tiene ${edad_h} h (esperado < ${BACKUP_MAX_AGE_H} h). El cron horario fallo."
  else
    ok "ultimo backup hace ${edad_h} h: $(basename "$ultimo")"
  fi
fi

# ── 4. Certificado ──────────────────────────────────────────────────────────
cert="certbot/conf/live/trader.estebanburgos.com.ar/fullchain.pem"
if [ ! -f "$cert" ] && ! sudo test -f "$cert" 2>/dev/null; then
  anotar "No se encuentra el certificado en ${cert}."
else
  fin=$(sudo openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
  if [ -n "$fin" ]; then
    dias=$(( ( $(date -d "$fin" +%s) - $(date +%s) ) / 86400 ))
    if [ "$dias" -le "$CERT_WARN_DAYS" ]; then
      anotar "El certificado vence en ${dias} dias y la renovacion automatica no lo tomo. Revisar ${COMPOSE_DIR}/logs/cert-renew.log."
    else
      ok "certificado vence en ${dias} dias"
    fi
  fi
fi

# ── 5. La API responde de verdad ────────────────────────────────────────────
# Se exige el cuerpo, no el codigo: un 200 con la base caida seria el mismo
# fail-open que este proyecto ya corrigio una vez.
cuerpo=$(curl -fsS --max-time 20 "$HEALTH_URL" 2>/dev/null)
if [ -z "$cuerpo" ]; then
  anotar "El health check no responde en ${HEALTH_URL}."
elif ! printf '%s' "$cuerpo" | grep -q '"status":"ok"'; then
  anotar "El health check responde degradado: ${cuerpo}"
else
  ok "health check: $(printf '%s' "$cuerpo" | head -c 60)"
fi

# ── 6. Ciclos de agente degradados ──────────────────────────────────────────
# Un sub-agente que trunca no rompe nada visible: baja la calidad de la decision
# en silencio. Es exactamente como se colo FIX-e-burgos-014.
truncados=$(docker compose logs api --since 24h 2>/dev/null | grep -c "LLM response truncated")
if [ "${truncados:-0}" -gt 0 ]; then
  anotar "${truncados} respuestas de LLM truncadas en 24 h: hay sub-agentes degradando decisiones en silencio."
else
  ok "sin respuestas de LLM truncadas en 24 h"
fi

# ── Aviso ───────────────────────────────────────────────────────────────────
echo
if [ "${#HALLAZGOS[@]}" -eq 0 ]; then
  echo "sin hallazgos"
  exit 0
fi

echo "${#HALLAZGOS[@]} hallazgo(s)"
if [ "$DRY_RUN" = '1' ]; then
  echo "(dry-run: no se escriben notificaciones)"
  exit 1
fi

# El mensaje va a TODOS los ADMIN: es informacion de operacion, no de trading.
mensaje="Chequeo diario del VPS — ${#HALLAZGOS[@]} hallazgo(s): $(printf '%s | ' "${HALLAZGOS[@]}" | sed 's/ | $//')"
mensaje_sql=$(printf '%s' "$mensaje" | sed "s/'/''/g")
docker compose exec -T postgres sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d crypto_trader -v ON_ERROR_STOP=1 -c \"
  INSERT INTO notifications (id, \\\"userId\\\", type, message, read, \\\"createdAt\\\")
  SELECT gen_random_uuid()::text, u.id, 'INFRA_ALERT', '${mensaje_sql}', false, now()
    FROM users u WHERE u.role = 'ADMIN';\"" >/dev/null 2>&1 \
  && echo "notificacion enviada a los administradores" \
  || echo "ATENCION: no se pudo escribir la notificacion" >&2

exit 1
