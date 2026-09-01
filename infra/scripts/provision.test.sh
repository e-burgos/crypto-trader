#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Suite de los scripts de provisioning. Contrato: spec-e-burgos-008 cycle-01,
# TASK-002. Cubre US-01-002.
#
# Corre en el runner de CI: NO toca el VPS ni la API de Hetzner. La idempotencia
# REAL se verifico corriendo los scripts dos veces contra el servidor (evidencia
# en el commit de TASK-001); lo que esta suite protege son las propiedades que
# se pueden romper editando el archivo sin darse cuenta.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok=0; fallos=0
pasa() { ok=$((ok + 1)); printf '  OK    %s\n' "$1"; }
falla() { fallos=$((fallos + 1)); printf '  FALLA %s\n        %s\n' "$1" "${2:-}"; }

SCRIPTS="provision-01-base.sh provision-02-sshd.sh provision-03-firewall.sh"

echo "── provisioning"

# 1. Todos parsean. Un script de infra con un error de sintaxis se descubre
#    normalmente a mitad de un provisioning, con el servidor a medio configurar.
for s in $SCRIPTS; do
  if bash -n "${AQUI}/${s}" 2>/dev/null; then pasa "sintaxis de ${s}"
  else falla "sintaxis de ${s}" "$(bash -n "${AQUI}/${s}" 2>&1 | head -1)"; fi
done

# 2. Todos abortan ante el primer error y ante una variable sin definir. Sin
#    `set -e`, un paso fallido sigue de largo y deja el servidor a medias.
for s in $SCRIPTS; do
  if grep -qE '^set -euo pipefail' "${AQUI}/${s}"; then pasa "${s} usa set -euo pipefail"
  else falla "${s} no usa set -euo pipefail"; fi
done

# 3. Ningun script lleva secretos literales. Los toma del entorno o falla.
patrones='gho_|ghp_|github_pat_|-----BEGIN|AKIA[0-9A-Z]{16}'
for s in $SCRIPTS; do
  if grep -qE "$patrones" "${AQUI}/${s}"; then
    falla "${s} contiene algo que parece un secreto literal"
  else pasa "${s} sin secretos literales"; fi
done

# 4. El de firewall exige sus tres entradas con `: "${VAR:?}"`. Sin eso, correrlo
#    sin token crearia un firewall vacio o fallaria de forma incomprensible.
for v in HETZNER_API_TOKEN DEV_IP SERVER_ID; do
  if grep -qE ": \"\\\$\{${v}:\?" "${AQUI}/provision-03-firewall.sh"; then
    pasa "provision-03 exige ${v}"
  else falla "provision-03 no exige ${v}"; fi
done

# 5. Correr el de firewall sin variables tiene que abortar, no intentar nada.
salida="$( cd "$TMP" && env -u HETZNER_API_TOKEN -u DEV_IP -u SERVER_ID \
  bash "${AQUI}/provision-03-firewall.sh" 2>&1 )"
if printf '%s' "$salida" | grep -qF 'falta HETZNER_API_TOKEN'; then
  pasa "sin HETZNER_API_TOKEN aborta con un mensaje claro"
else falla "sin HETZNER_API_TOKEN no aborta como corresponde" "$salida"; fi

# 6. El de sshd tiene que generar un archivo que ordene ANTES que
#    50-cloud-init.conf. En OpenSSH gana el PRIMER valor obtenido y la imagen de
#    Hetzner trae PasswordAuthentication yes en ese 50-: un prefijo mayor
#    perderia y el script quedaria sin efecto, en silencio.
conf="$(grep -oE '/etc/ssh/sshd_config\.d/[0-9]+-[a-z-]+\.conf' "${AQUI}/provision-02-sshd.sh" | head -1)"
prefijo="$(basename "$conf" | cut -d- -f1)"
if [ -n "$prefijo" ] && [ "$prefijo" -lt 50 ] 2>/dev/null; then
  pasa "el .conf de sshd ordena antes que 50-cloud-init.conf (prefijo ${prefijo})"
else
  falla "el .conf de sshd no ordena antes que 50-cloud-init.conf" "prefijo detectado: ${prefijo:-ninguno}"
fi

# 7. El de sshd apaga las tres puertas de contrasena, no solo una.
for opcion in 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitEmptyPasswords no'; do
  if grep -qF "$opcion" "${AQUI}/provision-02-sshd.sh"; then pasa "sshd fija: ${opcion}"
  else falla "sshd no fija: ${opcion}"; fi
done

# 8. root queda accesible por clave como camino de emergencia: si el usuario
#    no-root se rompe, la consola web de Hetzner mas la clave son la vuelta.
if grep -qF 'PermitRootLogin prohibit-password' "${AQUI}/provision-02-sshd.sh"; then
  pasa "root queda en prohibit-password, no bloqueado del todo"
else falla "PermitRootLogin no quedo en prohibit-password"; fi

# 9. El de sshd verifica por CONFIG EFECTIVA (sshd -T), no leyendo el archivo
#    que acaba de escribir. Comprobar lo que uno mismo escribio no prueba nada:
#    lo que importa es lo que sshd resolvio tras leer todos los includes.
if grep -qF 'sshd -T' "${AQUI}/provision-02-sshd.sh"; then
  pasa "sshd se verifica por config efectiva (sshd -T)"
else falla "sshd no verifica por sshd -T"; fi

# 10. El de base no hardcodea el codename de Ubuntu: lo toma del propio SO, o el
#     script deja de servir en cuanto el servidor se actualice.
if grep -qF '${UBUNTU_CODENAME}' "${AQUI}/provision-01-base.sh"; then
  pasa "el repo de Docker usa el codename del SO, no uno fijo"
else falla "el codename de Ubuntu parece hardcodeado"; fi

# 11. El de base copia la clave desde /root/.ssh/authorized_keys, que es la que
#     ya demostro que entra. Inventar otra fuente crea usuarios inaccesibles.
if grep -qF '/root/.ssh/authorized_keys' "${AQUI}/provision-01-base.sh"; then
  pasa "el usuario no-root hereda la clave que ya funciona"
else falla "el usuario no-root no hereda /root/.ssh/authorized_keys"; fi

echo
echo "provisioning: ${ok} OK, ${fallos} fallas"
[ "$fallos" -eq 0 ]
