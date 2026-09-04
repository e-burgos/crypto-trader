# Prompt: Verificar SPEC GATE antes de implementar

> Usar este prompt SIEMPRE antes de escribir código de implementación

## Qué es el SPEC GATE

El SPEC GATE es una verificación obligatoria que garantiza que ninguna
implementación se inicia sin haber completado el flujo de diseño SDD.

## Cómo usar

Antes de cualquier implementación, ejecutar este checklist y reportar el resultado:

```
SPEC GATE — Verificación para el módulo: [NOMBRE DEL MÓDULO]
Ciclo: [N]
Fecha: [FECHA]

ESTADO DE PRERREQUISITOS:
────────────────────────────────────────────────────────────
[ ] 1. Spec existe con formato correcto: sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md
        → Ruta: sdd/specs/spec-___-_____________.spec.md
        → Estado: EXISTE / NO EXISTE

[ ] 1b. Spec registrada en sdd/specs/index.json
        → SPEC-ID: SPEC-___
        → Estado: REGISTRADA / NO REGISTRADA

[ ] 1c. Status de la spec en sdd/specs/index.json ≠ "draft"
        → Estados posibles: draft / in-progress / completed / cancelled
        → Estado actual: _____________
        → ⚠️ "draft" = spec escrita pero sin ciclo abierto todavía: una spec "draft"
           NO se implementa. Primero el sdd-orchestrator abre cycle-01 y la pasa a
           "in-progress" (ver start-sdd-cycle.prompt.md) — recién ahí puede continuar
           el SPEC GATE.

[ ] 2. Módulo registrado en sdd/global.json
        → En pending_modules: SI / NO
        → En in_progress_modules: SI / NO
        → En completed_modules: SI / NO

[ ] 3. Ningún otro módulo en in_progress_modules
        → Módulos en progreso: _____________ (ninguno si vacío)

[ ] 4. Dependencias completadas
        → Dependencias requeridas: _____________
        → Todas en completed_modules: SI / NO

[ ] 5. Cycle brief generado
        → Archivo: sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml
        → Estado: EXISTE / NO EXISTE

[ ] 6. Historias de usuario generadas (sdd-functional)
        → Estado: GENERADAS / PENDIENTE

[ ] 7. Tasks técnicas en sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json (sdd-planner)
        → tasks.json del ciclo: TIENE TASKS / VACÍO / NO EXISTE
        → índice sdd/tasks.json actualizado (pnpm sdd:rebuild-tasks-index --check): SI / NO

[ ] 8. Schema y contratos definidos (sdd-architect)
        → sdd/schema.json actualizado: SI / NO
        → sdd/api.json actualizado: SI / NO

[ ] 9. Cycle JSON de estado creado
        → Archivo: sdd/specs/{spec-id}/cycles/cycle-[XX]/cycle.json
        → Estado: EXISTE con status "in-progress" / NO EXISTE
        → ⚠️ OBLIGATORIO antes de escribir cualquier línea de código.
           El sdd-orchestrator crea este archivo al iniciar el ciclo.
           Al finalizar, el sdd-reviewer lo actualiza a "completed".
────────────────────────────────────────────────────────────

RESULTADO:
→ Todos los ítems ✅: APROBADO — puede continuar a implementación
→ Algún ítem ❌: BLOQUEADO — completar los pasos faltantes primero
```

## Pasos para completar los requisitos faltantes

Si la spec NO existe:

```
Crear la spec en sdd/specs/<modulo>.spec.md con:
- Objetivo del módulo
- Alcance (qué incluye y qué no)
- Capas a implementar (domain, service, rest, etc.)
- Criterios de aceptación
- Tablas y endpoints involucrados
```

Si el módulo NO está en global.json:

```
Agregar en pending_modules de sdd/global.json:
{
  "id": "<modulo>",
  "name": "<nombre descriptivo>",
  "spec": "sdd/specs/<modulo>.spec.md",
  "dependencies": [],
  "priority": "alta|media|baja"
}
```

Si el cycle_brief NO existe:

```
Invocar sdd-orchestrator con:
"Iniciar ciclo [N] del módulo <modulo>"
→ El orquestador crea sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml
```

Si NO hay historias:

```
Invocar sdd-functional con el cycle_brief
```

Si NO hay tasks en el tasks.json del ciclo:

```
Invocar sdd-planner con las historias generadas
```

Si schema/contratos NO están definidos:

```
Invocar sdd-architect con las historias generadas
```

---

## Ejemplo de uso

```
Antes de implementar el módulo "migration-legacy" ciclo 1,
ejecutar el SPEC GATE con el prompt check-spec-before-implement.prompt.md
y reportar el estado de cada prerequisito.
```
