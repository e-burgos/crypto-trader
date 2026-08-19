# Spec e-burgos-004 — Resolución híbrida de credenciales de data sources

> **Autor:** e-burgos · **Fecha:** 2026-08-19 · **Estado:** in-progress
> **Módulo:** market-data-credentials
> **Subproyectos:** `apps/api`, `apps/web`, `libs/shared`

## 1. Contexto y diagnóstico

`spec-e-burgos-001` dejó el núcleo de agentes podado, con gestión activa de riesgo y con el
costo LLM por decisión medido y reducido. Su tesis es que **la inteligencia que ya se paga en
análisis debe determinar cuánto se compra, cuándo se vende y cuánto riesgo se acepta**. El
insumo de esa inteligencia es el `EnrichedMarketSnapshot` que arma
`MarketService.buildEnrichedSnapshot()`. Hoy ese insumo se degrada en silencio por un problema
de credenciales, no de análisis.

### Hallazgos

**A. Una fuente sin credencial se apaga para siempre, sin alternativa.**

`buildEnrichedSnapshot` resuelve credenciales con una sola regla: la credencial propia del
trader. Si no la tiene y la fuente la exige, la fuente entra en `failedSources` y su campo
llega `null` al orquestador (`market.service.ts:740-746`). De las 8 fuentes sembradas
(`apps/api/prisma/seed.ts:205-300`) solo dos exigen key — `coinalyze` (DERIVATIVES) y
`finnhub` (NEWS) — pero son justamente las dos que aportan señal no derivable de Binance.
El bot paga el mismo costo de LLM por ciclo con menos contexto en el prompt: empeora la
relación calidad/costo que cycle-03 de `spec-e-burgos-001` acaba de optimizar.

**B. No hay forma de que un trader cargue su propia key.**

`DataSourceCredential` existe desde Spec 40 y está poblada solo por el controller de admin
(`admin/data-sources.controller.ts`, guardado con `@Roles('ADMIN')`). Un trader no-admin no
tiene endpoint ni UI: su fila nunca se crea. En la práctica el sistema es admin-only.
Es la deuda que cycle-03 de `spec-e-burgos-001` dejó anotada en `out_of_scope` como
*"spec de UI dedicada — hoy esos campos solo se configuran por API"*.

**C. El caché y el rate limiter de data sources ignoran de quién es la credencial.**

`DataSourceRegistryService.fetchFromProvider` llavea ambos **solo por nombre de fuente**:

```
this.rateLimiter.tryAcquire(name, config.rateLimitPerMin)   // data-source-registry.service.ts:172
this.cache?.get(name)                                        // data-source-registry.service.ts:167, 211
```

Dos consecuencias medibles:

1. **El headroom del free tier no escala.** Todas las credenciales de una fuente comparten un
   único bucket de rate limit. Sumar traders con key propia no agrega cupo: agrega
   contención → circuit breaker abierto → `payload` stale servido como fallback.
2. **Fuga de aislamiento entre traders.** En los caminos de rate-limit, circuito abierto y
   error de fetch, el registry devuelve `this.cache.get(name)`: un payload traído con la key
   del trader A se le entrega al trader B. No es acceso gratuito —B ya tenía key propia para
   llegar ahí— pero sí es dato de otro tenant y una frescura que nadie pidió.

**D. La cascada `user → admin → fallback` ya es un patrón canónico del repo, y está sin aplicar acá.**

Cycle-01 de `spec-e-burgos-001` unificó la resolución de provider/modelo en un único servicio,
tipando el origen como `ResolutionSource = 'override' | 'user' | 'admin' | 'preset' | 'credential'`
(`agents/agent-config-resolver.service.ts:17`), y borró explícitamente la duplicación que existía
entre `AgentConfigResolverService` y `SubAgentService.getProvider`. Las credenciales de data
sources y de noticias son el mismo problema sin resolver con el mismo patrón.

**E. Hay dos sistemas de credenciales paralelos para el mismo caso de uso.**

`DataSourceCredential` (fuentes enriquecidas) y `NewsApiCredential` (pipeline de noticias) son
tablas distintas con la misma forma y la misma carencia. Finnhub aparece en ambos caminos.
Resolver solo uno deja la mitad del caso de uso abierta.

