# Spec 37 — Separación de acceso por roles (Admin vs Trader)

**Fecha:** 2026-04-22
**Versión:** 1.0
**Estado:** Propuesto
**Branch:** `feature/role-based-access-separation`
**Dependencias:** Spec 02 (auth-users), Spec 36 (agent-hub-config)

---

## 1. Resumen ejecutivo

Actualmente ambos roles (`ADMIN` y `TRADER`) comparten el mismo sidebar, las mismas rutas de dashboard y las mismas páginas. La única diferencia es que el admin tiene acceso adicional a `/admin/*`. Esto genera:

1. **Confusión de UX** — un admin ve funciones de trading que no le corresponden.
2. **Riesgo de seguridad** — un admin podría ejecutar trades accidentalmente; los endpoints de trading no verifican que el usuario sea TRADER.
3. **Violación del principio de menor privilegio** — cada rol debería ver solo lo que necesita.

Esta spec separa completamente la experiencia por rol: cada uno tiene su propio sidebar, sus propias rutas permitidas y guards tanto en frontend como en backend.

---

## 2. Arquitectura / Diseño

### 2.1 Principio de diseño

```
TRADER → ve y opera: trading, posiciones, agentes, chat, config, settings personales
ADMIN  → ve y gestiona: estadísticas de plataforma, usuarios, agentes globales, settings globales
```

No hay superposición de funcionalidades. Si en el futuro se necesita un rol híbrido, se crea un tercer rol (`SUPERADMIN`), pero no se mezclan los existentes.

### 2.2 Mapa de acceso por rol

#### Rutas TRADER (prefijo `/dashboard`)

| Ruta                           | Página                          | Acceso |
| ------------------------------ | ------------------------------- | ------ |
| `/dashboard`                   | Overview (portfolio, P&L)       | TRADER |
| `/dashboard/positions`         | Posiciones abiertas/cerradas    | TRADER |
| `/dashboard/history`           | Historial de trades             | TRADER |
| `/dashboard/market`            | Market data, velas              | TRADER |
| `/dashboard/bot-analysis`      | Análisis del agente             | TRADER |
| `/dashboard/agent-log`         | Log de decisiones               | TRADER |
| `/dashboard/news`              | Feed de noticias                | TRADER |
| `/dashboard/chat`              | Chat con agentes IA             | TRADER |
| `/dashboard/config`            | Configuración de trading        | TRADER |
| `/dashboard/settings/profile`  | Perfil personal                 | TRADER |
| `/dashboard/settings/exchange` | Claves Binance                  | TRADER |
| `/dashboard/settings/llms`     | Proveedores LLM                 | TRADER |
| `/dashboard/settings/news`     | Config de noticias              | TRADER |
| `/dashboard/settings/agents`   | Config de agentes (por usuario) | TRADER |
| `/dashboard/notifications`     | Notificaciones                  | TRADER |
| `/dashboard/live-chart`        | Gráfico en vivo                 | TRADER |

#### Rutas ADMIN (prefijo `/admin`)

| Ruta                      | Página                                      | Acceso |
| ------------------------- | ------------------------------------------- | ------ |
| `/admin`                  | Dashboard admin (stats globales)            | ADMIN  |
| `/admin/users`            | Gestión de usuarios                         | ADMIN  |
| `/admin/agents`           | Gestión global de agentes                   | ADMIN  |
| `/admin/settings/profile` | Perfil personal del admin                   | ADMIN  |
| `/admin/settings/llms`    | Config global de LLMs (OpenRouter defaults) | ADMIN  |
| `/admin/notifications`    | Notificaciones del admin                    | ADMIN  |

#### Rutas compartidas (públicas/auth)

| Ruta          | Página         | Acceso                     |
| ------------- | -------------- | -------------------------- |
| `/`           | Landing        | Todos                      |
| `/login`      | Login          | No autenticados            |
| `/register`   | Registro       | No autenticados            |
| `/help`       | Ayuda          | Todos                      |
| `/onboarding` | Wizard inicial | Autenticados (ambos roles) |

### 2.3 Diagrama de navegación post-login

```
Login exitoso
  │
  ├─ role === 'TRADER'
  │   └─ Redirect → /dashboard
  │       └─ Sidebar TRADER (Trading, Agente, Settings, Plataforma)
  │
  └─ role === 'ADMIN'
      └─ Redirect → /admin
          └─ Sidebar ADMIN (Overview, Gestión, Settings, Plataforma)
```

### 2.4 Componentes frontend afectados

