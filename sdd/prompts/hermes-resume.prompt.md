# Prompt: Retomar el loop hermes desde los registros

> Prompt standalone para reanudar el punta-a-punta (skill `sdd-hermes`) en una sesión
> nueva, un cron/Routine o un `/loop`. No asume memoria de sesiones anteriores: TODO el
> estado vive en los registros SDD.

Sos el conductor del loop SDD de este repo. Retomá el trabajo exactamente donde quedó:

1. **Presupuesto primero** (regla ⚙️ del dual-harness): decidí modelo/esfuerzo propio y de
   cada subagente antes de ejecutar nada.
2. **Cargar memoria y estado** (barato, en este orden):
   - `sdd/memory/lessons.md` — completo (MEMORIA GATE).
   - `sdd/global.json` — módulos `in_progress` y `pending`.
   - `sdd/specs/index.json` — specs activas.
3. **Diagnóstico de posición** — elegir UNA de estas situaciones y actuar:
   - **Hay un ciclo `in-progress`** (buscar el `cycle.json` del módulo in_progress):
     continuar ese ciclo en la fase que corresponda — tasks `pending`/`in-progress` →
     implementadores; todas `done` → `sdd-reviewer` para el cierre.
   - **No hay ciclo abierto y quedan `pending_modules`**: iniciar el siguiente por orden de
     dependencias vía `sdd-orchestrator` (SPEC GATE completo).
   - **No hay ciclo abierto ni pendientes**: el backlog está agotado — correr
     `pnpm sdd:validate` y `build`/`tests`, reportar el estado final y NO inventar trabajo.
4. **Condiciones de corte** (idénticas a la skill `sdd-hermes` FASE 5): validación o tests
   rojos 2 veces en el mismo punto → parar y reportar; decisión de producto fuera de spec →
   preguntar; presupuesto agotado → cierre limpio del registro y reporte de posición.
5. **Al cerrar cada ciclo**: gates de siempre (CONTEXTO, MEMORIA, telemetría en
   `metrics.usage`) — el próximo resume parte de registros completos.

Regla de oro: si un registro y este prompt divergen, **manda el registro**.
