import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Process, Processor } from '@nestjs/bull';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { ChunkSplitter } from './rag.service';

export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

export interface ExtractTextJobData {
  documentId: string;
  agentId: string;
  fileName: string;
  mimeType: string;
  /** Base64-encoded file content */
  fileContent: string;
}

export interface EmbedChunksJobData {
  documentId: string;
  agentId: string;
  chunks: string[];
}

// ── Queue enqueuer (injectable service) ──────────────────────────────────────

@Injectable()
export class DocumentProcessorService {
  constructor(
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE)
    private readonly queue: Queue,
  ) {}

  async enqueueDocument(data: ExtractTextJobData): Promise<void> {
    await this.queue.add('extract-text', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }
}

// ── Bull processor ────────────────────────────────────────────────────────────

@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Process('extract-text')
  async extractText(job: Job<ExtractTextJobData>): Promise<void> {
    const { documentId, agentId, fileName, mimeType, fileContent } = job.data;
    this.logger.log(`Extracting text for document ${documentId}`);

    await this.prisma.agentDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const text = await this.extractTextFromBuffer(buffer, mimeType, fileName);

      const chunks = ChunkSplitter.split(text, {
        chunkSize: 512,
        overlap: 64,
      });

      this.logger.log(
        `Document ${documentId}: ${chunks.length} chunks extracted`,
      );

      // Enqueue embedding job
      await (job.queue as Queue).add(
        'embed-chunks',
        { documentId, agentId, chunks } as EmbedChunksJobData,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Text extraction failed for ${documentId}: ${msg}`);
      await this.prisma.agentDocument.update({
        where: { id: documentId },
        data: { status: 'ERROR', errorMsg: msg.slice(0, 500) },
      });
    }
  }

  @Process('embed-chunks')
  async embedChunks(job: Job<EmbedChunksJobData>): Promise<void> {
    const { documentId, agentId, chunks } = job.data;
    this.logger.log(
      `Embedding ${chunks.length} chunks for document ${documentId}`,
    );

    try {
      // Delete previous chunks (re-processing)
      await this.prisma.agentDocumentChunk.deleteMany({
        where: { documentId },
      });

      // Embed in batches of 20 to respect API rate limits
      const BATCH_SIZE = 20;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const vectors = await this.embeddingService.embed(batch);

        await this.prisma.agentDocumentChunk.createMany({
          data: batch.map((content, j) => ({
            id: `${documentId}-${i + j}`,
            documentId,
            agentId: agentId as any,
            content,
            chunkIndex: i + j,
            embedding: vectors[j] as any,
          })),
        });

        this.logger.debug(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} embedded`,
        );
      }

      await this.prisma.agentDocument.update({
        where: { id: documentId },
        data: { status: 'READY', processedAt: new Date() },
      });

      this.logger.log(`Document ${documentId} READY`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Embedding failed for document ${documentId}: ${msg}`,
      );
      await this.prisma.agentDocument.update({
        where: { id: documentId },
        data: { status: 'ERROR', errorMsg: msg.slice(0, 500) },
      });
    }
  }

  // ── Text extraction helpers ─────────────────────────────────────────────────

  private async extractTextFromBuffer(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<string> {
    const lowerName = fileName.toLowerCase();

    if (
      mimeType === 'application/pdf' ||
      lowerName.endsWith('.pdf')
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      return result.text ?? '';
    }

    // Plain text (MD, TXT)
    return buffer.toString('utf-8');
  }
}
