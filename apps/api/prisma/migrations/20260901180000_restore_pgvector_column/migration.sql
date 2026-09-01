-- FIX-e-burgos-013 — Restaura la columna y el indice vectorial del RAG.
--
-- La migracion 20260413130000 los creo por SQL crudo y la 20260413184109 los
-- borro como dano colateral de un diff autogenerado: Prisma no conocia la
-- columna porque no estaba en schema.prisma. Desde entonces la busqueda
-- semantica cae a coseno en memoria sobre el jsonb, sin avisar.
--
-- Lo que evita que vuelva a pasar NO esta en este archivo, sino en
-- schema.prisma, que ahora declara la columna como Unsupported("vector(1024)").
-- Sin eso, la proxima migracion autogenerada la borra de nuevo.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "agent_document_chunks"
  ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);

-- Backfill desde el jsonb que se venia usando. Solo las filas cuyo array mide
-- exactamente 1024: una de otro largo no entra en la columna y abortaria la
-- migracion entera. Las que no califiquen quedan en NULL y las detecta el
-- script de verificacion — es preferible una fila sin indexar que una migracion
-- que no aplica.
UPDATE "agent_document_chunks"
   SET "embedding_vec" = ("embedding"::text)::vector
 WHERE "embedding_vec" IS NULL
   AND jsonb_typeof("embedding") = 'array'
   AND jsonb_array_length("embedding") = 1024;

-- ivfflat necesita filas para entrenar sus listas: con la tabla vacia el indice
-- se crea igual pero degrada a scan secuencial hasta el primer REINDEX. Con
-- lists=100 el criterio habitual es ~sqrt(filas); se conserva el valor original
-- de la migracion que lo creo.
CREATE INDEX IF NOT EXISTS "agent_document_chunks_embedding_vec_idx"
  ON "agent_document_chunks" USING ivfflat ("embedding_vec" vector_cosine_ops)
  WITH (lists = 100);
