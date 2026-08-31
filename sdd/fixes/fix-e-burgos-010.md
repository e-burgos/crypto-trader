# FIX-e-burgos-010 — Endpoints con @Body() de tipo inline saltean el ValidationPipe global: entran campos arbitrarios

> Tipo: BUGFIX | Severidad: medium | Estado: implemented | Creado: 2026-08-31 | Resuelto: 2026-08-31

## Problema

`apps/api/src/main.ts` monta un `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`. Esa es la defensa del backend contra asignacion masiva: descarta lo que no esta declarado y rechaza el request si viene algo de mas.

El pipe solo actua cuando el metatype del parametro es una clase con metadata de `class-validator`. Si el `@Body()` se tipa con un objeto inline (`@Body() body: { isActive: boolean }`), el metatype que llega al pipe es `Object`, el pipe hace short-circuit y **el body entra crudo**: sin validacion de tipos, sin coercion y sin descarte de campos de mas. La auditoria lo detecto en `admin/data-sources.controller.ts` y el barrido del backend encontro el mismo patron en 8 endpoints de 5 controllers.

## Endpoints afectados (8)

| Endpoint | Controller | Body sin validar |
| --- | --- | --- |
| `PATCH /admin/data-sources/:id/toggle` | `admin/data-sources.controller.ts:85` | `{ isActive: boolean }` |
| `PATCH /admin/data-sources/:id` | `admin/data-sources.controller.ts:117` | `{ priority?, rateLimitPerMin?, pollingIntervalMs? }` |
| `PUT /admin/data-sources/:id/credential` | `admin/data-sources.controller.ts:192` | `{ apiKey: string; shared?: boolean }` |
| `PUT /users/me/data-sources/:id/credential` | `users/users.controller.ts:462` | `{ apiKey: string }` |
| `POST /trading/sandbox-wallet/init` | `trading/trading.controller.ts:77` | `{ capitalUsdt?, capitalUsdc? }` |
| `POST /trading/config/auto-name` | `trading/trading.controller.ts:117` | `{ asset: string; riskProfile: string }` |
| `POST /chat/sessions/:id/select` | `chat/chat.controller.ts:236` | `{ optionId: string; value: string }` |
| `PUT /market/news/config` | `market/market.controller.ts:97` | `{ intervalMinutes?, newsCount?, enabledSources?, onlySummary?, botEnabled?, newsWeight? }` |

Los otros 25 `@Body()` del backend ya referenciaban una clase DTO y no se tocaron.

## Archivos afectados

- `apps/api/src/admin/data-sources.controller.ts` + `apps/api/src/admin/dto/data-sources.dto.ts` (nuevo)
- `apps/api/src/users/users.controller.ts` + `apps/api/src/users/dto/data-source-credential.dto.ts` (nuevo)
- `apps/api/src/market/market.controller.ts` + `apps/api/src/market/dto/news-config.dto.ts` (nuevo)
- `apps/api/src/trading/trading.controller.ts` + `apps/api/src/trading/dto/trading-config.dto.ts`
- `apps/api/src/chat/chat.controller.ts` + `apps/api/src/chat/dto/chat.dto.ts`
- `apps/api/src/common/body-dto-validation.spec.ts` (nuevo)

## Criterio de aceptacion

Ningun `@Body()` del backend queda tipado con un objeto inline, una interface o `any`: todos referencian una clase DTO con decoradores de `class-validator`, de modo que el `ValidationPipe` global valide tipos y rechace campos no declarados.

## Resolucion

Los 8 bodies pasaron a clases DTO con decoradores de `class-validator` y `@nestjs/swagger`, siguiendo el estilo de los DTOs que ya existen (`trading-config.dto.ts`, `chat.dto.ts`): `ToggleDataSourceDto`, `UpdateDataSourceConfigDto`, `SetDataSourceCredentialDto`, `SetMyDataSourceCredentialDto`, `UpdateNewsConfigDto`, `SelectOptionDto`, `InitSandboxWalletDto` y `AutoNameAgentDto`.

Los rangos de cada campo se tomaron del `schema.prisma` y del valor por defecto que ya aplicaba el servicio, para que la validacion no rechace ningun request que el frontend emite hoy: se verifico contra `use-data-sources.ts`, `use-trader-data-sources.ts`, `use-market.ts` / `news-config-panel.tsx`, `use-chat.ts` y `onboarding.tsx` que los payloads reales caen dentro de lo declarado y no llevan campos de mas.

Dos decisiones de alcance:

- El body de `PUT /admin/data-sources/:id/credential` (con `shared`) y el de `PUT /users/me/data-sources/:id/credential` (sin `shared`) quedaron como clases separadas a proposito: compartir una sola habilitaria a un trader a marcar su credencial como compartida, que es una capacidad de admin.
- `AutoNameAgentDto.asset` quedo como `@IsString()` y no como `@IsEnum(AssetEnum)` porque `generateAgentName` acepta cualquier asset y resuelve el perfil desconocido a `Balanced`; el `riskProfile` si es enum porque su unico consumidor lo emite desde `RiskProfileEnum`.

`data-sources.controller.ts` pasaba el body al `details` JSON del `AdminAction`; con el DTO tipado Prisma no acepta la instancia de clase como `InputJsonValue`, asi que se persiste `{ ...body }`. Es el unico cambio de comportamiento colateral y no altera el contenido registrado.

## Verificacion

- `apps/api/src/common/body-dto-validation.spec.ts` (nuevo, 25 tests): instancia el mismo `ValidationPipe` que monta `main.ts` (`whitelist` + `forbidNonWhitelisted`) y, para cada uno de los 8 DTOs, comprueba que acepta el body legitimo, **rechaza el body con un campo no declarado** (`userId`, `shared`, `sessionId`, `priority`... segun el endpoint) y rechaza el body mal tipado o fuera de rango.
- El mismo spec cierra con un guard estatico que recorre todos los `*.controller.ts` de `apps/api/src` y falla si algun `@Body()` vuelve a quedar tipado con algo que no sea una clase `*Dto` — la regresion no puede reintroducirse en silencio.
- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 720/720 (682 de linea base + 38 nuevos entre este fix y FIX-e-burgos-011).
- `pnpm nx build api` compila; `pnpm nx lint api` sin errores.
