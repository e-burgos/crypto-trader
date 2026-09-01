# spec-e-burgos-008 cycle-02 — 2026-09-01

## Estado

**La API está en producción** en `https://trader.estebanburgos.com.ar/api`, detrás de nginx en el
VPS. Dos defectos críticos que llevaban meses en el árbol se cerraron por FIX GATE, y los dos los
destapó **ejecutar**, no leer código.

## Estructura

### `src/app/` — el health check pasa a verificar de verdad

`HealthService` consulta Postgres con `SELECT 1` y hace `PING` a Redis; el controller responde
**503** cuando alguna está caída. Antes devolvía `{status:'ok'}` fijo sin mirar nada.

- **Timeout de 2 s por sonda**: una dependencia colgada no puede colgar el chequeo, o un
  orquestador esperando respuesta nunca reinicia el contenedor.
- **Conexión ioredis dedicada**, no una cola de Bull prestada: registrar una cola acá sumaría una
  tercera `Bull.Queue` para `trading-agent`, que es la deuda que `spec-005` ya dejó anotada.
- `lazyConnect` para que un Redis caído no bloquee el arranque — el chequeo lo reporta.

### `prisma/seed.ts` — un único ADMIN desde el entorno

`seedSuperAdmin()` provisiona **un** usuario `ADMIN` desde `ADMIN_USERNAME`/`ADMIN_PASSWORD` y
**converge en cada corrida**: rotar la contraseña es cambiar el secret y redesplegar, mismo contrato
que el rol de aplicación en `00-init.sql`.

- **Fail-closed en producción**: sin esas variables lanza, y como el `CMD` del Dockerfile corre
  `db seed` antes de arrancar, **el contenedor no levanta**. Una API en producción sin forma de
  entrar no es un servicio degradado.
- Otros usuarios `ADMIN` se **reportan con warning pero no se borran**: un seed que borra usuarios
  termina borrando al equivocado.
- No existe rol `SUPERADMIN` en el esquema: `UserRole` es `TRADER | ADMIN` y "superadmin" es el
  único con rol `ADMIN`.

### `src/orchestrator/` — dos correcciones que cambian invariantes

**El gate de riesgo ya no falla abierto (FIX-e-burgos-014).** `aegis-verdict.schema.ts` declaraba
`verdict` con `.catch('PASS')` y `positionSizeMultiplier` con `.catch(1)`: una respuesta ilegible
salía como **PASS a tamaño completo**. Ahora un veredicto que no se pudo parsear es `BLOCK` con
multiplicador `0` y alerta `AEGIS_UNPARSEABLE`.

> Los `.catch()` **por campo se conservan** —degradar un payload *parcial* era correcto—; lo que
> cambió es que un payload **vacío** ya no se confunde con una autorización. `isAegisUnavailable()`
> distingue *"AEGIS dijo PASS"* de *"AEGIS no dijo nada"*.

**Los embeddings pasan a OpenRouter con proveedor explícito.** `EmbeddingService` ya **no cae solo**
de un proveedor a otro: vectores de modelos distintos viven en espacios distintos y una similitud
coseno entre ellos no significa nada. Cambiar `EMBEDDING_PROVIDER` o `EMBEDDING_MODEL` **obliga a
re-embeber todo lo guardado**, y el código lo dice.

- `assertShape()` es **la única defensa** de la dimensión: la columna `embedding` es `jsonb` y acepta
  cualquier largo en silencio.

### Datos

`FIX-e-burgos-013` restauró `agent_document_chunks.embedding_vec vector(1024)` y su índice
`ivfflat`, que la migración `20260413184109` había borrado como daño colateral de un diff
autogenerado. **Lo que impide la recaída no está en la migración** sino en `schema.prisma`, que ahora
declara la columna como `Unsupported("vector(1024)")`: mientras Prisma no sepa que existe, cualquier
diff futuro la borra otra vez.

## Dependencias

`OPEN_ROUTER_API_KEY` pasa a ser **variable de entorno** además de vivir cifrada en
`llm_credentials`. No es duplicación por descuido: los embeddings son **infraestructura de
plataforma** y la credencial de la base es la del **chat de agentes**. Si los embeddings dependieran
de la credencial de cada usuario, los documentos se indexarían con modelos distintos según quién los
suba y el índice quedaría incomparable consigo mismo.

## Qué sigue

- **`auth.service.spec.ts` es flaky bajo carga paralela.** Aislado pasa 9/9 en ~5 s; en la suite
  completa llega a 20-29 s y a veces supera el timeout. `bcrypt` con 12 rondas compite por CPU con
  las otras 86 suites. Merece su propio fix.
- **Las 8 fuentes de datos están activas pero sin credenciales**: `altfins` devuelve 401 en cada
  ciclo. Las claves se cargan por el panel de admin, no por env.
- **Los modelos con razonamiento obligatorio no sirven para JSON estructurado con presupuesto
  acotado.** `minimax-m2.7` responde 400 al intentar apagarlo y hay que pagarle el pensamiento;
  conviene revisarlo en Agent Models.
- **No hay observabilidad.** Con claves LIVE conectadas, un backup que no sube o un ciclo que falla
  no avisan a nadie.