```
apps/web/src/
├── components/
│   ├── protected-route.tsx          → Ampliar con prop `allowedRoles`
│   └── role-redirect.tsx            → NUEVO: redirige post-login según rol
├── containers/
│   ├── sidebar-container.tsx        → Split en TraderSidebar + AdminSidebar
│   └── dashboard-header-container   → Adaptar título según rol
├── layouts/
│   ├── dashboard-layout.tsx         → Usado por TRADER (sin cambio)
│   └── admin-layout.tsx             → NUEVO: layout para admin con AdminSidebar
├── app/
│   └── app.tsx                      → Reorganizar rutas con guards por rol
└── pages/
    └── admin/
        ├── settings/                → NUEVO: settings del admin (profile, llms)
        └── notifications/           → NUEVO: notificaciones del admin
```

### 2.5 Guards backend

Los endpoints ya existentes de trading **no verifican** que el caller sea TRADER. Hay que agregar:

```
Endpoints que deben requerir @Roles('TRADER'):
  - POST   /trading/start
  - POST   /trading/stop
  - POST   /trading/stop-all
  - POST   /trading/stop-by-mode
  - POST   /trading/config
  - PUT    /trading/config/:id
  - DELETE /trading/config/:id
  - POST   /trading/positions/:id/close
  - POST   /trading/sandbox-wallet/init
  - GET    /trading/positions
  - GET    /trading/status
  - GET    /trading/config
  - POST   /trading/config/auto-name
  - GET    /users/me/agents/*
  - PUT    /users/me/agents/*
  - DELETE /users/me/agents/*
  - POST   /users/me/agents/*

Endpoints que ya tienen @Roles('ADMIN') (verificado, OK):
  - /admin/*
  - /admin/agents/*
  - /admin/agent-configs/*

Endpoints neutros (ambos roles):
  - GET    /users/me (perfil propio)
  - PUT    /users/me (actualizar perfil)
  - POST   /auth/login
  - POST   /auth/register
  - POST   /auth/refresh
  - GET    /market/* (datos de mercado son informativos)
  - GET    /notifications/* (filtrados por userId)
  - POST   /chat/* (el chat es per-user, ambos pueden usarlo)
```

> **Decisión:** El chat se mantiene accesible para admin también, ya que es útil para consultas generales sobre la plataforma. Pero los agentes de trading (Forge, Sigma, Aegis) solo devuelven data relevante si el usuario tiene posiciones/configs.

---

## 3. Modelos de datos

No se requieren cambios en el schema de Prisma. El campo `role` en `User` ya soporta `TRADER` | `ADMIN`.

---

## 4. API endpoints

### 4.1 Cambios en endpoints existentes

No se crean endpoints nuevos. Los cambios son:

| Endpoint                                     | Cambio                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `TradingController` (todos)                  | Agregar `@UseGuards(RolesGuard)` + `@Roles('TRADER')` |
| `AgentConfigController` (users/me/agents/\*) | Agregar `@UseGuards(RolesGuard)` + `@Roles('TRADER')` |
| `AnalysisController` (si existe)             | Agregar `@Roles('TRADER')`                            |

### 4.2 Respuesta de login

El endpoint `POST /auth/login` ya devuelve el `role` en el token JWT y en la respuesta. No hace falta cambio.

---

## 5. Componentes frontend

### 5.1 `ProtectedRoute` — ampliar con roles

```tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('TRADER' | 'ADMIN')[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirigir al home del rol correcto
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} />;
  }
  return <>{children}</>;
}
```

### 5.2 Sidebars separados

- `TraderSidebarContainer` — exactamente el sidebar actual menos la sección Admin
- `AdminSidebarContainer` — grupos: Overview, Gestión (Users, Agents), Settings (Profile, LLMs), Plataforma (Notifications, Help)

### 5.3 `RoleRedirect` — post-login

Componente que detecta el rol y redirige:

- TRADER → `/dashboard`
- ADMIN → `/admin`

Usado en la ruta raíz `/` cuando el usuario ya está autenticado, y post-login.

### 5.4 `AdminLayout` — layout dedicado

Similar a `DashboardLayout` pero usa `AdminSidebarContainer` y no incluye `LLMKeyGuard` (el admin no necesita tener LLM keys configuradas para operar).

---

## 6. Fases de implementación

### Fase A — Backend: Guards por rol en endpoints de trading

1. Agregar `@UseGuards(RolesGuard)` + `@Roles('TRADER')` al `TradingController` (nivel controller).
2. Agregar `@UseGuards(RolesGuard)` + `@Roles('TRADER')` al `AgentConfigController` (nivel controller).
3. Verificar que los endpoints admin ya existentes tengan guards (ya los tienen).
4. Tests: verificar que un ADMIN recibe 403 en endpoints de trading.

### Fase B — Frontend: Separar sidebars y layouts

