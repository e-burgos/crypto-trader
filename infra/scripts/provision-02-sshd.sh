#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Provisioning del VPS Hetzner — paso 2 de 3: endurecimiento de sshd.
# Contrato: spec-e-burgos-008 cycle-01, architect §3. Cubre US-01-001.
#
# ⚠️ CORRER SÓLO DESPUÉS DE VERIFICAR QUE EL USUARIO NO-ROOT ENTRA POR CLAVE.
# Este script apaga la autenticación por contraseña. Si la clave del usuario
# creado por provision-01-base.sh no quedó bien instalada, el único camino de
# vuelta es la consola web de Hetzner (que no pasa por sshd) con la contraseña
# de root — por eso esa contraseña se conserva aunque ya no sirva para SSH.
#
# POR QUÉ EL ARCHIVO SE LLAMA 00-crypto-trader.conf Y NO 99-
# ---------------------------------------------------------
# En OpenSSH gana el PRIMER valor obtenido para cada keyword, no el último.
# /etc/ssh/sshd_config trae `Include /etc/ssh/sshd_config.d/*.conf` en la línea
# 24 —antes de su propio `PermitRootLogin yes` de la línea 54— y los .conf se
# leen en orden alfabético. La imagen de Hetzner deja 50-cloud-init.conf con
# `PasswordAuthentication yes`. Un archivo 99- se leería DESPUÉS y perdería.
# El prefijo 00- es la razón por la que este script funciona.
#
# Uso:  ssh root@<host> 'bash -s' < provision-02-sshd.sh
# Sale 0 si sshd -t valida y la config efectiva refleja lo pedido.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "FATAL: se corre como root" >&2; exit 1; }

CONF=/etc/ssh/sshd_config.d/00-crypto-trader.conf

cat > "$CONF" <<'EOF'
# spec-e-burgos-008 cycle-01 — el prefijo 00- es deliberado, ver el script que
# genera este archivo: en OpenSSH gana el primer valor obtenido y este .conf
# debe leerse antes que 50-cloud-init.conf.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
MaxAuthTries 3
X11Forwarding no
EOF
chmod 644 "$CONF"

sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd

# Verificación por config efectiva, no por contenido del archivo: lo que
# importa es lo que sshd resolvió tras leer todos los includes.
eff() { sshd -T | awk -v k="$1" '$1==k{print $2}'; }
fail=0
for pair in "passwordauthentication no" "kbdinteractiveauthentication no" \
            "permitemptypasswords no" "pubkeyauthentication yes" \
            "permitrootlogin prohibit-password"; do
  k="${pair%% *}"; want="${pair#* }"; got="$(eff "$k")"
  if [ "$got" = "$want" ]; then
    echo "OK   $k = $got"
  else
    echo "FALLA $k = ${got:-<vacío>} (esperado $want)" >&2; fail=1
  fi
done
exit "$fail"
