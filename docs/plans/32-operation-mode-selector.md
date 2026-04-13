# Plan 32 — Selector Global de Modo de Operación

**Spec:** [32-operation-mode-selector.md](../specs/branches/32-operation-mode-selector.md)  
**Branch:** `feature/32-operation-mode-selector`  
**Prioridad:** 🔴 CRÍTICA  
**Fecha:** 2026-04-13

---

## Estado inicial requerido

Antes de empezar la implementación, verificar:

```bash
# Branch base
git checkout main && git pull
git checkout -b feature/32-operation-mode-selector

# Estado de migraciones aplicadas
pnpm nx run api:prisma-migrate-status

# Verificar que spec 20 (testnet) está implementada
grep -r "useTestnetBinanceKeyStatus" apps/web/src/hooks/use-user.ts
```

---

## Fase A — Backend: modelo + endpoint

**Estimado:** ~2-3 horas  
**Criterio de cierre:** Tests unitarios pasan, endpoint PATCH funciona con validación

### A1 — Migración Prisma

**Archivo:** `apps/api/prisma/schema.prisma`

Agregar en el modelo `User`:

```prisma
platformOperationMode  TradingMode  @default(SANDBOX)
```

Generar y aplicar migración:

```bash
pnpm nx run api:prisma-migrate -- --name add_platform_operation_mode
```

### A2 — DTO de actualización

**Archivo nuevo:** `apps/api/src/users/dto/update-operation-mode.dto.ts`

```typescript
import { IsEnum } from 'class-validator';
import { TradingMode } from '../../../generated/prisma';

export class UpdateOperationModeDto {
  @IsEnum(TradingMode)
  mode: TradingMode;
}
```

### A3 — Servicio: método updateOperationMode

**Archivo:** `apps/api/src/users/users.service.ts`

Agregar método `updateOperationMode(userId: string, mode: TradingMode)`:

- Si `mode === LIVE`: verificar que existe `BinanceCredential` con `userId` y `isTestnet: false` → lanzar `BadRequestException` si no.
- Si `mode === TESTNET`: verificar que existe `BinanceCredential` con `userId` y `isTestnet: true` → lanzar `BadRequestException` si no.
- Si `mode === SANDBOX`: siempre permitido.
- Actualizar `User.platformOperationMode` con el nuevo mode.

Asegurar que `getProfile(userId)` incluye `platformOperationMode` en el objeto retornado.

### A4 — Controlador: endpoint PATCH

**Archivo:** `apps/api/src/users/users.controller.ts`

```typescript
@Patch('me/operation-mode')
@UseGuards(JwtAuthGuard)
async updateOperationMode(
  @CurrentUser() user: User,
  @Body() dto: UpdateOperationModeDto,
) {
  return this.usersService.updateOperationMode(user.id, dto.mode);
}
```

### A5 — Mock actualizado

**Archivo:** `apps/api/src/__mocks__/generated-prisma.ts`

Agregar `platformOperationMode: 'SANDBOX'` en el objeto User mockeado.

### A6 — Tests unitarios

**Archivo:** `apps/api/src/users/users.service.spec.ts` (o nuevo spec file si no existe)

Casos a cubrir:

- `updateOperationMode(userId, SANDBOX)` → siempre ok, actualiza el campo
- `updateOperationMode(userId, LIVE)` cuando no hay keys → BadRequestException
- `updateOperationMode(userId, TESTNET)` cuando no hay keys → BadRequestException
- `updateOperationMode(userId, LIVE)` cuando SÍ hay keys → actualiza ok
- `getProfile(userId)` incluye `platformOperationMode` en la respuesta

### Checkpoints Fase A

```bash
pnpm nx run api:build          # Build sin errores
pnpm nx run api:test           # Tests pasan
pnpm nx run api:prisma-migrate-status  # Migración aplicada
```

---

## Fase B — Frontend: hook + componente ModeSelector

**Estimado:** ~3-4 horas  
**Criterio de cierre:** El ModeSelector aparece y funciona en el DashboardHeader

### B1 — Hooks en use-user.ts

**Archivo:** `apps/web/src/hooks/use-user.ts`

Agregar:

