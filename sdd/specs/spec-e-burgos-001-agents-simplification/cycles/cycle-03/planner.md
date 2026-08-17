# Sprint Plan — Cycle 03: Reducción del costo por decisión

> **Input:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-03/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-agents-simplification/cycles/cycle-03/planner.md
> **Generado por:** sdd-planner

---

## Resumen del ciclo

| Campo               | Valor                                                       |
| -------------------- | ------------------------------------------------------------ |
| Ciclo                | 3 (último de la spec spec-e-burgos-001-agents-simplification) |
| Módulo               | trading-agents-core                                          |
| Apps                 | apps/api, apps/web, libs/analysis, libs/openrouter, libs/trading-engine, libs/shared |
| Tasks totales         | 14 (9 backend, 2 frontend, 3 follow-ups de deuda técnica/protección) |
| Story points totales  | 46                                                            |
| Horas estimadas       | 41h                                                           |
| Duración estimada     | 1.5–2 semanas (1 dev full-time, deploy-blocker desbloqueable en el primer día) |

**Notas de alcance para todas las tasks de este ciclo:**

- Todo umbral exacto (thresholds del gate, TTL por tipo de señal, formato de `cache_control`,
  Redis vs proceso para el caché, `max_tokens` exacto en el rango 300-400) queda fijado por
  **architect.md** — el implementador lo consulta ahí, no lo decide en la task.
- El gate determinista y el caché nacen con la config que reproduce el comportamiento actual
  (gate desactivado); ninguna task de este ciclo puede cambiar el comportamiento de un bot ya
  desplegado sin que su dueño lo habilite explícitamente (restricción transversal del brief).
- La task del deploy-blocker (TASK-001, HU-03-08, apps/web) **no depende de ninguna otra task**
  y va primera — puede cerrarse aunque el resto del ciclo se alargue.
- TASK-009 (harness determinista del -50%, HU-03-07) es la **pieza de verificación del ciclo**:
  las tasks de optimización (TASK-002, TASK-004, TASK-005, TASK-006) quedan efectivamente
  probadas cuando TASK-009 corre en verde sobre el fixture fijo — cada una de esas tasks lo
  referencia explícitamente en su criterio de done.

---

## Tasks Backend

### TASK-002: Gate determinista — evaluación de las 5 condiciones "sin señal" con fail-closed

**Historia:** HU-03-01
**App:** apps/api (o libs/analysis según decida architect.md — el gate consume indicadores de
libs/analysis, cambio de precio y estado de posiciones)
**Descripción:** Implementar la evaluación de las cinco condiciones simultáneas de "sin señal"
(sin cruce de EMA, RSI en banda neutra, sin cambio significativo de precio, sin cambio de
posiciones abiertas, sin noticia/evento macro nuevo de CIPHER) respecto de la última
`AgentDecision` evaluada del bot. Umbrales exactos de cada condición: **según architect.md**.
Fail-closed explícito: reconciliación no confirmada (CE-01), indicador faltante/stale más allá
de tolerancia (CE-02), o ausencia de decisión previa (primer ciclo del bot, CA-042) → el gate no
aplica y el ciclo llama al LLM con normalidad. El gate nace desactivado por configuración
(RN-04) — activarlo es explícito del dueño del bot.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-038: con las 5 condiciones cumplidas simultáneamente, el gate resuelve "sin señal"; test
      con mock del cliente LLM que asserta cero invocaciones.
- [ ] CA-039: suite parametrizada — cada condición incumplida individualmente (las otras 4
      cumplidas) hace que el gate NO aplique, un caso por condición.
- [ ] CA-042: sin `AgentDecision` previa contra la cual comparar, el gate nunca aplica.
- [ ] CE-01/CE-02/CE-03 cubiertos: reconciliación no confirmada, indicador faltante/stale, y gate
      desactivado por config (default) → el gate no aplica en los tres casos.
- [ ] El gate nace con `enabled: false` por defecto — un bot existente que despliega este ciclo
      sin tocar su config no cambia de comportamiento.
- [ ] Verificado además por el harness determinista de TASK-009 (RF-07): ningún escenario "con
      señal" del fixture queda silenciado por este gate.

---

### TASK-003: Gate determinista — persistir AgentDecision (llmCostUsd=0) y emitir evento WS

