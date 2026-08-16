# CONTEXT PROMPT

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Es la única fuente de verdad — este documento nunca los hardcodea, así `sdd/` se copia
> a otro repo sin editarlo. `pnpm sdd:validate` falla si el nombre se filtra acá.
> Este documento es el punto de entrada para cualquier agente (Claude Code o GitHub Copilot).
> Leerlo completo antes de hacer cualquier tarea en este repositorio.
> **PLANTILLA:** completar las secciones marcadas con `[...]` al inicializar el proyecto.

---

## 1. Quiénes somos y qué estamos construyendo

Estamos construyendo el proyecto declarado en `sdd/global.json` → `project`, descrito en `description`.

**Rol arquitectónico:** plataforma fullstack de trading autónomo de criptomonedas. Expone un API NestJS (REST + WebSocket) y una SPA React 19; transforma datos de mercado (OHLCV Binance, noticias) en decisiones de trading vía un agente IA híbrido (indicadores técnicos + LLM multi-proveedor); delega la ejecución de órdenes en Binance (Sandbox/Testnet/Live); nunca ejecuta órdenes reales fuera del modo elegido explícitamente por el usuario (enforced server-side) ni almacena claves API sin cifrar.

El sistema vive en un monorepo Nx con metodología Spec-Driven Development (SDD). Backend: NestJS 11 + Prisma 7 + PostgreSQL 16 + Redis 7 + Bull. Frontend: React 19 + Vite 8 + TanStack Query + Zustand + Tailwind. Testing: Jest (api), Vitest (web/libs), Playwright (e2e).

---

## 2. Estructura del Monorepo

El proyecto usa **Nx** como monorepo manager con **pnpm** como package manager.

```
<repo-root>/                 → nombre del proyecto en sdd/global.json → project
  apps/                      → api (NestJS), web (React), api-e2e, web-e2e
  libs/                      → analysis, data-fetcher, trading-engine, openrouter, providers, shared, ui
  docs/                      → Constitución histórica + specs/planes legacy (pre-arnés)
  e2e/                       → Tests Playwright cross-app
  sdd/                       → Sistema SDD (NO modificar manualmente)
    context/
      constitution.md        → Constitución GLOBAL (reglas, arquitectura, snapshot)
      context_prompt.md      → Este documento (entry point global)
      apps/                  → Contextos individuales por app (fuente de verdad técnica)
      libs/                  → Contextos individuales por lib
      tools/                 → Contextos individuales por tool
    docs/                    → Visor portable de documentación SDD (JS vanilla, cero deps, `pnpm sdd:docs`)
    global.json              → Estado general del proyecto
    schema.json              → Tablas ya definidas
    api.json                 → Endpoints ya implementados
    components.json          → Componentes frontend creados
    schemas/                 → JSON Schemas estrictos de los registros
    tasks.json               → Índice de tareas (generado; canónico en cycles/cycle-XX/tasks.json)
    specs/                   → Especificaciones técnicas de módulos
```

### Contextos de subproyectos (leer antes de trabajar en cualquier app/lib/tool)

| Subproyecto | Context prompt | Constitución |
| ----------- | -------------- | ------------ |
| `apps/api` | `sdd/context/apps/api/context_prompt.md` | `sdd/context/apps/api/constitution.md` |
| `apps/web` | `sdd/context/apps/web/context_prompt.md` | `sdd/context/apps/web/constitution.md` |
| `apps/api-e2e` | `sdd/context/apps/api-e2e/context_prompt.md` | `sdd/context/apps/api-e2e/constitution.md` |
| `apps/web-e2e` | `sdd/context/apps/web-e2e/context_prompt.md` | `sdd/context/apps/web-e2e/constitution.md` |
| `libs/analysis` | `sdd/context/libs/analysis/context_prompt.md` | `sdd/context/libs/analysis/constitution.md` |
| `libs/data-fetcher` | `sdd/context/libs/data-fetcher/context_prompt.md` | `sdd/context/libs/data-fetcher/constitution.md` |
| `libs/trading-engine` | `sdd/context/libs/trading-engine/context_prompt.md` | `sdd/context/libs/trading-engine/constitution.md` |
| `libs/openrouter` | `sdd/context/libs/openrouter/context_prompt.md` | `sdd/context/libs/openrouter/constitution.md` |
| `libs/providers` | `sdd/context/libs/providers/context_prompt.md` | `sdd/context/libs/providers/constitution.md` |
| `libs/shared` | `sdd/context/libs/shared/context_prompt.md` | `sdd/context/libs/shared/constitution.md` |
| `libs/ui` | `sdd/context/libs/ui/context_prompt.md` | `sdd/context/libs/ui/constitution.md` |

> Al generar una nueva app/lib/tool, sumar una fila por subproyecto (solo agregar filas — nunca reformatear la tabla completa).

---

## 3. Metodología: SDD (Spec-Driven Development)

Este proyecto usa **SDD**. Toda funcionalidad pasa por un ciclo de agentes antes de ser implementada. **NUNCA escribir código sin haber pasado por el ciclo.**

