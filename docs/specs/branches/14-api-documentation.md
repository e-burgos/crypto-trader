# Spec 14 — API Documentation (OpenAPI + Scalar)

**Fecha:** 2026-04-01
**Versión:** 1.0
**Estado:** Aprobado
**Branch:** `feature/api-documentation`

---

## Objetivo

1. **Auditar** el estado actual de la API contra lo planificado en el spec original (v1.2) y el plan de implementación, identificando gaps de endpoints y módulos faltantes.
2. **Documentar** toda la API REST con `@nestjs/swagger` (generador OpenAPI 3.0) + **Scalar** como UI moderna de documentación interactiva.

---

## 1. Análisis de Gaps — Estado Actual vs Planificado

### 1.1 Endpoints implementados ✅

| Módulo | Endpoint | Estado |
|--------|----------|--------|
| **Auth** | `POST /api/auth/register` | ✅ |
| **Auth** | `POST /api/auth/login` | ✅ |
| **Auth** | `POST /api/auth/refresh` | ✅ |
| **Auth** | `POST /api/auth/logout` | ✅ |
| **Auth** | `GET /api/auth/me` | ✅ |
| **Users** | `GET /api/users/me` | ✅ |
| **Users** | `PUT /api/users/me` | ✅ |
| **Users** | `POST /api/users/me/binance-keys` | ✅ |
| **Users** | `DELETE /api/users/me/binance-keys` | ✅ |
| **Users** | `GET /api/users/me/binance-keys/status` | ✅ |
| **Users** | `POST /api/users/me/llm-keys` | ✅ |
| **Users** | `DELETE /api/users/me/llm-keys/:provider` | ✅ |
| **Users** | `GET /api/users/me/llm-keys/status` | ✅ |
| **Admin** | `GET /api/admin/stats` | ✅ |
| **Admin** | `POST /api/admin/kill-switch` | ✅ |
| **Admin** | `GET /api/admin/audit-log` | ✅ |
| **Admin** | `GET /api/admin/users` | ✅ (en UsersController) |
| **Admin** | `PATCH /api/admin/users/:id/status` | ✅ (en UsersController) |
| **Analytics** | `GET /api/analytics/portfolio` | ✅ |
| **Analytics** | `GET /api/analytics/trades` | ✅ |
| **Analytics** | `GET /api/analytics/decisions` | ✅ |
| **Notifications** | `GET /api/notifications` | ✅ |
| **Notifications** | `GET /api/notifications/unread` | ✅ |
| **Notifications** | `PATCH /api/notifications/read-all` | ✅ |
| **Notifications** | `PATCH /api/notifications/:id/read` | ✅ |

### 1.2 Endpoints planificados pero FALTANTES ❌

| Módulo | Endpoint | Prioridad | Referencia plan |
|--------|----------|-----------|-----------------|
| **Trading** | `GET /api/trading/config` | 🔴 Alta | Task 11 |
| **Trading** | `PUT /api/trading/config` | 🔴 Alta | Task 11 |
| **Trading** | `POST /api/trading/start` | 🔴 Alta | Task 11 |
| **Trading** | `POST /api/trading/stop` | 🔴 Alta | Task 11 |
| **Trading** | `GET /api/trading/status` | 🔴 Alta | Task 11 |
| **Trading** | `GET /api/trading/positions` | 🔴 Alta | Task 11 |
| **Trading** | `GET /api/trading/history` | 🔴 Alta | Task 11 |
| **Trading** | `GET /api/trading/decisions` | 🔴 Alta | Task 11 |
| **Market** | `GET /api/market/ohlcv/:asset/:interval` | 🟡 Media | Spec §7 |
| **Market** | `GET /api/market/news` | 🟡 Media | Spec §7 |
| **Analytics** | `GET /api/analytics/summary` | 🟡 Media | Task 14 |
| **Analytics** | `GET /api/analytics/pnl-chart` | 🟡 Media | Task 14 |
| **Analytics** | `GET /api/analytics/asset-breakdown` | 🟡 Media | Task 14 |
| **Admin** | `GET /api/admin/agents/status` | 🟢 Baja | Task 12 |

