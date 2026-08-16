---
name: sdd-hermes
description: Loop agéntico punta a punta - de una idea en lenguaje natural a producto funcionando. Descubre requisitos, decide y configura el stack con la CLI harness, siembra specs y conduce ciclos SDD encadenados hasta agotar el backlog, con presupuesto de modelo/esfuerzo por fase y condiciones de corte explícitas. Invocar cuando el usuario trae una idea u objetivo, no una spec.
---

# Skill: sdd-hermes

## Cuándo invocarlo

- El usuario trae **una idea, un objetivo o un problema** ("quiero una app que...",
  "necesito automatizar...") y espera que el sistema lo lleve a producto.
- NO invocarlo si ya existe una spec para el trabajo pedido → ir directo a
  `sdd-orchestrator` (SPEC GATE normal). Hermes no reemplaza el ciclo SDD: lo conduce.

## Principios (inviolables)

1. **SDD es el corazón.** Hermes jamás bypassea SPEC GATE, CONTEXTO GATE ni MEMORIA
   GATE — su único privilegio es encadenar fases sin esperar instrucciones humanas
   entre medio.
2. **Checkpoints humanos.** Dos decisiones son siempre del usuario: el **stack**
   (fin de FASE 2) y cada **spec** antes de implementar (fin de FASE 4). El resto
   corre solo, salvo que el usuario pida modo asistido (checkpoint por fase).
3. **Presupuesto explícito.** Cada fase declara modelo/esfuerzo ANTES de ejecutar
   (regla ⚙️ del dual-harness). Hermes es un loop largo: sin esta disciplina el
   costo explota.
4. **Todo queda registrado en `sdd/`.** Si Hermes se interrumpe en cualquier punto,
   otro agente retoma desde los registros — el loop no tiene estado propio.

## Presupuesto por fase (regla ⚙️ aplicada al loop)

| Fase                                      | Modelo    | Esfuerzo | Nota                                             |
| ----------------------------------------- | --------- | -------- | ------------------------------------------------ |
| 1. Descubrimiento                         | `sonnet`  | `medium` | Extraer, no razonar profundo                     |
| 2. Decisión de stack                      | `opus`    | `high`   | Una sola vez, cross-cutting, caro equivocarse    |
| 3. Configuración del workspace            | `haiku`   | `low`    | Mecánica: escribir config + correr CLI           |
| 4. Redacción de specs                     | `opus`    | `high`   | La spec es el contrato de todo lo que sigue      |
| 5. Loop de ciclos                         | según agente SDD | — | La tabla del dual-harness ⚙️ manda: implementores `sonnet`/`medium`, orquestador/arquitecto/reviewer `opus`/`high` |

## FASE 1 — Descubrimiento (una ronda de preguntas, máximo)

Leer `sdd/memory/lessons.md` (MEMORIA GATE) y extraer de la idea:

- **Dominio y usuarios**: quién lo usa y para qué.
- **Módulos core**: 3–7 capacidades con nombre propio (serán los módulos SDD).
- **Necesidades técnicas** (checklist): ¿persistencia? ¿tiempo real? ¿colas/jobs?
  ¿archivos/media? ¿auth? ¿UI web? ¿API pública? ¿integraciones externas?

Si algo **bloquea la decisión de stack**, hacer UNA ronda de preguntas concretas.
Todo lo demás se asume con defaults y se anota como supuesto en la spec — no
interrogar al usuario por lo que una spec puede fijar después.

## FASE 2 — Decisión de stack (matriz → propuesta → checkpoint)

| Necesidad detectada                          | Pieza                                     |
| -------------------------------------------- | ----------------------------------------- |
| API con dominio rico, websockets, jobs       | app `nestjs`                              |
| API liviana / microservicio simple           | app `fastify`                             |
| Scripting, datos, ML, integraciones Python   | app `python`                              |
| UI web SPA (dashboard, admin, tool interna)  | app `react`                               |
| UI web con SSR/SEO (producto público)        | app `nextjs`                              |
| Persistencia relacional                      | service `postgres`                        |
| Cache, sesiones, rate-limit, pub/sub simple  | service `redis`                           |
| Colas/eventos entre servicios                | service `rabbitmq`                        |
| Archivos/media (S3-compatible)               | service `minio`                           |
| Front + back en el stack                     | libs `shared-types` + `api-client`        |
| ≥2 apps TypeScript                           | lib `shared-utils`; UI compartida → `ui-kit` |

Reglas: **una sola app → modo `standalone`**; front+back o multi-servicio → modo
`nx`. Ante la duda entre dos piezas, la más simple. No agregar piezas "por si
acaso": `harness add app|service` existe para cuando la spec lo exija.

**Checkpoint:** presentar stack propuesto + módulos + supuestos. Sin aprobación no
se genera nada.

## FASE 3 — Configuración del workspace (mecánica, cero prompts)

**Repo vacío** → escribir `harness.config.json` y correr la vía no interactiva:

```jsonc
{
  "mode": "nx", // o "standalone" (exactamente 1 app)
  "project": {
    "name": "mi-proyecto", // kebab-case
    "description": "Qué es y para quién",
    "packageScope": "@mi-proyecto"
  },
  "apps": [{ "name": "core-api", "type": "nestjs" }], // nestjs|react|python|nextjs|fastify|springboot|hono
  "libs": [{ "name": "shared-types", "type": "shared-types" }], // shared-types|shared-utils|ui-kit|api-client|config
  "services": [{ "type": "postgres" }] // postgres|redis|rabbitmq|minio (port/version opcionales)
}
```

