#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Provisioning del VPS Hetzner — paso 3 de 3: firewall.
# Contrato: spec-e-burgos-008 cycle-01, architect §3. Cubre US-01-001.
#
# POR QUÉ EL FIREWALL DE HETZNER Y NO ufw
# ---------------------------------------
# El firewall de Hetzner vive FUERA de la VM. Si una regla deja al operador
# afuera, se corrige desde el panel sin necesidad de entrar al servidor. Una
# regla de ufw mal puesta —y este firewall restringe SSH a una sola IP, sobre
# una conexión residencial cuya IP cambia— es un servidor perdido.
# display-ads tiene el firewall como PENDIENTE en su propio checklist §13:
# "sin esto el VPS acepta conexiones directas que saltan el WAF de Cloudflare".
#
# 80/443 NO SE ABREN ACÁ. Nada escucha ahí hasta la Fase 5, y en la Fase 7 se
# abren restringidos a los rangos de Cloudflare, no a 0.0.0.0/0. Abrirlos antes
# es superficie sin uso.
#
# NOTA SOBRE IPv6: el servidor tiene IPv6 pública. No hace falta una regla que
# la bloquee: el firewall de Hetzner deniega por defecto todo lo que no esté
# explícitamente permitido, en ambas familias. Agregar una regla de SSH sólo
# para IPv4 deja el 22 cerrado sobre IPv6, que es lo que se quiere.
#
# Entradas (entorno, todas obligatorias):
#   HETZNER_API_TOKEN   token de proyecto con permiso Read & Write
#   DEV_IP              IPv4 del operador, SIN máscara (se agrega /32)
#   SERVER_ID           id numérico del servidor en Hetzner Cloud
#   FIREWALL_NAME       default crypto-trader-prod
#
# Uso:  HETZNER_API_TOKEN=... DEV_IP=... SERVER_ID=... bash provision-03-firewall.sh
# Sale 0 si el firewall queda applied sobre el servidor.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${HETZNER_API_TOKEN:?falta HETZNER_API_TOKEN}"
: "${DEV_IP:?falta DEV_IP (IPv4 del operador, sin máscara)}"
: "${SERVER_ID:?falta SERVER_ID}"
FIREWALL_NAME="${FIREWALL_NAME:-crypto-trader-prod}"

API=https://api.hetzner.cloud/v1
AUTH="Authorization: Bearer $HETZNER_API_TOKEN"

rules_json() {
  cat <<EOF
[
  { "direction": "in", "protocol": "tcp", "port": "22",
    "source_ips": ["${DEV_IP}/32"],
    "description": "SSH solo desde la IP del operador" },
  { "direction": "in", "protocol": "icmp",
    "source_ips": ["0.0.0.0/0", "::/0"],
    "description": "ICMP para diagnostico" }
]
EOF
}

# Idempotencia: si el firewall ya existe se actualizan sus reglas en vez de
# crear un segundo con el mismo propósito.
existing_id="$(curl -sS -H "$AUTH" "$API/firewalls?name=$FIREWALL_NAME" \
  | python3 -c 'import json,sys; fw=json.load(sys.stdin).get("firewalls",[]); print(fw[0]["id"] if fw else "")')"

if [ -n "$existing_id" ]; then
  echo "firewall $FIREWALL_NAME ya existe (id $existing_id): actualizo reglas"
  curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"rules\": $(rules_json)}" \
    "$API/firewalls/$existing_id/actions/set_rules" > /dev/null
  fw_id="$existing_id"
else
  fw_id="$(curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"name\": \"$FIREWALL_NAME\", \"rules\": $(rules_json)}" \
    "$API/firewalls" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit("ERROR: "+json.dumps(d["error"])) if "error" in d else print(d["firewall"]["id"])')"
  echo "firewall $FIREWALL_NAME creado (id $fw_id)"
fi

# apply_to_resources es idempotente del lado de Hetzner: reaplicar sobre un
# servidor que ya lo tiene no duplica nada.
curl -sS -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"apply_to\": [{\"type\": \"server\", \"server\": {\"id\": $SERVER_ID}}]}" \
  "$API/firewalls/$fw_id/actions/apply_to_resources" > /dev/null

sleep 3
# Sin f-strings a propósito: este bloque va entre comillas simples de shell, y
# una expresión de f-string no admite backslashes, así que las comillas
# escapadas que harían falta acá son un SyntaxError.
curl -sS -H "$AUTH" "$API/servers/$SERVER_ID" | python3 -c '
import json, sys
fws = json.load(sys.stdin)["server"]["public_net"]["firewalls"]
if not fws:
    sys.exit("FALLA: el servidor no tiene firewall aplicado")
for f in fws:
    print("firewall {}: {}".format(f["id"], f["status"]))
sys.exit(0 if all(f["status"] == "applied" for f in fws) else "FALLA: algun firewall no quedo applied")
'