### 1.3 DTOs sin decoradores de validación extendida

Los siguientes DTOs existen pero no tienen `@ApiProperty` ni descripciones de tipo OpenAPI:
- `RegisterDto`, `LoginDto`, `RefreshTokenDto`
- `UpdateUserDto`, `BinanceKeyDto`, `LLMKeyDto`, `UpdateUserStatusDto`

### 1.4 Discrepancias de nomenclatura vs spec

| Spec original | Implementado | Observación |
|---------------|-------------|-------------|
| `GET /analytics/summary` | `GET /analytics/portfolio` | Renombrado en implementación |
| `GET /trading/decisions` | `GET /analytics/decisions` | Endpoint en módulo Analytics, no Trading |
| `POST /admin/kill-switch` | `POST /admin/kill-switch` | ✅ Match exacto |
| `GET /admin/audit-log` | No en spec original | Extra añadido en implementación |

---

## 2. Scope de Documentación

### 2.1 Instalación de dependencias

```bash
pnpm add @nestjs/swagger @scalar/nestjs-api-reference
```

### 2.2 Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/main.ts` | Configurar `DocumentBuilder` + montar Scalar |
| `apps/api/src/auth/dto/auth.dto.ts` | Añadir `@ApiProperty` a todos los DTOs |
| `apps/api/src/auth/auth.controller.ts` | Añadir `@ApiTags`, `@ApiOperation`, `@ApiResponse` |
| `apps/api/src/users/users.controller.ts` | Añadir `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiResponse` |
| `apps/api/src/admin/admin.controller.ts` | Añadir `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiResponse` |
| `apps/api/src/analytics/analytics.controller.ts` | Añadir `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiQuery` |
| `apps/api/src/notifications/notifications.controller.ts` | Añadir `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiParam` |

### 2.3 Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/common/swagger/swagger.setup.ts` | Helper que configura y monta Swagger + Scalar |

---

## 3. Tareas de Implementación

---

### Tarea 1 — Instalar dependencias y configurar `DocumentBuilder`

**Archivos:** `apps/api/src/main.ts`, `apps/api/src/common/swagger/swagger.setup.ts`

**Pasos:**
1. Instalar: `pnpm add @nestjs/swagger @scalar/nestjs-api-reference`
2. Crear `swagger.setup.ts` con `DocumentBuilder`:
   - Título: `Crypto Trader API`
   - Descripción: `Autonomous crypto trading platform — REST API`
   - Versión: `1.0`
   - Esquema de seguridad: `BearerAuth` (JWT)
   - Tags definidos: `auth`, `users`, `admin`, `analytics`, `notifications`
3. Montar Scalar en `main.ts`:
   - Ruta del spec JSON: `/api/docs-json`
   - Ruta de la UI: `/api/docs`
   - Tema: oscuro (acorde al diseño de la plataforma)
4. Guardar con `SwaggerModule.createDocument()` y `app.use('/api/docs', ...)` con `@scalar/nestjs-api-reference`

**Criterio de aceptación:**
- `GET http://localhost:3000/api/docs` → responde con la UI de Scalar
- `GET http://localhost:3000/api/docs-json` → responde con JSON OpenAPI 3.0 válido

---

### Tarea 2 — Decorar DTOs con `@ApiProperty`

**Archivo:** `apps/api/src/auth/dto/auth.dto.ts`

**Decoradores a añadir por DTO:**

`RegisterDto`:
- `email`: `@ApiProperty({ example: 'trader@example.com', description: 'Email único del usuario' })`
- `password`: `@ApiProperty({ example: 'SecurePass123!', minLength: 8, description: 'Mínimo 8 caracteres' })`

`LoginDto`:
- `email`: `@ApiProperty({ example: 'trader@example.com' })`
- `password`: `@ApiProperty({ example: 'SecurePass123!' })`

`RefreshTokenDto`:
- `refreshToken`: `@ApiProperty({ description: 'JWT refresh token' })`

`UpdateUserDto`:
- `email`: `@ApiPropertyOptional({ example: 'new@example.com' })`
- `password`: `@ApiPropertyOptional({ example: 'NewSecurePass123!', minLength: 8 })`