```bash
npx @e-burgos/sdd-harness init --config ./harness.config.json
```

**Repo existente sin SDD** → instalarlo sin tocar el código, sin prompts:

```bash
npx @e-burgos/sdd-harness configure sdd --name mi-proyecto --description "Qué es y para quién"
```

(agregar `-y` sólo si ya hay un `sdd/` y querés **resetearlo** — borra specs, ciclos y fixes).

**Workspace SDD existente** → cubrir solo los gaps: `harness add app <type> --name <name>`,
`harness add service <type>`, `harness configure docker --services postgres,redis`.

> Todo comando de la CLI tiene flags para cada prompt: sin ellos el comando abre un
> prompt interactivo que **no se puede responder por stdin** (se cuelga). Pasá siempre
> los flags, y `harness <comando> --help` lista los que faltan.

**Verificación de fase (gate):** `pnpm sdd:validate` verde + build del workspace
verde. Rojo → arreglar antes de seguir; nunca sembrar specs sobre base rota.

## FASE 4 — Sembrar el backlog SDD

Por cada módulo core, en orden de dependencia:

1. `harness add spec <slug-del-modulo> --author <gh-user> --title "<título>" --app apps/<subproyecto>`
   — crea la estructura y registra en `sdd/specs/index.json`. Sin `--title`/`--app`
   el comando queda esperando input.
2. Redactar el `.spec.md` desde el descubrimiento: objetivo, alcance del primer
   ciclo, criterios de aceptación de alto nivel, supuestos asumidos en FASE 1.
3. Registrar el módulo en `pending_modules` de `sdd/global.json` (module + spec +
   apps, según `sdd/schemas/global.schema.json`).

**Checkpoint por spec:** la spec es el contrato — el usuario la aprueba (o edita)
antes de que el loop la implemente. En modo full-auto explícitamente pedido, se
aprueban en bloque acá y el loop no vuelve a preguntar.

## FASE 5 — El loop de ciclos

```
mientras global.json tenga pending_modules o in_progress_modules:
  1. sdd-orchestrator  → SPEC GATE, consolidación de contexto, destilación de
                         memoria si journal ≥5, brief, cycle.json in-progress
  2. sdd-functional    → functional.md
  3. sdd-planner + sdd-architect → tasks.json, planner.md, architect.md,
                         api/schema/components
  4. sdd-implementor-back / -front → tasks done, registros actualizados
  5. sdd-reviewer      → pnpm sdd:validate verde, CA verificados, CONTEXTO GATE
                         (fragmento aditivo), MEMORIA GATE (journal si hubo
                         lección), cycle.json completed
  6. commit del ciclo → siguiente módulo
```

**Condiciones de corte (obligatorias — Hermes para y reporta, no insiste):**

- `pnpm sdd:validate` o los tests fallan **2 veces en el mismo punto** con causas
  distintas de tipeo → parar, reportar diagnóstico y estado exacto del loop.
- Aparece una **decisión de producto** no cubierta por la spec → preguntar al
  usuario; nunca inventarla.
- **Presupuesto/uso agotado** (límite de sesión, rate limit, cupo del plan): cerrar
  limpio el ciclo en curso (o dejarlo `in-progress` con registros válidos), commitear
  y reportar en qué punto del backlog quedó — los registros SDD son el checkpoint;
  cualquier sesión futura retoma con `sdd/global.json` + `sdd/memory/lessons.md`.

**Disciplina de tokens dentro del loop:** brief mínimo por agente (el orquestador ya
lo garantiza); jamás releer specs completas si el brief alcanza; `lessons.md` al
inicio de cada sesión; graphify si existe; los implementores como subagentes
`sonnet`/`medium` con contexto acotado a su task.

## Automatización del loop (opcional — Claude Code)

El loop es retomable por diseño: todo el estado vive en los registros SDD, así que
cualquier sesión nueva puede continuarlo con `sdd/prompts/hermes-resume.prompt.md`
(prompt standalone: carga lessons + global.json, diagnostica la posición y sigue).
Sobre esa base, en Claude Code se puede automatizar:

- **Loop recurrente:** `/loop 15m` con el contenido de `hermes-resume.prompt.md` —
  cada iteración retoma desde los registros; las condiciones de corte del prompt
  evitan que insista contra un error repetido.
- **Reanudación programada (Routines/cron):** una Routine que dispare el mismo prompt
  en una sesión nueva (los registros son el checkpoint, no hace falta la sesión viva).
- **Memoria al inicio de sesión (hook opcional):** en `.claude/settings.json` del
  repo, un hook `SessionStart` que imprima la memoria destilada — se inyecta como
  contexto sin gastar un turno:

  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "hooks": [
            { "type": "command", "command": "cat sdd/memory/lessons.md 2>/dev/null || true" }
          ]
        }
      ]
    }
  }
  ```

El kit no instala nada de esto solo: son decisiones del dev (consumen cupo del plan).
En agentes sin automatización (Copilot, Cursor), el equivalente manual es pegar
`hermes-resume.prompt.md` al abrir sesión.

## Archivos que modifica

Hermes en sí solo escribe `harness.config.json` (FASE 3) y los `.spec.md` +
`pending_modules` (FASE 4). Todo lo demás lo escriben los agentes SDD de cada fase
bajo sus propias reglas — ver "Archivos que modifica" de cada skill.
