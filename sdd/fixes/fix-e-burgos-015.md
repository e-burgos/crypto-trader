# FIX-e-burgos-015 — El costo LLM no se guarda en las decisiones manuales

> Tipo: BUGFIX · Severidad: media · Autor: e-burgos · Creado: 2026-09-01
> Descubierto al revisar la evidencia de CA-007 en producción.

## Problema

`TradingService.triggerAnalysis` llama a `orchestrateDecision`, que **devuelve** `llmCostUsd` y
`llmCallCount`, pero su `prisma.agentDecision.create` **omite los dos campos**. El camino programado
([`trading.processor.ts:522`](../../apps/api/src/trading/trading.processor.ts)) sí los persiste.

**Toda decisión disparada desde el botón de análisis manual queda con `llmCostUsd` en `NULL`.** El
dashboard de costo subreporta, y sin ningún error de por medio.

## Evidencia

De las 5 decisiones reales en producción, **sólo la del ciclo programado tiene costo**:

```
decision | conf | llmCostUsd            | origen
HOLD     | 0.20 | 0.0038725524399999996 | ciclo programado
HOLD     | 0.72 | NULL                  | trigger-analysis
HOLD     | 0.82 | NULL                  | trigger-analysis
HOLD     | 0.84 | NULL                  | trigger-analysis
HOLD     | 0.88 | NULL                  | trigger-analysis
```

**No es falta de tarifa**: OpenRouter publica precio para los cinco modelos configurados, verificado
contra su catálogo (`deepseek-v4-pro` in=1.027e-6 out=2.055e-6, etc.).

Es el **hallazgo C de spec-001 reapareciendo por un camino que aquel ciclo no cubrió**.
`metadata.manualTrigger: true` muestra que se pensó en distinguir ese origen — el costo se olvidó.

## Justificación del bypass

FIX GATE: **un archivo**, sin entidades ni endpoints nuevos, sin tocar `sdd/schema.json`. No espera
porque la plataforma ya tiene claves LIVE conectadas y el dashboard de costo es **la única señal** de
cuánto gasta el operador en LLM. Una subestimación silenciosa es peor que no medir.

## Solución aplicada

Persistir `llmCostUsd` y `llmCallCount` en el `create` de `triggerAnalysis`, igual que hace el
camino programado. Un test cubre que los dos caminos guarden lo mismo, para que la próxima
divergencia falle en vez de pasar inadvertida.

## Archivos modificados

- `apps/api/src/trading/trading.service.ts`
- `apps/api/src/trading/trading.service.trigger-analysis.spec.ts`

## Test de validación

Verificado en producción con dos decisiones reales creadas por el **mismo endpoint**:

```
antes:  conf 0.88 | llmCostUsd NULL            | llmCallCount 0 | manualTrigger true
ahora:  conf 0.72 | llmCostUsd 0.006398032088  | llmCallCount 5 | manualTrigger true
```

El guard estático (4 asserts) exige que el `create` persista los dos campos, que el costo use
`?? null` y **no** `?? 0` —la columna es nullable justamente para distinguir *"gratis"* de *"no se
pudo tarifar"*— y que los contadores caigan a `0` porque su columna es `Int` no-nullable.

**Suite completa 755/755 en 88 suites**, `typecheck` y `lint` en verde.

### Una regresión propia, encontrada al verificar

El primer intento agregó también `pricedCallCount` y `unpricedCallCount`, copiados del **objeto
interno** del processor y no de su `create` real. Esos dos campos **no existen en el modelo
`AgentDecision`**, así que el endpoint pasó a devolver 500 con `PrismaClientValidationError`. Lo
detectó ejecutar el endpoint contra producción, no el typecheck: Prisma tipa el `create` con un
`any` de por medio en ese punto. Corregido y cubierto por el guard.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: Verificado en produccion con dos decisiones reales creadas por el MISMO endpoint. Antes: conf 0.88, llmCostUsd NULL, llmCallCount 0, manualTrigger true. Despues: conf 0.72, llmCostUsd 0.006398032088, llmCallCount 5, manu…
