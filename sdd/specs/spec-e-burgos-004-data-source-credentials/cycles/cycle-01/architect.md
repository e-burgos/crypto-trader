# Architect — Cycle 01: Resolución híbrida de credenciales de data sources

> **Spec:** spec-e-burgos-004-data-source-credentials
> **Módulo:** market-data-credentials · **Fecha:** 2026-08-19

## 1. Decisión central: el dueño de la credencial es la unidad de aislamiento

Hoy `DataSourceRegistryService` trata al **nombre de la fuente** como la unidad de todo: caché,
rate limit, circuito y salud. Es correcto para la salud del proveedor —si `coinalyze` está caído,
lo está para todos— y es incorrecto para cupo y datos, que son propiedades de la cuenta con la
que se llama.

Este ciclo separa esas dos naturalezas:

| Estructura | Clave después de este ciclo | Por qué |
| --- | --- | --- |
| `DataSourceCacheService` | `(name, ownerKey)` | El payload pertenece al tenant que lo pagó |
| `RateLimiterService` | `(name, ownerKey)` | La cuota la impone el proveedor por cuenta |
| `CircuitBreakerService` | `(name, ownerKey)` | Un 401 por key inválida de un tenant no debe cortar a los demás |
| `reportSuccess` / `reportError` (salud en BD) | `name` — **sin cambio** | Es la salud del proveedor, no la del tenant |
| `DataSourceMetricsService` | `name` — **sin cambio** | Métrica operativa agregada de la fuente |

`ownerKey` es el `userId` de la credencial resuelta. Para las seis fuentes que no exigen key se
usa la constante `SHARED_PUBLIC_OWNER`: no hay cuota por cliente que separar y mantenerlas en un
único bucket preserva el hit-rate actual del caché.

**Consecuencia buscada (CA-018):** si el admin deja de compartir una credencial, el trader que
dependía de ella deja de resolver `ownerKey = <admin>` y por lo tanto pierde también el acceso a
la entrada de caché de ese dueño. El corte es inmediato y sin residuo, sin necesidad de invalidar
nada explícitamente.

**Costo aceptado:** el hit-rate del caché baja en proporción a la cantidad de dueños distintos.
Es el precio correcto del aislamiento y solo afecta a `coinalyze` y `finnhub`, las dos únicas
fuentes con credencial.

**Migración de entradas vivas:** el caché es in-memory por proceso; al desplegar se pierde y se
repuebla con la clave nueva. No hace falta invalidación explícita.

## 2. `DataSourceCredentialResolver`

Servicio nuevo en `apps/api/src/market/data-source-credential-resolver.service.ts`, provisto por
`MarketModule` y exportado para el consumo desde `UsersModule`.

```ts
export const SHARED_PUBLIC_OWNER = '__public__';

export type CredentialOrigin = 'user' | 'admin-shared';

export interface ResolvedCredential {
  apiKey: string;
  ownerUserId: string;
  origin: CredentialOrigin;
}

resolveForDataSources(
  userId: string,
  dataSourceIds: string[],
): Promise<Map<string, ResolvedCredential>>;   // clave: dataSourceId

resolveForNewsProviders(
  userId: string,
  providers: NewsApiProvider[],
): Promise<Map<NewsApiProvider, ResolvedCredential>>;
```

`CredentialOrigin` es deliberadamente el mismo vocabulario que `ResolutionSource` de
`agents/agent-config-resolver.service.ts:17` (`'user' | 'admin' | ...`), sin reutilizar el tipo:
aquel describe de dónde sale una configuración de agente y este de quién es una credencial. Son
dominios distintos que comparten forma, y acoplarlos obligaría a que un cambio en el wire de
agentes toque credenciales.

**Algoritmo (idéntico en ambos métodos):**

1. Una consulta por las credenciales propias del `userId`, activas, restringidas al conjunto
   pedido.
2. Para los identificadores que quedaron sin resolver, una segunda consulta por credenciales
   activas con `shared: true` **cuyo usuario tenga rol `ADMIN`**, ordenadas por `createdAt` para
   que la elección sea determinista cuando hay más de un admin compartiendo la misma fuente.
3. Lo no resuelto no entra al mapa: el consumidor decide si omite la fuente.

El filtro por rol se hace por join contra `user.role`, no confiando en que solo un admin haya
podido escribir el flag. El endpoint del trader ya fuerza `shared: false`, pero la garantía
de CA-004 debe sostenerse en la lectura y no solo en la escritura.

Dos consultas en lote, nunca una por fuente: el camino corre en cada ciclo de trading de cada bot.

## 3. Consumo en `MarketService`

`buildEnrichedSnapshot` pierde su bloque de resolución y queda con:

