# FIX-e-burgos-014 — El gate de riesgo AEGIS falla ABIERTO

> Tipo: HOTFIX · Severidad: **crítica** · Autor: e-burgos · Creado: 2026-09-01
> Reproducido en producción con un ciclo real del agente, con claves LIVE conectadas.

## Problema

**Cuando el gate de riesgo falla, autoriza la operación al tamaño máximo.**

```ts
// apps/api/src/orchestrator/dto/aegis-verdict.schema.ts
verdict: z.enum(['PASS', 'REDUCE', 'BLOCK']).catch('PASS'),
positionSizeMultiplier: z.coerce.number().min(0).max(1).catch(1),
```

Cadena completa: AEGIS trunca → `content` vacío → `safeParseJson(raw, {})` devuelve `{}` → los
`.catch()` del schema aplican sus defaults → **`verdict: 'PASS'` con multiplicador `1`**.

Un gate de riesgo que ante su propio fallo autoriza al máximo **es exactamente lo contrario de un
gate**.

## Cómo se descubrió

Ciclo real del agente en SANDBOX. Los **cuatro** sub-agentes fallaron y la decisión se produjo igual:

```
WARN SubAgent[risk]       task=risk_gate         failed: LLM response truncated
WARN SubAgent[operations] task=sizing_suggestion failed: LLM response truncated
WARN SubAgent[market]     task=news_sentiment    failed: LLM response truncated
WARN SubAgent[blockchain] task=macro_context     failed: LLM response truncated
LOG  EvaluationService  Scheduled 4 evaluations for decision=cmtj2x3ef000h01qgsohx5bih
```

## Causa raíz — medida, no supuesta

Los modelos de `admin_agent_configs` son **de razonamiento**: consumen el presupuesto entero en
tokens de pensamiento antes de emitir el JSON. Medido contra OpenRouter con el prompt real:

| Modelo | Agente | `finish_reason` | Tokens | `content` | `reasoning` |
| --- | --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-pro` | **risk** | `length` | **350/350** | **0 chars** | 1361 chars |
| `minimax/minimax-m2.7` | blockchain | `length` | **350/350** | **0 chars** | 1239 chars |
| `deepseek/deepseek-v4-flash` | operations, market | `stop` | 174/350 | 617 chars | 0 |

Los límites de `AGENT_TASK_MAX_TOKENS` (`risk_gate: 350`, `sizing_suggestion: 350`,
`news_sentiment: 500`, `macro_context: 600`) se dimensionaron para modelos **sin** razonamiento.
Con los actuales, **AEGIS trunca siempre**.

> La spec 008 tenía esto anotado como riesgo teórico (*"Fail-open de AEGIS al degradar"*). Esta
> corrida lo convirtió en un hecho medido.

## Justificación del bypass

**HOTFIX y no ciclo SDD:** la cuenta ya tiene claves de Binance **LIVE con saldo real** (75,19 USDT
verificado) y el defecto autoriza al máximo cada vez que el gate falla — que con los modelos
actuales es **siempre**. Son 3 archivos, sin entidades ni endpoints nuevos.

## Solución aplicada

**Dos partes, y la primera es la que importa.**

1. **Fail-closed.** Un veredicto de AEGIS que no se pudo parsear deja de ser `PASS`. Se distingue
   *"AEGIS dijo PASS"* de *"AEGIS no dijo nada"*: lo segundo pasa a `BLOCK` con multiplicador `0`.
   Los `.catch()` por campo se conservan para degradar un payload **parcial** —esa parte del diseño
   es correcta—, pero un payload **vacío** ya no se confunde con una autorización.
2. **Presupuesto de tokens acorde a modelos de razonamiento.** Se elevan los límites para que el
   JSON entre después del pensamiento. Es la parte que hace que el gate vuelva a *funcionar*; la
   primera es la que hace que su fallo sea *seguro*.

## Archivos modificados

- `apps/api/src/orchestrator/dto/aegis-verdict.schema.ts`
- `apps/api/src/orchestrator/agent-task-limits.ts`
- `apps/api/src/orchestrator/dto/aegis-verdict.schema.spec.ts`

## Test de validación

Verificado con **ciclos reales del agente en producción**, no sólo en suite.

| Estado | Sub-agentes fallados | Confianza |
| --- | --- | --- |
| Antes del fix | **4 de 4**, y la decisión se producía igual | — (fail-open) |
| Fail-closed + `reasoning.enabled=false` | 2 | 0,82 |
| + reintento para modelos con razonamiento obligatorio | 1 | 0,84 |
| + `news_sentiment` a 1500 | **0** | **0,88** |

Mediciones contra OpenRouter con el prompt real:

- `deepseek-v4-pro` sin tocar → `finish_reason=length`, 350/350 tokens, **1361 chars de reasoning y
  0 de contenido**. Con `reasoning.enabled=false` → `finish=stop`, 136 tokens, JSON válido.
- **`reasoning.exclude=true` NO sirve**: deja el contenido vacío en 350/350 porque sólo oculta el
  razonamiento — el modelo igual lo genera, igual consume el presupuesto y **igual se cobra**.
- `minimax/minimax-m2.7` responde **400 "Reasoning is mandatory for this endpoint and cannot be
  disabled"**. De ahí el reintento sin el flag: sin él, agregar la optimización convertía una
  respuesta truncada en un fallo duro.

**Suites:** 751/751 en `apps/api` (87 suites) y 161/161 en `libs/analysis`. `typecheck` y `lint` en
verde. **CA-050** (risk_gate 300-400) queda intacto y el **harness de costo CA-060/CA-061 sigue
pasando** con los valores nuevos.

### Un test consagraba el bug

`aegis-verdict.schema.spec.ts` tenía:

```
it('degrades unparsable text to a neutral PASS verdict instead of throwing')
```

El fail-open **no era un descuido: estaba escrito y afirmado como comportamiento deseado**. Ese test
se invirtió; ahora exige `BLOCK` con multiplicador 0.

### Desviación registrada respecto de architect.md

`news_sentiment` (500 → 1500) y `macro_context` (600 → 1200) se apartan de los valores que fijó el
`architect.md` de spec-001 cycle-03. Son las únicas dos tareas cuyos modelos siguen truncando tras
apagar el razonamiento, porque `minimax-m2.7` no permite apagarlo y `deepseek-v4-flash` razona de
forma intermitente. Los límites que **CA-050 acota no se tocaron**.

## Decisión del Reviewer

Pendiente.
