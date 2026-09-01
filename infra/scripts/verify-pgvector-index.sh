#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Verifica que el indice vectorial del RAG exista y este poblado.
# Contrato: FIX-e-burgos-013.
#
# Existe porque el modo de falla es SILENCIOSO: rag.service.ts intenta pgvector
# y cae a coseno en memoria sin avisar, asi que perder la columna otra vez no
# rompe nada visible — solo hace la busqueda lineal en el corpus. Este script es
# lo que convierte esa perdida en algo detectable.
#
# Entradas: COMPOSE_DIR (default /opt/crypto-trader). Corre en el VPS.
# Sale 0 si la columna existe, el indice existe y no hay chunks sin vector.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
COMPOSE_DIR="${COMPOSE_DIR:-/opt/crypto-trader}"
cd "$COMPOSE_DIR" || { echo "FATAL: no existe $COMPOSE_DIR" >&2; exit 1; }

q() { docker compose exec -T postgres psql -U postgres -d crypto_trader -tAc "$1" 2>/dev/null | tr -d '\r'; }

fallos=0
chequear() { # chequear <descripcion> <valor> <esperado>
  if [ "$2" = "$3" ]; then echo "  OK    $1"
  else echo "  FALLA $1 (obtuvo '$2', esperaba '$3')"; fallos=$((fallos+1)); fi
}

echo "── indice vectorial del RAG"

chequear "la extension vector esta instalada" \
  "$(q "SELECT count(*) FROM pg_extension WHERE extname='vector'")" "1"

chequear "existe la columna embedding_vec" \
  "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='agent_document_chunks' AND column_name='embedding_vec'")" "1"

chequear "es vector(1024)" \
  "$(q "SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid='agent_document_chunks'::regclass AND attname='embedding_vec'")" "vector(1024)"

chequear "existe el indice ivfflat" \
  "$(q "SELECT count(*) FROM pg_indexes WHERE tablename='agent_document_chunks' AND indexdef ILIKE '%ivfflat%'")" "1"

# Un chunk con embedding en json pero sin vector es invisible para la busqueda
# nativa: aparece por el fallback y desaparece cuando el fallback se retire.
sin_vector="$(q "SELECT count(*) FROM agent_document_chunks WHERE embedding IS NOT NULL AND embedding_vec IS NULL")"
chequear "no hay chunks con embedding pero sin vector" "${sin_vector:-?}" "0"

total="$(q "SELECT count(*) FROM agent_document_chunks")"
echo "  info  chunks indexados: ${total:-?}"

echo
[ "$fallos" -eq 0 ] && echo "indice vectorial OK" || echo "$fallos problema(s)"
exit "$fallos"
