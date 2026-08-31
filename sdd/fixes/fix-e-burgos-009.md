# FIX-e-burgos-009 — El precio en vivo nunca llega al frontend: el backend emite price:update y el cliente escucha price:tick

> Tipo: BUGFIX | Severidad: high | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-31

## Problema

app.gateway.ts:67 emite price:update a la sala price:{symbol}; apps/web/src/hooks/use-websocket.ts:57 escucha price:tick. No hay ningun otro emisor de price:tick en apps/api/src, asi que el store de precios del frontend nunca se actualiza por esa via. Hay que unificar el nombre del evento en los dos lados.

## Archivos afectados

- `apps/api/src/gateway/app.gateway.ts`
- `apps/web/src/hooks/use-websocket.ts`

## Criterio de aceptacion

Un unico nombre de evento en emisor y receptor, verificado por grep en ambos lados

## Resolucion

Se unifico en `price:tick`, cambiando el emisor del backend (`app.gateway.ts`). Se cambio ese lado por ser el de menor superficie: `price:update` tenia una unica ocurrencia en todo el repo (la propia linea que emite), mientras que `price:tick` es el nombre del contrato publicado y ya tenia consumidores y documentacion — el listener de `use-websocket.ts`, la tabla de eventos WebSocket de `docs/CONSTITUTION.md`, `docs/specs/crypto-trader-spec.md`, tres specs de `docs/specs/branches/`, el plan de implementacion y el `context_prompt.md` de `sdd/context/apps/api`. No hay tests E2E ni tipos compartidos en `libs/shared` que nombren ninguno de los dos, asi que el cambio se agota en esa unica linea del gateway.

El frontend queda intacto: `apps/web/src/hooks/use-websocket.ts` sigue escuchando `price:tick`.

## Verificacion

- `apps/api/src/gateway/app.gateway.spec.ts` (nuevo): `emitPriceUpdate` publica en la sala `price:{symbol}` con el nombre `price:tick`, y un segundo test toma el nombre realmente emitido y comprueba que el hook del frontend se suscribe a ese mismo nombre y que ya no queda `price:update` del lado del cliente.
- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → suite completa en verde (682/682 en la corrida de cierre, con los 5 tests nuevos de estos dos fixes).
- `grep -rn "price:tick\|price:update" apps libs e2e` → un unico nombre en emisor y receptor.
