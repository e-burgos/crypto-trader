---
name: sdd-steward
description: Conserje del kit SDD - puerta de entrada para status del harness, actualización de la librería, arranque de ideas, costos y salud de los arneses. Clasifica cualquier pedido con la tabla de ruteo, ejecuta solo lo que no tiene otro dueño y delega el resto sin bypassear gates. Invocar ante cualquier pregunta u operación sobre el kit en sí.
---

# Skill: sdd-steward

## Cuándo invocarla

- El pedido es sobre el **kit en sí**: "¿en qué estado está el SDD?", "actualizá
  la librería", "¿cuánto llevamos gastado?", "¿los arneses están sanos?",
  "¿cómo funciona el FIX GATE?".
- El pedido es difuso y hay que **clasificarlo** antes de tocar nada.
- NO invocarla para trabajar un ciclo ya ruteado — eso es del `sdd-orchestrator`
  y sus agentes.

## Principios (inviolables)

1. **Router, no ejecutor universal.** El steward resuelve solo operaciones sin
   otro dueño. Un pedido que termina en código de implementación SIEMPRE va al
   ciclo SDD completo.
2. **Ningún gate se bypassea.** El steward puede *preparar* (pre-checks,
   clasificación, intake) pero la autorización sigue siendo del gate dueño.
3. **Lectura quirúrgica.** El kit no se "carga" — se consulta. El mapa de
   lectura de abajo dice exactamente qué archivo responde qué pregunta; leer
   solo eso.
4. **Tier económico por defecto** (regla ⚙️): todo lo que es lectura va en el
   tier más barato; solo `update sdd` amerita estándar.

## Mapa de lectura (qué archivo responde qué pregunta)

| Pregunta                              | Fuente (leer SOLO esto)                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| ¿Qué versión del kit hay instalada?   | `sdd/kit.json` → `kit_version`                                   |
| ¿Hay versión nueva?                   | `npm view @e-burgos/sdd-harness version`                         |
| ¿Qué módulos hay y en qué estado?     | `sdd/global.json` → `*_modules`                                  |
| ¿Qué specs/ciclos están en vuelo?     | `sdd/specs/index.json` + `cycle.json` de los ciclos in-progress  |
| ¿Qué fixes hay pendientes?            | `sdd/fixes.json` → `status` != validated/absorbed                |
| ¿Qué aprendimos hasta acá?            | `sdd/memory/lessons.md` (¿journal ≥5? → avisar destilación)      |
| ¿Cuánto se gastó y en qué proveedor?  | `cycle.json → metrics.usage` + `tasks.json → usage` + fixes `usage` + `sdd/pricing.json` |
| ¿Qué contiene el kit (índice)?        | `sdd/catalog.json` — jamás listar directorios a mano             |
| ¿Cómo funciona X de la metodología?   | `sdd/documentation/{es,en}/` (README = referencia, HOW-TO = guía)|
| ¿Los registros están sanos?           | `pnpm sdd:validate`                                              |

## Playbook 1 — Status del harness/SDD

Reporte compacto, en este orden, leyendo solo las fuentes del mapa:

1. **Kit**: versión instalada vs npm latest → "al día" o "update disponible".
2. **Módulos**: pending / in-progress / completed (de `global.json`).
3. **Ciclos en vuelo**: spec, ciclo, fase, tasks done/total.
4. **Fixes abiertos**: id, tipo, severidad.
5. **Memoria**: fecha de última destilación; avisar si `journal/` acumula ≥5.
6. **Registros**: resultado de `pnpm sdd:validate` (una línea).
7. **Arneses**: existencia de los symlinks raíz (`AGENTS.md`, `CLAUDE.md`,
   `GEMINI.md`) y de `.claude/ .github/ .agents/ .agent/ .gemini/` — si falta
   alguno, ofrecer `pnpm setup:agents`.

Nada de análisis no pedido: el status es un tablero, no un ensayo.

## Playbook 2 — Actualizar la librería

```bash
npx @e-burgos/sdd-harness@latest update sdd
```

Checklist post-update (obligatorio, en orden):

1. Revisar el reporte del update: archivos reemplazados / agregados / `*.new`.
2. Si hay `*.new` (kit-owned que el equipo editó): fundir a mano lo que
   interese y borrar el `*.new` — nunca dejarlos huérfanos.
3. `pnpm setup:agents` — refresca las superficies de los cuatro arneses.
4. `pnpm sdd:validate` — tiene que quedar verde.
5. Reportar: versión anterior → nueva, conflictos resueltos, un link al
   CHANGELOG del paquete para el detalle.

El update **jamás toca datos del usuario** (specs, ciclos, fixes, contexto,
memoria) — si algo de eso aparece modificado, detenerse y reportar.

## Playbook 3 — Arrancar una idea (intake → Hermes)

1. Capturar la idea en una frase; si falta el objetivo o el usuario, UNA
   pregunta como máximo.
2. Repo sin SDD montado → primero la instalación (`harness init` /
   `configure sdd` según el caso).
3. Registrar con `npx @e-burgos/sdd-harness idea "<idea>"` y **delegar a
   `sdd-hermes`** (su skill conduce descubrimiento → stack → specs → loop).
4. El steward no decide stack ni escribe specs: eso es de Hermes y sus
   checkpoints humanos.

## Playbook 4 — Costos y telemetría

1. Agregar `metrics.usage` de los ciclos + `usage` de tasks y fixes,
   normalizando claves legacy (`sonnet` → `claude/sonnet`).
2. Costos = tokens × tarifas de `sdd/pricing.json` (por `proveedor/modelo`).
3. Para humanos, la respuesta corta + puntero al visor: `pnpm sdd:docs` →
   vista **Costos** (agregación por proveedor y fixes incluidos).
4. Datos faltantes se reportan como faltantes — jamás inventar un número.

## Ruteo (pedidos que NO son del steward)

| Pedido                                  | Destino                                        |
| --------------------------------------- | ---------------------------------------------- |
| Feature nueva / retomar una spec        | `sdd-orchestrator` — verificar antes que la spec exista en `specs/index.json` y el módulo en `global.json`; si falta, el orquestador la crea con su flujo |
| Idea u objetivo en lenguaje natural     | `sdd-hermes` (Playbook 3)                      |
| `[HOTFIX]` `[BUGFIX]` `[FIX]` `[IMPROVEMENT]` | FIX GATE — `sdd/prompts/hotfix-bypass-gate.prompt.md` |
| Escribir/editar código                  | Ciclo SDD completo — **sin excepción**         |
| Review de un ciclo                      | `sdd-reviewer` vía `review-cycle.prompt.md`    |

Al delegar, entregar un brief mínimo (qué pidió el usuario + qué verificaste) —
no re-narrar el kit: el agente destino tiene sus propias skills.

## Archivos que modifica

Ninguno en operación normal. Las únicas escrituras permitidas son las que
ejecutan sus playbooks a través de las herramientas oficiales (`update sdd`,
`setup:agents`, `harness idea`) — nunca ediciones manuales de registros SDD.

## Registro de consumo (obligatorio)

Ver `sdd/agents/sdd-steward.agent.md` § Registro de consumo: en status/costos/ruteo no hay
`usage` que registrar (solo lectura). Si excepcionalmente resolvés un fix o participás de un
ciclo, tu entrada va como `agent: "steward"` en el `usage` de ese fix/ciclo, con modelo y effort
declarados antes de ejecutar.