## 2. Objetivo

Que cualquier trader obtenga el snapshot enriquecido completo sin depender de que un
administrador le cargue credenciales una por una, con un único punto de resolución tipado,
sin que el cupo de un tenant condicione al de otro y sin que el payload de un tenant se sirva
a otro.

## 3. Alcance por ciclo

### Cycle-01 — Resolución híbrida, aislamiento por tenant y self-service

1. Campo `shared` en `DataSourceCredential` y en `NewsApiCredential`: un admin puede marcar su
   credencial como compartida. Solo `@Roles('ADMIN')` puede setearlo; un trader que guarda su
   propia key la escribe siempre con `shared: false`.
2. `DataSourceCredentialResolver` como servicio único, con resultado tipado
   (`owner`, `source: 'user' | 'admin-shared'`, `apiKey`), consumido por
   `buildEnrichedSnapshot` y por `buildNewsSources`. Cero cascada inline: es el invariante que
   cycle-01 de `spec-e-burgos-001` estableció.
3. Prioridad de resolución, idéntica en ambos caminos:
   `credencial propia del trader → credencial de admin con shared:true → fuente omitida`.
   La propia siempre gana; la compartida jamás sobreescribe.
4. Llavear caché y rate limiter de `DataSourceRegistryService` por
   `(nombre de fuente, dueño de la credencial)`: cierra la fuga cross-tenant y hace que la key
   propia rinda cupo propio. El dueño es el `userId` de la credencial resuelta, de modo que
   todos los traders que caen en la key compartida del admin siguen compartiendo un bucket
   —que es el comportamiento correcto, porque comparten la cuota real del proveedor.
5. Self-service para el trader: `GET/PUT/DELETE /users/me/data-sources[/:id/credential]` y la
   página `/dashboard/settings/data-sources`, con badge por fuente
   (*Your key* / *Admin shared* / *No key*) y sin devolver nunca la key en claro.

## 4. Fuera de alcance

- Rotación, expiración o auditoría de uso de credenciales.
- Cuotas o límites por trader sobre la key compartida del admin (el rate limit real del
  proveedor es el único límite en este ciclo).
- `BinanceCredential` y `LLMCredential`: tienen semántica de ejecución y de costo facturable,
  no de enriquecimiento de contexto. Compartir una key de exchange o de LLM es una decisión de
  producto distinta y no se toca acá.
- UI de administración del flag `shared` en el panel de admin: en este ciclo se setea por API
  (`PUT /admin/data-sources/:id/credential`).
- Los 17 campos de `TradingConfig` que cycle-03 de `spec-e-burgos-001` dejó sin UI: siguen
  siendo deuda de una spec de UI propia.

## 5. Criterio de cierre

- Un trader sin ninguna credencial propia, con el admin compartiendo `coinalyze` y `finnhub`,
  recibe `derivatives` y `news` no nulos en su `EnrichedMarketSnapshot`.
- El mismo trader, tras cargar su propia key de `coinalyze`, la usa a él y no toca la del admin.
- Dos traders con keys propias distintas para la misma fuente no comparten entrada de caché ni
  bucket de rate limit.
- `buildEnrichedSnapshot` y `buildNewsSources` no contienen ninguna cascada de credenciales
  inline: ambas delegan en el resolver.

## 6. Dependencias

- `spec-e-burgos-001-agents-simplification` (completed) — `EnrichedMarketSnapshot`, el patrón
  `ResolutionSource` y el gate determinista sobre el que se apoya el criterio de calidad.

## 7. Antecedente

Este trabajo continúa la Spec 43 del flujo legacy (`docs/specs/branches/43-hybrid-data-source-credentials.md`),
implementada en la rama `feature/hybrid-data-source-credentials` antes del arnés `sdd/`. La
implementación previa cubre los puntos 1, 3 y 5 del alcance con la cascada inline; los puntos
2, 4 y la extensión a `NewsApiCredential` son la corrección que este ciclo agrega para alinearla
con los invariantes vigentes.
