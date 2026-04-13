import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface ChunkResult {
  id: string;
  documentId: string;
  agentId: string;
  content: string;
  chunkIndex: number;
  similarity?: number;
}

/**
 * Splits text into overlapping chunks for embedding.
 */
export class ChunkSplitter {
  static split(
    text: string,
    options: { chunkSize?: number; overlap?: number } = {},
  ): string[] {
    const { chunkSize = 512, overlap = 64 } = options;
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      if (end >= text.length) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Searches for relevant document chunks for a given agent and query.
   * Uses pgvector cosine similarity when embedding_vec column is available,
   * otherwise falls back to JSON-stored embeddings via in-memory cosine similarity.
   */
  async search(
    agentId: string,
    query: string,
    limit = 5,
  ): Promise<ChunkResult[]> {
    let queryEmbedding: number[];
    try {
      const vectors = await this.embeddingService.embed([query]);
      queryEmbedding = vectors[0];
    } catch (err) {
      this.logger.warn(
        `Embedding failed for RAG search — skipping: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    try {
      // Attempt pgvector native search (requires embedding_vec column populated)
      const pgvectorResult = await this.prisma.$queryRaw<
        Array<{
          id: string;
          documentId: string;
          agentId: string;
          content: string;
          chunkIndex: number;
          similarity: number;
        }>
      >`
        SELECT
          id,
          "documentId",
          "agentId",
          content,
          "chunkIndex",
          1 - (embedding_vec <=> ${queryEmbedding}::vector) AS similarity
        FROM agent_document_chunks
        WHERE "agentId" = ${agentId}::"AgentId"
          AND embedding_vec IS NOT NULL
          AND 1 - (embedding_vec <=> ${queryEmbedding}::vector) > 0.75
        ORDER BY embedding_vec <=> ${queryEmbedding}::vector
        LIMIT ${limit}
      `;

      if (pgvectorResult.length > 0) {
        return pgvectorResult;
      }
    } catch {
      // pgvector not available — fall through to JSON fallback
    }

    // Fallback: load JSON embeddings and compute cosine similarity in-memory
    const chunks = await this.prisma.agentDocumentChunk.findMany({
      where: { agentId: agentId as any },
      select: {
        id: true,
        documentId: true,
        agentId: true,
        content: true,
        chunkIndex: true,
        embedding: true,
      },
    });

    if (chunks.length === 0) return [];

    const scored = chunks
      .map((chunk) => {
        const vec = chunk.embedding as unknown as number[];
        const sim = cosineSimilarity(queryEmbedding, vec);
        return {
          id: chunk.id,
          documentId: chunk.documentId,
          agentId: chunk.agentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          similarity: sim,
        };
      })
      .filter((c) => c.similarity > 0.75)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  /**
   * Builds a formatted RAG context string to inject into a system prompt.
   */
  buildRagContext(chunks: ChunkResult[]): string {
    if (chunks.length === 0) return '';

    const parts = chunks.map((c, i) => `[Documento ${i + 1}]:\n${c.content}`);

    return `\n\n--- Documentos relevantes de la base de conocimiento ---\n${parts.join('\n\n')}\n--- Fin de documentos ---\n`;
  }
}

// ── Cosine similarity helper ─────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
