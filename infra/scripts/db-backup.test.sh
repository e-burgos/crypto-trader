#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Suite de db-backup.sh. Contrato: spec-e-burgos-008 cycle-01, TASK-010.
#
# Corre en el runner de CI: NO toca base, ni docker, ni el VPS. Todo se ejercita
# con DB_BACKUP_DRY_RUN=1 y stubs en el PATH, porque el valor de estos tests
# esta en cubrir el camino que solo se usa el dia que algo salio mal.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${AQUI}/db-backup.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok=0; fallos=0
afirmar() { # afirmar <descripcion> <esperado-en-salida> <salida>
  if printf '%s' "$3" | grep -qF -- "$2"; then
    ok=$((ok + 1)); printf '  OK    %s\n' "$1"
  else
    fallos=$((fallos + 1))
    printf '  FALLA %s\n        esperaba encontrar: %s\n        obtuvo: %s\n' "$1" "$2" "$(printf '%s' "$3" | tail -3)"
  fi
}

# Entorno falso: un COMPOSE_DIR con docker-compose.yml y un `docker` stub que
# nunca se invoca en dry-run pero tiene que existir en el PATH.
preparar() {
  local dir="$TMP/caso-$1"
  mkdir -p "$dir/bin" "$dir/backups"
  touch "$dir/docker-compose.yml"
  cat > "$dir/bin/docker" <<'EOF'
#!/bin/sh
echo "docker $*" >> "${DOCKER_LOG:-/dev/null}"
exit 0
EOF
  chmod +x "$dir/bin/docker"
  printf '%s' "$dir"
}

correr() { # correr <dir> [VAR=val ...]
  local dir="$1"; shift
  ( cd "$dir" && env PATH="$dir/bin:$PATH" COMPOSE_DIR="$dir" BACKUP_DIR="$dir/backups" \
      ENV_BACKUP_FILE="$dir/.env.backup" DB_BACKUP_DRY_RUN=1 \
      DB_BACKUP_FAKE_TS=20260901T000000Z "$@" bash "$SCRIPT" 2>&1 )
}

echo "── db-backup.sh"

# 1. Sin credenciales de R2: corre igual pero advierte que la copia es solo local.
d="$(preparar solo-local)"
salida="$(correr "$d")"
afirmar "sin R2 advierte que la copia queda solo local" "backup SÓLO local" "$salida"
afirmar "sin R2 igual completa el backup" "backup completo" "$salida"

# 2. GUARDA H-9: un bucket cuyo nombre contiene 'media' aborta antes de dumpear.
#    Es estructural: no hay flag que la desactive.
d="$(preparar h9)"
salida="$(correr "$d" BACKUP_R2_BUCKET=crypto-trader-media \
  BACKUP_R2_ACCESS_KEY_ID=x BACKUP_R2_SECRET_ACCESS_KEY=y CLOUDFLARE_ACCOUNT_ID=z)"
afirmar "H-9 rechaza un bucket con 'media' en el nombre" "expondría la base entera" "$salida"
afirmar "H-9 corta sin tocar nada" "No se tocó nada" "$salida"

# 3. Media credencial es peor que ninguna: se corta ANTES de dumpear en vez de
#    dumpear y descubrir despues que no se puede subir.
d="$(preparar media-credencial)"
salida="$(correr "$d" BACKUP_R2_ACCESS_KEY_ID=solo-la-key)"
afirmar "con access key pero sin secreto, aborta" "falta BACKUP_R2_SECRET_ACCESS_KEY" "$salida"

d="$(preparar media-credencial-2)"
salida="$(correr "$d" BACKUP_R2_SECRET_ACCESS_KEY=solo-el-secreto)"
afirmar "con secreto pero sin access key, aborta" "falta BACKUP_R2_ACCESS_KEY_ID" "$salida"

d="$(preparar sin-account)"
salida="$(correr "$d" BACKUP_R2_ACCESS_KEY_ID=x BACKUP_R2_SECRET_ACCESS_KEY=y)"
afirmar "sin CLOUDFLARE_ACCOUNT_ID aborta: de ahi sale el endpoint" "falta CLOUDFLARE_ACCOUNT_ID" "$salida"

# 4. Sin docker-compose.yml el VPS no esta desplegado: no se toca nada.
d="$(preparar sin-compose)"; rm -f "$d/docker-compose.yml"
salida="$(correr "$d")"
afirmar "sin docker-compose.yml aborta" "el VPS no está desplegado" "$salida"

# 5. El dump es de UNA base con -Fc, jamas pg_dumpall: un pg_dumpall se
#    auto-direcciona a la base de produccion.
d="$(preparar formato)"
salida="$(correr "$d")"
afirmar "dumpea con pg_dump -Fc" "pg_dump -Fc" "$salida"
if printf '%s' "$salida" | grep -q 'pg_dumpall'; then
  fallos=$((fallos + 1)); echo "  FALLA usa pg_dumpall, que se auto-direcciona a produccion"
else
  ok=$((ok + 1)); echo "  OK    no usa pg_dumpall en ningun camino"
fi

# 6. Los prefijos escalonados existen para que el lifecycle de R2 les de
#    retencion distinta. Con sello de la hora 00 tienen que aparecer los dos.
d="$(preparar prefijos)"
salida="$(correr "$d" BACKUP_R2_ACCESS_KEY_ID=x BACKUP_R2_SECRET_ACCESS_KEY=y CLOUDFLARE_ACCOUNT_ID=z)"
afirmar "sube al prefijo hourly/" "hourly/crypto_trader/2026/09/01/" "$salida"
afirmar "a la hora 00 sube tambien a daily/" "daily/crypto_trader/2026/09/" "$salida"
afirmar "sube el sidecar de checksum" ".dump.sha256" "$salida"

# 7. Fuera de la hora 00, daily/ no se escribe.
d="$(preparar prefijos-13h)"
salida="$( cd "$d" && env PATH="$d/bin:$PATH" COMPOSE_DIR="$d" BACKUP_DIR="$d/backups" \
  ENV_BACKUP_FILE="$d/.env.backup" DB_BACKUP_DRY_RUN=1 DB_BACKUP_FAKE_TS=20260901T130000Z \
  BACKUP_R2_ACCESS_KEY_ID=x BACKUP_R2_SECRET_ACCESS_KEY=y CLOUDFLARE_ACCOUNT_ID=z \
  bash "$SCRIPT" 2>&1 )"
if printf '%s' "$salida" | grep -q 'daily/'; then
  fallos=$((fallos + 1)); echo "  FALLA escribe daily/ fuera de la hora 00"
else
  ok=$((ok + 1)); echo "  OK    fuera de la hora 00 no escribe daily/"
fi

# 8. El dry-run no puede ejecutar docker: si lo hace, un ensayo tocaria la base.
d="$(preparar dry-run-puro)"
DOCKER_LOG="$d/docker.log" correr "$d" >/dev/null 2>&1
if [ -s "$d/docker.log" ]; then
  fallos=$((fallos + 1)); echo "  FALLA el dry-run invoco docker: $(head -1 "$d/docker.log")"
else
  ok=$((ok + 1)); echo "  OK    el dry-run no invoca docker"
fi

# 9. El RPO declarado en el log tiene que coincidir con el decidido (1 hora).
d="$(preparar rpo)"
salida="$(correr "$d")"
afirmar "declara el RPO de 1 hora" "última hora" "$salida"

echo
echo "db-backup.sh: ${ok} OK, ${fallos} fallas"
[ "$fallos" -eq 0 ]