`BinanceKeyDto`:
- `apiKey`: `@ApiProperty({ description: 'Binance API Key (solo permisos de lectura y trading)' })`
- `apiSecret`: `@ApiProperty({ description: 'Binance API Secret' })`

`LLMKeyDto`:
- `provider`: `@ApiProperty({ enum: ['CLAUDE', 'OPENAI', 'GROQ'], example: 'CLAUDE' })`
- `apiKey`: `@ApiProperty({ description: 'API Key del proveedor LLM' })`
- `selectedModel`: `@ApiProperty({ example: 'claude-sonnet-4-6', description: 'Modelo seleccionado del proveedor' })`

`UpdateUserStatusDto`:
- `isActive`: `@ApiProperty({ example: true })`

**Criterio de aceptación:** El spec JSON generado incluye los schemas completos de todos los DTOs con ejemplos.

---

### Tarea 3 — Decorar `AuthController`

**Archivo:** `apps/api/src/auth/auth.controller.ts`

**Decoradores:**

```
@ApiTags('auth')
class AuthController

@Post('register')
@ApiOperation({ summary: 'Registrar nuevo usuario' })
@ApiResponse({ status: 201, description: 'Usuario creado. Devuelve accessToken + refreshToken' })
@ApiResponse({ status: 409, description: 'Email ya registrado' })
@ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })

@Post('login')
@ApiOperation({ summary: 'Iniciar sesión' })
@ApiResponse({ status: 200, description: 'Login exitoso. Devuelve accessToken + refreshToken + user' })
@ApiResponse({ status: 401, description: 'Credenciales inválidas' })

@Post('refresh')  
@ApiOperation({ summary: 'Rotar access token usando refresh token' })
@ApiResponse({ status: 200, description: 'Nuevo par de tokens' })
@ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })

@Post('logout')
@ApiBearerAuth()
@ApiOperation({ summary: 'Cerrar sesión (invalida refresh token)' })
@ApiResponse({ status: 204, description: 'Sesión cerrada' })

@Get('me')
@ApiBearerAuth()
@ApiOperation({ summary: 'Obtener usuario autenticado' })
@ApiResponse({ status: 200, description: 'Datos del usuario actual' })
@ApiResponse({ status: 401, description: 'No autenticado' })
```

---

### Tarea 4 — Decorar `UsersController`

**Archivo:** `apps/api/src/users/users.controller.ts`

**Decoradores a nivel clase:**
```
@ApiTags('users')
@ApiBearerAuth()
```

**Por endpoint:**

```
GET /users/me
@ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
@ApiResponse({ status: 200 })

PUT /users/me  
@ApiOperation({ summary: 'Actualizar email o contraseña' })
@ApiResponse({ status: 200 })
@ApiResponse({ status: 409, description: 'Email ya en uso' })

POST /users/me/binance-keys
@ApiOperation({ summary: 'Guardar credenciales de Binance (encriptadas)' })
@ApiResponse({ status: 201 })

DELETE /users/me/binance-keys
@ApiOperation({ summary: 'Eliminar credenciales de Binance' })
@ApiResponse({ status: 204 })

GET /users/me/binance-keys/status
@ApiOperation({ summary: 'Verificar si hay credenciales de Binance configuradas' })
@ApiResponse({ status: 200, schema: { example: { connected: true } } })

POST /users/me/llm-keys
@ApiOperation({ summary: 'Guardar clave de proveedor LLM (Claude / OpenAI / Groq)' })
@ApiResponse({ status: 201 })

DELETE /users/me/llm-keys/:provider
@ApiOperation({ summary: 'Eliminar clave de un proveedor LLM' })
@ApiParam({ name: 'provider', enum: ['CLAUDE', 'OPENAI', 'GROQ'] })
@ApiResponse({ status: 204 })

GET /users/me/llm-keys/status
@ApiOperation({ summary: 'Estado de cada proveedor LLM configurado' })
@ApiResponse({ status: 200, schema: { example: { providers: [{ provider: 'CLAUDE', connected: true, selectedModel: 'claude-sonnet-4-6' }] } } })

GET /admin/users
@ApiTags('admin')
@ApiOperation({ summary: '[ADMIN] Listar todos los usuarios con su estado' })
@ApiResponse({ status: 200 })
@ApiResponse({ status: 403 })

PATCH /admin/users/:id/status
@ApiTags('admin')
@ApiOperation({ summary: '[ADMIN] Activar o desactivar una cuenta de usuario' })
@ApiParam({ name: 'id', description: 'ID del usuario' })
@ApiResponse({ status: 200 })
@ApiResponse({ status: 403 })
```