```typescript
// Hook para leer el modo activo del perfil
export function usePlatformMode() {
  const { data: profile, isLoading } = useUserProfile();
  const { data: liveKeyStatus } = useBinanceKeyStatus();
  const { data: testnetKeyStatus } = useTestnetBinanceKeyStatus();

  const mode = profile?.platformOperationMode ?? 'SANDBOX';
  const availableModes: TradingMode[] = ['SANDBOX'];
  if (testnetKeyStatus?.hasKey) availableModes.push('TESTNET');
  if (liveKeyStatus?.hasKey) availableModes.push('LIVE');

  return {
    mode,
    isSandbox: mode === 'SANDBOX',
    isTestnet: mode === 'TESTNET',
    isLive: mode === 'LIVE',
    availableModes,
    isLoading,
  };
}

// Hook para actualizar el modo
export function useUpdatePlatformMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: TradingMode) =>
      api.patch('/users/me/operation-mode', { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });
}
```

### B2 — Componente ModeSelector

**Archivo nuevo:** `apps/web/src/components/mode-selector.tsx`

Comportamiento:

- Badge pill en el header con el modo activo: color ámbar (SANDBOX), naranja (TESTNET), verde con pulse (LIVE)
- Click → dropdown con los 3 modos
- Modos sin keys: texto gris + tooltip "Configura claves en Settings"
- Modos disponibles: clickeables
- Al seleccionar LIVE: mostrar `ConfirmDialog` antes de persistir
- Optimistic update: badge cambia inmediatamente, si falla → rollback + toast error
- Iconos: FlaskConical (SANDBOX), TestTube (TESTNET), Activity (LIVE)

### B3 — Integrar en DashboardHeader

**Archivo:** `apps/web/src/components/dashboard-header.tsx`

Agregar `<ModeSelector />` entre `<ConnectionStatusDropdown />` y el botón de notificaciones:

```tsx
{
  /* Mode selector */
}
<ModeSelector />;

{
  /* Notifications bell */
}
```

### Checkpoints Fase B

```bash
pnpm nx run web:build          # Build sin errores TS
pnpm nx run web:lint           # Sin errores de lint
# Verificación visual: el ModeSelector aparece en el header
```

---

## Fase C — Páginas: consumo del modo global

**Estimado:** ~3-4 horas  
**Criterio de cierre:** Todas las páginas reaccionan al cambio de modo global

### C1 — trade-history.tsx

**Archivo:** `apps/web/src/pages/dashboard/trade-history.tsx`

- Importar `usePlatformMode`
- Inicializar el filtro de modo con `mode` del hook en lugar de hardcode o estado independiente
- Usar `useEffect` para resetear filtro cuando `mode` cambia
- Mantener opción 'ALL' en el selector de filtro

### C2 — positions.tsx

**Archivo:** `apps/web/src/pages/dashboard/positions.tsx`

- Importar `usePlatformMode`
- Inicializar el filtro de modo con `mode`
- Resetear filtro cuando `mode` cambia
- Agregar badge del modo activo en la sección de header de la página

### C3 — agent-log.tsx

**Archivo:** `apps/web/src/pages/dashboard/agent-log.tsx`

- Importar `usePlatformMode`
- Inicializar el filtro de modo con `mode`
- Resetear filtro cuando `mode` cambia

### C4 — config.tsx

**Archivo:** `apps/web/src/pages/dashboard/config.tsx`

- Importar `usePlatformMode`
- Al abrir el formulario de nueva TradingConfig, pre-seleccionar `mode` del modo global activo como valor por defecto del campo `mode` del formulario
- Si el formulario tiene `mode === 'LIVE'` pero el modo global es `SANDBOX`: mostrar warning "Estás creando una configuración LIVE pero el modo global es SANDBOX"

### C5 — bot-analysis.tsx

**Archivo:** `apps/web/src/pages/dashboard/bot-analysis.tsx`

- Importar `usePlatformMode`
- Usar `mode` como filtro inicial por defecto
- Resetear filtro cuando `mode` cambia

### C6 — overview.tsx

**Archivo:** `apps/web/src/pages/dashboard/overview.tsx`

- Importar `usePlatformMode`
- Mostrar badge del modo activo junto al nombre del usuario o en la sección de stats
- El widget de balance usa el hook adecuado según `mode` (SANDBOX → sandboxWallet, TESTNET/LIVE → binanceBalance)

### Checkpoints Fase C

```bash
pnpm nx run web:build
pnpm nx run web:lint
# Verificación manual: cambiar modo en header → páginas reaccionan
```

---

## Fase D — Fallback seguridad + i18n + E2E

