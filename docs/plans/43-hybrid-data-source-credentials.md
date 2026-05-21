# Plan 43 — Hybrid Data Source Credentials

**Spec:** docs/specs/branches/43-hybrid-data-source-credentials.md  
**Branch:** feature/hybrid-data-source-credentials  
**Depende de:** Spec 42 mergeada en main (o trabajar desde branch actual si no está mergeada)

---

## Estado inicial requerido

```bash
# 1. Verificar que estamos en branch correcto
git checkout main && git pull origin main
git checkout -b feature/hybrid-data-source-credentials

# 2. Verificar que schema tiene DataSourceCredential
grep -n "DataSourceCredential" apps/api/prisma/schema.prisma

# 3. Verificar builds
pnpm nx build api
pnpm nx build web

# 4. Verificar tests baseline
pnpm nx test api
```

---

## Fase A — Schema + migración + resolución cascada backend

### A.1 — Agregar campo `shared` al schema Prisma

**Archivo:** `apps/api/prisma/schema.prisma`

En el modelo `DataSourceCredential`, agregar:
```prisma
shared Boolean @default(false)   // solo admins pueden setear true
```

### A.2 — Generar migración

```bash
cd apps/api
npx prisma migrate dev --name add-shared-credential-flag
```

### A.3 — Modificar `buildEnrichedSnapshot()` en MarketService

**Archivo:** `apps/api/src/market/market.service.ts`

Cambiar la carga de credentials para implementar resolución en cascada:

```typescript
// 1. Cargar credentials del trader
const traderCreds = await this.prisma.dataSourceCredential.findMany({
  where: {
    userId,
    dataSourceId: { in: activeConfigs.map((c) => c.id) },
    isActive: true,
  },
});

// 2. Identificar fuentes sin key del trader que requieren key
const traderCredMap = new Map(traderCreds.map(c => [c.dataSourceId, c]));
const missingSourceIds = activeConfigs
  .filter(cfg => cfg.requiresApiKey && !traderCredMap.has(cfg.id))
  .map(cfg => cfg.id);

// 3. Buscar shared credentials del admin como fallback
let sharedCreds: typeof traderCreds = [];
if (missingSourceIds.length > 0) {
  sharedCreds = await this.prisma.dataSourceCredential.findMany({
    where: {
      dataSourceId: { in: missingSourceIds },
      shared: true,
      isActive: true,
    },
  });
}

// 4. Construir mapa final: trader > shared > skip
const credentialMap = new Map<string, string>();
for (const cred of [...sharedCreds, ...traderCreds]) {
  // traderCreds va segundo → overwrites shared
  const cfg = activeConfigs.find((c) => c.id === cred.dataSourceId);
  if (cfg) {
    credentialMap.set(cfg.name, decrypt(cred.apiKeyEncrypted, cred.apiKeyIv));
  }
}
```

### A.4 — Modificar admin `PUT credential` para aceptar `shared`

**Archivo:** `apps/api/src/admin/data-sources.controller.ts`

En el endpoint `PUT :id/credential`, agregar `shared?: boolean` al body:
```typescript
@Body() body: { apiKey: string; shared?: boolean }
```

Y en el upsert:
```typescript
create: {
  userId: user.userId,
  dataSourceId: id,
  apiKeyEncrypted: encrypted,
  apiKeyIv: iv,
  shared: body.shared ?? false,
},
update: {
  apiKeyEncrypted: encrypted,
  apiKeyIv: iv,
  shared: body.shared ?? false,
},
```

### A.5 — Tests de resolución en cascada

**Archivo:** `apps/api/src/market/market.service.spec.ts`

Tests nuevos:
- [ ] `should use trader's own credential when available`
- [ ] `should fallback to admin shared credential when trader has none`
- [ ] `should skip source when neither trader nor shared credential exists`
- [ ] `should prefer trader credential over admin shared credential`

### Verificación Fase A

```bash
pnpm nx test api -- --testPathPattern="market.service"
pnpm nx build api
```

---

## Fase B — Endpoints trader + tests

### B.1 — Agregar endpoints en UsersController

**Archivo:** `apps/api/src/users/users.controller.ts`

3 endpoints nuevos:

#### `GET /users/me/data-sources`

```typescript
@Get('me/data-sources')
@ApiOperation({ summary: 'List data sources with credential status' })
async getDataSources(@CurrentUser() user: RequestUser) {
  // 1. Get all active DataSourceConfigs
  // 2. Get trader's own credentials
  // 3. Get admin shared credentials (for "hasSharedCredential" flag)
  // 4. Map to TraderDataSourceInfo[]
}
```

#### `PUT /users/me/data-sources/:id/credential`

```typescript
@Put('me/data-sources/:id/credential')
@ApiOperation({ summary: 'Set API key for a data source' })
async setDataSourceCredential(
  @Param('id') id: string,
  @Body() body: { apiKey: string },
  @CurrentUser() user: RequestUser,
) {
  // 1. Validate source exists and is active
  // 2. Encrypt API key
  // 3. Upsert DataSourceCredential (shared: false always for traders)
}
```

#### `DELETE /users/me/data-sources/:id/credential`

