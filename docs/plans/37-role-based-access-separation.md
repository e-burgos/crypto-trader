# Plan 37 — Separación de acceso por roles (Admin vs Trader)

**Spec:** docs/specs/branches/37-role-based-access-separation.md
**Branch:** feature/role-based-access-separation
**Depende de:** Spec 36 mergeada en main

---

## Estado inicial requerido

```bash
# Verificar que estamos en main actualizado
git checkout main && git pull origin main

# Verificar que el schema tiene roles
grep -n "role" apps/api/prisma/schema.prisma | head -5

# Verificar que RolesGuard existe
cat apps/api/src/auth/guards/roles.guard.ts

# Verificar que el TradingController NO tiene @Roles
grep -n "Roles" apps/api/src/trading/trading.controller.ts

# Crear branch
git checkout -b feature/role-based-access-separation
```

---

## Fase A — Backend: Guards por rol en endpoints de trading

### A.1 — Agregar `@Roles('TRADER')` al TradingController

**Archivo:** `apps/api/src/trading/trading.controller.ts`

- Agregar `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de **controller** (reemplazar `@UseGuards(JwtAuthGuard)` existente).
- Agregar `@Roles('TRADER')` a nivel de **controller**.
- Esto cubre todos los endpoints del controller: `config`, `start`, `stop`, `stop-all`, `positions`, `status`, etc.

```diff
-@UseGuards(JwtAuthGuard)
+@UseGuards(JwtAuthGuard, RolesGuard)
+@Roles('TRADER')
 @Controller('trading')
```

**Importaciones necesarias:**

```typescript
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
```

### A.2 — Agregar `@Roles('TRADER')` al AgentConfigController (user-level)

**Archivo:** `apps/api/src/agents/agent-config.controller.ts`

- El controller de `users/me/agents` debe ser solo para TRADER.
- Agregar `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('TRADER')` a nivel controller.

### A.3 — Verificar otros controllers

Revisar y agregar `@Roles('TRADER')` si aplica:

- `AnalysisController` — si tiene endpoints de trigger manual de análisis.
- Cualquier controller que maneje sandbox wallet, posiciones, o decisiones del agente.

### A.4 — Test manual de guards

```bash
# Build API
pnpm nx build api

# Verificar que no hay errores
pnpm nx test api
```

Verificar con seed data:

- Login como admin → `POST /trading/start` → debe dar **403**.
- Login como trader → `POST /trading/start` → debe funcionar (o dar error de config, no de auth).

### Commit Fase A

```
feat(api): add TRADER role guards to trading and agent-config endpoints — Spec 37
```

---

## Fase B — Frontend: Separar sidebars y layouts

### B.1 — Crear `AdminSidebarContainer`

**Archivo nuevo:** `apps/web/src/containers/admin-sidebar-container.tsx`

Grupos de navegación para admin:

```
Grupo: "Administración"
  - Overview (stats)    → /admin
  - Usuarios            → /admin/users
  - Agentes             → /admin/agents

Grupo: "Configuración"
  - Perfil              → /admin/settings/profile
  - LLM Providers       → /admin/settings/llms

Grupo: "Plataforma"
  - Notificaciones      → /admin/notifications
  - Ayuda               → /help
