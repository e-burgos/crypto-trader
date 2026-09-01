#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Provisioning del VPS Hetzner — paso 1 de 3: base del servidor.
# Contrato: spec-e-burgos-008 cycle-01, architect §3. Cubre US-01-002.
#
# POR QUÉ ESTE ARCHIVO ESTÁ VERSIONADO
# ------------------------------------
# El dueño decidió NO usar los backups de Hetzner (2026-08-31): sin snapshots,
# la configuración del servidor sólo existe en git. Un paso ejecutado a mano y
# no versionado es un paso que se pierde. Es la falla concreta de display-ads,
# cuyo infrastructure.md describe el estado final pero nunca cómo se llegó.
#
# IDEMPOTENTE: correrlo N veces deja el mismo resultado que correrlo una.
# NO toca sshd — eso es provision-02-sshd.sh, que se corre DESPUÉS de verificar
# que el usuario no-root entra por clave (apagar la contraseña antes de eso
# deja el servidor inaccesible si la clave no quedó bien instalada).
#
# Entradas (entorno, con defaults):
#   DEPLOY_USER   default deploy    usuario no-root dueño de la app
#   APP_DIR       default /opt/crypto-trader
#   SWAP_SIZE     default 2G        el CX23 viene con swap 0 y 3.7 GiB de RAM
#
# Uso:  ssh root@<host> 'bash -s' < provision-01-base.sh
# Sale 0 si docker run hello-world corre.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/crypto-trader}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "FATAL: se corre como root" >&2; exit 1; }

say "usuario no-root: $DEPLOY_USER"
if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "ya existe"
else
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi

# La clave sale de /root/.ssh/authorized_keys: es la que ya demostró que entra.
# Copiar una clave distinta acá es la forma más fácil de crear un usuario al
# que nadie puede acceder.
[ -s /root/.ssh/authorized_keys ] || { echo "FATAL: /root/.ssh/authorized_keys vacío" >&2; exit 1; }
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
visudo -c -q

say "swap ($SWAP_SIZE)"
# El CX23 viene sin swap. Con 3.7 GiB de RAM corriendo Postgres + Redis + Node
# + nginx, quedarse sin swap significa que el OOM killer elige qué matar.
if swapon --show | grep -q .; then
  echo "ya hay swap activa"
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q -w vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

say "docker"
if command -v docker >/dev/null 2>&1; then
  echo "ya instalado: $(docker --version)"
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  # El codename se toma del propio SO, no se hardcodea: el servidor corre
  # Ubuntu 26.04 (resolute) y Docker publica para él, pero el script tiene que
  # seguir sirviendo cuando el SO cambie.
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
usermod -aG docker "$DEPLOY_USER"

say "actualizaciones de seguridad desatendidas"
# Sin snapshots de Hetzner, un servidor sin parches automáticos es riesgo puro.
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

say "directorio de la app"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

say "verificación"
echo "docker:  $(docker --version)"
echo "compose: $(docker compose version --short 2>/dev/null || echo '?')"
echo "swap:    $(free -h | awk '/Swap:/{print $2}')"
echo "usuario: $(id "$DEPLOY_USER")"
echo "appdir:  $(stat -c '%n %U:%G %a' "$APP_DIR")"
docker run --rm hello-world >/dev/null 2>&1 && echo "hello-world: OK" || {
  echo "hello-world: FALLO" >&2; exit 1; }
