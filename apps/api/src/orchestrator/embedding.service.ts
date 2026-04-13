import { Injectable, Logger } from '@nestjs/common';

/**
 * Generates vector embeddings for text using Voyage AI (primary)
 * or OpenAI (fallback).
 *
 * Config via environment variables:
 *  VOYAGE_API_KEY     — Voyage AI key (voyage-3, 1024 dims)
 *  OPENAI_PLATFORM_KEY — OpenAI key reused for embeddings (text-embedding-3-small, 1536 dims)
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  /** Dimensions of the embedding vectors produced by this service. */
  get dimensions(): number {
    if (process.env.VOYAGE_API_KEY) return 1024;
    if (process.env.OPENAI_PLATFORM_KEY || process.env.OPENAI_API_KEY)
      return 1536;
    throw new Error(
      'No embedding provider configured. Set VOYAGE_API_KEY or OPENAI_PLATFORM_KEY.',
    );
  }

  /**
   * Embed a batch of texts.
   * Returns a list of Float[] vectors, one per input text.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (process.env.VOYAGE_API_KEY) {
      return this.embedVoyage(texts);
    }

    const openaiKey =
      process.env.OPENAI_PLATFORM_KEY ?? process.env.OPENAI_API_KEY;
    if (openaiKey) {
      return this.embedOpenAI(texts, openaiKey);
    }

    throw new Error(
      'No embedding provider configured. Set VOYAGE_API_KEY or OPENAI_PLATFORM_KEY.',
    );
  }

  // ── Voyage AI ─────────────────────────────────────────────────────────────

  private async embedVoyage(texts: string[]): Promise<number[][]> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { VoyageAIClient } = require('voyageai');
    const client = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY,
    });

    const response = await client.embed({
      input: texts,
      model: 'voyage-3',
    });

    if (!response.data?.length) {
      throw new Error('Voyage AI returned empty embeddings');
    }

    return (
      response.data as Array<{ embedding: number[] }>
    ).map((d) => d.embedding);
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────

  private async embedOpenAI(
    texts: string[],
    apiKey: string,
  ): Promise<number[][]> {
    const { default: axios } = await import('axios');

    const response = await axios.post<{
      data: Array<{ embedding: number[] }>;
    }>(
      'https://api.openai.com/v1/embeddings',
      {
        input: texts,
        model: 'text-embedding-3-small',
      },
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