### ⛔ SPEC GATE — Verificación obligatoria antes de implementar

```
1. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md?  → SI / NO
2. ¿La spec está registrada en sdd/specs/index.json?                                   → SI / NO
3. ¿El módulo está en in_progress_modules en global.json?                              → SI / NO
4. ¿Existe sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml?                           → SI / NO
5. ¿Existe sdd/specs/{spec-id}/cycles/cycle-[XX]/functional.md?                        → SI / NO
6. ¿Existe sdd/specs/{spec-id}/cycles/cycle-[XX]/planner.md?                           → SI / NO
7. ¿Existe sdd/specs/{spec-id}/cycles/cycle-[XX]/architect.md?                         → SI / NO
8. ¿Existe sdd/specs/{spec-id}/cycles/cycle-[XX]/cycle.json (status: in-progress)?     → SI / NO
9. ¿Existe sdd/context/[apps|libs|tools]/[nombre]/constitution.md?                           → SI / NO
```

→ Si alguna respuesta es NO: usar `sdd/prompts/check-spec-before-implement.prompt.md`
→ Solo si TODAS son SI: invocar `sdd/prompts/start-sdd-cycle.prompt.md`

### Los 7 agentes y su orden obligatorio

```
1. Orquestador  → lee especificación (sdd/specs/), crea `sdd/specs/{spec-id}/cycles/cycle-[XX]/brief.yaml`
2. Funcional    → genera historias de usuario y requisitos en lenguaje de negocio
3. Planner      → genera sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json (en paralelo con Arquitecto)
4. Arquitecto   → actualiza sdd/schema.json y sdd/api.json (en paralelo con Planner)
5. Impl. Back   → implementa backend, una TASK-BE a la vez
6. Impl. Front  → implementa frontend, una TASK-FE a la vez (después del BE)
7. Reviewer     → valida calidad, actualiza todos los JSONs de estado, cierra el ciclo
```

---

## 4. Reglas generales del proyecto

1. **SPEC GATE:** Ninguna implementación sin spec + cycle_brief + historias + tasks + contratos
2. **Leer `sdd/global.json` antes de cualquier tarea**
3. **Nunca escribir código sin haber pasado por el ciclo SDD**
4. **Un módulo a la vez, en el orden de ciclos definido**
5. **Los ciclos siguen el orden de `planned_cycles` en global.json — uno no comienza si el anterior no está `completed`**
6. **Nunca modificar archivos de `sdd/` manualmente** (solo los agentes los modifican)
7. **Siempre usar `pnpm nx` para correr tareas del workspace**
8. **Sin comentarios explicativos** — código autodescriptivo, ver "Estilo de código (INVIOLABLE)"
   en los agentes implementadores; único comentario permitido es una línea en inglés para un POR
   QUÉ no obvio
9. **TypeScript estricto — sin `any` en ningún caso**

---

## 5. Documentos de referencia en el repositorio

| Documento                   | Ubicación                                           | Para qué sirve                                                              |
| --------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Constitución del Proyecto   | `sdd/context/constitution.md`                       | Visión, arquitectura, stack y reglas de desarrollo                          |
| Estado del proyecto         | `sdd/global.json`                                   | Ver qué está hecho y qué falta                                              |
| Tablas de DB                | `sdd/schema.json`                                   | Referencia del schema actual                                                |
| Endpoints                   | `sdd/api.json`                                      | Qué endpoints existen y su estado                                           |
| Componentes                 | `sdd/components.json`                               | Qué componentes frontend existen                                            |
| Tasks del ciclo             | `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json`  | Detalle canónico de tasks                                                   |
| Índice de tasks             | `sdd/tasks.json`                                    | Resumen generado (`pnpm sdd:rebuild-tasks-index`)                           |
| Specs de módulos            | `sdd/specs/`                                        | Especificaciones técnicas de cada módulo                                    |
| Documentos de ciclos        | `sdd/specs/{spec-id}/cycles/cycle-[XX]/`            | brief.yaml, functional.md, planner.md, architect.md, cycle.json, tasks.json |
| Agentes y Skills            | `sdd/agents/` y `sdd/skills/`                       | Definiciones del comportamiento del arnés                                   |
| **⛔ Estructura SDD**       | `sdd/skills/sdd-file-structure/skill.md`            | **Naming, templates y checklist — leer SIEMPRE**                            |
| **Prompt SPEC GATE**        | `sdd/prompts/check-spec-before-implement.prompt.md` | **Verificar antes de CUALQUIER implementación**                             |
| **Prompt inicio ciclo**     | `sdd/prompts/start-sdd-cycle.prompt.md`             | Iniciar un ciclo SDD                                                        |
| **Template nueva API Java** | `sdd/skills/generate-springboot-api/skill.md`       | **Leer antes de crear cualquier API Spring Boot**                           |

---

## 6. Contextos de subproyectos

### Principio fundamental

