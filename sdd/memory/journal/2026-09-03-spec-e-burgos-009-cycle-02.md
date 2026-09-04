# spec-e-burgos-009 cycle-02 — 2026-09-03

## Qué pasó

- Un implementador paralelo hizo `git reset` y un commit de archivo completo en el árbol compartido:
  barrió el spec de otra task en su commit, dejó una borrado *staged* del mismo archivo y tiró un
  commit de registro del orquestador, que hubo que rehacer. Después se cortó por el límite de gasto
  de la cuenta a mitad de una operación de git.
- El planner lanzó un subagente de exploración para verificar paths que ya estaban en el brief.

## Lección

- Los implementadores **no ejecutan `git reset`, `git checkout --`, `git stash` ni commits de archivo
  completo** en el árbol compartido: sólo `git add <sus paths>` y `git commit`. Si ven un archivo
  ajeno en el índice, lo reportan y siguen.
- Un agente de tier estándar no delega exploración a subagentes cuando el brief ya trae los hechos:
  cuesta tokens y contexto sin aportar.
- Ante el corte de un agente por límite de gasto, inspeccionar `git status` (staged vs unstaged)
  antes de reanudarlo o relanzarlo; lo pequeño lo termina el orquestador, que ya tiene el contexto.

## Costo evitable

- Un commit rehecho, un `git restore --staged` de rescate y un subagente de exploración innecesario.
