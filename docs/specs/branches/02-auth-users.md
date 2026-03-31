# Spec 02 — Auth & Users

## Objetivo

Implementar autenticación JWT, registro/login, refresh, logout, y gestión de usuarios y credenciales (Binance + LLM) con cifrado seguro.

## Alcance

- Endpoints:
  - POST /auth/register
  - POST /auth/login
  - POST /auth/refresh
  - POST /auth/logout
  - GET/PUT /users/me
  - POST/DELETE /users/me/binance-keys
  - GET /users/me/binance-keys/status
  - POST/DELETE /users/me/llm-keys
  - GET /users/me/llm-keys/status
  - GET /admin/users
  - PATCH /admin/users/:id/status
- Cifrado AES-256-GCM para credenciales (clave en env)
- Guards: JwtAuthGuard, RolesGuard
- Tests unitarios: registro, login, refresh, cifrado, acceso admin

## Criterios de aceptación

- Todos los endpoints funcionan vía curl/httpie
- Tests unitarios cubren casos principales y edge
- Ningún secreto se almacena en texto plano
- Branch: `feature/auth-users`

---

**Depende de:** 01-foundation
**Siguiente:** 04-trading-engine, 07-frontend-auth
