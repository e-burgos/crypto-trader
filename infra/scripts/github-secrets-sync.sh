#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Carga en GitHub Secrets lo que el workflow de deploy necesita.
# Contrato: spec-e-burgos-008 cycle-02, Fase 5.
#
# Lee los valores de .env.production (que NO se versiona) y los sube con `gh`.
# NUNCA imprime un valor: solo el nombre y si quedo cargado.
#
# Requiere una cuenta con permiso ADMIN sobre el repo. Con permiso READ, la API
# de secrets devuelve 403 — es el caso de una cuenta secundaria.
#
# Uso:  bash infra/scripts/github-secrets-sync.sh [--dry-run]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/crypto-trader-hetzner}"
DRY_RUN=0
[ "${1:-}" = '--dry-run' ] && DRY_RUN=1

command -v gh >/dev/null || { echo "FATAL: falta el CLI gh" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "FATAL: no existe $ENV_FILE" >&2; exit 1; }

# Mapa: NOMBRE_DEL_SECRET <- VARIABLE_EN_ENV_FILE
# Se separan porque los nombres locales de los secretos de produccion llevan
# prefijo PROD_ para no pisar los valores de desarrollo del mismo archivo.
MAPA="
POSTGRES_PASSWORD=POSTGRES_PASSWORD
APP_DB_PASSWORD=APP_DB_PASSWORD
JWT_SECRET=PROD_JWT_SECRET
JWT_REFRESH_SECRET=PROD_JWT_REFRESH_SECRET
BINANCE_KEY_ENCRYPTION_KEY=PROD_BINANCE_KEY_ENCRYPTION_KEY
ADMIN_USERNAME=ADMIN_USERNAME
ADMIN_PASSWORD=ADMIN_PASSWORD
CLOUDFLARE_ACCOUNT_ID=CLOUDFLARE_ACCOUNT_ID
BACKUP_R2_ACCESS_KEY_ID=BACKUP_R2_ACCESS_KEY_ID
BACKUP_R2_SECRET_ACCESS_KEY=BACKUP_R2_SECRET_ACCESS_KEY
"

leer_env() {
  # Toma el valor tal cual del archivo, sin ejecutarlo: un `source` correria
  # cualquier cosa que alguien haya dejado ahi.
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed 's/^"//; s/"$//'
}

faltantes=0
for par in $MAPA; do
  secret="${par%%=*}"; var="${par##*=}"
  valor="$(leer_env "$var")"
  if [ -z "$valor" ]; then
    echo "  FALTA   $secret  (no hay $var en $ENV_FILE)"
    faltantes=$((faltantes + 1))
    continue
  fi
  if [ "$DRY_RUN" = '1' ]; then
    echo "  (dry)   $secret  <- $var  (${#valor} chars)"
  else
    # Por stdin, sin --body ni --body-file: --body dejaria el valor en la linea de
    # comandos (visible en `ps` y en el historial), y --body-file no existe en
    # todas las versiones del CLI. Sin flag, `gh secret set` lee de stdin.
    printf '%s' "$valor" | gh secret set "$secret" >/dev/null
    echo "  OK      $secret"
  fi
done

# La clave SSH es un archivo, no una variable del .env.
if [ -f "$SSH_KEY_FILE" ]; then
  if [ "$DRY_RUN" = '1' ]; then
    echo "  (dry)   HETZNER_SSH_KEY  <- $SSH_KEY_FILE"
  else
    gh secret set HETZNER_SSH_KEY < "$SSH_KEY_FILE" >/dev/null
    echo "  OK      HETZNER_SSH_KEY"
  fi
else
  echo "  FALTA   HETZNER_SSH_KEY  (no existe $SSH_KEY_FILE)"
  faltantes=$((faltantes + 1))
fi

echo
if [ "$faltantes" -gt 0 ]; then
  echo "$faltantes secreto(s) sin cargar. El deploy va a fallar hasta completarlos."
  exit 1
fi
echo "Todos los secretos del deploy estan cargados."
