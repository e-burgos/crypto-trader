# FIX-e-burgos-008 — Sin limite de intentos en login y register: fuerza bruta sin friccion

> Tipo: HOTFIX | Severidad: critical | Estado: pending | Creado: 2026-08-30

## Problema

No hay ningun mecanismo de rate limiting en el backend (no existe @nestjs/throttler en package.json). /api/auth/login y /api/auth/register aceptan intentos ilimitados. El costo 12 de bcrypt limita el throughput pero no impide el ataque, y ademas convierte cada intento en trabajo caro para el servidor, con lo que la ausencia de limite es tambien un vector de agotamiento de recursos.

## Archivos afectados

- `package.json`
- `apps/api/src/app/app.module.ts`
- `apps/api/src/auth/auth.controller.ts`

## Criterio de aceptacion

Los endpoints de autenticacion rechazan con 429 al superar el limite; el resto de la API mantiene su comportamiento
