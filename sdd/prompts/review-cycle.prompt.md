# Prompt: Revisar y Cerrar Ciclo

> Para uso en cualquier monorepo que implemente SDD

## Cómo usarlo

```
Revisar el Ciclo [N] — Spec [spec-id] — Módulo [nombre].

Invocar el agente sdd-reviewer con el output completo del ciclo:
- Historias de usuario generadas
- Tasks del Planner
- Schema y contratos del Arquitecto
- Código del Implementador Backend
- Código del Implementador Frontend

Si el reviewer aprueba — realizar EN ESTE ORDEN:
0. ⛔ VALIDATION GATE (pre-review): correr pnpm sdd:validate
   → si falla, los registros del ciclo están mal estructurados: devolver al implementador
1. Actualizar sdd/global.json:
   - Mover [módulo] de in_progress_modules a completed_modules (apps[], cycles_completed, completed_at)
2. Actualizar cycle.json a status "completed" con reviewer_report
3. Confirmar que sdd/schema.json y sdd/api.json están actualizados
4. Marcar tasks del ciclo como "done" en sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json
   + regenerar índice (pnpm sdd:rebuild-tasks-index)
4b. ⛔ VALIDATION GATE (post-cierre): pnpm sdd:validate DEBE quedar en verde
   → registrar el resultado en reviewer_report.tests["sdd:validate"]
   → el mismo check corre en CI (sdd-validate.yml): un cierre en rojo rompe el PR
5. ⛔ CONTEXTO GATE — OBLIGATORIO — no cerrar el ciclo sin completar:
   a. Escribir el fragmento aditivo del subproyecto (NO editar constitution.md ni
      context_prompt.md del subproyecto durante el ciclo — regla 🧩 del dual-harness):
      sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md
      → solo el delta: Estado / Estructura / Dependencias / Qué sigue
      → si algo "pendiente" del base quedó implementado, anotarlo como "resuelve: ..."
      → NO tocar la línea "Última actualización:" del base (solo cambia al consolidar)
   b. Actualizar sdd/context/constitution.md (global)
      → solo la fila del subproyecto en la tabla-snapshot (sección 3)
      → agregar fila nueva al final si se creó un nuevo app/lib/tool
   c. Actualizar sdd/context/context_prompt.md (global)
      → agregar fila nueva al final si se creó un nuevo app/lib/tool
   d. Si updates/ del subproyecto acumula ≥5 fragmentos → consolidar (un solo actor):
      fundir fragmentos en los archivos base, actualizar encabezado, borrar fragmentos,
      commit dedicado "chore(sdd): consolidate context updates for [nombre]"

Si requiere cambios:
1. Identificar el agente responsable de cada issue
2. Re-ejecutar solo ese agente con el issue específico
3. Re-ejecutar el reviewer
```

---

## ⛔ CONTEXTO GATE — Regla de frescura

El contexto vigente de un subproyecto = archivos base + `updates/*.md` en orden de
nombre (el prefijo de fecha ordena solo). Se considera **desactualizado** (= ciclo NO
cerrado) si:

- No existe fragmento en `updates/` para el ciclo que se está cerrando
- El conjunto base+fragmentos describe estructura de paquetes que no coincide con el código real
- El conjunto base+fragmentos menciona como "pendiente" funcionalidad ya implementada sin fragmento que lo corrija
- Le faltan dependencias o patrones que sí existen en el código

**El reviewer NO puede marcar el ciclo como `completed` en `cycle.json` mientras el contexto esté desactualizado.**