**Estimado:** ~2-3 horas  
**Criterio de cierre:** Tests E2E pasan, fallback funciona, i18n completo

### D1 — Fallback en frontend

**Archivo:** `apps/web/src/hooks/use-user.ts`

En `usePlatformMode()`, detectar si el modo almacenado no está en `availableModes`:

```typescript
// Si el modo activo ya no tiene keys, hacer fallback a SANDBOX
useEffect(() => {
  if (!isLoading && mode !== 'SANDBOX' && !availableModes.includes(mode)) {
    updateMode.mutate('SANDBOX');
    toast.warning(t('modeSelector.fallbackNotice', { mode }));
  }
}, [mode, availableModes, isLoading]);
```

### D2 — i18n

**Archivos:** `apps/web/src/locales/es.ts` y `apps/web/src/locales/en.ts`

Agregar bajo la sección `modeSelector`:

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
  noKeysTooltip: 'Configura tus claves API en Ajustes para habilitar este modo.',
  switchConfirmTitle: 'Cambiar a modo {{mode}}',
  switchConfirmDesc: 'Estás a punto de cambiar al modo EN VIVO. Las operaciones afectarán fondos reales en Binance.',
  switchedSuccess: 'Modo cambiado a {{mode}}',
  fallbackNotice: 'Modo {{mode}} no disponible. Cambiado a Sandbox automáticamente.',
}
```

### D3 — Test E2E

**Archivo nuevo:** `e2e/mode-selector.spec.ts`

Escenarios a cubrir:

- Usuario SANDBOX: solo ve modo SANDBOX habilitado, los otros grayed
- Usuario con testnet keys: ve SANDBOX + TESTNET habilitados
- Usuario con live keys: ve todos habilitados
- Cambio de modo: selector cambia → badge del header actualiza → trade-history filtra por nuevo modo
- Cambio a LIVE: dialog de confirmación aparece → confirmar → modo cambia
- Cambio a LIVE: dialog de confirmación → cancelar → modo no cambia

### Checkpoints Fase D

```bash
pnpm nx run web:build
pnpm nx run web:lint
pnpm nx e2e web-e2e --spec=e2e/mode-selector.spec.ts
```

---

## Criterios de aceptación globales

- [ ] `User.platformOperationMode` existe en DB con default SANDBOX
- [ ] `PATCH /users/me/operation-mode` valida disponibilidad del modo (keys requeridas)
- [ ] `GET /users/me/profile` incluye `platformOperationMode`
- [ ] El `ModeSelector` aparece en el DashboardHeader, visible en todas las páginas del dashboard
- [ ] Solo se muestran como activos los modos que el usuario tiene configurados
- [ ] La selección persiste entre sesiones (guardada en DB)
- [ ] Al cambiar el modo, trade-history, positions y agent-log actualizan su filtro por defecto
- [ ] La config de trading pre-selecciona el modo global al crear
- [ ] El cambio a LIVE requiere confirmación explícita
- [ ] El fallback automático a SANDBOX funciona cuando se eliminan keys
- [ ] i18n completo en ES y EN
- [ ] Tests E2E del flujo completo pasan

---

## Cierre de branch

```bash
# Verificación final
pnpm nx run api:build
pnpm nx run api:test
pnpm nx run web:build
pnpm nx run web:lint
pnpm nx e2e web-e2e --spec=e2e/mode-selector.spec.ts

# PR
gh pr create \
  --base main \
  --head feature/32-operation-mode-selector \
  --title "feat(32): selector global de modo de operación (SANDBOX/TESTNET/LIVE)" \
  --body "## Resumen

Implementa el selector global de modo de operación en el DashboardHeader.

## Cambios principales
- Campo \`platformOperationMode\` en modelo User (Prisma)
- Endpoint \`PATCH /users/me/operation-mode\` con validación de keys
- Componente \`ModeSelector\` en DashboardHeader
- Hook \`usePlatformMode()\` consumido por todas las páginas del dashboard
- Filtros de trade-history, positions, agent-log, bot-analysis sincronizados con modo global
- Confirmación obligatoria al cambiar a modo LIVE
- Fallback automático a SANDBOX si keys son eliminadas
- i18n ES + EN completo
- Tests E2E del flujo completo

## Spec
docs/specs/branches/32-operation-mode-selector.md

## Screenshots
[adjuntar screenshots del ModeSelector en acción]"
```
