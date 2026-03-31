# Spec 05 — Trading Engine & Agent Lifecycle

## Objetivo

Implementar ejecución de órdenes, gestión de posiciones, cálculo de P&L y ciclo de vida del agente (Bull queue).

## Alcance

- `libs/trading-engine/`: OrderExecutor, PositionManager
- `apps/api/src/trading/`: endpoints de trading, agent loop, WebSocket events
- Soporte SANDBOX vs LIVE
- Tests: ejecución buy/sell, stop-loss, take-profit, agent loop

## Criterios de aceptación

- Agente ejecuta ciclo completo (análisis, decisión, trade, log)
- WebSocket emite eventos correctos
- Branch: `feature/trading-engine`

---

**Depende de:** 02-auth-users, 03-data-layer, 04-analysis-engine
**Siguiente:** 06-backend-support