**Historia:** HU-03-01
**App:** apps/api
**Descripción:** El HOLD resuelto por el gate de TASK-002 debe persistir una `AgentDecision`
como cualquier otra decisión del ciclo — con `llmCostUsd = 0` y una justificación legible que la
identifica como decisión determinista (no generada por LLM) — y emitir el mismo evento
WebSocket `agent:decision` que emitiría una decisión LLM, con idéntica estructura de payload.
Nunca debe quedar un hueco en el historial de decisiones del bot.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** TASK-002
**Criterio de done:**

- [ ] CA-040: el HOLD del gate persiste `AgentDecision` con `llmCostUsd = 0` y justificación que
      la distingue de una decisión LLM (test).
- [ ] CA-041: se emite el evento WS `agent:decision` con la misma estructura de payload que una
      decisión LLM (test que verifica el evento emitido).

---

### TASK-004: Caché compartido de señal técnica/macro por (asset, pair, timeframe)

**Historia:** HU-03-02
**App:** apps/api (extiende el patrón de `apps/api/src/market/data-source-cache.service.ts`) —
Redis vs in-memory por proceso: **según architect.md**
**Descripción:** Extender el patrón de caché TTL ya existente (sentimiento/data-source) a señal
técnica y macro, con clave `(asset, pair, timeframe)` compartida entre bots y usuarios. TTL
configurable por tipo de señal, con CIPHER en un TTL propio del orden de horas, mayor al de
señal técnica. Ante fallo al recalcular tras vencer el TTL, se devuelve el último valor conocido
(stale) — mismo patrón que el caché de sentimiento existente (CE-04).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-043: N bots concurrentes sobre la misma clave dentro de la ventana de vigencia comparten
      el mismo resultado; solo el primero dispara el cálculo real (assert de una sola invocación
      del origen de datos subyacente).
- [ ] CA-044: vencida la ventana, la siguiente consulta recalcula en vez de servir el valor
      anterior (test de invalidación).
- [ ] CA-045: la señal macro (CIPHER) usa una ventana de vigencia propia, en horas, mayor a la de
      señal técnica (test de ventanas independientes por tipo).
- [ ] CA-046: claves distintas de `(asset, pair, timeframe)` nunca comparten valor (test de
      aislamiento).
- [ ] CE-04: fallo al recalcular tras vencer el TTL → se sirve el último valor conocido (stale).
- [ ] Verificado además por el harness determinista de TASK-009 (RF-07).

---

### TASK-005: Prompt caching de proveedor con degradación silenciosa

**Historia:** HU-03-03
**App:** libs/openrouter
**Descripción:** Marcar el bloque de system prompt estático (650-830 tokens, fuente:
`AgentPromptService`/tabla `AgentDefinition`) para cache de proveedor (Anthropic `cache_control`,
equivalente OpenRouter) cuando el proveedor/modelo lo soporta. Formato exacto de la marca:
**según architect.md**. Con un proveedor/modelo sin soporte, la llamada se arma igual, sin la
marca — degradación silenciosa, sin fallar ni cambiar el resultado de la decisión.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-047: con soporte de cache de prompt, la request arma el bloque de system prompt estático
      marcado para cache (test unitario del armado de la request, sin red).
- [ ] CA-048: sin soporte, la request se arma igual sin la marca — no falla ni cambia el
      resultado (test).
- [ ] CA-049: el contenido y el resultado de la decisión son los mismos con y sin la marca activa,
      para el mismo input (test de regresión).
- [ ] CE-05: si el proveedor rechaza explícitamente la marca, se reintenta la misma llamada sin
      ella en vez de fallar el ciclo completo.
- [ ] Verificado además por el harness determinista de TASK-009 (RF-07).

---

### TASK-006: max_tokens configurable por tipo de tarea (risk_gate, sizing)

**Historia:** HU-03-04
**App:** libs/openrouter
**Descripción:** El límite de tokens de salida se define por tipo de tarea del agente (risk_gate,
sizing, etc.), no por agente ni por modelo asignado. `risk_gate` y `sizing` usan un límite en el
rango 300-400 (valor exacto: **según architect.md**), sensiblemente menor al default genérico de
1024 usado hoy.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-050: `risk_gate` y `sizing` piden un límite de tokens de salida en el rango 300-400 en
      vez del default 1024 (test que verifica el límite en la request armada, por tipo de tarea).
- [ ] CA-051: el límite se define por tipo de tarea — dos agentes distintos que ejecutan la misma
      tarea usan el mismo límite (test).
- [ ] CA-052: una respuesta truncada por el nuevo límite no se interpreta como decisión parcial
      válida — mismo camino de error que hoy usa una respuesta incompleta (test).
