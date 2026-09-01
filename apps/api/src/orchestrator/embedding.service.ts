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
 * The vector space every stored chunk shares. NOTHING IN THE DATABASE ENFORCES
 * THIS: migration 20260413184109 dropped the `embedding_vec vector(1024)` column
 * and its ivfflat index as collateral damage of a Prisma-generated migration, so
 * embeddings now live in a jsonb column that accepts any length. assertShape() is
 * the only thing standing between a provider change and an index of mixed,
 * incomparable vectors. 1024 is kept because it is what the dropped column used
 * and what every stored chunk already has.
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
   * The jsonb column accepts a vector of ANY length without complaining, so this
   * check is not belt-and-braces: it is the only enforcement there is.
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
          `${provider} model '${this.model}' returned ${vector.length} dimensions, but every stored chunk has ${EMBEDDING_DIMENSIONS}. The jsonb column would accept it silently and the index would stop being comparable.`,
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
