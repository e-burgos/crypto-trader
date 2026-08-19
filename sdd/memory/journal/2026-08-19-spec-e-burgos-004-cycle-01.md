# spec-e-burgos-004 cycle-01 — 2026-08-19

## Qué pasó

El architect fijó como restricción del ciclo que un campo nuevo en el body de
`PUT /admin/data-sources/:id/credential` tenía que declararse en una clase DTO, porque el
`ValidationPipe` global corre con `forbidNonWhitelisted`. Es falso para ese endpoint: los
controllers de este repo tipan sus `@Body()` con object types inline, y
`ValidationPipe.toValidate` saltea la validación cuando el metatype es `Object`
(`node_modules/@nestjs/common/pipes/validation.pipe.js:120`). El campo pasa sin DTO y sin 400.

Segundo hecho, del mismo ciclo: al extraer la cascada de credenciales a un resolver, el listado
que alimenta la UI quedó con su propia consulta de credenciales compartidas, sin el filtro de rol
que sí aplica la resolución. La pantalla anunciaba "Admin shared" para fuentes que el snapshot
después omitía.

## Lección

- Antes de tratar una config global (`forbidNonWhitelisted`, guards, interceptors) como
  restricción de diseño, verificar que alcance al código concreto: en este repo el
  `ValidationPipe` global no valida ningún `@Body()` tipado inline.
- Al centralizar una regla en un servicio, enumerar **todos** sus lectores, no solo el camino
  caliente: un lector que sobrevive con su propia consulta produce una UI que promete lo que el
  backend niega, y no lo detecta ningún test de la ruta principal.

## Costo evitable

Un refactor a clases DTO que no hacía falta, y un bug de UI que habría llegado a review o a
producción como "la fuente dice disponible pero no trae datos".
