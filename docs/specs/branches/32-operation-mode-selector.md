# Spec 32 — Selector Global de Modo de Operación

**Branch:** `feature/32-operation-mode-selector`  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** Pendiente  
**Fecha:** 2026-04-13

---

## Resumen ejecutivo

La plataforma mezcla actualmente datos y comportamientos de los tres modos de operación (SANDBOX, TESTNET, LIVE) en las mismas vistas, sin una separación clara de contexto. El usuario no tiene un control centralizado para definir en qué modo está operando globalmente, lo que genera confusión, datos entremezclados y riesgo de ejecutar acciones en el modo incorrecto.

Esta spec introduce un **Selector Global de Modo de Operación** en el `DashboardHeader`, que determina el contexto activo de toda la plataforma. La selección es persistente por usuario en el backend. Solo se muestran los modos que el usuario tiene configurados (con claves API disponibles o modo sandbox siempre disponible). Todas las páginas del dashboard que presentan datos scoped por modo deben respetar y reaccionar a este selector.

---

## Problema actual

1. **Mezcla de datos**: Las páginas de `trade-history`, `positions`, `agent-log` muestran datos de todos los modos mezclados, con filtros secundarios por modo pero sin un contexto global activo.
2. **Sin persistencia**: No existe concepto de "modo de operación activo del usuario" a nivel de sesión/perfil. Cada página decide su propio estado de filtro.
3. **Riesgo operativo**: Un usuario podría creer que está operando en SANDBOX cuando realmente su configuración activa es LIVE.
4. **Onboarding incompleto**: El modo elegido en onboarding se aplica por TradingConfig pero no existe un "modo global de plataforma".

---

## Arquitectura

### Concepto central: `platformOperationMode`

Se introduce un campo `platformOperationMode: TradingMode` en el modelo `User` de Prisma. Este campo representa el modo de visualización y operación activo de la plataforma para ese usuario.

**Reglas de negocio:**

- SANDBOX siempre está disponible (no requiere keys).
- TESTNET solo aparece como opción si el usuario tiene `binanceTestnetKey` configurada.
- LIVE solo aparece si el usuario tiene `binanceKey` (producción) configurada.
- El modo activo se persiste en DB y se devuelve en el perfil del usuario.
- Al cambiar de modo, la UI actualiza todas las páginas afectadas sin navegación.
- Si el modo activo almacenado se vuelve inválido (ej: el usuario borra sus keys de LIVE), el sistema hace fallback a SANDBOX y notifica al usuario.

### Flujo de datos

```
DashboardHeader
  └─ ModeSelector (nuevo componente)
       ├─ Lee: useUserProfile() → platformOperationMode
       ├─ Lee: useBinanceKeyStatus() → hasLiveKeys
       ├─ Lee: useTestnetBinanceKeyStatus() → hasTestnetKeys
       ├─ Calcula: availableModes = ['SANDBOX', + TESTNET si hasTestnetKeys, + LIVE si hasLiveKeys]
       ├─ Muestra: Solo los modos disponibles
       └─ Al cambiar: PATCH /users/me/operation-mode → invalida query de perfil

usePlatformMode() (nuevo hook)
  └─ Lee el platformOperationMode del perfil del usuario
  └─ Consumido por todas las páginas para filtrar/contextualizar datos
```

---

## Modelos de datos

### Prisma — User model

```prisma
model User {
  // ... campos existentes ...
  platformOperationMode  TradingMode  @default(SANDBOX)
}
```

### Nueva migración

```
apps/api/prisma/migrations/YYYYMMDD_HHMMSS_add_platform_operation_mode/migration.sql
```

```sql
ALTER TABLE "User" ADD COLUMN "platformOperationMode" "TradingMode" NOT NULL DEFAULT 'SANDBOX';
```

---

## API Endpoints

### Nuevo endpoint

| Método  | Path                       | Descripción                                                         |
| ------- | -------------------------- | ------------------------------------------------------------------- |
| `PATCH` | `/users/me/operation-mode` | Actualiza el modo de operación activo del usuario                   |
| `GET`   | `/users/me/profile`        | Ya existente — debe incluir `platformOperationMode` en la respuesta |

### DTO `UpdateOperationModeDto`

```typescript
export class UpdateOperationModeDto {
  @IsEnum(TradingMode)
  mode: TradingMode;
}
```

### Validaciones server-side

- Si `mode === 'LIVE'` y el usuario no tiene `binanceKey` → `400 Bad Request` con mensaje `"No Binance production keys configured"`.
- Si `mode === 'TESTNET'` y el usuario no tiene `binanceTestnetKey` → `400 Bad Request` con mensaje `"No Binance testnet keys configured"`.
- Si `mode === 'SANDBOX'` → siempre permitido.

---

## Fases de implementación

### Fase A — Backend: modelo + endpoint

**Archivos comprometidos:**

