# Proyecto SDD

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Es la única fuente de verdad. Este archivo nunca los hardcodea: `sdd/` tiene que poder
> copiarse a otro repo sin editar nada. `pnpm sdd:validate` falla si el nombre se filtra.

Este proyecto utiliza la metodología Spec-Driven Development (SDD).
Toda la información del contexto general, stack tecnológico y reglas de desarrollo se encuentra unificada en:
👉 **[sdd/context/context_prompt.md](sdd/context/context_prompt.md)**

Por favor, lee este archivo antes de realizar cualquier cambio en el repositorio.

---

## 🚀 Estructura del workspace — skill `init-nx-workspace` (AL INICIAR SESIÓN)

> [!IMPORTANT]
> **Al iniciar cualquier sesión, antes de la primera acción, verificá que el workspace esté
> montado.** Es un solo comando y define si podés trabajar o si primero hay que inicializar:
>
> ```bash
> ls nx.json pnpm-workspace.yaml .npmrc .nxignore 2>&1; ls package-lock.json yarn.lock 2>/dev/null
> ```
>
> **Si falta alguno de los cuatro primeros, o si aparece un lockfile de npm/yarn → invocá la skill
> `init-nx-workspace` (tool `Skill`) ANTES de cualquier otra cosa** y seguila hasta su checklist de
> cierre. Un workspace desalineado falla de formas silenciosas y caras: tipos que solo andan después
> de `build`, libs que pnpm no linkea, `nx run-many` reventando en CI.
>
> Si los cuatro están y no hay lockfile rival, el workspace está sano: seguí con la tarea sin
> leer la skill (no gastes contexto en ella).

Invariantes que la skill garantiza y que **ningún cambio puede romper**:

- **pnpm es el único package manager.** `packageManager` pinneado en `package.json`; jamás
  `npm install` ni `yarn` en este repo — generan un lockfile rival y Nx infiere el PM del lockfile.
- **Los proyectos viven en `apps/`, `libs/` y `tools/`** — nunca en `packages/`. Los globs de
  `pnpm-workspace.yaml` y todo el sistema SDD asumen eso.
- **`customConditions` de `tsconfig.base.json` === `name` del `package.json` raíz.** Nx lo deriva
  literal de ahí; si divergen, TypeScript resuelve a `dist` en vez de a `src`.
- **`.nxignore` contiene `sdd/templates`** — son blueprints, no proyectos Nx.
- **Crear apps/libs es otra skill:** `scaffold-nx`, y siempre dentro de un ciclo SDD.

---

## 🔎 Búsqueda y exploración del repo (graphify — OPCIONAL)

> [!NOTE]
> graphify indexa el repo como grafo de conocimiento en `graphify-out/` (código vía AST +
> la capa semántica de `sdd/` y `docs/`). Es **opt-in por dev**: `graphify-out/` está
> gitignoreado, no viaja con el repo y en un clon nuevo no existe. **Nada del flujo SDD
> depende de él.**

**Si `graphify-out/graph.json` existe**, consultalo antes de hacer `grep`/`Read` a ciegas
o de lanzar un agente de exploración: una consulta devuelve una respuesta acotada citando
`source_file`/`source_location`, en vez de leer archivos completos para reconstruir la
misma información. Es la opción más barata en tokens.

| Comando                        | Para qué                                                          |
| ------------------------------ | ----------------------------------------------------------------- |
| `graphify query "<pregunta>"`  | Arquitectura, dependencias, flujos. `--budget N` acota la salida. |
| `graphify explain "<nodo>"`    | Un archivo, clase, servicio o concepto **antes de tocarlo**.      |
| `graphify path "<A>" "<B>"`    | Camino más corto entre dos partes lejanas del sistema.            |
| `graphify affected "<nodo>"`   | Traversal inverso: qué se impacta si cambiás ese nodo.            |
| `graphify-out/GRAPH_REPORT.md` | God Nodes, hyperedges y comunidades etiquetadas.                  |

**Si no existe**, no lo menciones ni intentes construirlo por tu cuenta (consume cupo de
API del dev): trabajá con `grep`/`Read`/agentes de exploración con normalidad. Si el dev
quiere habilitarlo, la skill **`setup-graphify`** lo guía de punta a punta — instalación,
backend gratuito (Gemini free tier u Ollama local), API key y primer build.

