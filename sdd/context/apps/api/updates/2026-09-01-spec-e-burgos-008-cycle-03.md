# spec-e-burgos-008 cycle-03 — 2026-09-01

## Estado

**El ciclo de agente corre entero en Hetzner y queda registrado** (CA-007). Verificado con 6 ciclos
reales en SANDBOX contra la infraestructura nueva, no con una simulación.

## Estructura

`TradingService.triggerAnalysis` pasa a persistir `llmCostUsd` y `llmCallCount` en la
`AgentDecision`, igual que el camino programado (FIX-e-burgos-015). Omitirlos dejaba en `NULL` toda
decisión disparada desde el botón de análisis manual, y el dashboard de costo **subreportaba sin
ningún error**.

- **Sólo esos dos campos existen en el modelo.** `pricedCallCount` y `unpricedCallCount` viven
  únicamente en el objeto interno del processor; agregarlos al `create` tira
  `PrismaClientValidationError`, y el typecheck **no lo detecta** porque hay un `any` de por medio.
- `llmCostUsd` usa `?? null` y **nunca** `?? 0`: la columna es nullable para distinguir *"la corrida
  fue gratis"* de *"no se pudo tarifar"*. Confundirlas convierte una falla de tarifado en un cero
  creíble.
- `trading.service.trigger-analysis.spec.ts` es un guard estático sobre el fuente: instanciar
  `TradingService` exige una decena de colaboradores y el defecto no estaba en la lógica sino en un
  objeto literal.

## Qué sigue

- **Railway sigue existiendo.** Su trial venció y todos sus deployments están en `REMOVED`, así que
  no corre nada, pero el proyecto no está borrado. Darlo de baja es acción del dueño: es destructivo
  sobre su cuenta y no lo ejecuta un agente.
- Los datos de aquel stack **se descartaron a conciencia** (DEC-DATOS): eran de prueba y no había vía
  técnica de extraerlos sin levantar el servicio.
