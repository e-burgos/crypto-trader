# Spec 43 — Hybrid Data Source Credentials

**Fecha:** 2025-05-12  
**Versión:** 1.0  
**Estado:** Propuesto  
**Branch:** `feature/hybrid-data-source-credentials`  
**Dependencias:** Spec 40 (Market Data Sources Integration), Spec 42 (Agent Profit Optimizer — credential isolation fix)

---

## 1. Resumen ejecutivo

Implementar un modelo híbrido de credenciales para data sources donde:

1. **El admin puede compartir credenciales** — marcando una credential como `shared: true`. Cuando un trader no tiene su propia key para una fuente, el sistema busca una key compartida del admin como fallback.
2. **El trader puede poner sus propias keys** — a través de una nueva página `/dashboard/settings/data-sources` con UI similar al admin. Las keys propias del trader **siempre tienen prioridad** sobre las compartidas por el admin.
3. **Sin key propia ni compartida** → la fuente se salta (comportamiento actual).

### Prioridad de resolución de credenciales

```
1. Trader tiene su propia key → USAR
2. Admin compartió una key (shared: true) → USAR como fallback
3. Ninguna → SKIP fuente
```

---

## 2. Arquitectura / Diseño

### Cambios en el backend

- **Prisma schema**: Agregar campo `shared: Boolean @default(false)` al modelo `DataSourceCredential`.
- **Market Service**: Modificar `buildEnrichedSnapshot()` para implementar la resolución en cascada (trader key → admin shared key → skip).
- **Users Controller**: Nuevos endpoints para que traders gestionen sus propias data source credentials (set, delete, list).
- **Admin Controller**: Nuevo campo `shared` en el endpoint `PUT /admin/data-sources/:id/credential`, permitiendo marcar keys como compartidas.

### Cambios en el frontend

- **Nueva página**: `SettingsDataSourcesPage` en `/dashboard/settings/data-sources` con:
  - Lista de fuentes activas del sistema agrupadas por categoría
  - Indicador de si el admin comparte una key (sin revelar la key)
  - Modal para que el trader ponga/elimine su propia API key
  - Badge visual: "Admin shared" / "Your key" / "No key"

---

## 3. Modelos de datos

### 3.1 Cambio en `DataSourceCredential`

```prisma
model DataSourceCredential {
  id              String   @id @default(cuid())
  userId          String
  dataSourceId    String
  apiKeyEncrypted String
  apiKeyIv        String
  isActive        Boolean  @default(true)
  shared          Boolean  @default(false)   // ← NUEVO
  createdAt       DateTime @default(now())

  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  dataSource DataSourceConfig @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@unique([userId, dataSourceId])
  @@map("data_source_credentials")
}
```

**Regla de negocio**: Solo usuarios con rol `ADMIN` pueden setear `shared: true`. El campo se ignora para credentials de traders.

### 3.2 Nuevo tipo compartido

```typescript
// libs/shared — trader-facing data source info
export interface TraderDataSourceInfo {
  id: string;                    // DataSourceConfig.id
  name: string;                  // internal name
  displayName: string;           // human-friendly name
  category: DataSourceCategoryType;
  isActive: boolean;             // source active in platform
  requiresApiKey: boolean;
  monthlyCostUsd: number;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  hasOwnCredential: boolean;     // trader has their own key
  hasSharedCredential: boolean;  // admin shared a key for this source
}
```

---

## 4. API Endpoints

### 4.1 Trader endpoints (nuevo)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/users/me/data-sources` | Lista fuentes activas con status de credentials del trader |
| `PUT` | `/users/me/data-sources/:id/credential` | Upsert API key para una fuente |
| `DELETE` | `/users/me/data-sources/:id/credential` | Eliminar API key propia del trader |

#### `GET /users/me/data-sources`

**Response:**
```json
{
  "sources": [
    {
      "id": "cuid",
      "name": "finnhub",
      "displayName": "Finnhub — News & Sentiment",
      "category": "NEWS",
      "isActive": true,
      "requiresApiKey": true,
      "monthlyCostUsd": 0,
      "health": "healthy",
      "hasOwnCredential": false,
      "hasSharedCredential": true
    }
  ]
}
```

#### `PUT /users/me/data-sources/:id/credential`

