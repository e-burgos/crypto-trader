# Prompt: Iniciar Ciclo SDD

> Para uso en cualquier monorepo que implemente SDD

## ⛔ SPEC GATE — Verificación obligatoria ANTES de iniciar

Antes de invocar cualquier agente, responder estas preguntas:

```
1. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md?  SI / NO
2. ¿El módulo está en pending_modules (global.json)?                                   SI / NO
3. ¿No hay otro módulo en in_progress_modules?                                        SI / NO
4. ¿Las dependencias están en completed_modules?                                      SI / NO
```

**→ Si alguna respuesta es NO: completar ese paso antes de continuar.**
**→ Solo si TODAS son SI: proceder con el ciclo.**

---

## Regla de documentos de ciclo (INVIOLABLE)

Los únicos documentos permitidos en la raíz de `cycle-[XX]/` son:

| Archivo         | Generado por                                      |
| --------------- | ------------------------------------------------- |
| `brief.yaml`    | sdd-orchestrator                                  |
| `functional.md` | sdd-functional                                    |
| `planner.md`    | sdd-planner                                       |
| `architect.md`  | sdd-architect                                     |
| `cycle.json`    | sdd-orchestrator (inicio) / sdd-reviewer (cierre) |

**Cualquier documento de apoyo adicional** (diagramas, ejemplos de API, exploración, tasks detalladas, etc.) debe ubicarse en:

```
sdd/specs/{spec-id}/cycles/cycle-[XX]/artifacts/<nombre-del-doc>.md
```

Y debe indexarse en `cycle.json` bajo la clave `"artifacts": [...]`.

---

## Cómo usarlo

Copiar y completar este prompt para iniciar un ciclo:

```
Iniciá el Ciclo [N] del proyecto [nombre-del-proyecto] siguiendo el flujo SDD.

Módulo a desarrollar: [nombre del módulo]
Spec en: sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md

Antes de empezar:
1. Ejecutar el SPEC GATE (verificaciones de arriba)
2. Leer sdd/global.json para verificar el estado actual
3. Confirmar que el módulo tiene spec y está en pending_modules
4. Consolidación de contexto (sdd-orchestrator, antes de generar el brief): si
   sdd/context/[apps|libs|tools]/[nombre]/updates/ tiene fragmentos acumulados para el
   subproyecto de este ciclo, fusionarlos en constitution.md + context_prompt.md base,
   actualizar el encabezado `> Última actualización:`, borrar los fragmentos consolidados
   y commitear aparte (`chore(sdd): consolidate context updates for [nombre]`)

Pasos a seguir en orden (solo si el SPEC GATE pasa):
1. sdd-orchestrator → preparar cycle_brief + crear sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml
2. sdd-functional   → generar historias de usuario → crear sdd/specs/{spec-id}/cycles/cycle-[XX]/functional.md
        ⛔ TELEMETRÍA: al cerrar el documento, agregar la propia entrada en
        cycle.json → metrics.usage.by_agent[] (agent: "functional", provider_model, effort,
        tokens_in/tokens_out, approx, source, recorded_at)
3. sdd-planner      → crear sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json + regenerar índice (PARALELO con 4)
        ⛔ TELEMETRÍA: entrada propia en metrics.usage.by_agent[] (agent: "planner") al cerrar
4. sdd-architect    → definir schema y contratos, actualizar sdd/schema.json y sdd/api.json (PARALELO con 3)
        ⛔ TELEMETRÍA: entrada propia en metrics.usage.by_agent[] (agent: "architect") al cerrar
⚠️  5. sdd-orchestrator → crear sdd/specs/{spec-id}/cycles/cycle-[XX]/cycle.json con status "in-progress"
        OBLIGATORIO antes de cualquier implementación. Estructura mínima:
        { "cycle": N, "module": "...", "status": "in-progress", "objectives": [...],
          "metrics": { "tasks_total": 0, "tasks_completed": 0, "story_points": 0,
            "files_created": [], "files_modified": [], "files_deleted": [],
            "usage": { "tokens_in": 0, "tokens_out": 0, "by_agent": [] } } }
        Además, en este mismo paso: pasar la spec de "draft" a "in-progress" en
        sdd/specs/index.json (lifecycle del schema: draft → in-progress lo hace el
        orquestador al abrir cycle-01 de esa spec, nunca antes).
        Si el orquestador lanzó subagentes (functional/planner/architect) vía la tool
        Agent, capturar la notificación `agent-usage-notification` de cada uno
        (`<usage><subagent_tokens>N</subagent_tokens>…</usage>`, exacta, approx: false,
        split 85/15 en tokens_in/tokens_out) y agregarla a by_agent en su nombre si el
        propio subagente no llegó a registrarla.
6. sdd-implementor-back → implementar TASK-BE una a la vez
        Una task pasa a "done" en tasks.json solo cuando además de la implementación
        tiene su `usage` completo (provider_model, effort, tokens_in/tokens_out, approx,
        source, recorded_at) — sin `usage` la task NO está cerrada.
7. sdd-implementor-front → implementar TASK-FE una a la vez (solo si hay frontend)
        Misma condición de cierre que 6: sin `usage` en la task, no es "done".
8. sdd-reviewer     → validar, actualizar cycle-[XX]/cycle.json a "completed" con reviewer_report,
        actualizar todos los JSONs de estado (global.json, specs/index.json, tasks del ciclo)
        y dejar pnpm sdd:validate en verde
        ⛔ TELEMETRÍA: agregar la entrada propia (agent: "reviewer") en
        metrics.usage.by_agent[], derivar by_tier agrupando by_agent por provider_model
        y sumar el top-level — ver review-cycle.prompt.md paso 4c
9. ⛔ CONTEXTO GATE, mecanismo aditivo (parte del paso del reviewer — OBLIGATORIO):
        - Escribir el fragmento append-only:
          sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md
          (NUNCA editar directamente constitution.md/context_prompt.md del subproyecto
          ni su línea `> Última actualización:` durante el ciclo)
        - sdd/context/constitution.md → actualizar SOLO la fila propia de la
          tabla-snapshot del subproyecto
        - sdd/context/context_prompt.md → agregar fila nueva si se creó app/lib/tool
        El ciclo NO puede cerrarse sin haber escrito el fragmento en updates/.

⚠️ Documentos de apoyo: si se generan docs extra (exploración, diseño, ejemplos),
   guardarlos SIEMPRE en artifacts/ y referenciarlos en cycle.json["artifacts"].
```

---

## Plantilla de ejemplo

```
Iniciá el Ciclo [N] del proyecto [nombre-del-proyecto] siguiendo el flujo SDD.

Módulo: [nombre-del-modulo] (fase: [nombre-de-la-fase])
Spec: sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md

Objetivo del ciclo:
[Describir en una oración qué se logra al finalizar este ciclo.]

Siguiendo flujo SDD obligatorio con SPEC GATE.
```
