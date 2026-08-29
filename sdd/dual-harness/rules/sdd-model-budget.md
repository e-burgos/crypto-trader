---
trigger: always_on
description: Presupuesto de modelo y esfuerzo por tarea (regla obligatoria de optimización de tokens) y registro de telemetría de costos
---

# ⚙️ Presupuesto de modelo/esfuerzo (OBLIGATORIO)

Antes de encarar CUALQUIER tarea: decidir explícitamente qué tier de modelo y qué
nivel de razonamiento conviene, para el trabajo propio y para cada subagente que se
dispare. Regla base: **el tier más barato que aún cumple con calidad**; escalar solo
con justificación. Tabla canónica completa: `GEMINI.md` raíz, sección ⚙️.

| Tier          | Tarea típica                                             | Gemini (modelo/thinking)             |
| ------------- | -------------------------------------------------------- | ------------------------------------ |
| **económico** | lectura, formateo, edición mecánica, grep, fan-out       | Flash-Lite o Flash / `minimal`–`low` |
| **estándar**  | implementación de una task, tests, edición multi-archivo | Flash / `medium`                     |
| **alto**      | arquitectura, debugging complejo, orquestación, review   | Pro / `low`–`high`                   |
| **máximo**    | solo el paso más difícil (verify adversarial, judge)     | Pro / `high`                         |

Agentes del ciclo SDD: implementores → estándar; orquestador/arquitecto/reviewer →
alto; funcional/planner → estándar salvo spec compleja.

**En Antigravity el modelo lo elige el usuario en el dropdown.** ANTES de ejecutar,
comparar el modelo activo con el tier requerido: si no coinciden (tarea económica por
correr en Pro/high, o tarea de tier alto en Flash), **avisar y pedir el cambio de
modelo o thinking level** — nunca ejecutar en silencio con el tier equivocado.

**En Gemini CLI:** modelo por sesión/flag acorde al tier; fan-out de lectores en
subagentes económicos, síntesis en Pro; `/stats` da el consumo real.

## Telemetría (dashboard de Costos) — OBLIGATORIA

Al cerrar cada ciclo: `cycle.json → metrics.usage` con `tokens_in`/`tokens_out` y
`by_tier` con claves `proveedor/modelo` (`gemini/pro`, `gemini/flash`,
`claude/opus`, `copilot/claude-sonnet`). Por task: `tasks.json → usage.model_tier`.
Todo fix: `usage` en `sdd/fixes.json`. Tarifas editables en `sdd/pricing.json`.

**Declarar proveedor y modelo no es opcional.** El modelo siempre se conoce: es el que
estás usando. De dónde sale el número de tokens:

| Arnés              | Fuente                                    | `source`            | `approx` |
| ------------------ | ----------------------------------------- | ------------------- | -------- |
| Claude Code        | reporte de uso de la sesión               | `session-report`    | `false`  |
| Gemini CLI         | `/stats`                                  | `stats-command`     | `false`  |
| GitHub Copilot     | sin contador → estimación declarada       | `declared-estimate` | `true`   |
| Antigravity        | sin contador → estimación declarada       | `declared-estimate` | `true`   |

> Antigravity registra bajo `gemini/*` — corre modelos Gemini.

**Quien ejecuta registra; el reviewer consolida.** Se anota al cerrar cada task y cada fix; el
total del ciclo se suma de eso, no se reconstruye al final.

**Sin contador se estima; no se omite.** `/stats` y el reporte de sesión son comandos del
cliente: un agente no puede ejecutarlos (pedíselos al dev). En Copilot y Antigravity no
existen. En todos esos casos va una estimación de orden de magnitud con `approx: true` y
`source: "declared-estimate"` — el visor la muestra como **estimado**, no la esconde.

Lo prohibido es inventar un número preciso y presentarlo como medido (`approx: false` sin
contador detrás). Un ciclo cerrado sin `usage` es un cierre incompleto: `pnpm sdd:validate`
lo avisa.