> **Global ↔ Subproyecto**
>
> - Los documentos globales (`constitution.md`, `context_prompt.md`) definen **gobernanza, reglas y una tabla-resumen** que apunta a los subproyectos.
> - Los documentos de subproyecto son la **fuente de verdad** del stack, estructura, patrones y estado de cada app/lib/tool.
> - Nunca duplicar en global lo que vive en el subproyecto. Siempre referenciar.

### Flujo de actualización (mecanismo aditivo — patrón changesets)

> ⛔ Durante un ciclo/fix **NUNCA** se editan directamente `constitution.md` ni
> `context_prompt.md` del subproyecto, ni su línea `> Última actualización:`. Las
> actualizaciones son aditivas: un fragmento append-only por ciclo/fix.

```
 Ciclo o fix completado
       ↓
 1. El dev escribe el fragmento (nunca edita los archivos base):
       sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md
       (fixes repo-level: YYYY-MM-DD-fix-[gh-user]-[seq].md)
       El nombre lleva el spec-id (y con él el gh-user) → único por construcción,
       sin merge conflicts posibles
       ↓
 2. Reviewer actualiza SOLO la fila propia en la tabla-snapshot de
       sdd/context/constitution.md sección 3
       ↓
 3. Si se agregó un nuevo subproyecto: se suma una fila nueva a ambas tablas
       globales (sección 2.1 de constitution.md y sección 2 de context_prompt.md)
       ↓
 4. Consolidación (operación de un solo actor, nunca en paralelo con un ciclo):
       el orquestador al iniciar un ciclo nuevo sobre ese subproyecto, o el
       reviewer si se acumulan ≥5 fragmentos, funde los fragmentos en los
       archivos base, actualiza `> Última actualización:`, borra los fragmentos
       consolidados y commitea aparte
       (`chore(sdd): consolidate context updates for [nombre]`)
```

**Leer** el contexto vigente de un subproyecto = `constitution.md` + `context_prompt.md`
base **+ `updates/*.md` en orden de nombre** (el prefijo de fecha los ordena
cronológicamente).

### Cuándo crear el contexto de un nuevo subproyecto

Cuando se agrega una nueva `app/`, `lib/` o `tool/` al monorepo, el Orquestador del primer ciclo que la afecte DEBE:

1. Crear `sdd/context/[apps|libs|tools]/[nombre]/constitution.md` con el stack inicial
2. Crear `sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md` con el entry point inicial
3. Agregar la nueva entrada a la tabla de la sección 2 de este documento
4. Agregar la nueva entrada a las tablas de sección 2.1 y 3 de `constitution.md`

### Estructura completa de contextos

```
sdd/context/
├── constitution.md          ← GLOBAL: gobernanza + tablas-resumen → subproyectos
├── context_prompt.md        ← GLOBAL: entry point + links a subproyectos
├── apps/                    ← Un directorio por app generada en Nx
│   └── [nombre]/
│       ├── constitution.md
│       ├── context_prompt.md
│       └── updates/
├── libs/                    ← Ídem por lib
└── tools/                   ← Ídem por tool
```

**Flujo de lectura obligatorio para agentes:**

1. Leer `sdd/context/context_prompt.md` (GLOBAL) — siempre, en todo ciclo
2. Leer `sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md` — al trabajar un subproyecto
3. El contexto del subproyecto tiene precedencia sobre el global en especificidad de stack o convenciones

---

## 7. FIX GATE — Bypass controlado del SPEC GATE

Cuando el desarrollador necesita resolver un problema urgente fuera del flujo SDD, usar los siguientes prefijos en el mensaje al orquestador:

| Prefijo         | Cuándo usarlo                                               |
| --------------- | ----------------------------------------------------------- |
| `[HOTFIX]`      | Producción bloqueada, regresión crítica, dato corrupto      |
| `[BUGFIX]`      | Error confirmado en desarrollo o testing                    |
| `[FIX]`         | Alias genérico — el orquestador pedirá clasificar           |
| `[IMPROVEMENT]` | Mejora menor (UX, wording, performance puntual) out-of-spec |

El orquestador ejecutará `sdd/prompts/hotfix-bypass-gate.prompt.md` que:

1. Solicita justificación y datos del fix
2. Registra el fix en `sdd/fixes.json` con ID correlativo (FIX-001, FIX-002…)
3. Crea o actualiza `sdd/specs/{spec-id}/fixes/fix-[gh-user]-[spec-NNN]-[seq].md` (o `sdd/fixes/fix-[gh-user]-[seq].md` si es repo-level)
4. Autoriza al implementador a proceder

> ⚠️ El FIX GATE no elimina la trazabilidad — la simplifica.
> El sdd-reviewer valida todos los fixes al cerrar el ciclo.

- Registry de fixes: `sdd/fixes.json`
- Prompt FIX GATE: `sdd/prompts/hotfix-bypass-gate.prompt.md`
- Template fixes.md: `sdd/skills/sdd-file-structure/skill.md` → sección 9
