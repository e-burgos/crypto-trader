---
trigger: always_on
description: Gates inviolables del sistema SDD - SPEC GATE, tipado estricto, CONTEXTO GATE y FIX GATE (versión condensada; fuente completa en GEMINI.md)
---

# Gates SDD (inviolables)

Este repo usa Spec-Driven Development. Fuente completa: `GEMINI.md` raíz +
`sdd/context/context_prompt.md`. Al iniciar sesión leer también `sdd/memory/lessons.md`.

## ⛔ SPEC GATE — antes de escribir UNA línea de código de implementación

Verificar que exista TODO esto (si algo falta → DETENER y completarlo primero):

1. `sdd/specs/spec-[gh-user]-[NNN]-[slug]/…spec.md` registrada en `sdd/specs/index.json`
2. Módulo en `in_progress_modules` de `sdd/global.json`
3. En `cycles/cycle-[XX]/`: `brief.yaml`, `functional.md`, `planner.md`,
   `architect.md`, `cycle.json`, `tasks.json` con tasks
4. `sdd/context/[apps|libs|tools]/[nombre]/constitution.md`

Solo esos 6 archivos pueden existir en la raíz del ciclo; documentos de apoyo van en
`cycle-[XX]/artifacts/` referenciados en `cycle.json["artifacts"]`.

El `cycle.json` se crea al INICIAR el ciclo con `status: "in-progress"`; solo el
sdd-reviewer lo pasa a `"completed"` al cerrar.

## ⛔ Tipado estricto de registros SDD

Todo `*.json` de `sdd/` tiene JSON Schema estricto en `sdd/schemas/` y declara
`$schema`. Antes de escribir un registro: leer su schema. Después de escribir:

```bash
pnpm sdd:validate            # valida TODOS los registros + reglas cruzadas
pnpm sdd:rebuild-tasks-index # regenera el índice sdd/tasks.json
```

`sdd/tasks.json` es solo un índice generado — las tasks canónicas viven en el
`tasks.json` de cada ciclo. Un commit con `pnpm sdd:validate` en rojo es inválido
(el mismo check corre en CI).

## ⛔ CONTEXTO GATE — al cerrar cualquier ciclo

El sdd-reviewer debe dejar actualizado el contexto ANTES de completar el ciclo:

- Fragmento aditivo en `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
  (NUNCA editar directamente `constitution.md` / `context_prompt.md` del subproyecto
  durante un ciclo — solo la consolidación de un solo actor los toca).
- En las tablas globales (`sdd/context/constitution.md` y `context_prompt.md`): tocar
  solo la fila del subproyecto propio.
- Si hubo lección real: entrada en `sdd/memory/journal/` (mismo naming). Lo obvio o ya
  documentado NO se escribe.

## 🔧 FIX GATE — bypass controlado del SPEC GATE

Para trabajo que no puede esperar un ciclo completo, prefijos al orquestador:
`[HOTFIX]` (producción bloqueada) · `[BUGFIX]` (error confirmado) · `[FIX]` (genérico)
· `[IMPROVEMENT]` (mejora menor). El orquestador corre
`sdd/prompts/hotfix-bypass-gate.prompt.md`: registra el fix en `sdd/fixes.json`
(FIX-…), crea el documento del fix y recién ahí autoriza a implementar. Al resolverlo,
registrar también `usage` (tokens/modelo — ver rule de presupuesto de modelos). La
trazabilidad no se elimina: se simplifica.