---

### Tarea 5 — Decorar `AdminController`

**Archivo:** `apps/api/src/admin/admin.controller.ts`

**Decoradores a nivel clase:**
```
@ApiTags('admin')
@ApiBearerAuth()
```

**Por endpoint:**

```
GET /admin/stats
@ApiOperation({ summary: '[ADMIN] Stats globales de la plataforma' })
@ApiResponse({ status: 200, schema: { example: { totalUsers: 12, totalTrades: 340, totalPnl: 1250.5, activeAgents: 3 } } })
@ApiResponse({ status: 403 })

POST /admin/kill-switch
@ApiOperation({ summary: '[ADMIN] Detener todos los agentes activos en la plataforma' })
@ApiResponse({ status: 200, description: 'Kill-switch ejecutado. Todos los agentes detenidos.' })
@ApiResponse({ status: 403 })

GET /admin/audit-log
@ApiOperation({ summary: '[ADMIN] Ver log de acciones administrativas' })
@ApiResponse({ status: 200 })
@ApiResponse({ status: 403 })
```

---

### Tarea 6 — Decorar `AnalyticsController`

**Archivo:** `apps/api/src/analytics/analytics.controller.ts`

**Decoradores a nivel clase:**
```
@ApiTags('analytics')
@ApiBearerAuth()
```

**Por endpoint:**

```
GET /analytics/portfolio
@ApiOperation({ summary: 'Resumen del portfolio: P&L total, win rate, trades totales' })
@ApiResponse({ status: 200 })

GET /analytics/trades
@ApiOperation({ summary: 'Historial de trades del usuario (paginado)' })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
@ApiResponse({ status: 200 })

GET /analytics/decisions
@ApiOperation({ summary: 'Historial de decisiones del agente IA' })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
@ApiResponse({ status: 200 })
```

---

### Tarea 7 — Decorar `NotificationsController`

**Archivo:** `apps/api/src/notifications/notifications.controller.ts`

**Decoradores a nivel clase:**
```
@ApiTags('notifications')
@ApiBearerAuth()
```

**Por endpoint:**

```
GET /notifications
@ApiOperation({ summary: 'Listar notificaciones del usuario (las no leídas primero)' })
@ApiQuery({ name: 'take', required: false, type: Number, example: 50 })
@ApiResponse({ status: 200 })

GET /notifications/unread
@ApiOperation({ summary: 'Listar solo notificaciones no leídas' })
@ApiResponse({ status: 200 })

PATCH /notifications/read-all
@ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
@ApiResponse({ status: 204 })

PATCH /notifications/:id/read
@ApiOperation({ summary: 'Marcar una notificación como leída' })
@ApiParam({ name: 'id', description: 'ID de la notificación' })
@ApiResponse({ status: 204 })
@ApiResponse({ status: 404, description: 'Notificación no encontrada' })
```

---

## 4. Módulos Faltantes — Plan de Acción

Los endpoints de `TradingModule` y `MarketModule` están planificados pero NO implementados. Se documentan aquí como **pendientes** y se registran en el backlog del spec.

### 4.1 TradingModule (pendiente — alta prioridad)

Referencia: **Task 11** del plan de implementación.

Endpoints a implementar en una tarea separada:
- `GET /api/trading/config` — configuración del agente del usuario
- `PUT /api/trading/config` — actualizar configuración
- `POST /api/trading/start` — arrancar el agente (live o sandbox)
- `POST /api/trading/stop` — detener el agente
- `GET /api/trading/status` — estado actual + próxima ejecución
- `GET /api/trading/positions` — posiciones abiertas (paginado)
- `GET /api/trading/history` — historial de trades (paginado, filtrable por asset/modo/fecha)
- `GET /api/trading/decisions` — log de decisiones (paginado)