**Request:** `{ "apiKey": "sk-..." }`  
**Response:** `{ "success": true, "maskedKey": "***abcd" }`

#### `DELETE /users/me/data-sources/:id/credential`

**Response:** `{ "success": true }`

### 4.2 Cambio en admin endpoint

`PUT /admin/data-sources/:id/credential` — agregar campo opcional `shared`:

**Request:** `{ "apiKey": "sk-...", "shared": true }`

---

## 5. Componentes frontend

### 5.1 Nueva página: `SettingsDataSourcesPage`

**Ruta:** `/dashboard/settings/data-sources`  
**Archivo:** `apps/web/src/pages/dashboard/settings/data-sources.tsx`

**Layout:**
- Header: icono Database + "Data Sources" + subtítulo
- Summary bar: X fuentes activas, X con key propia, X compartidas por admin
- Fuentes agrupadas por categoría (mismas categorías que admin)
- Card por fuente con:
  - Nombre + health badge
  - Badge de credential: "Your key ✓" (verde) / "Admin shared" (azul) / "Key required" (amarillo) / "Free" (gris)
  - Botón para configurar/eliminar key (abre modal)
  - Info de costo mensual

### 5.2 Reutilización del `ApiKeyModal`

Reutilizar el componente `ApiKeyModal` existente de admin, parametrizando la mutation (admin usa `/admin/data-sources/:id/credential`, trader usa `/users/me/data-sources/:id/credential`).

### 5.3 Nuevo componente: `TraderDataSourceCard`

Similar al `DataSourceCard` del admin pero sin toggle de activación (solo admin puede activar/desactivar fuentes). Muestra credential status y permite set/delete de keys.

### 5.4 Hooks

**Archivo:** `apps/web/src/hooks/use-trader-data-sources.ts`

- `useTraderDataSources()` — `GET /users/me/data-sources`
- `useSetTraderCredential()` — `PUT /users/me/data-sources/:id/credential`
- `useDeleteTraderCredential()` — `DELETE /users/me/data-sources/:id/credential`

---

## 6. Fases de implementación

### Fase A — Schema + migración + resolución cascada backend

1. Agregar `shared Boolean @default(false)` al modelo `DataSourceCredential`
2. Crear migración Prisma
3. Modificar `buildEnrichedSnapshot()` en MarketService para resolución en cascada
4. Modificar admin `PUT credential` para aceptar `shared` flag
5. Tests unitarios de la resolución en cascada

### Fase B — Endpoints trader + tests

1. Agregar endpoints en `UsersController`: GET, PUT, DELETE para data source credentials
2. Tests unitarios de los 3 endpoints
3. Validaciones: fuente debe existir y estar activa, key no vacía

### Fase C — Frontend: página + hooks + componentes

1. Crear hooks `use-trader-data-sources.ts`
2. Crear `TraderDataSourceCard` component
3. Crear `SettingsDataSourcesPage`
4. Registrar ruta en router
5. Agregar link en el sidebar/menú de settings
6. Reutilizar/adaptar `ApiKeyModal` para trader

---

## 7. Out of scope

- Dashboard de métricas de uso por data source (es admin-only, Spec 40)
- Health checks ejecutados por traders (admin-only)
- Toggle de activar/desactivar fuentes por trader (admin-only)
- Configuración de priority/rate limits por trader
- Notificaciones cuando admin comparte/revoca una key

---

## 8. Decisiones de diseño

| # | Decisión | Alternativa | Razón |
|---|----------|-------------|-------|
| 1 | Campo `shared` en `DataSourceCredential` | Tabla separada `SharedCredential` | Menor complejidad, un solo query con OR para resolver |
| 2 | Resolución cascada en `buildEnrichedSnapshot` | Resolver en un service dedicado | El método ya maneja la carga de credentials, agregar fallback es natural |
| 3 | Trader NO puede toggle fuentes | Cada trader elige qué fuentes usar | Simplifica el modelo — admin controla qué está disponible, trader solo pone keys |
| 4 | Admin shared key visible como boolean, no como key | Mostrar key enmascarada del admin | Seguridad — trader solo sabe que "hay una key compartida disponible" |
| 5 | Reutilizar `ApiKeyModal` | Crear modal nuevo para trader | Mismo UX, solo cambia el endpoint de la mutation |