```

Usar el mismo componente `<Sidebar>` de `@crypto-trader/ui` — solo cambian los `groups`.

### B.2 — Crear `AdminDashboardLayout`

**Archivo nuevo:** `apps/web/src/layouts/admin-dashboard-layout.tsx`

Similar a `DashboardLayout` pero:

- Usa `AdminSidebarContainer` en lugar de `SidebarContainer`.
- **No** incluye `LLMKeyGuard` (el admin no necesita LLM keys).
- Mantiene `DashboardHeader`.

### B.3 — Refactorizar sidebar del trader

**Archivo:** `apps/web/src/containers/sidebar-container.tsx`

- Renombrar a `TraderSidebarContainer` (o mantener nombre y quitar la lógica `isAdmin`).
- Eliminar la sección condicional `...(isAdmin ? [{ id: 'admin', ... }] : [])`.
- El sidebar del trader ya no muestra la opción "Admin".

### B.4 — Crear páginas admin faltantes

**Archivos nuevos:**

- `apps/web/src/pages/admin/settings/profile.tsx` — reutilizar `SettingsProfilePage` o crear wrapper.
- `apps/web/src/pages/admin/settings/llms.tsx` — reutilizar `SettingsLLMsPage` o crear wrapper para config global.
- `apps/web/src/pages/admin/notifications.tsx` — reutilizar `NotificationsPage`.

> Nota: estas páginas pueden ser wrappers simples que reusan los containers existentes. No duplicar lógica.

### B.5 — Agregar claves i18n para sidebar admin

**Archivos:** `apps/web/src/locales/es.ts` y `en.ts`

Agregar claves:

```
sidebar.adminGroupManagement: "Administración" / "Administration"
sidebar.adminOverview: "Vista general" / "Overview"
sidebar.adminUsers: "Usuarios" / "Users"
sidebar.adminAgents: "Agentes" / "Agents"
sidebar.adminGroupConfig: "Configuración" / "Configuration"
sidebar.adminGroupPlatform: "Plataforma" / "Platform"
```

### Commit Fase B

```
feat(web): separate admin and trader sidebars and layouts — Spec 37
```

---

## Fase C — Frontend: Route guards y redirección por rol

### C.1 — Ampliar `ProtectedRoute`

**Archivo:** `apps/web/src/components/protected-route.tsx`

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
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    allowedRoles &&
    user?.role &&
    !allowedRoles.includes(user.role as 'TRADER' | 'ADMIN')
  ) {
    const homeRoute = user.role === 'ADMIN' ? '/admin' : '/dashboard';
    return <Navigate to={homeRoute} replace />;
  }

  return <>{children}</>;
}
```

### C.2 — Crear `RoleRedirect`

**Archivo nuevo:** `apps/web/src/components/role-redirect.tsx`

Redirige usuarios autenticados a su home según rol. Se usa en la ruta `/` para usuarios logueados.

```tsx
export function RoleRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <LandingPage />;
  return (
    <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  );
}
```

### C.3 — Reorganizar rutas en `app.tsx`

**Archivo:** `apps/web/src/app/app.tsx`

Cambios principales:

```tsx
{
  /* Rutas TRADER */
}
<Route
  path="/dashboard"
  element={
    <ProtectedRoute allowedRoles={['TRADER']}>
      <DashboardLayout />
    </ProtectedRoute>
  }
>
  {/* ... todas las rutas de trader ... */}
</Route>;

{
  /* Rutas ADMIN */
}
<Route
  path="/admin"
  element={
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <AdminDashboardLayout />
    </ProtectedRoute>
  }
>
  <Route index element={<AdminStatsPage />} />
  <Route path="users" element={<AdminUsersPage />} />
  <Route path="agents" element={<AdminAgentsPage />} />
  <Route path="settings/profile" element={<AdminSettingsProfilePage />} />
  <Route path="settings/llms" element={<AdminSettingsLLMsPage />} />
  <Route path="notifications" element={<AdminNotificationsPage />} />
</Route>;
```

### C.4 — Actualizar redirect post-login

**Archivo:** `apps/web/src/pages/login.tsx` (o donde se maneje el post-login redirect)

Después de login exitoso:

```tsx
const homeRoute = user.role === 'ADMIN' ? '/admin' : '/dashboard';
navigate(from || homeRoute);
```

### C.5 — Actualizar ruta raíz `/`

Usar `RoleRedirect` para que usuarios autenticados vayan a su home:

```tsx
<Route
  path="/"
  element={
    <PublicLayout>
      <RoleRedirect />
    </PublicLayout>
  }
/>
```

### Commit Fase C

```
feat(web): implement role-based route guards and post-login redirect — Spec 37
```

---

## Fase D — Testing y limpieza