**Mantenimiento — solo si lo tenés instalado.** El grafo se desactualiza y entonces
**miente** (archivos movidos, símbolos nuevos, docs reescritas). Actualizalo al cerrar cada
unidad de trabajo — task/ciclo SDD, fix, o antes de cerrar un PR — **no** después de cada
edición individual.

```bash
set -a && source .env && set +a   # ⚠️ imprescindible: graphify NO lee el .env
graphify check-update .           # ¿hay re-extracción semántica pendiente?
graphify update .                 # solo código (AST): gratis, sin LLM
graphify cluster-only . --no-viz  # o `graphify label .` → re-etiquetar comunidades
```

Si cambió **documentación o `sdd/`** (no código), el `update` de AST no alcanza: hace falta
la re-extracción semántica con la skill `graphify` y `--update`, que sí consume LLM.

> [!CAUTION]
> Dos trampas que hacen fallar esto **en silencio**, sin ningún error: (1) `source .env` a
> secas no exporta, así que la key no llega y graphify cae al fan-out de subagentes del
> harness — se paga el modelo caro justo cuando creías usar el gratuito; (2) varios modelos
> "lite" devuelven un grafo vacío (0 edges) sin avisar. El detalle, la tabla de modelos
> medidos y el protocolo de validación están en la skill **`setup-graphify`**.
>
> Si el modelo gratuito falla o se agotó el cupo diario (resetea 00:00 UTC): **avisá al dev
> y dejá la actualización para después**. No escales a un modelo pago ni al fan-out de
> subagentes sin autorización explícita.

## ⚙️ Selección de modelo y esfuerzo (OBLIGATORIO — optimización de tokens/contexto)

> [!IMPORTANT]
> **Antes de encarar CUALQUIER tarea nueva —sin importar con qué modelo estés corriendo
> en ese momento— decidí explícitamente qué modelo y qué nivel de esfuerzo conviene,
> para el trabajo propio y para CADA subagente/workflow que dispares.** El objetivo es
> gastar el mínimo de tokens y contexto sin bajar la calidad del resultado. No arranques
> a ejecutar sin haber hecho esta decisión.

**Regla base:** elegí el modelo/esfuerzo más barato que aún cumple la tarea con calidad.
Escalá de tier sólo cuando la tarea lo justifique (ambigüedad, razonamiento
cross-cutting, riesgo de error alto). Ante la duda entre dos tiers, probá el más barato
primero y escalá si el resultado no alcanza.

**Modelos disponibles** (`model`): `haiku` · `sonnet` · `opus` · `fable`.
**Esfuerzo** (`effort`): `low` · `medium` · `high` · `xhigh` · `max`.

| Tipo de tarea                                                                                                        | Modelo sugerido | Esfuerzo       |
| -------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- |
| Lectura de estado, formateo, edición mecánica/puntual, respuestas cortas, grep/glob dirigido                         | `haiku`         | `low`–`medium` |
| Implementación estándar (una task acotada), tests, edición multi-archivo simple, la mayoría de subagentes ejecutores | `sonnet`        | `medium`       |
| Arquitectura, decisiones cross-cutting, debugging complejo, orquestación SDD, revisión final del ciclo, síntesis     | `opus`          | `high`–`xhigh` |
| Sólo el paso más difícil (verify adversarial, judge, diseño crítico)                                                 | según tarea     | `xhigh`–`max`  |

**Cómo aplicarlo en la práctica:**

- **Subagentes (`Agent`) y workflows (`Workflow`):** pasá `model` y `effort` explícitos
  en cada `agent()`/llamada, acordes a la tabla. Un fan-out de lectores/mecánicos va en
  `haiku`/`low`; el paso de verificación o síntesis en `opus`/`high`. Nunca dispares
  todo un fleet en el tier más caro por defecto.
- **Agentes del ciclo SDD:** implementores → `sonnet`/`medium`; orquestador, arquitecto
  y reviewer → `opus`/`high` (razonamiento y visión global). Funcional/planner →
  `sonnet`/`medium` salvo spec compleja.
- **Trabajo propio (main loop):** si la tarea es trivial, bajá el esfuerzo; no quemes
  contexto releyendo lo ya establecido ni narrando opciones que no vas a seguir.
