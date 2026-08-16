# Guía de uso del sistema SDD

> **Spec-Driven Development (SDD)** — paso a paso para desarrolladores.  
> Leer este documento antes de cualquier tarea nueva en el repositorio.

---

## Tabla de contenidos

1. [Concepto en 30 segundos](#1-concepto-en-30-segundos)
2. [Setup inicial (una sola vez)](#2-setup-inicial-una-sola-vez)
3. [Flujo normal — Funcionalidad nueva](#3-flujo-normal--funcionalidad-nueva)
4. [Contexto de subproyectos — actualizaciones aditivas](#4-contexto-de-subproyectos--actualizaciones-aditivas)
5. [Flujo rápido — Fix / Mejora](#5-flujo-rápido--fix--mejora)
6. [Referencia de archivos SDD](#6-referencia-de-archivos-sdd)
7. [Convenciones de naming](#7-convenciones-de-naming)
8. [Reglas absolutas (nunca violar)](#8-reglas-absolutas-nunca-violar)
9. [Cheat sheet de prompts](#9-cheat-sheet-de-prompts)
10. [Hermes, memoria y costos — el punta a punta](#10-hermes-memoria-y-costos--el-punta-a-punta)

---

## 1. Concepto en 30 segundos

```
IDEA → prompt del dev → SPEC (Orquestador) → CICLO (5 agentes) → IMPLEMENTACIÓN → REVIEW → CIERRE
```

- **El dev describe qué quiere** — no escribe documentos SDD, escribe prompts en lenguaje natural y adjunta referencias.
- **Los agentes generan todos los artefactos** — spec, functional.md, planner.md, architect.md, cycle.json, etc.
- **El dev revisa y aprueba** lo que cada agente produce antes de pasar al siguiente.
- **Ninguna línea de código** se escribe sin que los 6 documentos del ciclo existan y estén aprobados
  (`brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `tasks.json`, `cycle.json`).
- El **Reviewer** cierra el ciclo y escribe un **fragmento aditivo** de contexto para que el
  próximo agente tenga el estado (ver sección 4 — evita merge conflicts entre devs).
- **Todo registro `sdd/**/*.json` valida contra `sdd/schemas/`** — `pnpm sdd:validate` corre en local, en el Reviewer y en CI.

---

## 2. Setup inicial (una sola vez)

### 2.a Repo ya inicializado — clone normal

```bash
pnpm install        # pnpm es el ÚNICO package manager: nunca npm install ni yarn
pnpm setup:agents
pnpm sdd:validate   # debe quedar en verde
```

> ⛔ `npm install` o `yarn` en este repo generan un lockfile rival. Nx infiere el package manager
> del lockfile, así que eso cambia en silencio cómo se resuelven las tasks. `.npmrc` tiene
> `package-manager-strict=true` y `.gitignore` bloquea `package-lock.json`/`yarn.lock`, pero la
> regla es no correrlos.

### 2.b Repo nuevo, o `sdd/` portado a otro repo

Si falta `nx.json`, `pnpm-workspace.yaml`, `.npmrc` o `.nxignore` — o si aparece un lockfile de
npm/yarn — el workspace no está montado. Pedirle a un agente que use la skill
**`init-nx-workspace`**: monta Nx 23 + pnpm, los globs `apps/* libs/* tools/*`, el `.nxignore`, el
CI con pnpm y el arnés dual, y termina en un checklist verificable comando por comando.

El arnés dual (`AGENTS.md`/`CLAUDE.md`) instruye a los agentes a chequear esto **al iniciar
cualquier sesión**, así que normalmente lo detectan solos antes de la primera acción.

> Crear apps o libs **no** es parte de esta skill: eso es `scaffold-nx`, y siempre dentro de un
> ciclo SDD.

### 2.c Qué genera `setup:agents`

Este script genera (o regenera) todos los symlinks necesarios:

| Symlink creado             | Apunta a                                       |
| -------------------------- | ---------------------------------------------- |
| `.claude/agents`           | `sdd/agents/`                                  |
| `.claude/skills`           | `sdd/skills/`                                  |
| `.claude/prompts`          | `sdd/prompts/`                                 |
| `.claude/commands`         | `sdd/prompts/` (slash commands de Claude Code) |
| `.github/agents`           | `sdd/agents/`                                  |
| `.github/skills/<skill>`   | `sdd/skills/<skill>/` (uno por uno)            |
| `.github/prompts/<prompt>` | `sdd/prompts/<prompt>` (uno por uno)           |
| `AGENTS.md` (raíz)         | `sdd/dual-harness/AGENTS.md`                   |
| `CLAUDE.md` (raíz)         | `sdd/dual-harness/CLAUDE.md`                   |

> Es seguro re-ejecutar `pnpm setup:agents` en cualquier momento — regenera todo sin romper nada.
> **En Windows es obligatorio** tras cada clone: git deja los symlinks como archivos de texto y el
> script los reemplaza por junctions/hardlinks.
> `.github/copilot-instructions.md` es un archivo real (no symlink) para los lectores server-side de GitHub.

### Visor SDD (opcional, recomendado)

Para navegar todo el estado SDD en el browser en vez de leer JSONs a mano:

```bash
pnpm sdd:docs        # → http://127.0.0.1:4310/sdd/docs/
```

Es una app en JS vanilla de 5 archivos: **cero dependencias, cero build, cero instalación**. Lee
los registros de `sdd/` en vivo, así que lo que ves es el estado real del repo, no un snapshot.
Tiene 15 vistas (dashboard, specs, ciclos, tareas, fixes, contexto, agentes, skills, prompts,
schema, API, componentes, schemas JSON, planificación y ayuda).

### Grafo de conocimiento (opcional)

`graphify` indexa el repo como grafo y permite consultas acotadas (`graphify query "..."`) en vez
de `grep` a ciegas — útil para entender arquitectura o hacer impact analysis antes de un refactor.
Es **opt-in por dev** y nada del flujo SDD depende de él. Para habilitarlo, pedile a un agente que
use la skill `setup-graphify`: te guía la instalación con un backend **gratuito** (Gemini free
tier u Ollama local).

---

## 3. Flujo normal — Funcionalidad nueva

### Paso 0 — Chequear el estado del proyecto

Antes de empezar, verificar que no hay un módulo en curso. El Orquestador lo hace automáticamente, pero también podés consultarlo directamente:

```bash
cat sdd/global.json
```

Condiciones para poder empezar:

- **Tu spec no tiene otro ciclo abierto** — la regla es _un ciclo activo por spec_.
  Varios devs pueden tener sus módulos en `in_progress_modules` en paralelo (modelo multi-developer).
- Si tu funcionalidad depende de otra spec (`depends_on` en `sdd/specs/index.json`),
  esa spec debe estar `completed`.

---

### Paso 1 — Describir la funcionalidad al Orquestador

**El dev no crea archivos SDD.** En cambio, escribe un prompt en lenguaje natural describiendo qué quiere construir y adjunta las referencias relevantes (documentos de negocio, wireframes, endpoints existentes, contratos de API externos, etc.).

**Mensaje de ejemplo al agente `sdd-orchestrator`:**

```
Quiero implementar el módulo de Market Data Feed para la app <nombre-de-la-app>.

Objetivo: consumir precios en tiempo real desde el proveedor Plug y exponerlos
vía WebSocket a los clientes del frontend.

Referencias adjuntas:
- docs/artifacts/plug/api-spec.pdf  (contrato del proveedor)
- sdd/api.json                      (endpoints ya implementados)
- sdd/context/apps/<nombre-de-la-app>/constitution.md
```

**El Orquestador genera automáticamente:**

1. El archivo de spec `.spec.md` con objetivo, contexto, alcance y criterios de aceptación.
2. La entrada correspondiente en `sdd/specs/index.json`.
3. El registro del módulo en `pending_modules` dentro de `sdd/global.json`.
4. `cycle-01/brief.yaml` con el contexto mínimo para cada agente.
5. `cycle-01/cycle.json` con `status: "in-progress"` (valida contra `sdd/schemas/cycle.schema.json`).
6. Corre `pnpm sdd:validate` — el ciclo no queda registrado si algún registro está fuera de schema.

**El dev revisa y aprueba** los documentos generados antes de continuar.
Si algo no refleja lo que querés, corregís el prompt y volvés a pedirlo.

> ⛔ **El Orquestador NO implementa código.** Solo genera el brief y los artefactos de spec.

---

### Paso 2 — Agente Funcional

El agente `sdd-functional` lee el brief generado por el Orquestador y produce las historias de usuario.

**Prompt al agente:**

```
Generar functional.md para el Ciclo 01 — spec-<gh-user>-<NNN>-<slug>.
```

El agente lee `brief.yaml` y genera `cycle-01/functional.md` con historias **Como / Quiero / Para**,
criterios de aceptación `CA-[NNN]` verificables (PASS/FAIL) y casos de error.

**El dev revisa** que las historias cubran el objetivo de la spec. Si falta cobertura, se lo indica al agente para que ajuste.

---

### Paso 3 — Agentes Planner y Arquitecto (paralelo)

Ambos pueden correr **en paralelo** (dos conversaciones simultáneas) porque son independientes entre sí.

**Prompt al agente `sdd-planner`:**

```
Generar planner.md para el Ciclo 01 — spec-<gh-user>-<NNN>-<slug>.
```

El Planner lee `functional.md` y `brief.yaml`, y genera **dos archivos**:

- `cycle-01/planner.md` — sprint plan legible con tasks `TASK-001`, `TASK-002`… (scope: el ciclo),
  cada una con estimación de horas, story points y dependencias.
- `cycle-01/tasks.json` — las mismas tasks en formato canónico (schema `cycle-tasks.schema.json`),
  y regenera el índice con `pnpm sdd:rebuild-tasks-index`.

**Prompt al agente `sdd-architect`:**

```
Generar architect.md para el Ciclo 01 — spec-<gh-user>-<NNN>-<slug>.
```

El Arquitecto lee `functional.md`, `brief.yaml`, `sdd/schema.json` y `sdd/api.json`, y genera:

- `cycle-01/architect.md` con decisiones técnicas, schema de DB y contratos de endpoints.
- Actualiza `sdd/schema.json` y `sdd/api.json` con los nuevos artefactos.

**El dev revisa ambos documentos.** Si hay inconsistencias entre planner y architect (ej. una task menciona un endpoint que el arquitecto no definió), se le indica a cada agente que lo corrija.

> Documentos de apoyo (diagramas, ejemplos de endpoints, exploración de código) que el Arquitecto genere:
> → guardar **siempre** en `cycle-01/artifacts/` y referenciar en `cycle.json["artifacts"]`.

---

### Paso 4 — Implementación

Con los 6 documentos del ciclo listos y aprobados, se invocan los implementadores **task por task**.
Una task por conversación, sin agrupar. El stack lo define la `constitution.md` del subproyecto.

**Prompt al agente `sdd-implementor-back` (una task a la vez):**

```
Implementar TASK-001 del Ciclo 01 — spec-<gh-user>-<NNN>-<slug>.
```

El agente lee la task en `cycle-01/tasks.json`, el contrato en `architect.md` y la `constitution.md`
del subproyecto; escribe el código y los tests. Al cerrar cada task: marca `"done"` + `files[]` en
`tasks.json` y corre `pnpm sdd:rebuild-tasks-index && pnpm sdd:validate`.

**Prompt al agente `sdd-implementor-front` (solo si hay tasks FE, después del backend):**

```
Implementar TASK-00X del Ciclo 01 — spec-<gh-user>-<NNN>-<slug>.
```

El agente frontend verifica primero que los endpoints consumidos estén `"implemented"` en `sdd/api.json`.

**El dev revisa** el código generado tarea a tarea. Si algo no cumple la spec, se le indica al agente qué corregir antes de pasar a la siguiente task.

---

### Paso 5 — Review y cierre

Con todas las tasks implementadas, invocar el agente `sdd-reviewer`:

```
Revisar el Ciclo 01 — spec-<gh-user>-<NNN>-<slug> — Módulo <nombre>.
```

El Reviewer realiza **en orden obligatorio**:

0. ⛔ **VALIDATION GATE (pre-review)** — corre `pnpm sdd:validate`; si falla, devuelve al implementador.
1. Valida que el código cumple los criterios de aceptación (`ca_results` con un PASS/FAIL por `CA-[NNN]`).
2. Actualiza `cycle.json` → `status: "completed"` + `completed_at` + `metrics` + `reviewer_report`.
3. Mueve el módulo a `completed_modules` en `global.json` (con `apps[]`, `cycles_completed`, `completed_at`).
4. Si era el último ciclo de la spec → `status: "completed"` + `completed_at` en `sdd/specs/index.json`.
5. Marca las tasks del ciclo como `done` en `cycles/cycle-[XX]/tasks.json` y regenera el índice (`pnpm sdd:rebuild-tasks-index`).
6. Verifica que `sdd/schema.json`, `sdd/api.json` y `sdd/components.json` estén actualizados.
7. Revisa los fixes `implemented` del ciclo en `sdd/fixes.json` → los marca `validated` o `absorbed`.
8. ⛔ **CONTEXTO GATE (aditivo)** — escribe el fragmento del ciclo y toca **solo su fila** en las
   tablas globales:
   - `sdd/context/[apps|libs|tools]/<nombre>/updates/YYYY-MM-DD-<spec-id>-cycle-XX.md` ← **el delta**
   - `sdd/context/constitution.md` → solo la fila del subproyecto en la tabla-snapshot
   - `sdd/context/context_prompt.md` → fila nueva solo si se creó app/lib/tool

   > ⛔ **No** edita `constitution.md` ni `context_prompt.md` del subproyecto, ni su línea
   > `> Última actualización:`. Ver sección 4.

9. ⛔ **VALIDATION GATE (post-cierre)** — `pnpm sdd:validate` en verde, registrado en `reviewer_report.tests["sdd:validate"]`.

> El ciclo **no puede cerrarse** con el CONTEXTO GATE pendiente ni con la validación en rojo —
> el mismo check corre en CI (`.github/workflows/sdd-validate.yml`) y rompe el PR.

---

## 4. Contexto de subproyectos — actualizaciones aditivas

**El problema que resuelve:** cuando varios devs trabajan specs distintas sobre el mismo
subproyecto (ej. `example-api`), todos editaban los mismos `constitution.md` y
`context_prompt.md` al cerrar su ciclo. Merge conflicts garantizados, agravados por la línea
`> Última actualización:` que todos tocaban.

**La solución:** durante un ciclo o fix **nunca** se editan los archivos base del subproyecto. Se
escribe un fragmento append-only cuyo nombre incluye el spec-id — que lleva el gh-user del dev —
así que **es único por construcción** y el conflicto no puede ocurrir.

```
sdd/context/[apps|libs|tools]/<nombre>/updates/
  ├── 2026-07-13-spec-asmith-001-cycle-01.md
  ├── 2026-08-03-fix-jdoe-002-001.md        ← fixes: YYYY-MM-DD-fix-<gh-user>-<seq>.md
  └── 2026-08-04-spec-jdoe-003-cycle-01.md
```

### Template del fragmento (solo el delta, nunca copiar del base)

```markdown
# <spec-id> cycle-<XX> — <YYYY-MM-DD>

## Estado → qué quedó implementado / en qué estado queda el subproyecto

## Estructura → paquetes/módulos/patrones nuevos o cambiados

## Dependencias → librerías o servicios nuevos que consume/expone

## Qué sigue → pendientes que el próximo ciclo debe saber
```

Secciones vacías se omiten. Si el ciclo resolvió algo que el base declara "pendiente", anotarlo
como `resuelve: <sección>` para que la consolidación lo elimine.

### Las 3 operaciones

| Operación                                                                          | Quién                                                                                                     | Cuándo      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| **Escribir** el fragmento                                                          | reviewer al cerrar ciclo · dev al cerrar fix                                                              | cada cierre |
| **Leer** contexto = base + `updates/*.md` en orden de nombre                       | cualquier agente                                                                                          | siempre     |
| **Consolidar**: fundir fragmentos en los base, actualizar el encabezado, borrarlos | **un solo actor**: orquestador al iniciar ciclo nuevo sobre ese subproyecto, o reviewer con ≥5 fragmentos | periódica   |

> La consolidación va en commit dedicado (`chore(sdd): consolidate context updates for <nombre>`)
> y **nunca** en paralelo con un ciclo abierto sobre el mismo subproyecto.
> La línea `> Última actualización:` solo cambia ahí.

**Si necesitás leer el contexto de un subproyecto:** base + fragmentos. Los fragmentos están
ordenados cronológicamente por el prefijo de fecha, así que leerlos en orden de nombre da la
evolución real.

```bash
# Cuántos fragmentos hay sin consolidar (≥5 dispara consolidación)
ls sdd/context/*/*/updates/*.md 2>/dev/null | wc -l
```

---

## 5. Flujo rápido — Fix / Mejora

Cuando el cambio **no justifica un ciclo SDD completo**, usar el FIX GATE.

### Cuándo usar cada prefijo

| Prefijo         | Cuándo                                    | Severidad           |
| --------------- | ----------------------------------------- | ------------------- |
| `[HOTFIX]`      | Producción bloqueada, regresión crítica   | `critical` / `high` |
| `[BUGFIX]`      | Error en desarrollo o testing             | `medium` / `low`    |
| `[FIX]`         | Alias genérico (el orquestador clasifica) | cualquiera          |
| `[IMPROVEMENT]` | Mejora menor de UX/wording/performance    | `low`               |

> ⚠️ Si el fix afecta más de 5 archivos o cambia el contrato de API → **ciclo SDD completo**.

### Paso a paso del FIX GATE

**1. Enviar el mensaje con prefijo al Orquestador:**

```
[BUGFIX] El endpoint /enrollment devuelve 500 cuando el CUIT tiene formato X.
```

**2. El Orquestador bloquea la implementación** y pide estos datos:

```
1. Tipo: [HOTFIX] / [BUGFIX] / [IMPROVEMENT]
2. Título (máx 80 chars)
3. Descripción del problema
4. Justificación de urgencia
5. Archivos afectados
6. ¿Existe test que valide el fix?
```

**3. El Orquestador registra el fix:**

- Agrega entrada a `sdd/fixes.json` con ID correlativo del autor (`FIX-<gh-user>-001`, `FIX-<gh-user>-002`…
  o `FIX-<gh-user>-<spec-NNN>-<seq>` si es de una spec). Valida contra `sdd/schemas/fixes.schema.json`.
- Crea `sdd/fixes/fix-<gh-user>-<seq>.md` (fix repo-level)  
  o `sdd/specs/<spec-id>/fixes/fix-<gh-user>-<spec-NNN>-<seq>.md` (fix de spec).

**4. Solo después del registro → implementar.**

**5. Al terminar:** actualizar en `sdd/fixes.json` → `affected_files`, `resolved_at`, `status: "implemented"`
y `test_reference`. El Reviewer lo marcará `validated` o `absorbed` al cerrar el ciclo.
Correr `pnpm sdd:validate` antes de commitear.

---

## 6. Referencia de archivos SDD

### Archivos de estado (actualizar siempre al cerrar un ciclo)

| Archivo                      | Contenido                                      | Quién actualiza                                                          |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `sdd/global.json`            | Estado del proyecto, módulos en curso          | Orquestador (inicio) + Reviewer (cierre)                                 |
| `cycles/cycle-XX/tasks.json` | Tasks canónicas del ciclo                      | Planner (crea) + Implementadores + Reviewer                              |
| `sdd/tasks.json`             | Índice de tasks (generado)                     | `pnpm sdd:rebuild-tasks-index`                                           |
| `sdd/catalog.json`           | Manifest de contenido para el visor (generado) | `pnpm sdd:rebuild-catalog` — `sdd:validate` falla si está desactualizado |
| `sdd/schema.json`            | Esquema de base de datos                       | Arquitecto (define) + Implementador back (migra) + Reviewer              |
| `sdd/api.json`               | Contratos de endpoints                         | Arquitecto (define) + Implementador back (implementa) + Reviewer         |
| `sdd/components.json`        | Componentes frontend creados                   | Implementador front + Reviewer                                           |
| `sdd/fixes.json`             | Registry de fixes fuera del flujo              | Orquestador (FIX GATE) + dev (cierre) + Reviewer (valida)                |
| `sdd/specs/index.json`       | Registro de specs (append-only)                | Quien crea la spec + Reviewer (cierre)                                   |
| `sdd/schemas/*.schema.json`  | JSON Schemas estrictos (fuente de máquina)     | Manual — cambio de schema = decisión de equipo                           |

### Archivos de contexto (leer antes de cualquier tarea)

| Archivo                                    | Para qué                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| `sdd/context/context_prompt.md`            | Entry point global — leer primero                       |
| `sdd/context/constitution.md`              | Arquitectura global + tabla-resumen de subproyectos     |
| `sdd/context/apps/<app>/context_prompt.md` | Estado de la app — BASE (solo lo toca la consolidación) |
| `sdd/context/apps/<app>/constitution.md`   | Stack, paquetes, patrones — BASE                        |
| `sdd/context/apps/<app>/updates/*.md`      | Fragmentos por ciclo/fix — **leer junto con el base**   |
| `sdd/context/tools/<tool>/`                | Igual, para herramientas que no son app ni lib          |

### Documentos de ciclo (6 archivos por ciclo, solo estos)

```
sdd/specs/<spec-id>/cycles/cycle-<XX>/
  ├── brief.yaml       ← Orquestador
  ├── functional.md    ← Agente Funcional
  ├── planner.md       ← Agente Planner
  ├── architect.md     ← Agente Arquitecto
  ├── tasks.json       ← Planner (crea) + Implementadores (status) — tasks CANÓNICAS del ciclo
  ├── cycle.json       ← Orquestador (inicio) + Reviewer (cierre)
  └── artifacts/       ← Docs de apoyo (referenciados en cycle.json)
```

---

## 7. Convenciones de naming

### ID de spec

```
spec-<gh-user>-<NNN>-<slug>
```

- `<gh-user>`: handle de GitHub del autor (ej. `jdoe`)
- `<NNN>`: contador **personal** del dev, comenzando en `001` (no global)
- `<slug>`: kebab-case descriptivo del módulo

Ejemplos:

```
spec-jdoe-001-enrollment-request
spec-asmith-001-market-data-feed
```

### Ciclos

```
cycle-01, cycle-02, ...
```

Se resetean por spec (no son globales al repo).

### Tasks

```
TASK-001, TASK-002, ...
```

El scope es el `tasks.json` del ciclo — sin prefijo de spec, ciclo ni capa (BE/FE).
Los mismos IDs se usan en `planner.md` y en `cycles/cycle-XX/tasks.json`.

### Fixes

```
fix-<gh-user>-<seq>.md              ← repo-level (sdd/fixes/)
fix-<gh-user>-<spec-NNN>-<seq>.md   ← de una spec (sdd/specs/<id>/fixes/)
```

---

## 8. Reglas absolutas (nunca violar)

### ⛔ SPEC GATE — antes de implementar

```
1. ¿Existe el archivo .spec.md de la spec?               → SI / NO
2. ¿La spec está en sdd/specs/index.json?                → SI / NO
3. ¿El módulo está en in_progress_modules (global.json)? → SI / NO
4. ¿Existe brief.yaml del ciclo?                         → SI / NO
5. ¿Existe functional.md del ciclo?                      → SI / NO
6. ¿Existe planner.md del ciclo?                         → SI / NO
7. ¿Existe architect.md del ciclo?                       → SI / NO
8. ¿Existe cycle.json con status "in-progress"?          → SI / NO
9. ¿Existe tasks.json del ciclo con tasks?               → SI / NO
10. ¿Existe constitution.md del subproyecto afectado?    → SI / NO
```

**Si alguna es NO → DETENER. Completar ese paso antes de continuar.**

### ⛔ CONTEXTO GATE — antes de cerrar un ciclo (ADITIVO)

```
1. ¿Existe el fragmento del ciclo en context/[apps|libs|tools]/<nombre>/updates/?  → SI / NO
2. ¿La fila propia de la tabla-snapshot en context/constitution.md está al día?     → SI / NO
3. ¿Hace falta fila nueva en context/context_prompt.md (app/lib/tool nueva)?        → SI / NO / N/A
4. ¿Los archivos BASE del subproyecto quedaron intactos?                            → SI / NO
```

**El cycle.json NO puede tener status "completed" sin el fragmento escrito.**
Y si el punto 4 es NO, hay un error: los base solo los toca la consolidación (ver sección 4).

### Otras reglas

- **Un ciclo activo por spec.** Distintos devs avanzan sus specs en paralelo, pero una misma
  spec nunca tiene dos ciclos abiertos.
- **Solo 6 archivos en la raíz del ciclo** (`brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `cycle.json`, `tasks.json`). Cualquier otro → `artifacts/`.
- **Tipado estricto:** todo registro `sdd/**/*.json` valida contra `sdd/schemas/`. Correr `pnpm sdd:validate` después de cualquier escritura.
- **`sdd/specs/index.json` es append-only** — nunca editar entradas existentes.
- **Los implementadores reciben UNA task por mensaje**, no varias.
- **El Orquestador NO escribe código** — solo prepara el brief.
- **Cero comentarios en el código de implementación.** La documentación vive en los documentos
  SDD, no en comentarios. Nombres declarativos y funciones cortas en su lugar. Sin `// TODO` —
  eso es una task o un fix. Excepciones (1 línea, inglés): restricción que el código no puede
  expresar, o anotación exigida por framework/linter. El reviewer lo chequea al cerrar.
- **Elegir modelo y esfuerzo antes de empezar**: el tier más barato que cumpla. Implementores
  `sonnet`/`medium`; orquestador, arquitecto y reviewer `opus`/`high`. Nunca un fan-out entero
  en el tier más caro.
- **graphify es opcional** — si `graphify-out/graph.json` existe, consultalo antes de `grep`/`Read`
  a ciegas; si no, trabajá normal. Para habilitarlo: skill `setup-graphify`.
- **Invariantes del workspace** (los garantiza la skill `init-nx-workspace`, y romperlos falla en
  silencio): pnpm es el único package manager; los proyectos viven en `apps/`, `libs/` y `tools/`
  —nunca en `packages/`—; `customConditions` de `tsconfig.base.json` es **idéntico** al `name` del
  `package.json` raíz; y `.nxignore` contiene `sdd/templates` para que los blueprints no entren al
  project graph.
- **El nombre y la descripción del proyecto viven SOLO en `sdd/global.json`** (`project` /
  `description`). Ningún otro archivo de `sdd/` los hardcodea — eso es lo que mantiene `sdd/`
  portable, y `pnpm sdd:validate` falla si el valor se filtra a los documentos del kit.

---

## 9. Cheat sheet de prompts

```bash
# Ver estado del proyecto
cat sdd/global.json

# Ver specs registradas
cat sdd/specs/index.json

# Ver tasks del ciclo actual
cat sdd/tasks.json                       # índice: totales por spec/ciclo
cat sdd/specs/<spec-id>/cycles/cycle-01/tasks.json  # detalle de tasks del ciclo
pnpm sdd:validate                        # validar todos los registros
pnpm sdd:rebuild-tasks-index             # regenerar el índice tras tocar tasks
pnpm sdd:rebuild-catalog                 # regenerar el manifest tras agregar/quitar agente, skill, prompt o schema

# Ver endpoints implementados
cat sdd/api.json

# Setup inicial de un clone / regenerar symlinks
pnpm install                             # pnpm únicamente — nunca npm install ni yarn
pnpm setup:agents

# Abrir el visor SDD (lee los registros en vivo, cero build)
pnpm sdd:docs                            # → http://127.0.0.1:4310/sdd/docs/

# Fragmentos de contexto sin consolidar (≥5 dispara consolidación)
ls sdd/context/*/*/updates/*.md 2>/dev/null | wc -l
```

### Prompts de invocación por agente

```
# Orquestador (describe en lenguaje natural + adjunta referencias)
"Quiero implementar <descripción>.
[Adjuntar referencias relevantes]"

# Funcional
"Generar functional.md para el Ciclo 01 — <spec-id>."

# Planner + Arquitecto (paralelo)
"Generar planner.md para el Ciclo 01 — <spec-id>."
"Generar architect.md para el Ciclo 01 — <spec-id>."

# Implementar una task
"Implementar TASK-001 del Ciclo 01 — <spec-id>."

# Revisar y cerrar
"Revisar el Ciclo 01 — <spec-id>."

# Fix urgente
"[BUGFIX] <descripción del problema>"
```

---

## 10. Hermes, memoria y costos — el punta a punta

### 10.1 De una idea a producto (skill `sdd-hermes`)

El ciclo SDD arranca en una spec — Hermes arranca **antes**: en la idea. Todo el
protocolo vive en `sdd/skills/sdd-hermes/skill.md`; la entrada es un comando:

```bash
# Repo vacío — registrar la idea y dejar todo listo para el agente:
npx @e-burgos/sdd-harness idea "una app de turnos para peluquerías con recordatorios"
# → harness.idea.md          (la idea + el protocolo a seguir, con checkpoints humanos)
# → harness.config.json      (stub del stack, lo completa el agente)
# → harness.config.schema.json (para validar el config sin correr la CLI)

# El agente decide el stack (checkpoint humano), y genera el workspace sin un solo prompt:
npx @e-burgos/sdd-harness init --config ./harness.config.json

# Workspace existente — la misma entrada, protocolo de gaps:
harness idea "sumar reportes de ventas"   # → harness.idea.md con análisis vs el stack instalado
```

Dentro del workspace, el agente sigue las fases 4–5 de la skill: una spec por
módulo (`harness add spec`, checkpoint humano) y el loop de ciclos de siempre —
Hermes **no bypassea ningún gate**, solo encadena fases.

**Retomar en cualquier sesión** (el estado vive en los registros, no en la sesión):
pegarle al agente `sdd/prompts/hermes-resume.prompt.md` — diagnostica la posición
(ciclo abierto → continuar; pendientes → orquestador; backlog vacío → reportar) y sigue.

### 10.2 Memoria (regla 🧠 del dual-harness)

Dos capas de archivos versionados, sin dependencias:

- `sdd/memory/lessons.md` — lecciones destiladas, cap 120 líneas. **Se lee completo
  al iniciar toda sesión.**
- `sdd/memory/journal/` — entradas episódicas al cerrar ciclo/fix, **solo si hubo
  lección real** (filtro anti-ruido). Nunca se lee entero.

```markdown
<!-- sdd/memory/journal/2026-08-13-spec-jdoe-001-cycle-01.md -->
# spec-jdoe-001 cycle-01 — 2026-08-13

## Qué pasó → el mock de la API de pagos no simula timeouts; 2 tasks bloqueadas
## Lección → probar contra el sandbox real de pagos desde el primer ciclo
## Costo evitable → ~40 min y dos re-implementaciones
```

Con ≥5 entradas, el orquestador las **destila** en `lessons.md` (una línea por
lección) y borra lo destilado — `pnpm sdd:validate` avisa cuando está pendiente.

### 10.3 Telemetría y dashboard de Costos

Al cerrar cada ciclo, el reviewer registra el consumo aproximado (aproximación
honesta vale; número inventado no):

```jsonc
// cycle.json → metrics
"usage": {
  "tokens_in": 980000, "tokens_out": 151000, "duration_minutes": 65,
  "by_tier": { "sonnet": { "tokens_in": 830000, "tokens_out": 130000 },
               "opus":   { "tokens_in": 150000, "tokens_out": 21000 } }
}
```

Con eso, `pnpm sdd:docs` → vista **Costos**: comparativa del costo agéntico
(tokens × tarifa por tier) contra la estimación tradicional (`estimation_hours`
de las tasks × tarifa hora), ahorro proyectado, tokens por ciclo y tabla exacta.
Las tarifas se editan en `sdd/pricing.json`.

El visor además es **reactivo en local**: pollea un fingerprint por área de los
registros cada 4 s — cerrás un ciclo y la vista activa se actualiza sola, sin
recargar y sin perder lo que tenías expandido. En hosting estático queda el
refresh manual.

---

## Diagrama del flujo completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FUNCIONALIDAD NUEVA                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dev describe la funcionalidad (prompt + referencias)          │
│         ↓                                                       │
│  sdd-orchestrator → .spec.md + index.json + global.json        │
│                   → brief.yaml + cycle.json (in-progress)      │
│         ↓                                                       │
│  sdd-functional → functional.md (HUs + CAs verificables)       │
│         ↓                                                       │
│  sdd-planner ──┐    planner.md + tasks.json (TASK-NNN)         │
│  (paralelo)    ├──→                                            │
│  sdd-architect─┘    architect.md + schema.json + api.json      │
│         ↓                                                       │
│  sdd-implementor-back  (task por task → done + validate)       │
│  sdd-implementor-front (task por task, si hay FE)              │
│         ↓                                                       │
│  sdd-reviewer → VALIDATION GATE + cycle.json (completed)       │
│               + CONTEXTO GATE + pnpm sdd:validate en verde     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FIX / MEJORA                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dev envía [HOTFIX|BUGFIX|IMPROVEMENT] <descripción>           │
│         ↓                                                       │
│  sdd-orchestrator BLOQUEA implementación                       │
│         ↓                                                       │
│  Registra en fixes.json + crea fix-*.md                        │
│         ↓                                                       │
│  Implementa el fix → status "implemented" + sdd:validate       │
│         ↓                                                       │
│  El Reviewer lo valida/absorbe al cerrar el ciclo              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
