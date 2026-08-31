# FIX-e-burgos-009 — El precio en vivo nunca llega al frontend: el backend emite price:update y el cliente escucha price:tick

> Tipo: BUGFIX | Severidad: high | Estado: pending | Creado: 2026-08-30

## Problema

app.gateway.ts:67 emite price:update a la sala price:{symbol}; apps/web/src/hooks/use-websocket.ts:57 escucha price:tick. No hay ningun otro emisor de price:tick en apps/api/src, asi que el store de precios del frontend nunca se actualiza por esa via. Hay que unificar el nombre del evento en los dos lados.

## Archivos afectados

- `apps/api/src/gateway/app.gateway.ts`
- `apps/web/src/hooks/use-websocket.ts`

## Criterio de aceptacion

Un unico nombre de evento en emisor y receptor, verificado por grep en ambos lados