- **Si el repo tiene grafo de graphify** (regla anterior, opcional), consultalo antes de
  pagar lecturas a ciegas: es parte de la misma optimización de tokens.
- **Telemetría de uso (dashboard de Costos):** al cerrar cada ciclo, registrar el consumo
  aproximado en `cycle.json` → `metrics.usage` (`tokens_in`/`tokens_out`, y por task si se
  conoce). Alimenta la vista **Costos** del visor SDD, que compara el costo agéntico contra
  la estimación tradicional de las tasks — las tarifas se editan en `sdd/pricing.json`.
  Una aproximación honesta vale; un número inventado no: ante la duda, omitir el campo.

## ✍️ Código sin comentarios (OBLIGATORIO — el código se explica solo)

> [!IMPORTANT]
> **No escribir comentarios en el código de implementación.** Hoy se genera más
> comentario que código, y es gasto doble: tokens al escribirlos y tokens cada vez que
> un humano o un agente lee el archivo. En este repo la documentación NO vive en
> comentarios: vive en los documentos SDD (spec, functional, planner, architect,
> constitutions) y, si está disponible, en el grafo de graphify. Un comentario que
> repite lo que el SDD ya documenta es duplicación que además se desactualiza.

**Cómo lograr cero comentarios sin perder claridad:**

- **Nombres declarativos**: cada función/método/variable dice exactamente qué hace, sin
  margen a segunda interpretación — `propagateAccountStatusToTradingApi()` en vez de
  `process()` + comentario explicando.
- **Modularizar**: funciones cortas, de una sola responsabilidad. Una función larga con
  bloques comentados (`// paso 1: ...`) son en realidad N funciones con nombre propio.
- **El impulso de comentar es señal de refactor**: si sentís que una línea necesita
  explicación, extraé una función cuyo nombre sea esa explicación.
- Prohibido: comentarios narrativos, "qué hace la línea siguiente", código muerto
  comentado, y `// TODO` — un TODO real es una task o un fix registrado en SDD, no un
  comentario.

**Únicas excepciones permitidas** (una línea, en inglés):

- Una restricción que el código no puede expresar: workaround con link al issue
  externo, o regla de negocio contra-intuitiva con referencia a su spec
  (ej. `// ack 200 only after confirmed propagation so the provider retries (spec-jdoe-001)`).
- Anotaciones exigidas por framework/tooling (Swagger/OpenAPI, Lombok, decorators) y
  Javadoc/JSDoc público **solo si el linter del subproyecto lo exige** — eso no es un
  comentario narrativo.

**Regla espejo en review:** un PR que agrega comentarios fuera de estas excepciones
recibe request de cambios; el sdd-reviewer lo chequea al cerrar el ciclo.

## 🧩 Contexto de subproyectos: actualizaciones ADITIVAS (anti merge-conflict)

> [!IMPORTANT]
> Cuando varios devs trabajan sus specs sobre el mismo subproyecto (ej.
> `example-api`), todos actualizan `sdd/context/apps/example-api/*.md` al cerrar
> su ciclo y eso genera merge conflicts garantizados. **Durante un ciclo/fix NUNCA se
> editan directamente `constitution.md` ni `context_prompt.md` del subproyecto**: las
> actualizaciones son aditivas, un fragmento append-only por ciclo/fix.

**Mecanismo (patrón changesets):**

1. **Escribir** — al cerrar un ciclo o fix, en lugar de editar los archivos base, crear:

   ```
   sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md
   # [spec-id] admite la forma corta spec-[gh-user]-[NNN] (sin slug) — es la práctica vigente
   # fixes: sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-fix-[gh-user]-[seq].md
   #        (fixes de spec: YYYY-MM-DD-fix-[gh-user]-[spec-NNN]-[seq].md)
   ```

   El nombre incluye el spec-id (que lleva el gh-user del dev) → **es único por
   construcción y dos devs jamás chocan**. Template mínimo del fragmento:

   ```markdown
   # [spec-id] cycle-[XX] — [YYYY-MM-DD]

   ## Estado → qué quedó implementado / en qué estado queda el subproyecto

   ## Estructura → paquetes/módulos/patrones nuevos o cambiados

   ## Dependencias → librerías o servicios nuevos que consume/expone

   ## Qué sigue → pendientes que el próximo ciclo debe saber
   ```

   Secciones vacías se omiten. El fragmento es **corto y solo el delta** — nunca copia
   del contenido base.

