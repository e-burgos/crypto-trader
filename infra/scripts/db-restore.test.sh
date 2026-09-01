#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Suite de db-restore.sh. Contrato: spec-e-burgos-008 cycle-01, TASK-010.
#
# Corre en el runner de CI: NO toca base, ni docker, ni el VPS.
# Lo que cubre no es "el restore funciona" —eso se verifico restaurando de
# verdad en una base descartable (CA-003)— sino las GUARDAS: que un tipeo no
# pueda convertirse en una restauracion sobre la base viva.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${AQUI}/db-restore.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok=0; fallos=0
afirmar() {
  if printf '%s' "$3" | grep -qF -- "$2"; then
    ok=$((ok + 1)); printf '  OK    %s\n' "$1"
  else
    fallos=$((fallos + 1))
    printf '  FALLA %s\n        esperaba: %s\n        obtuvo: %s\n' "$1" "$2" "$(printf '%s' "$3" | tail -3)"
  fi
}

preparar() {
  local dir="$TMP/caso-$1"
  mkdir -p "$dir/bin" "$dir/backups"
  touch "$dir/docker-compose.yml" "$dir/backups/prueba.dump"
  cat > "$dir/bin/docker" <<'EOF'
#!/bin/sh
echo "docker $*" >> "${DOCKER_LOG:-/dev/null}"
exit 0
EOF
  chmod +x "$dir/bin/docker"
  printf '%s' "$dir"
}

correr() {
  local dir="$1"; shift
  ( cd "$dir" && env PATH="$dir/bin:$PATH" COMPOSE_DIR="$dir" BACKUP_DIR="$dir/backups" \
      ENV_BACKUP_FILE="$dir/.env.backup" DB_RESTORE_DRY_RUN=1 \
      bash "$SCRIPT" "$@" 2>&1 )
}

echo "── db-restore.sh"

# 1. --dbname obligatorio y SIN default. Es la guarda central: el dump -Fc no
#    contiene el nombre de destino, asi que alguien tiene que decirlo en voz alta.
d="$(preparar sin-dbname)"
salida="$(correr "$d" --file prueba.dump)"
afirmar "--dbname es obligatorio" "obligatorio y no tiene default" "$salida"

# 2. No se puede restaurar sobre la base de produccion sin --force-production.
d="$(preparar prod)"
salida="$(correr "$d" --file prueba.dump --dbname crypto_trader)"
afirmar "se niega a pisar la base de produccion" "es la base de PRODUCCIÓN" "$salida"
afirmar "y no toca nada al negarse" "No se tocó nada" "$salida"

# 3. Con --force-production explicito, deja de negarse.
d="$(preparar prod-forzado)"
salida="$(correr "$d" --file prueba.dump --dbname crypto_trader --force-production)"
if printf '%s' "$salida" | grep -qF 'es la base de PRODUCCIÓN'; then
  fallos=$((fallos + 1)); echo "  FALLA --force-production no levanta la guarda"
else
  ok=$((ok + 1)); echo "  OK    --force-production levanta la guarda"
fi

# 4. El log NO puede decir que se forzo cuando no se forzo. Este caso existe
#    porque el bug estuvo: ${FORCE_PROD:+...} expandia tambien con "0".
d="$(preparar log-honesto)"
salida="$(correr "$d" --file prueba.dump --dbname descartable)"
if printf '%s' "$salida" | grep -qF -- '--force-production'; then
  fallos=$((fallos + 1)); echo "  FALLA el log menciona --force-production sin haberse pasado"
else
  ok=$((ok + 1)); echo "  OK    el log no miente sobre --force-production"
fi

d="$(preparar log-forzado)"
salida="$(correr "$d" --file prueba.dump --dbname crypto_trader --force-production)"
afirmar "cuando SI se fuerza, el log lo dice" "FORZADO SOBRE PRODUCCIÓN" "$salida"

# 5. Hace falta un origen: --file o --from-r2, y no los dos.
d="$(preparar sin-origen)"
salida="$(correr "$d" --dbname descartable)"
afirmar "exige --file o --from-r2" "hace falta --file o --from-r2" "$salida"

d="$(preparar dos-origenes)"
salida="$(correr "$d" --file prueba.dump --from-r2 x/y.dump --dbname descartable)"
afirmar "--file y --from-r2 son excluyentes" "son excluyentes" "$salida"

# 6. Un argumento desconocido corta, no se ignora en silencio.
d="$(preparar arg-raro)"
salida="$(correr "$d" --file prueba.dump --dbname descartable --wipe-everything)"
afirmar "un argumento desconocido aborta" "argumento desconocido" "$salida"

# 7. Sin docker-compose.yml no hay VPS desplegado.
d="$(preparar sin-compose)"; rm -f "$d/docker-compose.yml"
salida="$(correr "$d" --file prueba.dump --dbname descartable)"
afirmar "sin docker-compose.yml aborta" "no hay docker-compose.yml" "$salida"

# 8. El dry-run no ejecuta docker: un ensayo no puede tocar ninguna base.
d="$(preparar dry-run-puro)"
DOCKER_LOG="$d/docker.log" correr "$d" --file prueba.dump --dbname descartable >/dev/null 2>&1
if [ -s "$d/docker.log" ]; then
  fallos=$((fallos + 1)); echo "  FALLA el dry-run invoco docker: $(head -1 "$d/docker.log")"
else
  ok=$((ok + 1)); echo "  OK    el dry-run no invoca docker"
fi

# 9. El restore siempre pasa --dbname explicito a pg_restore.
d="$(preparar dbname-explicito)"
salida="$(correr "$d" --file prueba.dump --dbname descartable)"
afirmar "pg_restore recibe --dbname explicito" "--dbname descartable" "$salida"

echo
echo "db-restore.sh: ${ok} OK, ${fallos} fallas"
[ "$fallos" -eq 0 ]
