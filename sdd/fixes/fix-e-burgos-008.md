# FIX-e-burgos-008 — Sin limite de intentos en login y register: fuerza bruta sin friccion

> Tipo: HOTFIX | Severidad: critical | Estado: implemented | Creado: 2026-08-30 | Resuelto: 2026-08-31

## Problema

No hay ningun mecanismo de rate limiting en el backend (no existe @nestjs/throttler en package.json). /api/auth/login y /api/auth/register aceptan intentos ilimitados. El costo 12 de bcrypt limita el throughput pero no impide el ataque, y ademas convierte cada intento en trabajo caro para el servidor, con lo que la ausencia de limite es tambien un vector de agotamiento de recursos.

## Solucion

Se agrega `@nestjs/throttler@6.5.0` (peer range `@nestjs/common ^11`, compatible con el NestJS 11 del repo).

**Alcance: solo autenticacion, sin guard global.** `ThrottlerModule.forRoot()` declara un unico
throttler nombrado `auth` y NO se registra ningun `APP_GUARD`. El limite se aplica con
`@UseGuards(ThrottlerGuard)` a nivel de metodo sobre `POST /api/auth/login` y
`POST /api/auth/register`. Todo el resto de la API — incluidos `refresh`, `logout` y `me` del mismo
controlador — queda sin tocar. Un limite global habria puesto en riesgo al frontend, que hace 26
hooks de datos y polling de precios por sesion.

**Calibracion** (`ttl` en milisegundos; el contador es por handler, login y register no comparten cupo):

| Endpoint | Limite | Ventana | Criterio |
| --- | --- | --- | --- |
| `POST /auth/login` | 10 intentos | 60 s | ~6x la rafaga legitima maxima de una persona o de una NAT chica; acota el trabajo bcrypt(12) a ~10 hashes/min/IP (segundos de CPU, no saturacion); baja al atacante de miles de intentos/hora a 600/hora por IP. |
| `POST /auth/register` | 5 intentos | 3600 s | El alta es un evento unico en la vida de un usuario real; 5/hora absorbe reintentos por errores de validacion y a la vez inutiliza el alta masiva automatizada y la enumeracion de emails via el 409 de email duplicado. |

`blockDuration` queda por defecto igual al `ttl`. El guard responde 429 con `Retry-After-auth` y
publica `X-RateLimit-Limit-auth` / `-Remaining-auth` / `-Reset-auth` mientras se esta por debajo del
limite.

**Identificacion del cliente:** el tracker por defecto de `ThrottlerGuard` es `req.ip`.

## Archivos afectados

- `package.json` — dependencia `@nestjs/throttler@^6.5.0`
- `pnpm-lock.yaml`
- `apps/api/src/app/app.module.ts` — `ThrottlerModule.forRoot()` con el throttler nombrado `auth`
- `apps/api/src/auth/auth.controller.ts` — guard + `@Throttle` en `login` y `register`, respuesta 429 documentada en Swagger
- `apps/api/src/auth/auth.rate-limit.spec.ts` — nuevo

## Criterio de aceptacion

Los endpoints de autenticacion rechazan con 429 al superar el limite; el resto de la API mantiene su comportamiento.

## Verificacion

- `pnpm exec jest --config apps/api/jest.config.js apps/api/src` → 682/682 en verde (80 suites), 7 de ellos nuevos.
- `pnpm nx build api` → compila.
- `pnpm exec eslint` sobre los tres archivos tocados → sin hallazgos.

El spec levanta una app Nest real sobre un puerto efimero y pega con `fetch`. Cubre: los intentos
por debajo del limite siguen llegando a `AuthService` y devuelven 200; el intento siguiente devuelve
429 sin llegar al servicio; los headers de cupo; el limite propio de register; que login y register
llevan cupos separados; y que `refresh` y un controlador ajeno a auth aguantan el triple del limite
sin ser throttleados.

## Pendiente

- **`trust proxy` no esta configurado en `apps/api/src/main.ts`.** Railway es un proxy: sin
  `app.set('trust proxy', 1)`, `req.ip` es la IP del edge de Railway y no la del cliente, con lo que
  todo el trafico de produccion cae en un unico bucket — se pierde el aislamiento por atacante y se
  arriesga throttlear usuarios legitimos. Es una linea en `main.ts`; no se toco porque el archivo
  esta asignado a otro fix en curso. **Debe resolverse antes del proximo deploy.** No se implemento
  un tracker propio que lea `X-Forwarded-For` a mano: ese header es falsificable si el proxy lo
  agrega en vez de reemplazarlo, y daria una falsa sensacion de proteccion. Con `trust proxy`
  seteado, el tracker por defecto de la libreria ya resuelve la IP real.
- El almacenamiento del throttler es el `ThrottlerStorageService` en memoria: el cupo es por
  instancia. Con mas de una replica el limite efectivo se multiplica por la cantidad de instancias.
  Para escalar horizontalmente hace falta un storage compartido en Redis (el repo ya tiene `ioredis`
  y `REDIS_URL`).
- El limite es por IP, no por cuenta: no frena un ataque de password spraying distribuido. El
  complemento natural es un lockout o backoff por cuenta, fuera del alcance de este fix.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: apps/api/src/auth/auth.rate-limit.spec.ts