2. **Leer** — todo agente que necesite el contexto de un subproyecto lee
   `constitution.md` + `context_prompt.md` **+ `updates/*.md` en orden de nombre**
   (el prefijo de fecha los ordena cronológicamente). El contexto vigente = base + deltas.

3. **Consolidar** — operación de **un solo actor**, nunca en paralelo con un ciclo:
   el orquestador al iniciar un ciclo nuevo sobre ese subproyecto (o el reviewer si se
   acumulan ≥5 fragmentos) funde los fragmentos en los archivos base, actualiza el
   encabezado `> Última actualización:`, **borra los fragmentos consolidados** y lo
   commitea como cambio dedicado (`chore(sdd): consolidate context updates for [nombre]`).
   La línea `> Última actualización:` solo cambia en la consolidación — es el principal
   imán de conflictos y nadie más la toca.

4. **Contexto global** (`sdd/context/constitution.md` y `context_prompt.md`): son tablas
   de referencia. Tocar **solo la fila del subproyecto propio** (o agregar una fila
   nueva al final si se creó una app/lib); jamás reformatear ni reordenar la tabla
   completa.

> El CONTEXTO GATE se cumple con el fragmento escrito en `updates/` — no exige editar
> los archivos base durante el ciclo (ver nota en la sección del gate).

## 🧠 MEMORIA GATE — autoaprendizaje entre sesiones (lessons + journal)

> [!IMPORTANT]
> El contexto de subproyectos (sección 🧩) registra **qué es** el sistema; la memoria
> registra **qué aprendimos** trabajándolo. Sin ella cada sesión repite los mismos errores
> y re-paga en tokens el mismo descubrimiento. `sdd/memory/` es la memoria versionada del
> repo: viaja con git, sirve a cualquier agente y a cualquier máquina o CI.

**Estructura (dos capas, costo de lectura asimétrico por diseño):**

- `sdd/memory/lessons.md` — lecciones **destiladas**, cap duro 120 líneas. **Leerlo al
  inicio de toda sesión**, junto con `context_prompt.md`. Es la única pieza de memoria
  que se carga siempre.
- `sdd/memory/journal/` — entradas episódicas append-only, el detalle crudo. **Jamás se
  lee entero**: solo grep dirigido cuando una lección destilada remite a su detalle.

**1. Escribir** — al cerrar un ciclo o fix, **solo si hubo lección real**, crear:

```
sdd/memory/journal/YYYY-MM-DD-[spec-id]-cycle-[XX].md
# fixes: sdd/memory/journal/YYYY-MM-DD-fix-[gh-user]-[seq].md
#        (fixes de spec: YYYY-MM-DD-fix-[gh-user]-[spec-NNN]-[seq].md)
```

Mismo naming que los fragmentos de contexto → único por construcción, dos devs jamás
chocan. Template mínimo (secciones vacías se omiten; crear `journal/` si no existe):

```markdown
# [spec-id] cycle-[XX] — [YYYY-MM-DD]

## Qué pasó → el hecho concreto (error, descubrimiento, supuesto que falló)

## Lección → 1 línea accionable, candidata a lessons.md

## Costo evitable → qué tokens/tiempo se habrían ahorrado sabiéndolo antes
```

**Filtro anti-ruido (obligatorio):** antes de escribir, preguntarse *"¿esto cambiaría el
comportamiento de un agente futuro?"*. Si la respuesta es no —lo obvio, lo ya documentado
en constitutions/skills/dual-harness, el detalle de implementación del ciclo— **no se
escribe**. Una memoria con ruido cuesta tokens y esconde las lecciones reales.

**2. Leer** — al iniciar sesión: `lessons.md` completo. `journal/` solo bajo demanda.

**3. Destilar** — operación de **un solo actor**, nunca en paralelo con un ciclo: cuando
`journal/` acumula ≥5 entradas (`pnpm sdd:validate` lo avisa), el orquestador al iniciar
el próximo ciclo funde cada entrada en una línea de la categoría correcta de `lessons.md`
(Proceso / Técnica / Costo), actualiza su encabezado `> Última destilación:`, **borra las
entradas destiladas** y lo commitea como cambio dedicado
(`chore(sdd): distill memory journal into lessons`). Reglas de la destilación:

