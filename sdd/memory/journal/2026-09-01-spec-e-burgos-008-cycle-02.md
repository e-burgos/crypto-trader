# spec-e-burgos-008 cycle-02 — 2026-09-01

## Qué pasó

**El CLI `gh` tiene tres cuentas configuradas y la activa por defecto NO es la que sirve.** Un
`gh secret list` sobre `e-burgos/crypto-trader` devolvió `HTTP 403: You must have repository read
permissions` y se interpretó como "no puedo cargar los secrets, que los cargue el dev". La causa
real era otra: la cuenta activa era `eburgos-flx`, que tiene permiso **READ**. La cuenta con
**ADMIN** es `e-burgos`, y estaba configurada todo el tiempo.

Cuentas presentes: `eburgos-flx` (la que suele quedar activa), `es-burgos`, `e-burgos`.

## Lección

Antes de cualquier operación con `gh`, cambiar a `e-burgos` con `gh auth switch --user e-burgos`,
y **volver a la cuenta que estaba activa al terminar** — otras herramientas del entorno dependen de
ella. Un 403 de `gh` es cuenta equivocada hasta que se demuestre lo contrario, no falta de permisos.

```bash
ORIGINAL=$(gh auth status 2>&1 | grep -B1 "Active account: true" \
  | grep -oE "account [a-z-]+" | awk '{print $2}')
gh auth switch --user e-burgos
# ... operaciones con gh ...
gh auth switch --user "$ORIGINAL"
```

Capturar `ORIGINAL` en vez de asumir `eburgos-flx`: si alguien dejó activa otra cuenta, devolverla
a una fija sería cambiarle el entorno al dev sin avisar.

## Costo evitable

Se escribió `infra/scripts/github-secrets-sync.sh` con el supuesto de que un agente **no puede**
cargar los secrets, y se le pidió al dev que lo corriera. El script sigue siendo útil —documenta el
mapa de secretos y sirve para rotarlos—, pero el bloqueo era falso: con la cuenta correcta la
operación era inmediata. Media vuelta de conversación y un traspaso de tarea al dev que no hacía
falta.

## Nota de alcance

Este aprendizaje es **del entorno de trabajo**, no de este subproyecto: aplica a cualquier ciclo y
a cualquier repo de este dev. Al destilar, va a la categoría **Proceso** de `lessons.md`, no a la
`constitution.md` de ningún subproyecto.
