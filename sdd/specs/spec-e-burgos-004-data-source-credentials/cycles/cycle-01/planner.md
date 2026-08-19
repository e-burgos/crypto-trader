# Planner — Cycle 01: Resolución híbrida de credenciales de data sources

> **Spec:** spec-e-burgos-004-data-source-credentials
> **Módulo:** market-data-credentials · **Fecha:** 2026-08-19

## Orden de ejecución

El resolver (TASK-002) es la raíz del backend: TASK-003, TASK-004 y TASK-005 dependen de su
resultado tipado. El esquema (TASK-001) precede al resolver porque el resolver lee la columna
nueva. El frontend (TASK-007) depende solo del contrato de TASK-006, no de su implementación,
así que puede avanzar en paralelo con el backend una vez fijado el contrato en `sdd/api.json`.

```
TASK-001 (schema)
   └─> TASK-002 (resolver)
          ├─> TASK-003 (snapshot enriquecido)
          ├─> TASK-004 (fuentes de noticias)
          └─> TASK-005 (aislamiento caché + rate limit)
   └─> TASK-006 (endpoints trader + admin)
          └─> TASK-007 (pantalla web)
TASK-008 (registros SDD) — al cierre, depende de todas
```

## Fase 1 — Backend: dato y resolución

### TASK-001 — Columna `shared` en las dos tablas de credenciales

Migración SQL aditiva única que agrega `shared BOOLEAN NOT NULL DEFAULT false` a
`data_source_credentials` y a `news_api_credentials`, más los campos correspondientes en
`schema.prisma`. Timestamp posterior a `20260817160000_add_cost_gate_fields`.

**Cubre:** RF-02 · **Verifica:** CA-016 (default no compartida)
**Riesgo:** bajo — aditivo, con default que preserva el comportamiento actual.

### TASK-002 — `DataSourceCredentialResolver`

Servicio único con la cascada `propia → admin compartida → ninguna`, resultado tipado con dueño
y origen. Dos métodos de resolución en lote: uno por conjunto de `dataSourceId` y otro por
conjunto de proveedores de noticias, ambos con la misma semántica. La condición de "admin" se
resuelve por el rol del usuario dueño de la credencial, no por confianza en el flag.

**Cubre:** RF-01, RF-03 · **Verifica:** CA-004, CA-005, CA-006
**Riesgo:** medio — es el punto donde se decide qué key se usa; un error acá cambia con qué
credencial se llama al proveedor.

## Fase 2 — Backend: consumo y aislamiento

### TASK-003 — `buildEnrichedSnapshot` delega en el resolver

Reemplazar el bloque de resolución de credenciales por una llamada al resolver, conservando el
mapa que consume el filtro de fuentes omitidas y propagando el dueño hacia `fetchFromProvider`.
No queda ninguna cascada inline en `market.service.ts`.

**Cubre:** RF-01 · **Verifica:** CA-001, CA-003
**Riesgo:** medio — toca el camino caliente de cada ciclo de trading.

### TASK-004 — `buildNewsSources` delega en el resolver

Misma sustitución para el pipeline de noticias, que hoy resuelve `newsApiCredential` fila por
fila dentro de un `Promise.all`.

**Cubre:** RF-01 · **Verifica:** CA-002
**Riesgo:** bajo — superficie chica y aislada.

### TASK-005 — Caché y rate limiter por `(fuente, dueño de credencial)`

Extender `DataSourceRegistryService.fetchFromProvider` y las dos colaboradoras
(`DataSourceCacheService`, rate limiter, circuit breaker) para indexar por clave compuesta. Las
fuentes sin credencial usan un dueño común explícito. Los tres caminos de fallback —rate limit
excedido, circuito abierto, error de fetch— leen la entrada del dueño correcto o ninguna.

**Cubre:** RF-04 · **Verifica:** CA-019, CA-020, CA-021, CA-022
**Riesgo:** alto — cambia la clave de tres estructuras compartidas. Es la task que cierra la
fuga cross-tenant, y también la que puede degradar el hit-rate del caché si la clave se elige
mal.

## Fase 3 — API y frontend

### TASK-006 — Endpoints de trader y extensión del de admin

Tres endpoints bajo `/users/me/data-sources` y el campo nuevo en el body del endpoint de admin,
declarado en su DTO para no chocar con `forbidNonWhitelisted`. El listado calcula por fuente si
el trader tiene credencial propia y si hay compartida disponible.

**Cubre:** RF-05, RF-02 · **Verifica:** CA-008, CA-012, CA-013, CA-015, CA-017
**Riesgo:** bajo — CRUD guardado por los guards existentes.

### TASK-007 — Pantalla `/dashboard/settings/data-sources`

Página, card por fuente, modal de carga de key y hook de datos. Estado derivado del servidor,
nunca inferido en el cliente.

**Cubre:** RF-06 · **Verifica:** CA-009, CA-010, CA-011, CA-014
**Riesgo:** bajo.

### TASK-008 — Registros SDD y contexto

Registrar las dos tablas en `sdd/schema.json`, los endpoints en `sdd/api.json`, los componentes
en `sdd/components.json`, y escribir los fragmentos aditivos de contexto de `apps/api` y
`apps/web`. Cierre con `pnpm sdd:validate` y `pnpm sdd:rebuild-tasks-index` en verde.

**Cubre:** CONTEXTO GATE · **Riesgo:** bajo.

## Cobertura de criterios de aceptación

| CA                                     | Task                |
| -------------------------------------- | ------------------- |
| CA-001, CA-003                         | TASK-003            |
| CA-002                                 | TASK-004            |
| CA-004, CA-005, CA-006                 | TASK-002            |
| CA-007                                 | TASK-002 + TASK-006 |
| CA-008, CA-012, CA-013, CA-015, CA-017 | TASK-006            |
| CA-009, CA-010, CA-011, CA-014         | TASK-007            |
| CA-016                                 | TASK-001            |
| CA-018                                 | TASK-002 + TASK-005 |
| CA-019, CA-020, CA-021, CA-022         | TASK-005            |

## Riesgo transversal

CA-018 (dejar de compartir corta el acceso, sin residuo por caché) depende de que la clave de
caché de TASK-005 incluya al dueño: si un trader consumía la key compartida y esa credencial
deja de estar compartida, su próxima resolución no encuentra credencial y la fuente se omite,
sin poder leer la entrada cacheada bajo el dueño admin. Es la razón por la que TASK-005 no es
opcional ni postergable a otro ciclo.
