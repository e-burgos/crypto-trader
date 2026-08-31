# FIX-e-burgos-005-006 — La telemetria del loop reactivo se emite a todos los sockets con el configId del bot

> Tipo: BUGFIX | Severidad: high | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-31

## Problema

material-event.service.ts:252 emite agent:cycle-advanced y stream-health.service.ts:135 emite market:stream-health, ambos por emitToAll, de modo que llegan a todos los sockets conectados llevando configId y simbolo. Contradice el aislamiento multiusuario que declara la constitucion del subproyecto (§1.3), y lo introdujo este mismo ciclo. Deben ir por emitToUser al dueno de la config, o a una sala por usuario.

## Archivos afectados

- `apps/api/src/reactive/material-event.service.ts`
- `apps/api/src/reactive/stream-health.service.ts`

## Criterio de aceptacion

Ningun evento del loop reactivo llega a un socket que no sea el del dueno de la config; probado con un test que verifica el destinatario

## Resolucion

Los dos eventos dejan de emitirse por `emitToAll` y pasan por `AppGateway.emitToUser`, que publica en la sala `user:{userId}`.

- `agent:cycle-advanced` (`material-event.service.ts`): llega solo al dueno de la config adelantada (`config.userId`). El payload sigue llevando `configId`, pero ya solo lo ve quien es dueno de ese bot.
- `market:stream-health` (`stream-health.service.ts`): la salud de un simbolo le interesa a todo usuario con un bot corriendo ese par, no solo al dueno del stream. El criterio de destinatarios se extrajo del que ya usaba `notifyDegradedUsers` a `resolveUserIdsRunningSymbol(symbol)`: `tradingConfig` con `isRunning: true` cuyo `asset + pair` es el simbolo, deduplicado por `userId`. Ese mismo helper alimenta ahora la notificacion de degradacion sostenida, asi que ambos caminos comparten un unico criterio. Si ningun usuario corre ese simbolo, la transicion no se emite a nadie.

`checkTransition` pasa a ser `async` porque resolver los destinatarios consulta la base; `publishSymbol` la espera antes de `checkSustainedDegradation`.

## Verificacion

- `material-event.service.spec.ts`: dos configs de usuarios distintos sobre el mismo simbolo reciben cada una su propio `agent:cycle-advanced` y `emitToAll` no se llama nunca.
- `stream-health.service.spec.ts`: la transicion llega solo a los usuarios con un bot corriendo ese simbolo (deduplicados) y a nadie cuando no hay ninguno.
- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → suite completa en verde (682/682 en la corrida de cierre, con los 5 tests nuevos de estos dos fixes).
- `grep -rn "emitToAll" apps/api/src/reactive/*.service.ts` → sin coincidencias.