- `apps/api/prisma/schema.prisma` — agregar `platformOperationMode TradingMode @default(SANDBOX)` al modelo `User`
- `apps/api/prisma/migrations/` — nueva migración SQL
- `apps/api/src/users/dto/update-operation-mode.dto.ts` — nuevo DTO con validación
- `apps/api/src/users/users.service.ts` — método `updateOperationMode(userId, mode)` con validaciones de keys
- `apps/api/src/users/users.controller.ts` — endpoint `PATCH /users/me/operation-mode`
- `apps/api/src/users/users.service.ts` — asegurar que `getProfile()` incluye `platformOperationMode`
- `apps/api/src/__mocks__/generated-prisma.ts` — agregar `platformOperationMode` al mock User

**Criterios Fase A:**

- Migración aplicable y reversible
- El endpoint `PATCH /users/me/operation-mode` valida modos y keys
- El perfil del usuario incluye `platformOperationMode`
- Tests unitarios del servicio con casos: SANDBOX ok, LIVE sin keys → 400, TESTNET sin keys → 400

---

### Fase B — Frontend: hook + componente ModeSelector

**Archivos comprometidos:**

- `apps/web/src/hooks/use-user.ts` — agregar hook `usePlatformMode()` y `useUpdatePlatformMode()`
- `apps/web/src/components/mode-selector.tsx` — nuevo componente selector de modo
- `apps/web/src/components/dashboard-header.tsx` — integrar `<ModeSelector />`

**Detalles del componente `ModeSelector`:**

```tsx
// Comportamiento
- Badge/pill visible en el header con el modo activo: [🟡 SANDBOX] [🟠 TESTNET] [🔴 LIVE]
- Al hacer click: dropdown que SIEMPRE muestra las 3 opciones (SANDBOX, TESTNET, LIVE)
- Modos NO configurados: aparecen visualmente apagados (opacity reducida + ícono de candado)
  → Al hacer click sobre ellos: se abre el modal "CredentialsRequiredModal" (ver abajo)
  → NO se seleccionan como modo activo
- Modos configurados: clickeables y seleccionables normalmente
- Al seleccionar un modo disponible: llama useUpdatePlatformMode() → optimistic update → persiste en backend
- Loading state: badge con spinner mientras persiste
- Error state: rollback al modo anterior + toast de error
- Visual:
  - SANDBOX: badge amarillo/ámbar — ícono FlaskConical
  - TESTNET: badge naranja — ícono TestTube
  - LIVE: badge verde/rojo pulsante — ícono Activity (indica dinero real)
  - No configurado: item con opacity-50 + ícono Lock a la derecha
```

**Modal `CredentialsRequiredModal`:**

```tsx
// Se muestra cuando el usuario toca un modo no configurado
// Props: mode: TradingMode, onClose: () => void

Título: "Modo {{mode}} no configurado"

Contenido según modo:
  - TESTNET: "Para operar en modo Testnet necesitás configurar tus claves API de Binance Testnet.
               Obtenelas gratis en testnet.binance.vision (sin dinero real)."
  - LIVE:     "Para operar en modo En Vivo necesitás configurar tus claves API de Binance.
               ⚠️ Este modo opera con fondos reales."

Botones:
  1. "Cancelar" (ghost/secondary) → cierra el modal
  2. "Agregar Credenciales" (primary) → navega a /dashboard/settings con el tab correcto pre-seleccionado:
       - TESTNET → abre Settings en la sección "Claves Binance Testnet"
       - LIVE    → abre Settings en la sección "Claves Binance"

El modal cierra el dropdown automáticamente al abrirse.
```

**Hook `usePlatformMode()`:**

```typescript
// Retorna:
{
  mode: TradingMode;             // modo activo (del perfil)
  isSandbox: boolean;
  isTestnet: boolean;
  isLive: boolean;
  availableModes: TradingMode[];  // modos con keys configuradas
  isLoading: boolean;
}
```

**Criterios Fase B:**

- El ModeSelector aparece en el DashboardHeader entre la conexión y las notificaciones
- Siempre muestra las 3 opciones (SANDBOX, TESTNET, LIVE) en el dropdown, sin excepción
- Modos no configurados: visualmente apagados (opacity-50 + ícono Lock), no cambian el modo activo al tocarse
- Al tocar un modo no configurado: se abre el modal `CredentialsRequiredModal` (no el dropdown cierra solo)
- El modal muestra descripción contextual del modo y tiene botones "Cancelar" y "Agregar Credenciales"
- "Agregar Credenciales" navega a Settings con el tab correcto pre-seleccionado y cierra el modal
- La selección de un modo disponible persiste correctamente en el backend
- Optimistic update + manejo de error con rollback

---

### Fase C — Páginas: consumo del modo global

Todas las páginas listadas abajo deben importar `usePlatformMode()` y usar `mode` como filtro/contexto inicial por defecto, en lugar de estado local independiente.

**Archivos comprometidos:**

#### `apps/web/src/pages/dashboard/overview.tsx`

- Mostrar badge del modo activo en la sección de stats de resumen
- Widget de balance: mostrar balance correspondiente al modo activo (sandbox wallet / binance testnet / binance live) — ya implementado en spec 20, conectar con modo global

#### `apps/web/src/pages/dashboard/trade-history.tsx`

