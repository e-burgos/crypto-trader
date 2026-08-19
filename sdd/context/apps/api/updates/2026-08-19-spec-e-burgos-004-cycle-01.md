# spec-e-burgos-004 cycle-01 — 2026-08-19

## Estado

Las credenciales de fuentes externas ya no dependen de que un admin cargue una fila por trader.
`DataSourceCredentialResolver` resuelve `credencial propia del trader → credencial de admin con
`shared: true` → ninguna`, y es el único lugar del código con esa cascada. `MarketService` no
consulta más `dataSourceCredential` ni `newsApiCredential` de forma directa: delega en el
resolver desde `buildEnrichedSnapshot`, `buildNewsSources` y `getNewsSourcesStatus`.

## Estructura

- `market/data-source-credential-resolver.service.ts` — servicio nuevo, provisto y exportado por
  `MarketModule`. Devuelve `ResolvedCredential { apiKey, ownerUserId, origin }` donde `origin` es
  `'user' | 'admin-shared'`. Dos consultas en lote por llamada, nunca una por fuente. El fallback
  compartido filtra por `user: { role: 'ADMIN' }` en la lectura, no confía en quién escribió el
  flag, y ordena por `createdAt` para ser determinista con varios admins.
- `market/credential-tenant-key.ts` — clave compuesta `${source}::${owner}`.
- `DataSourceRegistryService.fetchFromProvider` toma un tercer parámetro `ownerKey` (default
  `SHARED_PUBLIC_OWNER`) y llavea caché, rate limiter y circuit breaker por
  `(fuente, dueño de credencial)`. La salud en BD (`reportSuccess`/`reportError`) y
  `DataSourceMetricsService` siguen llaveadas por nombre de fuente: son propiedades del proveedor,
  no del tenant. Los getters de diagnóstico (`getCircuitStates`, `getCacheStats`,
  `getRateLimiterStats`) reagregan por nombre de fuente, así que el contrato del endpoint de admin
  no cambia.

## Dependencias

Ninguna nueva.

## Qué sigue

- `DataSourcesController` y los otros controllers que tipan `@Body()` con object types inline no
  son validados por el `ValidationPipe` global: `toValidate` saltea el metatype `Object`, así que
  `whitelist`/`forbidNonWhitelisted` no los cubre. Migrarlos a clases DTO es deuda abierta.
- `BinanceCredential` y `LLMCredential` siguen sin cascada compartida, por decisión de alcance:
  tienen semántica de ejecución y de costo facturable.
- El caché de data sources sigue siendo in-memory por proceso. Con réplicas, el aislamiento por
  dueño se mantiene pero el hit-rate se fragmenta por instancia.
