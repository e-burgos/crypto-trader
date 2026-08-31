# FIX-e-burgos-007 — Sin JWT_SECRET la app arranca igual con un secreto conocido escrito en el codigo

> Tipo: HOTFIX | Severidad: critical | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-31

## Problema

auth.module.ts:12 y jwt.strategy.ts:17 caen a dev-secret; auth.service.ts:56,76 caen a dev-refresh-secret. No hay validacion de entorno al arrancar, asi que si la variable falta en produccion nada lo detecta y cualquiera que lea el repositorio puede forjar un token de administrador. Agravado por chat.module.ts:19, que usa process.env.JWT_SECRET sin fallback: si falta, ese modulo valida contra undefined mientras el resto firma con el valor por defecto. Hay que eliminar los fallbacks y validar el entorno al arrancar, fallando ruidoso.

## Solucion

Fuente unica de verdad en `apps/api/src/common/config/env.config.ts`:

- `validateRequiredEnv()` corre en `bootstrap()` de `main.ts` antes de `NestFactory.create`. Si falta
  alguna variable requerida (o esta vacia/en blanco) lanza con la lista completa de faltantes; el
  `catch` de `bootstrap()` la loguea y sale con codigo 1.
- `getJwtSecret()` / `getJwtRefreshSecret()` son los unicos accesos al secreto. No tienen fallback:
  si la variable falta, lanzan. Los cuatro puntos que antes divergian ahora llaman a la misma funcion.
- `auth.module.ts` y `chat.module.ts` pasaron de `JwtModule.register` (evaluado en tiempo de import,
  antes de la validacion) a `JwtModule.registerAsync` con `useFactory`, de modo que el secreto se
  resuelve al instanciar el contenedor DI — despues de la validacion de arranque. Asi el fallo que ve
  el operador es siempre el mensaje unificado, no un throw suelto durante el import.
- `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` mantienen su default legitimo (`15m` / `7d`) y tambien
  salen de este modulo, para que no se repliquen literales por el codigo.

### Variables validadas al arrancar

| Variable | Por que entra |
| --- | --- |
| `JWT_SECRET` | Firma y verifica el access token. Sin ella el codigo caia a un secreto publico del repo. |
| `JWT_REFRESH_SECRET` | Firma y verifica el refresh token. Mismo problema, con `dev-refresh-secret`. |
| `DATABASE_URL` | Hoy rompe igual, pero tarde y con el error de driver de Prisma. Adelantarlo al boot da un mensaje accionable. |
| `BINANCE_KEY_ENCRYPTION_KEY` | Hoy falla lazy, en `encryption.util.ts`, al primer guardado de credenciales: la app arranca "sana" y explota en runtime con un usuario adelante. Se adelanta al boot. |

Quedan fuera las opcionales con default legitimo: `PORT`, `REDIS_URL`, `CORS_ORIGIN`,
`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`. La validacion de arranque comprueba presencia; la regla de
longitud de 32 caracteres de `BINANCE_KEY_ENCRYPTION_KEY` sigue viviendo en `encryption.util.ts`, que
ya falla ruidoso y tiene test propio.

## Archivos afectados

- `apps/api/src/common/config/env.config.ts` (nuevo)
- `apps/api/src/main.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/strategies/jwt.strategy.ts`
- `apps/api/src/chat/chat.module.ts`
- `apps/api/src/test-setup.ts`
- `.env.example`

## Criterio de aceptacion

La app no arranca sin JWT_SECRET ni JWT_REFRESH_SECRET, con mensaje explicito; ningun fallback hardcodeado queda en el codigo

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 673/673, 78 suites en verde.
- `pnpm nx build api` → webpack compiled successfully.
- `pnpm nx lint api` → 0 errores.
- Arranque sin `JWT_SECRET` (resto presente) → exit code 1:

  ```
  ERROR Missing required environment variable: JWT_SECRET. There is no fallback secret: the API
  refuses to start until every required variable is set. See .env.example, set the missing values,
  and start again.
  ```

- Arranque sin ninguna de las cuatro → mismo formato, listando
  `DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, BINANCE_KEY_ENCRYPTION_KEY`.
- Con las cuatro presentes el arranque pasa la validacion y ambos `JwtModule` inicializan.
- `grep -rn "dev-secret\|dev-refresh-secret" apps/api/src` → sin resultados.

## Nota para el reviewer

`apps/api/src/test-setup.ts` define ahora `JWT_SECRET` y `JWT_REFRESH_SECRET` con `||=`, igual que ya
hacia con `BINANCE_KEY_ENCRYPTION_KEY`: al desaparecer los fallbacks, `auth.service.spec.ts` ejercita
`generateTokens()`, que lee el refresh secret. La validacion de arranque en si no corre en los tests
(vive dentro de `bootstrap()`, que jest nunca invoca).

`apps/api/src/common/config/env.config.ts` es un archivo nuevo fuera de la lista original del fix: los
cuatro consumidores necesitan un unico punto de acceso para no volver a divergir, y `main.ts` no sirve
como origen porque importarlo dispararia el bootstrap.