- Lección específica de un subproyecto → va a su `constitution.md` vía consolidación 🧩,
  no a `lessons.md` (que es transversal).
- Cap 120 líneas: si se supera, podar primero lecciones obsoletas o ya absorbidas por
  una skill/constitution — la memoria buena es chica.
- Durante ciclos/fixes `lessons.md` **no se edita** — igual que los archivos base de
  contexto, solo lo toca la destilación.

---

## ⛔ SPEC GATE — REGLA GLOBAL INVIOLABLE

**Antes de escribir UNA SOLA LÍNEA de código de implementación**, verificar:

```
1. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md?      → SI / NO
2. ¿La spec está registrada en sdd/specs/index.json?                                       → SI / NO
3. ¿El módulo está en in_progress_modules en global.json?                                  → SI / NO
4. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/brief.yaml?            → SI / NO
5. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/functional.md?         → SI / NO
6. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/planner.md?            → SI / NO
7. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/architect.md?          → SI / NO
8. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/cycle.json?            → SI / NO
9. ¿Existe sdd/specs/spec-[gh-user]-[NNN]-[slug]/cycles/cycle-[XX]/tasks.json con tasks?  → SI / NO
10. ¿Existe sdd/context/[apps|libs|tools]/[nombre]/constitution.md?                              → SI / NO
```

**Convención de naming (INVIOLABLE):**

- Spec: `spec-[gh-user]-[NNN]-[slug]` donde `[NNN]` es el contador personal del dev (no global)
- Ciclos: `cycle-01`, `cycle-02`... reseteados por spec (no globales)
- Tasks: `TASK-[NNN]` (ej: `TASK-001`) — el scope es el `tasks.json` del ciclo, sin prefijo de spec/ciclo
- Fixes: `sdd/specs/{spec-id}/fixes/fix-[gh-user]-[spec-NNN]-[seq].md`; `sdd/fixes/` para fixes repo-level
- Índice global: `sdd/specs/index.json` (append-only, sin last_id)
- Índice de fixes: `sdd/fixes.json` (con spec_id para trazabilidad)

**Documentos permitidos en la raíz del ciclo (INVIOLABLE):**

Solo estos 6 archivos pueden existir directamente en `cycle-[XX]/`:
`brief.yaml`, `functional.md`, `planner.md`, `architect.md`, `cycle.json`, `tasks.json`

> Cualquier documento de apoyo adicional (diagramas, ejemplos de API, exploración) debe ir en `cycle-[XX]/artifacts/` y referenciarse en `cycle.json["artifacts"]`.

**Si alguna respuesta es NO → DETENER. Completar ese paso antes de continuar.**

## ⛔ TIPADO ESTRICTO DE REGISTROS SDD (INVIOLABLE)

Todos los `*.json` de `sdd/` tienen JSON Schema estricto en `sdd/schemas/` y declaran `$schema`.
**Antes de escribir en cualquier registro SDD, leer su schema. Después de escribir, correr:**

```bash
pnpm sdd:validate            # valida TODOS los registros + reglas cruzadas
pnpm sdd:rebuild-tasks-index # regenera sdd/tasks.json desde los tasks.json per-cycle
```

- `sdd/tasks.json` es **solo un índice** generado — las tasks canónicas viven en
  `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json`. **Nunca editar detalle de tasks en el índice.**
- Un commit que deje `pnpm sdd:validate` en rojo es un commit inválido — el mismo check corre en CI
  (`.github/workflows/sdd-validate.yml`, gate de todo PR que toque `sdd/**`) y es paso obligatorio del sdd-reviewer.
- Schemas: `tasks-index`, `cycle-tasks`, `cycle`, `global`, `specs-index`, `api`, `db-schema`, `components`, `fixes` (todos en `sdd/schemas/*.schema.json`).

## ⛔ CONTEXTO GATE — REGLA GLOBAL DE CIERRE (INVIOLABLE)

**Al finalizar la revisión de CUALQUIER ciclo**, el sdd-reviewer DEBE actualizar:

```
1. sdd/context/[apps|libs|tools]/[nombre]/constitution.md     → estructura, patrones, dependencias del ciclo
2. sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md   → estado, ciclos completados, qué sigue
3. sdd/context/constitution.md                          → tabla-snapshot del subproyecto (sección 3)
4. sdd/context/context_prompt.md                        → nueva fila si se creó app/lib/tool
```

