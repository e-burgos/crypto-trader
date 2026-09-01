#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Verifica POR EVIDENCIA que Postgres y Redis no son alcanzables desde fuera
# del VPS. Contrato: spec-e-burgos-008 cycle-01, RN-04 del funcional.
#
# No alcanza con que el compose diga que no publica el puerto: se comprueba
# intentando conectarse desde afuera. Corre desde la maquina del operador, NO
# desde el VPS.
#
# Entradas: HOST (obligatoria) — IP publica del servidor.
# Sale 0 si NINGUNO de los puertos de datos responde.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
: "${HOST:?falta HOST}"
TIMEOUT="${TIMEOUT:-5}"

fail=0
for spec in "5432:postgres" "6379:redis" "3000:api-directo"; do
  port="${spec%%:*}"; name="${spec##*:}"
  # Un firewall que hace DROP no devuelve RST: el timeout ES la respuesta correcta.
  if nc -z -G "$TIMEOUT" -w "$TIMEOUT" "$HOST" "$port" 2>/dev/null; then
    echo "FALLA  $port ($name) RESPONDE desde internet"; fail=1
  else
    echo "OK     $port ($name) no responde"
  fi
done
exit "$fail"
