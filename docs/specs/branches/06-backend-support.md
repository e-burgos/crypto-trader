# Spec 06 — Backend Support (Admin, Notifications, Analytics)

## Objetivo

Agregar módulos de administración, notificaciones en tiempo real y analíticas de trading.

## Alcance

- `apps/api/src/admin/`: endpoints admin, kill-switch, stats
- `apps/api/src/notifications/`, `apps/api/src/gateway/`: notificaciones + WebSocket
- `apps/api/src/analytics/`: métricas de performance
- Tests: acceso admin, notificación, analítica

## Criterios de aceptación

- Admin puede pausar el sistema y ver stats
- Notificaciones llegan en tiempo real
- Branch: `feature/backend-support`

---

**Depende de:** 05-trading-engine
**Siguiente:** 07-frontend-foundation
