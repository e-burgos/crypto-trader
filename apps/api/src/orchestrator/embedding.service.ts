import { Injectable, Logger } from '@nestjs/common';

/**
 * Generates vector embeddings for the RAG pipeline.
 *
 * The provider is chosen EXPLICITLY and never falls back on its own. Vectors
 * produced by different models live in different vector spaces: a cosine
 * similarity between a Voyage vector and an OpenAI one is meaningless even when
 * both have the same length. A silent fallback would keep indexing documents
 * while quietly making them incomparable with everything already stored, and
 * retrieval would degrade with nothing in the logs to explain it.
 *
 * Switching provider or model therefore means RE-EMBEDDING every stored chunk.
 *
 * Config via environment variables:
 *  EMBEDDING_PROVIDER   — 'openrouter' (default) | 'voyage' | 'openai'
 *  EMBEDDING_MODEL      — overrides the provider's default model
 *  OPEN_ROUTER_API_KEY  — required for 'openrouter'
 *  VOYAGE_API_KEY       — required for 'voyage'
 *  OPENAI_API_KEY / OPENAI_PLATFORM_KEY — required for 'openai'
 */

export type EmbeddingProvider = 'openrouter' | 'voyage' | 'openai';

/**
 * Fixed by the schema: agent_document_chunks.embedding_vec is vector(1024).
 * Any provider used here must produce exactly this many dimensions, or the
 * insert fails — which is the loud failure we want instead of a silent one.
 */
export const EMBEDDING_DIMENSIONS = 1024;

const DEFAULT_MODELS: Record<EmbeddingProvider, string> = {
  // text-embedding-3-* are Matryoshka models: the `dimensions` parameter
  // truncates them natively, so 1024 is a first-class output rather than a
  // client-side crop. Verified through OpenRouter, which passes the parameter.
  openrouter: 'openai/text-embedding-3-small',
  voyage: 'voyage-3',
  openai: 'text-embedding-3-small',
};

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  get provider(): EmbeddingProvider {
    const raw = (process.env['EMBEDDING_PROVIDER'] ?? 'openrouter').trim();
    if (raw === 'openrouter' || raw === 'voyage' || raw === 'openai') {
      return raw;
    }
    throw new Error(
      `EMBEDDING_PROVIDER='${raw}' is not a known provider. Use openrouter, voyage or openai.`,
    );
  }

  get model(): string {
    return process.env['EMBEDDING_MODEL']?.trim() || DEFAULT_MODELS[this.provider];
  }

  /** Dimensions of the vectors this service produces. Fixed by the schema. */
  get dimensions(): number {
    return EMBEDDING_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const provider = this.provider;
    const vectors =
      provider === 'openrouter'
        ? await this.embedOpenRouter(texts)
        : provider === 'voyage'
          ? await this.embedVoyage(texts)
          : await this.embedOpenAI(texts);

    return this.assertShape(vectors, texts.length, provider);
  }

  /**
   * A vector of the wrong length would be rejected by Postgres anyway, but the
   * error there names a column, not a provider. Checking here says which model
   * produced it and stops a partially-written batch.
   */
  private assertShape(
    vectors: number[][],
    expectedCount: number,
    provider: EmbeddingProvider,
  ): number[][] {
    if (vectors.length !== expectedCount) {
      throw new Error(
        `${provider} returned ${vectors.length} embeddings for ${expectedCount} inputs`,
      );
    }
    for (const vector of vectors) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `${provider} model '${this.model}' returned ${vector.length} dimensions, but agent_document_chunks.embedding_vec is vector(${EMBEDDING_DIMENSIONS}). Storing it would corrupt the index.`,
        );
      }
    }
    return vectors;
  }

  private requireKey(name: string, provider: EmbeddingProvider): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(
        `EMBEDDING_PROVIDER='${provider}' requires ${name}. There is no automatic fallback: another provider would produce vectors incomparable with the ones already stored.`,
      );
    }
    return value;
  }

  // ── OpenRouter (default) ──────────────────────────────────────────────────

  private async embedOpenRouter(texts: string[]): Promise<number[][]> {
    const apiKey = this.requireKey('OPEN_ROUTER_API_KEY', 'openrouter');
    const { default: axios } = await import('axios');

    const response = await axios.post<{
      data: Array<{ embedding: number[] }>;
    }>(
      'https://openrouter.ai/api/v1/embeddings',
      { input: texts, model: this.model, dimensions: EMBEDDING_DIMENSIONS },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.data?.data?.length) {
      throw new Error('OpenRouter returned empty embeddings');
    }
    return response.data.data.map((d) => d.embedding);
  }

  // ── Voyage AI ─────────────────────────────────────────────────────────────

  private async embedVoyage(texts: string[]): Promise<number[][]> {
    const apiKey = this.requireKey('VOYAGE_API_KEY', 'voyage');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { VoyageAIClient } = require('voyageai');
    const client = new VoyageAIClient({ apiKey });

    const response = await client.embed({ input: texts, model: this.model });
    if (!response.data?.length) {
      throw new Error('Voyage AI returned empty embeddings');
    }
    return (response.data as Array<{ embedding: number[] }>).map(
      (d) => d.embedding,
    );
  }

  // ── OpenAI directo ────────────────────────────────────────────────────────

  private async embedOpenAI(texts: string[]): Promise<number[][]> {
    const apiKey =
      process.env['OPENAI_PLATFORM_KEY'] ??
      this.requireKey('OPENAI_API_KEY', 'openai');
    const { default: axios } = await import('axios');

    const response = await axios.post<{
      data: Array<{ embedding: number[] }>;
    }>(
      'https://api.openai.com/v1/embeddings',
      // `dimensions` is what keeps this provider interchangeable with the other
      // two: without it text-embedding-3-small returns 1536 and never fits.
      { input: texts, model: this.model, dimensions: EMBEDDING_DIMENSIONS },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.data?.data?.length) {
      throw new Error('OpenAI returned empty embeddings');
    }
    return response.data.data.map((d) => d.embedding);
  }
}