**El `cycle.json` NO puede tener `status: "completed"` si estos archivos están desactualizados.**

> [!IMPORTANT]
> **Los pasos 1–2 se cumplen escribiendo el fragmento aditivo en
> `sdd/context/[apps|libs|tools]/[nombre]/updates/`** (ver sección 🧩 Contexto de
> subproyectos) — los archivos base del subproyecto NO se editan durante el ciclo; solo
> los toca la consolidación de un solo actor. Los pasos 3–4 (tablas globales) siguen
> siendo edición directa, pero únicamente de la fila propia.

- Encabezado obligatorio en constitution.md y context_prompt.md de subproyecto:
  `> Última actualización: cycle-[N] | Fecha: [YYYY-MM-DD]`
- El global NUNCA duplica el detalle del subproyecto: solo mantiene tablas de referencia
- Ver reglas completas: `sdd/agents/sdd-reviewer.agent.md` → sección "Actualización de contexto"

> ⚠️ El `cycle.json` debe crearse al **iniciar** el ciclo con `status: "in-progress"`.
> Solo el Reviewer lo actualiza a `status: "completed"` al cerrar. Un ciclo sin `cycle.json` no puede iniciarse.

- Prompt de verificación: `sdd/prompts/check-spec-before-implement.prompt.md`
- Prompt de inicio de ciclo: `sdd/prompts/start-sdd-cycle.prompt.md`
- Estado actual del proyecto: `sdd/global.json`

---

## 🔧 FIX GATE — Bypass controlado del SPEC GATE

Cuando el problema **no puede esperar un ciclo SDD completo**, usar uno de estos prefijos en el mensaje al orquestador:

| Prefijo         | Cuándo usarlo                                               |
| --------------- | ----------------------------------------------------------- |
| `[HOTFIX]`      | Producción bloqueada, regresión crítica, dato corrupto      |
| `[BUGFIX]`      | Error confirmado en desarrollo o testing                    |
| `[FIX]`         | Alias genérico — el orquestador pedirá clasificar           |
| `[IMPROVEMENT]` | Mejora menor (UX, wording, performance puntual) out-of-spec |

**El orquestador ejecutará `sdd/prompts/hotfix-bypass-gate.prompt.md`** que reemplaza el SPEC GATE con un proceso ligero:

1. Recolecta justificación y datos del fix
2. Registra el fix en `sdd/fixes.json` con ID correlativo (FIX-001, FIX-002…)
3. Crea o actualiza `sdd/specs/{spec-id}/fixes/fix-[gh-user]-[spec-NNN]-[seq].md` (o `sdd/fixes/` si es repo-level)
4. Autoriza al implementador a proceder

> ⚠️ El FIX GATE **no elimina la trazabilidad** — la simplifica. Todo fix queda registrado y el sdd-reviewer lo evalúa al cerrar el ciclo.

- Registry de fixes: `sdd/fixes.json`
- Prompt FIX GATE: `sdd/prompts/hotfix-bypass-gate.prompt.md`

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->


---

## Instrucciones previas del proyecto (absorbidas al instalar SDD)

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Spec-Driven Development legacy (docs/) — SUPERSEDIDO por el arnés `sdd/`

> ⚠️ El flujo SDD anterior de este repositorio (specs en `docs/specs/branches/`, planes en
> `docs/plans/`, skill legacy en `.github/skills/`) queda **supersedido** por el arnés portable
> `sdd/` descrito arriba. NO iniciar features nuevas con el flujo legacy: usar el ciclo de
> agentes SDD (`sdd/specs/` + SPEC GATE).
>
> Los documentos legacy siguen siendo referencia histórica valiosa:
>
> | Tipo | Ruta |
> |------|------|
> | Constitución histórica del proyecto | `docs/CONSTITUTION.md` |
> | Specs de features legacy | `docs/specs/branches/NN-nombre.md` |
> | Planes de implementación legacy | `docs/plans/NN-nombre.md` |
> | Branch plan maestro legacy | `docs/plans/` (archivo `*-branch-plan.md`) |
>
> Al cerrar cada ciclo, el contexto vigente se actualiza en `sdd/context/` (fragmentos
> aditivos en `updates/`), no en `docs/CONSTITUTION.md`.