- [ ] CE-06: respuesta truncada por el límite → tratada como no confiable, el ciclo no opera
      sobre un fragmento de decisión.
- [ ] Verificado además por el harness determinista de TASK-009 (RF-07).

---

### TASK-007: Escribir AgentDecision.llmCostUsd con tarifa real en llamadas LLM

**Historia:** HU-03-05
**App:** apps/api
**Descripción:** Toda `AgentDecision` originada en una llamada LLM real debe persistir su costo
calculado con la tarifa vigente del modelo usado al momento de la llamada, usando la cascada ya
existente de `ModelPricingService` (LIVE_OPENROUTER → STALE_CACHE → STATIC_TABLE → UNPRICED, que
nunca lanza) — hoy resuelve tarifa pero nadie escribe el resultado en el flujo real. Si la
cascada se agota sin precio confiable, la decisión igual se persiste y se cuenta en el
historial; el valor no calculable queda marcado como tal, nunca como cero encubierto (CE-07).
**Estimación:** 3h · **Story points:** 3
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-053: toda `AgentDecision` de una llamada LLM real persiste `llmCostUsd` calculado con la
      tarifa vigente al momento de la llamada — no un valor fijo ni estimado después (test
      unitario con mock de la resolución de tarifa).
- [ ] CE-07: si la cascada de tarifa se agota, la decisión se persiste igual y el valor no
      calculable queda marcado explícitamente (no `0` disfrazado).

---

### TASK-008: Endpoint de costo LLM por bot/día y agregado de plataforma

**Historia:** HU-03-05, HU-03-06
**App:** apps/api
**Descripción:** Endpoint nuevo que expone el costo LLM real de un bot en un día calendario
(suma de `llmCostUsd` de todas sus `AgentDecision` del día, sin excluir ninguna — sea resuelta
por LLM o por el gate determinista) y el costo agregado de toda la plataforma en un período,
calculado sobre la misma fuente (sin cálculo paralelo que pueda desincronizarse), distinguiendo
cuánto corresponde a decisiones LLM y cuánto al gate determinista. Contrato exacto del endpoint:
**según architect.md**.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-003 (el gate debe escribir `llmCostUsd=0` para que la suma no excluya sus
decisiones), TASK-007 (escritura del costo real)
**Criterio de done:**

- [ ] CA-055: el costo de un bot en un día calendario es la suma de `llmCostUsd` de todas sus
      `AgentDecision` de ese día, sin excluir ninguna (test de agregación).
- [ ] CA-056: un bot con llamadas LLM reales en el día no puede mostrar costo $0 (test de
      regresión directo sobre el hallazgo C de la spec).
- [ ] CA-057: el costo agregado de plataforma en un período es la suma de `llmCostUsd` de todas
      las `AgentDecision` de todos los bots en ese período, sobre la misma fuente que el costo
      por bot individual (test cruzado: suma de individuales == agregado).
- [ ] CA-058: el costo agregado distingue cuánto corresponde a decisiones LLM y cuánto al gate
      determinista (test).

---

### TASK-009: Harness determinista de verificación del ahorro de costo (-50%)

