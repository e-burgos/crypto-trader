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
subagentes económicos, síntesis en Pro; `/stats` da el consumo real del main loop.

## Telemetría (dashboard de Costos) — OBLIGATORIA

**Quien ejecuta registra al cerrar** su unidad de trabajo: `provider_model`, `effort`,
`tokens_in`/`tokens_out` (o `tokens_total`), `approx` y `source` → task:
`tasks.json → tasks[].usage`; documento/ciclo: `cycle.json → metrics.usage.by_agent[]`
(una entrada por unidad; el reviewer agrega la suya y consolida); fix:
`sdd/fixes.json → fixes[].usage` (`by_agent[]` si varios agentes). **`by_tier` se
deriva de `by_agent`** agrupado por `provider_model` — no se llena a mano. Tarifas
editables en `sdd/pricing.json`.

**Declarar proveedor y modelo no es opcional.** El modelo siempre se conoce: es el que
estás usando. De dónde sale el número de tokens:

| Arnés                              | Fuente                                              | `source`                    | `approx` |
| ------------------------------------ | ----------------------------------------------------- | ---------------------------- | -------- |
| Claude Code — subagente (`Agent`)  | notificación `<subagent_tokens>` al padre — exacta   | `agent-usage-notification`  | `false`  |
| Claude Code — main loop            | reporte de uso de la sesión                          | `session-report`            | `false`  |
| Gemini CLI — main loop             | `/stats`                                             | `stats-command`             | `false`  |
| Gemini CLI — subagentes            | sin contador → estimación declarada                  | `declared-estimate`         | `true`   |
| GitHub Copilot                     | sin contador → estimación declarada                  | `declared-estimate`         | `true`   |
| Antigravity                        | sin contador → estimación declarada                  | `declared-estimate`         | `true`   |

> Antigravity registra bajo `gemini/*` — corre modelos Gemini. `/stats` solo cubre el
> main loop de Gemini CLI; sus subagentes van con estimación declarada.

**Sin contador se estima; no se omite.** `/stats` y el reporte de sesión son comandos del
cliente: un agente no puede ejecutarlos (pedíselos al dev). Lo prohibido es inventar un
número preciso y presentarlo como medido (`approx: false` sin contador detrás). Un ciclo
o fix cerrado sin `usage` es un cierre incompleto: `pnpm sdd:validate` lo avisa.