1. Crear `AdminSidebarContainer` con navegación propia.
2. Crear `AdminDashboardLayout` que use el sidebar admin.
3. Refactorizar `SidebarContainer` actual → `TraderSidebarContainer` (quitar la sección admin condicional).
4. Crear páginas admin faltantes: `AdminSettingsProfilePage`, `AdminSettingsLLMsPage`, `AdminNotificationsPage`.

### Fase C — Frontend: Route guards y redirección por rol

1. Ampliar `ProtectedRoute` con `allowedRoles`.
2. Crear componente `RoleRedirect`.
3. Reorganizar `app.tsx`:
   - `/dashboard/*` envuelto en `<ProtectedRoute allowedRoles={['TRADER']}>`.
   - `/admin/*` envuelto en `<ProtectedRoute allowedRoles={['ADMIN']}>`.
4. Actualizar login redirect: después de login exitoso, redirigir según rol.
5. Actualizar el redirect de `/` para usuarios autenticados.

### Fase D — Testing y limpieza

1. Actualizar tests E2E: los tests de admin no deben acceder a rutas trader y viceversa.
2. Actualizar tests unitarios de sidebar.
3. Verificar i18n: agregar claves para sidebar admin si faltan.
4. Limpiar código muerto (sección condicional `isAdmin` del sidebar original).

---

## 7. Out of scope

- Crear un tercer rol (SUPERADMIN, VIEWER, etc.)
- Permitir que un admin también haga trading (si se necesita, el admin debería tener una cuenta TRADER separada)
- Cambios en el schema de Prisma
- Endpoints API nuevos (solo se agregan guards a los existentes)
- Admin dashboard con métricas de trading de todos los usuarios (feature separada)
- Notificaciones push/email por rol

---

## 8. Decisiones de diseño

| #   | Decisión                                          | Alternativa                                  | Razón                                                                                     |
| --- | ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Sidebars completamente separados (no condicional) | Un sidebar con items filtrados por rol       | Más limpio, más fácil de mantener, cada rol es una experiencia distinta                   |
| 2   | Route guards en frontend + backend                | Solo backend                                 | Defense in depth — el frontend evita la navegación, el backend lo enforce                 |
| 3   | Admin no puede hacer trading                      | Admin hereda todo de trader + panel admin    | Principio de menor privilegio; si necesita tradear, usa otra cuenta                       |
| 4   | Chat accesible para admin                         | Chat solo para traders                       | El chat es útil para consultas de plataforma; los agentes devuelven data según el usuario |
| 5   | No crear endpoints nuevos                         | Crear `/admin/overview` con stats dedicados  | Los stats del admin ya existen en `/admin`; no hace falta duplicar                        |
| 6   | `allowedRoles` como prop de ProtectedRoute        | Crear `AdminRoute` y `TraderRoute` separados | Más flexible; un solo componente reutilizable                                             |
| 7   | Admin tiene su propio layout sin LLMKeyGuard      | Reusar DashboardLayout                       | El admin no configura LLM keys propias, no debería ser bloqueado por el guard             |

---

## 9. Consideraciones de seguridad

### 9.1 Defense in depth

- **Capa 1 (UI):** El sidebar no muestra rutas del otro rol → el usuario no puede navegar.
- **Capa 2 (Router):** `ProtectedRoute` con `allowedRoles` → si el usuario tipea la URL manualmente, es redirigido.
- **Capa 3 (API):** `@Roles('TRADER')` en controllers de trading → si un admin hace un request directo al API, recibe `403 Forbidden`.

### 9.2 Vulnerabilidades que cierra esta spec

| Vulnerabilidad actual                                      | Severidad | Fix                                                                          |
| ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Admin puede llamar `POST /trading/start` y arrancar el bot | Alta      | `@Roles('TRADER')` en TradingController                                      |
| Admin puede crear/modificar TradingConfig vía API          | Alta      | `@Roles('TRADER')` en TradingController                                      |
| Admin puede cerrar posiciones de otros (si tuviera el ID)  | Alta      | `@Roles('TRADER')` + verificación de ownership                               |
| Admin ve sidebar de trading y puede navegar a esas páginas | Media     | Sidebar separado + route guards                                              |
| Un trader puede navegar a `/admin` tipando la URL          | Media     | `ProtectedRoute` con `allowedRoles` (frontend) + guards existentes (backend) |

### 9.3 No rompemos nada existente

- Los endpoints admin ya tienen `@Roles('ADMIN')` — no se tocan.
- El flujo de login no cambia — solo se agrega redirección post-login por rol.
- El modelo `User` no cambia — el campo `role` ya tiene los valores correctos.