- Inicializar el filtro de modo con `usePlatformMode().mode` en lugar de 'ALL'
- Cuando el modo global cambia → resetear el filtro al nuevo modo activo
- Mantener la posibilidad de ver 'ALL' como opción adicional

#### `apps/web/src/pages/dashboard/positions.tsx`

- Inicializar el filtro de modo con `usePlatformMode().mode`
- Cuando el modo global cambia → resetear filtro
- Badge de modo activo visible en la cabecera de la página

#### `apps/web/src/pages/dashboard/agent-log.tsx`

- Inicializar el filtro de modo con `usePlatformMode().mode`
- Cuando el modo global cambia → resetear filtro

#### `apps/web/src/pages/dashboard/config.tsx`

- Al crear una nueva TradingConfig: pre-seleccionar el modo global activo como valor por defecto del campo `mode`
- Warning visual si el usuario crea una config LIVE pero el modo global es SANDBOX
- Mostrar badge del modo activo en el header de la página

#### `apps/web/src/pages/dashboard/bot-analysis.tsx`

- Filtrar análisis del bot por modo global por defecto
- Resetear al cambiar modo global

#### `apps/web/src/pages/dashboard/overview.tsx`

- En el widget de "Configuraciones activas": diferenciar por modo activo

**Criterios Fase C:**

- Todas las páginas usan el modo global como filtro inicial
- Al cambiar el modo en el header, las páginas reaccionan inmediatamente (sin navegación)
- La experiencia indica claramente en qué "entorno" se está operando

---

### Fase D — Fallback de seguridad + i18n

**Archivos comprometidos:**

- `apps/api/src/users/users.service.ts` — lógica de fallback: si el modo almacenado ya no es válido (keys eliminadas), hacer fallback a SANDBOX
- `apps/web/src/hooks/use-user.ts` — detectar incoherencia y disparar `useUpdatePlatformMode('SANDBOX')` + toast
- `apps/web/src/locales/es.ts` — claves i18n para labels, tooltips, confirmaciones del ModeSelector
- `apps/web/src/locales/en.ts` — ídem inglés
- `e2e/mode-selector.spec.ts` — tests E2E del flujo completo

**Claves i18n mínimas:**

```typescript
// es.ts
modeSelector: {
  label: 'Modo de operación',
  sandbox: 'Sandbox',
  testnet: 'Testnet',
  live: 'En Vivo',
  sandboxDesc: 'Simulación con fondos virtuales. Sin riesgo real.',
  testnetDesc: 'Órdenes reales en red de prueba de Binance. Sin dinero real.',
  liveDesc: '⚠️ Dinero real. Órdenes reales en Binance.',
  switchConfirmTitle: 'Cambiar a modo En Vivo',
  switchConfirmDesc: 'Estás a punto de cambiar al modo EN VIVO. Las operaciones afectarán fondos reales en Binance.',
  switchedSuccess: 'Modo cambiado a {{mode}}',
  fallbackNotice: 'Modo {{mode}} no disponible. Cambiado a Sandbox automáticamente.',
  // Modal credenciales
  credentialsModalTitle: 'Modo {{mode}} no configurado',
  credentialsModalTestnetDesc: 'Para operar en modo Testnet necesitás configurar tus claves API de Binance Testnet. Obtenelas gratis en testnet.binance.vision (sin dinero real).',
  credentialsModalLiveDesc: 'Para operar en modo En Vivo necesitás configurar tus claves API de Binance. ⚠️ Este modo opera con fondos reales.',
  credentialsModalCancel: 'Cancelar',
  credentialsModalCta: 'Agregar Credenciales',
}
```

---

## Out of Scope

- Cambio de UX del onboarding (ya tiene selección de modo por TradingConfig).
- Refactor de las TradingConfigs para que hereden el modo global automáticamente.
- Implementación del balance widget para LIVE/TESTNET (ya cubierto en Spec 20).
- Restricción de creación de TradingConfigs según el modo global (puede ser una mejora futura).
- Notificaciones push al cambiar de modo.

---

## Decisiones de diseño

| Decisión                                                                  | Alternativa considerada                   | Motivo                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campo `platformOperationMode` en `User` vs estado solo en frontend        | Solo estado frontend (Zustand)            | La persistencia en DB garantiza consistencia entre sesiones y dispositivos. El estado frontend puede derivarse del perfil.                                          |
| Fallback automático a SANDBOX                                             | Bloquear el acceso si el modo es inválido | UX menos disruptiva. El usuario siempre puede operar en Sandbox.                                                                                                    |
| Siempre mostrar los 3 modos; no configurados abren modal de configuración | Ocultar modos no disponibles              | El usuario ve todas sus opciones posibles y entiende qué necesita para habilitarlas. El modal guía la acción directamente hacia Settings en lugar de solo informar. |
| Confirmación dialog para cambio a LIVE                                    | Sin confirmación                          | El modo LIVE involucra dinero real → el usuario debe ser consciente del cambio.                                                                                     |

---

**Depende de:** 20 (Testnet Support), 02 (Auth/Users), 09 (Frontend Dashboard)  
**Siguiente:** Sin asignación aún