```
resolveForDataSources(userId, activeConfigs.map(c => c.id))
  → filtro de omitidas: cfg.requiresApiKey && !resolved.has(cfg.id)
  → fetchFromProvider(cfg.name, apiKey, ownerKey)
```

`ownerKey` es `resolved.get(cfg.id)?.ownerUserId ?? SHARED_PUBLIC_OWNER`.

`buildNewsSources` reemplaza el `findFirst` por proveedor dentro del `Promise.all` por una única
llamada a `resolveForNewsProviders` con los proveedores habilitados.

**Test existente a reescribir:** `market.service.credential-isolation.spec.ts` (regresión del
Bug #1) hoy afirma que `prisma.dataSourceCredential.findMany` se llama con un `where` que
incluye el `userId`. Al mover la consulta al resolver ese assert deja de aplicar. La garantía no
se pierde: se traslada al spec del resolver, que debe afirmar (a) que la consulta de credenciales
propias filtra por `userId`, y (b) que una credencial de otro trader no se resuelve ni siquiera
con `shared: true`. El spec de `market.service` pasa a afirmar que delega en el resolver con el
`userId` recibido.

## 4. Esquema de base de datos

Migración `apps/api/prisma/migrations/20260819120000_add_shared_credential_flag/migration.sql`:

```sql
ALTER TABLE "data_source_credentials" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "news_api_credentials"    ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;
```

Aditiva, con default que preserva el comportamiento actual (CA-016). El timestamp
`20260819120000` es posterior a `20260817160000_add_cost_gate_fields`, la última migración
aplicada en `main`: una migración con timestamp anterior quedaría pendiente fuera de orden en
entornos que ya desplegaron cycle-03 de `spec-e-burgos-001`.

Índice: no se agrega. La consulta de credenciales compartidas filtra por `dataSourceId IN (...)`
y `shared`, sobre una tabla que tiene una fila por usuario y fuente —cardinalidad baja por
construcción— y ya cuenta con el índice del `@@unique([userId, dataSourceId])`.

Ambas tablas se registran por primera vez en `sdd/schema.json`: existen desde el flujo legacy
(Spec 40) y nunca entraron al registro SDD.

## 5. Contrato de API

| ID | Método | Path | Nota |
| --- | --- | --- | --- |
| EP-011 | GET | `/users/me/data-sources` | Listado con estado de credencial por fuente |
| EP-012 | PUT | `/users/me/data-sources/:id/credential` | Upsert de la key propia; fuerza `shared: false` |
| EP-013 | DELETE | `/users/me/data-sources/:id/credential` | Idempotente |
| EP-014 | PUT | `/admin/data-sources/:id/credential` | Pre-existente del flujo legacy; se registra y se extiende con `shared` |

`TraderDataSourceInfo` vive en `libs/shared/src/types/market-data-sources.ts` y expone
`hasOwnCredential` y `hasSharedCredential` como booleanos derivados en el servidor. La pantalla
no infiere el estado: lo recibe. Nunca se expone el `userId` del dueño de la credencial
compartida (CA-014).

El campo `shared` del body de admin debe declararse en el DTO del endpoint: el `ValidationPipe`
global corre con `forbidNonWhitelisted`, así que un campo no declarado hace fallar el request
entero con 400.

## 6. Verificación sin credenciales reales

Todo se prueba contra mocks de la capa HTTP. Los asserts clave son de **identidad de la key**,
no de contenido de la respuesta:

- CA-005 / CA-004: `fetchData` recibe la key propia, y nunca la de otro trader.
- CA-019 / CA-021: dos resoluciones con `ownerKey` distinto adquieren buckets distintos; dos con
  el mismo `ownerKey` comparten bucket. Se verifica sobre `RateLimiterService` directamente,
  agotando el cupo de un dueño y comprobando que el otro sigue adquiriendo.
- CA-020: con el circuito abierto para un dueño, `fetchFromProvider` no devuelve la entrada
  cacheada de otro dueño.
- CA-022: `recordFailure` repetido para un dueño no cambia `canExecute` de otro.

## 7. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La clave compuesta baja el hit-rate del caché | Solo afecta a las 2 fuentes con credencial; las 6 sin key comparten `SHARED_PUBLIC_OWNER` |
| Un admin comparte una key sin querer | El default es `false` y el flag se setea explícitamente por request; ningún dato existente cambia al desplegar |
| Elección no determinista entre varios admins compartiendo la misma fuente | Orden por `createdAt` en la consulta de credenciales compartidas |
| El resolver se convierte en N+1 en el camino caliente | Dos consultas en lote por snapshot, nunca una por fuente |
| Se reintroduce una cascada inline en un ciclo futuro | El spec del resolver es el único lugar con la lógica; el reviewer verifica que `market.service.ts` no consulte `dataSourceCredential` ni `newsApiCredential` directamente |
