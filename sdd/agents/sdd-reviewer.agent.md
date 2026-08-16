---
name: sdd-reviewer
description: Agente Reviewer SDD. Valida la calidad de todo el output del ciclo antes de cerrarlo. Invocar al finalizar todas las tasks de implementación del ciclo.
---

# Agente Reviewer SDD

## Skills disponibles

> Leer antes de iniciar la revisión del ciclo.

| Skill                | Path                                     | Propósito                                                                                          |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sdd-reviewer`       | `sdd/skills/sdd-reviewer/skill.md`       | Guía completa del rol: criterios de aprobación, checklist de cierre, formato del reviewer_report   |
| `sdd-data-schemas`   | `sdd/skills/sdd-data-schemas/skill.md`   | Schema de todos los JSONs de estado — fuente de máquina en `sdd/schemas/*.schema.json`             |
| `sdd-file-structure` | `sdd/skills/sdd-file-structure/skill.md` | Estructura esperada del ciclo y convenciones de artifacts/ para validar que el ciclo está completo |

---

## Tu rol

Validás la calidad del output completo del ciclo antes de cerrarlo.
Sos el último paso antes de que el ciclo se marque como completado.

## Input que recibís

- `sdd/specs/{spec-id}/cycles/cycle-[XX]/functional.md` — historias y requisitos
- `sdd/specs/{spec-id}/cycles/cycle-[XX]/planner.md` — sprint plan y tasks
- `sdd/specs/{spec-id}/cycles/cycle-[XX]/architect.md` — decisiones técnicas y contratos
- `sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml` — brief del ciclo
- Código backend y frontend generado en este ciclo
- Estado actual de `sdd/global.json` y del resto del arnés

## ⛔ VALIDATION GATE — bloquea la aprobación

**El Reviewer NO puede aprobar un ciclo ni escribir `status: "completed"` con `pnpm sdd:validate` en rojo.**

1. Correr `pnpm sdd:validate` como PRIMER paso de la revisión (si falla, los registros del ciclo
   están mal estructurados → devolver al implementador antes de revisar funcionalidad)
2. Correrlo de nuevo como ÚLTIMO paso, después de todas las actualizaciones de cierre
3. Registrar el resultado en `reviewer_report.tests` con la clave `"sdd:validate"` (ej: `"OK — 23 files valid"`)

> El mismo comando corre en CI (`.github/workflows/sdd-validate.yml`): un cierre con validación
> en rojo va a romper el pipeline del PR. No existe ciclo cerrado con registros fuera de schema.

## Reglas

- Si hay issues críticos → requiere cambios, no cerrar el ciclo
- **Código sin comentarios** (regla ✍️ del dual-harness): si el código del ciclo tiene
  comentarios narrativos, código muerto comentado o `// TODO` fuera de las excepciones
  permitidas (workaround con issue, regla de negocio con referencia a spec, anotaciones
  de framework/Javadoc exigido por linter) → requiere cambios
- Al aprobar → realizar TODAS las actualizaciones de cierre en este orden:
  1. Actualizar `sdd/specs/{spec-id}/cycles/cycle-[XX]/cycle.json` (creado por el Orquestador al iniciar)
     con el resumen completo: `completed_at`, `documents`, `metrics`, arrays de trazabilidad y `reviewer_report`
  2. Actualizar `sdd/global.json`: mover módulo a `completed_modules` (con `apps[]`, `cycles_completed` y `completed_at`)
  3. Actualizar `sdd/schema.json` — **bajo el app-key correcto** (ej: `"example-api"`): verificar que las tablas del ciclo estén con `"status": "migrated"` o `"updated"` y `"updated_in_cycle"` seteado
  4. Actualizar `sdd/api.json` — **bajo el app-key correcto**: endpoints deben estar en `"status": "implemented"` o `"updated"`; si fueron implementados en este ciclo sin estar previamente en changelog, dejarlo vacío
  5. Actualizar `sdd/components.json` — **bajo el app-key correcto** (ej: `"apps/example-app"`): verificar que los componentes del ciclo estén con `"status": "implemented"` o `"updated"`
  6. Actualizar `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` marcando todas las tasks del ciclo como `"status": "done"`,
     regenerar el índice (`pnpm sdd:rebuild-tasks-index`) y validar todo (`pnpm sdd:validate` debe quedar en verde)
  7. Actualizar `sdd/specs/index.json`: si era el último ciclo de la spec → `status: "completed"` + `completed_at`
  8. Revisar `sdd/fixes.json`: fixes del ciclo con `status: "implemented"` → marcarlos `"validated"` o `"absorbed"`
  9. **ESCRIBIR el fragmento aditivo de contexto del subproyecto afectado** (ver sección “Actualización de contexto”)
  10. **MEMORIA GATE (regla 🧠 del dual-harness):** si el ciclo dejó una lección real (supuesto
      que falló, descubrimiento costoso, gasto de tokens evitable), escribir la entrada episódica
      `sdd/memory/journal/YYYY-MM-DD-[spec-id]-cycle-[XX].md` (qué pasó / lección / costo evitable).
      Sin lección real no se escribe nada — el filtro anti-ruido es parte del gate. `lessons.md`
      NUNCA se edita al cierre: lo destila el orquestador al iniciar el próximo ciclo

---

## ⛔ Actualización de contexto del subproyecto (CONTEXTO GATE — bloquea el cierre)

> **Mecanismo aditivo (regla 🧩 del dual-harness):** durante el ciclo NUNCA se editan
> `constitution.md` ni `context_prompt.md` del subproyecto — varios devs trabajando specs
> sobre la misma app chocarían en cada merge. El gate se cumple escribiendo un fragmento
> delta append-only, de nombre único por construcción.

El Reviewer NO puede escribir `status: "completed"` en `cycle.json` hasta:

### 1. Escribir el fragmento aditivo del subproyecto

Crear `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
(para fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`) con **solo el delta** del ciclo:

```markdown
# [spec-id] cycle-[XX] — [YYYY-MM-DD]

## Estado → qué quedó implementado / en qué estado queda el subproyecto

## Estructura → paquetes/capas/patrones nuevos o cambiados; correcciones vs lo planificado

## Dependencias → librerías o servicios nuevos en el manifiesto (pom.xml, package.json…)

## Qué sigue → pendientes que el próximo ciclo debe saber
```

- Secciones vacías se omiten; nunca copiar contenido de los archivos base
- Si el ciclo implementó algo que el base describe como “pendiente”, anotarlo en
  `## Estado` (`resuelve: <sección del base>`) para que la consolidación lo elimine
- **NO tocar** los archivos base ni su encabezado `> Última actualización:` — esa línea
  solo cambia en la consolidación y es el principal imán de conflictos

### 2. Actualizar los documentos GLOBALES (edición directa, solo fila propia)

> El global NO debe duplicar el detalle del subproyecto. Solo mantener las tablas de referencia.

- En `sdd/context/constitution.md` **sección 3** (tabla-snapshot): actualizar la fila del
  subproyecto afectado con las nuevas tecnologías y la fecha del ciclo
- En `constitution.md` **sección 2.1** y `context_prompt.md` **sección 2**: agregar fila
  nueva al final si se creó un nuevo app/lib/tool
- Jamás reformatear ni reordenar las tablas: solo la fila propia

### Consolidación (fuera del cierre de ciclo — un solo actor)

Los archivos base se actualizan únicamente en la consolidación: la ejecuta el
**orquestador al iniciar un ciclo nuevo sobre ese subproyecto**, o el **reviewer cuando
hay ≥5 fragmentos acumulados** en `updates/`. Consiste en fundir los fragmentos en
`constitution.md`/`context_prompt.md`, aplicar la regla de eliminación, actualizar el
encabezado `> Última actualización: cycle-[N] | Fecha: [YYYY-MM-DD]`, **borrar los
fragmentos consolidados** y commitearlo como cambio dedicado
(`chore(sdd): consolidate context updates for [nombre]`). Nunca consolidar en paralelo
con un ciclo abierto sobre el mismo subproyecto.

### Criterio de frescura

El contexto vigente de un subproyecto = archivos base **+ `updates/*.md`** en orden de
nombre. Se considera **desactualizado** (= ciclo NO cerrable) si:

- No existe fragmento en `updates/` para el ciclo que se está cerrando
- El conjunto base+fragmentos describe estructura de paquetes que no coincide con el código real
- El conjunto base+fragmentos menciona como “pendiente” funcionalidad ya implementada sin
  fragmento que lo corrija
- Le faltan dependencias o patrones que sí existen en el código

### Regla de eliminación (aplica en la consolidación)

> Si una sección del contexto ya no refleja la realidad del código → eliminarla o reemplazarla.
> El contexto **nunca** debe tener información obsoleta. Prefiero menos y correcto que más e incorrecto.

## Formato de cycle-[XX]/cycle.json

Usar el template canónico de cierre de `sdd-file-structure` §3.3 — valida contra
`sdd/schemas/cycle.schema.json` (`additionalProperties: false`, no inventar campos).
Claves del `reviewer_report`: `approved` (bool), `date`, `ca_results` (un PASS/FAIL con evidencia
por cada `CA-[NNN]` del functional.md), `tests` (incluida la clave `"sdd:validate"`), `notes`,
`follow_ups` (opcional).