```typescript
@Delete('me/data-sources/:id/credential')
@ApiOperation({ summary: 'Delete API key for a data source' })
async deleteDataSourceCredential(
  @Param('id') id: string,
  @CurrentUser() user: RequestUser,
) {
  // 1. Delete credential if exists
}
```

### B.2 — Agregar tipo compartido `TraderDataSourceInfo`

**Archivo:** `libs/shared/src/types/market-data-sources.ts`

```typescript
export interface TraderDataSourceInfo {
  id: string;
  name: string;
  displayName: string;
  category: DataSourceCategoryType;
  isActive: boolean;
  requiresApiKey: boolean;
  monthlyCostUsd: number;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  hasOwnCredential: boolean;
  hasSharedCredential: boolean;
}
```

### B.3 — Tests de endpoints

**Archivo:** `apps/api/src/users/users.controller.spec.ts`

Tests:
- [ ] `GET /users/me/data-sources` retorna lista con flags correctos
- [ ] `PUT /users/me/data-sources/:id/credential` guarda key cifrada
- [ ] `PUT /users/me/data-sources/:id/credential` rechaza si source no existe
- [ ] `DELETE /users/me/data-sources/:id/credential` elimina key
- [ ] `DELETE /users/me/data-sources/:id/credential` retorna ok si no existía

### Verificación Fase B

```bash
pnpm nx test api -- --testPathPattern="users.controller"
pnpm nx build api
```

---

## Fase C — Frontend: página + hooks + componentes

### C.1 — Crear hooks

**Archivo:** `apps/web/src/hooks/use-trader-data-sources.ts`

```typescript
export function useTraderDataSources()     // GET /users/me/data-sources
export function useSetTraderCredential()   // PUT /users/me/data-sources/:id/credential
export function useDeleteTraderCredential() // DELETE /users/me/data-sources/:id/credential
```

### C.2 — Crear `TraderDataSourceCard`

**Archivo:** `apps/web/src/components/settings/trader-data-source-card.tsx`

Card simplificada respecto al admin:
- Sin toggle de activación
- Muestra nombre + health badge
- Badge de credential status: "Your key ✓" / "Admin shared" / "Key required" / "Free"
- Botones: "Set Key" / "Remove Key"

### C.3 — Adaptar `ApiKeyModal` para trader

Reutilizar el `ApiKeyModal` existente pero parametrizar la mutation. Opciones:
- A) Pasar la mutation function como prop
- B) Crear un wrapper `TraderApiKeyModal` que use `useSetTraderCredential`

Elegir opción B para mantener separación de concerns.

### C.4 — Crear `SettingsDataSourcesPage`

**Archivo:** `apps/web/src/pages/dashboard/settings/data-sources.tsx`

Layout:
- Header: Database icon + "Data Sources" + subtitle
- Summary badges: total activas, con key propia, admin shared
- Categorías agrupadas (mismo patrón que admin)
- `TraderDataSourceCard` por fuente
- `TraderApiKeyModal` al clickear "Set Key"

### C.5 — Registrar ruta

**Archivo:** `apps/web/src/app/app.tsx`

Agregar:
```tsx
<Route path="/dashboard/settings/data-sources" element={<SettingsDataSourcesPage />} />
```

### C.6 — Agregar link en settings navigation

Buscar donde está el menú/sidebar de settings y agregar "Data Sources" con icono Database.

### C.7 — Exportar página en index

**Archivo:** `apps/web/src/pages/dashboard/settings/index.ts`

### Verificación Fase C

```bash
pnpm nx build web
# Verificación visual manual (opcional)
```

---

## Criterios de aceptación

- [ ] Admin puede marcar una credential como `shared: true` al guardar key
- [ ] `buildEnrichedSnapshot()` usa key del trader si existe, fallback a shared del admin, skip si ninguna
- [ ] Trader puede ver lista de fuentes activas en `/dashboard/settings/data-sources`
- [ ] Trader puede poner/eliminar su propia API key para cualquier fuente
- [ ] Badge indica correctamente: "Your key" / "Admin shared" / "Key required" / "Free"
- [ ] Si trader tiene key propia Y admin tiene shared, se usa la del trader
- [ ] Build de api y web pasan sin errores
- [ ] Tests de market.service cubren los 4 escenarios de resolución

---

## Cierre de branch

```bash
# Push
git push origin feature/hybrid-data-source-credentials

# PR
gh pr create \
  --base main \
  --head feature/hybrid-data-source-credentials \
  --title "feat: hybrid data source credentials — Spec 43" \
  --body "## Spec 43 — Hybrid Data Source Credentials

### Resumen
Modelo híbrido de credenciales: admin comparte keys (shared flag), traders pueden poner las suyas propias con prioridad.

### Cambios
- **Schema**: campo \`shared\` en \`DataSourceCredential\`
- **Backend**: resolución cascada en \`buildEnrichedSnapshot\` (trader → admin shared → skip)
- **Backend**: 3 endpoints trader: GET/PUT/DELETE \`/users/me/data-sources\`
- **Frontend**: nueva página Settings > Data Sources para traders
- **Frontend**: \`TraderDataSourceCard\` + \`TraderApiKeyModal\` + hooks

### Tests
- Market service: 4 escenarios de resolución cascada
- Users controller: 5 tests de endpoints trader

### Spec
docs/specs/branches/43-hybrid-data-source-credentials.md"
```
