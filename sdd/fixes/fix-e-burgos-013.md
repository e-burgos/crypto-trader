# FIX-e-burgos-013 — El índice vectorial del RAG no existe

> Tipo: BUGFIX · Severidad: media · Autor: e-burgos · Creado: 2026-09-01
> Descubierto probando el pipeline de embeddings en producción (spec-e-burgos-008 cycle-02).

## Problema

La búsqueda semántica del RAG **no usa pgvector**: corre por coseno **en memoria**, cargando todos
los chunks en cada consulta.

Verificado contra la base de producción, no deducido:

```
information_schema.columns  →  embedding :: jsonb        (no hay embedding_vec)
pg_indexes                  →  pkey, agentId_idx, documentId_idx   (ningún índice vectorial)
pg_extension                →  vector                    (instalada, y sin usar)
```

### Cómo llegó a estar así

1. `20260413130000_add_agent_definitions_rag` creó **por SQL crudo** la columna
   `embedding_vec vector(1024)` y su índice `ivfflat`.
2. `20260413184109_add_platform_operation_mode` **las borró a las dos**. Su propia cabecera lo
   declara: *"You are about to drop the column `embedding_vec` … All the data in the column will be
   lost"*, y su cuerpo hace `DROP INDEX` + `ALTER TABLE … DROP COLUMN`.

Fue **daño colateral de una migración autogenerada**. Prisma no conocía esa columna —la creó SQL
crudo y no estaba en `schema.prisma`— así que al calcular el diff contra el esquema la vio como
sobrante y la eliminó. El nombre de la migración no menciona embeddings, y por eso nadie la asoció.

### Por qué no se detectó

`rag.service.ts` **intenta pgvector y cae al camino en memoria sin avisar**, así que el sistema
siguió funcionando. Y el comentario del modelo Prisma sigue afirmando lo contrario:

```prisma
/// Float[] stored as JSON — pgvector column added via raw migration
```

Ese comentario es la razón por la que la lectura del código confirmaba una premisa falsa.

## Justificación del bypass

FIX GATE y no ciclo SDD: **3 archivos**, sin endpoints nuevos, sin entidades nuevas, y
`agent_document_chunks` **no está registrada en `sdd/schema.json`**.

No espera un ciclo porque el costo de la consulta crece linealmente con el corpus, y **el momento
barato de arreglarlo es ahora**: hay 2 chunks, así que el backfill es trivial y no hay nada
significativo que re-embeber. Con un corpus real, restaurar la columna implicaría una ventana de
re-indexado.

## Solución aplicada

1. **Migración** que restaura `embedding_vec vector(1024)`, hace backfill desde el `jsonb` existente
   y recrea el índice `ivfflat`.
2. **`schema.prisma` declara la columna** como `Unsupported("vector(1024)")?`. Es la parte que
   impide que vuelva a pasar: mientras Prisma no sepa que la columna existe, **cualquier migración
   autogenerada futura la va a borrar otra vez**. Arreglar solo la migración sería arreglar el
   síntoma.
3. **Se corrige el comentario del modelo**, que afirmaba que la columna existía.
4. **Script de verificación** que comprueba columna, índice y que los vectores estén poblados.

## Archivos modificados

- `apps/api/prisma/migrations/20260901180000_restore_pgvector_column/migration.sql`
- `apps/api/prisma/schema.prisma`
- `infra/scripts/verify-pgvector-index.sh`

## Test de validación

Verificado **contra la base de producción**, no en local.

**Antes:** `information_schema` devolvía solo `embedding :: jsonb` y `pg_indexes` no listaba ningún
índice vectorial.

**Después:** `verify-pgvector-index.sh` pasa sus 5 chequeos — extensión instalada, columna presente,
tipo exacto `vector(1024)`, índice `ivfflat` existente y cero chunks con embedding pero sin vector.

Con 2 chunks reales indexados vía OpenRouter:

```
chunkIndex | dims | norma  →  0 | 1024 | 1.0001
                              1 | 1024 | 1.0001
SELECT 1 - (a.embedding_vec <=> b.embedding_vec)  →  0.4720
```

Ese `0.4720` es lo que prueba el fix: el operador nativo de pgvector opera sobre **datos reales**,
no sobre `NULL`s. El backfill pobló las 2 filas preexistentes desde el `jsonb`.

El verificador vuelve a pasar con la tabla vacía tras limpiar el documento de prueba, y
`prisma generate` sigue funcionando con la columna `Unsupported`.

## Decisión del Reviewer

> Validado el 2026-09-04 en la limpieza de deuda de proceso post-cierre de ciclos (los ciclos que debían validarlo ya estaban cerrados).
>
> - [x] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
>
> **Evidencia.** Fix mergeado en `main` (36a89c135). Suite de `apps/api` en verde sobre ese commit: 101 suites, 930 tests.
> Referencia de test declarada al resolverlo: Verificado contra la base de produccion, no en local. Antes del fix: information_schema devolvia solo 'embedding :: jsonb' y pg_indexes no listaba ningun indice vectorial. Despues: verify-pgvector-index.sh pasa sus 5 che…