### D.1 — Actualizar tests E2E

**Archivos en `e2e/`:**

- Tests de admin (`admin.spec.ts`, `multi-agent-admin.spec.ts`):
  - Verificar que admin **no** puede acceder a `/dashboard/*`.
  - Verificar redirect a `/admin` post-login.

- Tests de trader (`trading.spec.ts`, `positions.spec.ts`, `dashboard.spec.ts`, etc.):
  - Verificar que trader **no** puede acceder a `/admin`.
  - Verificar redirect a `/dashboard` post-login.

- Agregar test nuevo: `role-access.spec.ts`:
  - Admin navega a `/dashboard` → redirigido a `/admin`.
  - Trader navega a `/admin` → redirigido a `/dashboard`.
  - Admin llama API `/trading/start` → 403.
  - Trader llama API `/admin/stats` → 403.

### D.2 — Limpiar código muerto

- Eliminar la lógica `isAdmin` condicional del sidebar original (ya no necesaria).
- Eliminar `AdminLayout` original (`apps/web/src/pages/admin/index.tsx`) que hacía el guard interno — ahora lo hace `ProtectedRoute`.

### D.3 — Verificar build y tests

```bash
pnpm nx build api
pnpm nx build web
pnpm nx test api
pnpm nx test web
pnpm nx lint api
pnpm nx lint web
```

### Commit Fase D

```
test(e2e): add role-based access tests and cleanup dead code — Spec 37
```

---

## Criterios de aceptación

- [ ] Un ADMIN logueado es redirigido automáticamente a `/admin`.
- [ ] Un TRADER logueado es redirigido automáticamente a `/dashboard`.
- [ ] El sidebar del ADMIN muestra solo: Overview, Usuarios, Agentes, Settings (Profile, LLMs), Notificaciones, Ayuda.
- [ ] El sidebar del TRADER muestra solo: funciones de trading, agente, settings personales, notificaciones, ayuda. **Sin** sección Admin.
- [ ] Si un ADMIN tipea `/dashboard` en el browser, es redirigido a `/admin`.
- [ ] Si un TRADER tipea `/admin` en el browser, es redirigido a `/dashboard`.
- [ ] `POST /trading/start` con token ADMIN devuelve `403 Forbidden`.
- [ ] `POST /trading/config` con token ADMIN devuelve `403 Forbidden`.
- [ ] `GET /admin/stats` con token TRADER devuelve `403 Forbidden` (ya funciona, verificar).
- [ ] El admin no ve `LLMKeyGuard` al entrar a su dashboard.
- [ ] Todos los tests E2E pasan.
- [ ] Build limpio sin errores de lint ni TypeScript.

---

## Cierre de branch

```bash
# Push
git push origin feature/role-based-access-separation

# PR
gh pr create \
  --base main \
  --head feature/role-based-access-separation \
  --title "feat: role-based access separation (Admin vs Trader) — Spec 37" \
  --body "## Spec 37 — Separación de acceso por roles

### Cambios

**Backend:**
- \`@Roles('TRADER')\` en TradingController y AgentConfigController
- Admin ya no puede ejecutar operaciones de trading vía API

**Frontend:**
- Sidebars separados para Admin y Trader
- AdminDashboardLayout dedicado (sin LLMKeyGuard)
- ProtectedRoute ampliado con \`allowedRoles\`
- Redirección post-login según rol
- Route guards: cada rol solo accede a sus rutas

**Testing:**
- Tests E2E de acceso por rol
- Verificación de 403 en endpoints cruzados

### Seguridad
- Defense in depth: UI → Router → API
- Cierra vulnerabilidad: admin podía ejecutar trades
- Principio de menor privilegio aplicado

**Spec:** docs/specs/branches/37-role-based-access-separation.md
**Plan:** docs/plans/37-role-based-access-separation.md"

# Actualizar branch plan
# Agregar fila: | 37 | feature/role-based-access-separation | 37-role-based-access-separation.md | 36 |
```