### 4.2 MarketModule (pendiente — media prioridad)

Referencia: Spec §7.

Endpoints a implementar:
- `GET /api/market/ohlcv/:asset/:interval` — datos OHLCV para el gráfico
- `GET /api/market/news` — noticias recientes usadas por el agente

### 4.3 Analytics extendida (pendiente — media prioridad)

Referencia: **Task 14**.

Endpoints a implementar:
- `GET /api/analytics/summary` — resumen completo (Sharpe ratio, drawdown, best/worst trade)
- `GET /api/analytics/pnl-chart` — P&L diario últimos 30 días `{ date, pnl }[]`
- `GET /api/analytics/asset-breakdown` — P&L desglosado por BTC/ETH

---

## 5. Estructura del Documento OpenAPI Generado

El spec resultante deberá tener la siguiente estructura de tags:

```
auth
  POST /auth/register
  POST /auth/login
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/me

users
  GET    /users/me
  PUT    /users/me
  POST   /users/me/binance-keys
  DELETE /users/me/binance-keys
  GET    /users/me/binance-keys/status
  POST   /users/me/llm-keys
  DELETE /users/me/llm-keys/{provider}
  GET    /users/me/llm-keys/status

admin
  GET    /admin/users
  PATCH  /admin/users/{id}/status
  GET    /admin/stats
  POST   /admin/kill-switch
  GET    /admin/audit-log

analytics
  GET    /analytics/portfolio
  GET    /analytics/trades
  GET    /analytics/decisions

notifications
  GET    /notifications
  GET    /notifications/unread
  PATCH  /notifications/read-all
  PATCH  /notifications/{id}/read
```

---

## 6. Configuración de Scalar

```typescript
// Opciones recomendadas para Scalar
{
  theme: 'saturn',     // tema oscuro compatible con el diseño crypto
  darkMode: true,
  defaultHttpClient: {
    targetKey: 'javascript',
    clientKey: 'fetch',
  },
  authentication: {
    preferredSecurityScheme: 'BearerAuth',
  },
}
```

URL de acceso en desarrollo: `http://localhost:3000/api/docs`

---

## 7. Criterios de Aceptación

- [ ] `pnpm dev:api` arranca sin errores con las nuevas dependencias
- [ ] `GET http://localhost:3000/api/docs` → renderiza la UI de Scalar con todos los tags
- [ ] `GET http://localhost:3000/api/docs-json` → JSON OpenAPI 3.0 válido, parseable en https://editor.swagger.io
- [ ] Todos los endpoints listados en §1.1 aparecen en la documentación con descripciones
- [ ] Todos los DTOs tienen campos documentados con ejemplos
- [ ] Los endpoints protegidos muestran el candado 🔒 y requieren Bearer token en la UI de Scalar
- [ ] Los endpoints `ADMIN` están claramente marcados con tag `admin`
- [ ] No hay regresiones en `pnpm test:api`

---

## 8. Dependencias

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@nestjs/swagger` | `^8.x` | Generador OpenAPI 3.0, decoradores y `SwaggerModule` |
| `@scalar/nestjs-api-reference` | `^0.x` | UI moderna Scalar para NestJS |

---

## 9. Notas de Seguridad

- El endpoint `/api/docs` y `/api/docs-json` deben estar **deshabilitados en producción** (variable de entorno `NODE_ENV=production` condiciona el montaje).
- Los campos `password`, `passwordHash`, `apiKeyEncrypted`, `secretEncrypted` nunca deben aparecer en responses documentadas.
- La documentación no expone claves reales — solo schemas y ejemplos ficticios.

---

**Depende de:** 02-auth-users, 06-backend-support
**Bloquea:** (ninguno — tarea transversal de documentación)
**Siguiente acción:** Ejecutar las 7 tareas en orden. Cada tarea es independiente excepto Tarea 1 que debe ir primero.
