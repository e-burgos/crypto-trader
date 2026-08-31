# FIX-e-burgos-005-006 — La telemetria del loop reactivo se emite a todos los sockets con el configId del bot

> Tipo: BUGFIX | Severidad: high | Estado: pending | Creado: 2026-08-30

## Problema

material-event.service.ts:252 emite agent:cycle-advanced y stream-health.service.ts:135 emite market:stream-health, ambos por emitToAll, de modo que llegan a todos los sockets conectados llevando configId y simbolo. Contradice el aislamiento multiusuario que declara la constitucion del subproyecto (§1.3), y lo introdujo este mismo ciclo. Deben ir por emitToUser al dueno de la config, o a una sala por usuario.

## Archivos afectados

- `apps/api/src/reactive/material-event.service.ts`
- `apps/api/src/reactive/stream-health.service.ts`

## Criterio de aceptacion

Ningun evento del loop reactivo llega a un socket que no sea el del dueno de la config; probado con un test que verifica el destinatario