**Historia:** HU-03-07
**App:** apps/api (o el subproyecto que architect.md defina para el harness — ejecuta como parte
de `pnpm nx run-many -t test`)
**Descripción:** Reinterpretación ejecutable en CI del criterio de la spec ("costo por ciclo
−50% sin degradar decisiones") ante la ausencia de backtest/escenario de referencia como
infraestructura — mismo precedente que CA-001 (cycle-01) y CA-012 (cycle-02). Harness que corre
un conjunto fijo de N escenarios (fixtures deterministas de indicadores, precio, posiciones
abiertas y noticias, versionados en el repo — no generados en runtime) dos veces sobre mocks
deterministas (sin red, sin LLM real): una con la configuración previa al ciclo (línea base) y
otra con las optimizaciones activas (gate de TASK-002, caché de TASK-004, prompt caching de
TASK-005, `max_tokens` de TASK-006), contando llamadas LLM y tokens totales en cada corrida.
Diseño del harness (estructura de fixtures, mecanismo de conteo): **según architect.md**.
**Estimación:** 4h · **Story points:** 5
**Dependencias:** TASK-002, TASK-004, TASK-005, TASK-006 (el harness compara línea base contra
las cuatro optimizaciones ya implementadas)
**Criterio de done:**

- [ ] CA-059: conjunto fijo de N escenarios versionado en el repo, cubre casos "sin señal" (deben
      resolver HOLD por el gate) y casos "con señal" (no deben resolver HOLD por el gate).
- [ ] CA-060: el harness corre el mismo conjunto dos veces (línea base / optimizado), contando
      llamadas LLM y tokens totales en cada corrida.
- [ ] CA-061: el total de llamadas LLM y tokens de la corrida "con optimizaciones" es al menos
      50% menor que el de "línea base" (assert numérico).
- [ ] CA-062: ningún escenario diseñado "con señal" resuelve HOLD por el gate en la corrida
      optimizada — assert por escenario individual, no agregado.
- [ ] CA-063: el harness corre como parte de `pnpm nx run-many -t test`, no como script manual
      aparte.

---

## Tasks Frontend

### TASK-001: DEPLOY-BLOCKER — Migrar apps/web al wire slot/ResolutionSource

**Historia:** HU-03-08
**App:** apps/web
**Descripción:** Migrar `hooks/use-agent-config.ts` y `pages/dashboard/settings/agents.tsx` al
wire post-cycle-02: `agentId` → `slot` (8 lecturas de `config.agentId` a reemplazar) y tipar
`source` con el union completo de `ResolutionSource` (`override | user | admin | preset |
credential`, con `'fallback'` renombrado a `'preset'`). Verificación con tests de comportamiento
sobre fixtures del wire real — el typecheck NO es criterio de done porque `apps/web` declara su
propia interfaz del response y no detecta este desalineamiento. Es prerrequisito de deploy: sin
esta task, la pantalla de configuración de agentes está rota en producción (nombres vacíos,
filtros que no matchean, `PUT /users/me/agents/undefined/config`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna — **PRIORIDAD 1, va primera**
**Criterio de done:**

- [ ] CA-064: la pantalla muestra el nombre de cada agente a partir de `slot` — ningún nombre
      vacío (test de UI con fixture del response real post-cycle-02).
- [ ] CA-065: los filtros de categoría (`'risk'`, `'routing'` y el resto) matchean correctamente
      contra los agentes del fixture (test de UI).
- [ ] CA-066: guardar la configuración dispara la petición con el `slot` real en la URL, nunca
      `.../agents/undefined/config` (test que intercepta la llamada HTTP saliente).
- [ ] CA-067: `hooks/use-agent-config.ts` tipa `source` con el union completo de
      `ResolutionSource`; `'preset'` se procesa igual que cualquier otro valor del union, sin caer
      a un default (test unitario, un caso por valor del union).
- [ ] CA-068: cobertura con tests de comportamiento sobre el fixture del wire real — "test en
      verde" es el criterio de done, no "typecheck en verde".
- [ ] CE-08: un `source` fuera del union conocido degrada la fila a un estado "desconocido"
      visible, sin romper el render de toda la pantalla.

---

### TASK-010: Panel de costo/día por bot en la página de analytics (apps/web)

**Historia:** HU-03-05
**App:** apps/web
**Descripción:** Panel en la página de analytics que consume el endpoint de costo/día por bot de
TASK-008 y muestra el costo real (no el ~$0 actual). Convenciones no negociables de apps/web:
datos del servidor por TanStack Query, textos por `t('clave')` en `es.ts`/`en.ts`, componentes
stateless desde `@crypto-trader/ui`, estilos con Tailwind.
**Estimación:** 3h · **Story points:** 3
**Dependencias:** TASK-008 (endpoint de costo/día por bot)
**Criterio de done:**

- [ ] El panel consume el endpoint de TASK-008 vía TanStack Query — sin fetch manual.
- [ ] Muestra el costo real del día para un bot con llamadas LLM reales (regresión visible sobre
      el hallazgo C: ya no reporta ~$0).
- [ ] Todo texto del panel pasa por `t('clave')` en `es.ts` y `en.ts`.
- [ ] Fuera de alcance explícito: columnas de estado de protección/trailing de posiciones y UI de
      configuración de los 17 campos de `TradingConfig` — deuda documentada, no se tocan aquí.

---

## Tasks Follow-up (deuda de cycle-02)

### TASK-011: Re-armar la orden de protección nativa al mover el stop

**Historia:** HU-03-09
**App:** apps/api / libs/trading-engine (qué parte es función pura y qué parte orquestación:
**según architect.md**)
**Descripción:** Cuando el trailing stop o el breakeven mueven el nivel de stop en 0.1% o más
respecto de la orden de protección vigente, cancelar esa orden (`cancelProtectionOrder`) y
colocar una nueva (`placeProtectionOrder`) con los niveles actualizados y la cantidad remanente
de la posición. Cierra la degradación a polling aceptada en cycle-02 y elimina el take-profit
zombie que sobrevive en la OCO viva. Opera sobre la misma superficie que la regla no negociable
de cycle-02 (cancelar la protección antes de vender / `releaseProtectionIfNeeded`).
**Estimación:** 4h · **Story points:** 5
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-069: movimiento de stop ≥ 0.1% respecto del stop vigente → cancela y coloca una nueva
      orden con niveles actualizados y cantidad remanente (test con mock del cliente del
      exchange: cancelación seguida de la nueva colocación, con parámetros correctos).
- [ ] CA-070: movimiento < 0.1% no dispara cancelación ni recolocación (test: ninguna operación
      se invoca).
- [ ] CA-071: tras un re-arme exitoso, no sobrevive ninguna pierna de la orden anterior — la
      única orden viva refleja los niveles nuevos (test).
- [ ] CA-072: con `nativeProtectionEnabled` + `trailingStopEnabled`/`partialTpEnabled`
      simultáneos, el re-arme reemplaza el cierre a mercado local documentado en cycle-02 como
      degradación (test de regresión directo sobre ese escenario).
- [ ] CE-09: cancelación fallida → la posición no se asume protegida con los niveles nuevos;
      aplica el tratamiento de "desprotegida" de cycle-02 hasta confirmar el estado real.
- [ ] CE-10: colocación fallida tras cancelación exitosa → la posición queda explícitamente
      desprotegida (no en estado ambiguo) y el error queda registrado.

---

### TASK-012: Extender select de getPositions y pasar EP-008 a implemented

**Historia:** HU-03-10
**App:** apps/api
**Descripción:** Extender el `select` de `TradingService.getPositions` con los 9 campos nuevos de
`Position` que architect.md de cycle-02 §14 dejó pendientes: `protectionStatus`, `stopPrice`,
`takeProfitPrice`, `highWaterPrice`, `trailingActive`, `initialQuantity`, `partialExitCount`,
`realizedPnl`, `exitReason`. Actualizar `EP-008` de `defined` a `implemented` en `sdd/api.json`.
Presentación visual en apps/web queda explícitamente fuera de alcance (deuda documentada).
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-073: la consulta de posiciones (`EP-008`) devuelve los 9 campos nuevos para cada
      posición (test de integración del endpoint con fixture/mock, sin BD real).
- [ ] CA-074: los valores devueltos son los mismos que tiene la entidad `Position` en el momento
      de la consulta — no un cálculo derivado distinto (test de consistencia).
- [ ] CA-075: `EP-008` pasa a `status: "implemented"` en `sdd/api.json`.
- [ ] CE-11: una posición sin trailing activo ni ventas parciales devuelve los campos nuevos con
      valores definidos (neutros), nunca `null` inesperado ni campo ausente.

---

### TASK-013: Guard estático anti-regresión (isFalseConcentrationBlock / cast AgentId)

**Historia:** HU-03-11
**App:** apps/api (o el nivel del pipeline de tests que architect.md/constitution defina, mismo
patrón de `trading.processor.isolation.spec.ts`)
**Descripción:** Verificación estática en el pipeline de tests, con el patrón `readFileSync`
sobre el árbol fuente ya usado en `trading.processor.isolation.spec.ts`, que falla si aparece la
cadena `isFalseConcentrationBlock` o el cast `as unknown as AgentId` en el código fuente de
`apps/api` o `libs/`.
**Estimación:** 1h · **Story points:** 1
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-076: la verificación estática existe y cubre `apps/api` y `libs/`.
- [ ] CA-077: con el árbol actual (sin esos símbolos), la verificación pasa (test en verde,
      confirma que no es un falso positivo permanente).
- [ ] CA-078: reintroducir cualquiera de los dos símbolos en un fixture de prueba controlado hace
      fallar la verificación (test que agrega temporalmente la cadena y confirma el fallo).

---

### TASK-014: Reescribir aserciones de checkOpenPositions sin string-matching

**Historia:** HU-03-12
**App:** apps/api
**Descripción:** Reemplazar en `trading.processor.isolation.spec.ts` y
`trading.processor.decision-traceability.spec.ts` las aserciones que hoy extraen código por
coincidencia de texto sobre el rango fuente entre `checkOpenPositions` y
`parseSymbolForSandbox`, por una verificación de comportamiento observable (invocar y verificar
el efecto) o por una unidad extraída y testeada de forma independiente.
**Estimación:** 2h · **Story points:** 2
**Dependencias:** ninguna
**Criterio de done:**

- [ ] CA-079: las aserciones de string-matching se reemplazan por verificación de comportamiento
      observable o por unidad extraída.
- [ ] CA-080: ambos specs siguen verificando lo mismo que antes (cierre a mercado, crédito de
      wallet SANDBOX) y quedan en verde.
- [ ] CA-081: un cambio cosmético en `checkOpenPositions` (reordenar código, renombrar una
      variable local) que no altera su comportamiento no rompe estos tests (test de regresión).

---

## Orden de ejecución

```
TASK-001 (deploy-blocker, apps/web) ──────────────────────────────────► puede cerrarse en paralelo
                                                                          con todo lo demás

TASK-002 (gate: 5 condiciones) ──► TASK-003 (gate: persist + WS) ──┐
TASK-004 (caché compartido) ───────────────────────────────────────┤
TASK-005 (prompt caching) ──────────────────────────────────────────┼──► TASK-009 (harness -50%)
TASK-006 (max_tokens por tarea) ────────────────────────────────────┘

TASK-007 (llmCostUsd real) ──┐
TASK-003 (gate: persist) ────┴──► TASK-008 (endpoint costo/día) ──► TASK-010 (panel FE costo)

TASK-011 (re-arme OCO) ────────────────────────────────────────────► independiente
TASK-012 (select getPositions + EP-008) ────────────────────────────► independiente
TASK-013 (guard estático) ──────────────────────────────────────────► independiente
TASK-014 (rewrite string-matching) ─────────────────────────────────► independiente
```

> IDs `TASK-[NNN]` — el scope es el `tasks.json` del ciclo; los mismos IDs van en ambos archivos.

---

## Advertencia de tamaño

14 tasks está en el borde superior del rango 10-14 pedido. Se evaluó consolidar TASK-002/TASK-003
(gate: evaluación + persistencia) en una sola, pero cubren responsabilidades distintas —
evaluación de condiciones vs. persistencia/WS — y juntas superarían 5 SP (regla: máx 1 día /
5 puntos por task). Se mantienen separadas por trazabilidad de CA y para no forzar una task de
más de 1 día. Ídem TASK-007/TASK-008 (escritura de costo vs. endpoint de lectura agregada): son
capas distintas (writer vs. reader) y TASK-008 depende de que TASK-007 exista.

---

## Pendiente de documentar en contexto

### TASK-004 — Caché compartido de señal técnica/macro

- `SignalCacheService.getOrComputeNews(asset, pair, newsFingerprint, compute)` existe
  (`apps/api/src/cache/signal-cache.service.ts`, clave `sig:v1:news:{asset}:{pair}:{newsFingerprint}`,
  TTL 10 min) cumpliendo el contrato de architect.md §3.3, pero **no está cableado** en
  `orchestrator.service.ts`: el ALCANCE de la task excluyó explícitamente tocar el bloque de
  relectura per-user de sentimiento (~líneas 152-187) para mantenerlo byte-idéntico con el flag
  apagado. Además, la huella `newsFingerprint` content-addressed depende de la función pura
  `fingerprint()` de `libs/shared` que entrega TASK-002 (gate determinista), no implementada
  todavía al cerrar esta task. Cablear `getOrComputeNews` en lugar del bloque actual queda para
  una task futura, una vez exista `fingerprint()`.
- La atribución del resultado cacheado (`producedBy`/`cachedFrom` en `SubAgentResult`, architect.md
  §3.4: marcar `{ cached: true, cachedFrom: { provider, model } }` cuando un bot consume una
  entrada producida por el modelo de otro usuario) no se implementó: `SignalCacheService` cachea
  únicamente el string de salida del sub-agente, sin metadata de proveedor/modelo. Agregarla
  requiere tocar la construcción de `subAgentResults` más abajo en `orchestrator.service.ts`
  (fuera del punto de integración declarado para esta task) y resolver el modelo en el momento de
  escritura del caché, no solo en el de lectura. No hay CA/CE de cycle-03 que lo exija
  explícitamente (CA-043..046 y CE-04 cubren comportamiento del caché, no atribución), así que se
  documenta como deuda en vez de expandir el alcance de TASK-004.
