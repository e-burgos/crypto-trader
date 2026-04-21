import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { EmbeddingService } from './embedding.service';
import { RagService } from './rag.service';
import {
  DocumentProcessorService,
  DocumentProcessor,
  DOCUMENT_PROCESSING_QUEUE,
} from './document-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    AgentConfigModule,
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
  ],
  providers: [
    OrchestratorService,
    SubAgentService,
    EmbeddingService,
    RagService,
    DocumentProcessorService,
    DocumentProcessor,
  ],
  exports: [
    OrchestratorService,
    SubAgentService,
    RagService,
    DocumentProcessorService,
  ],
})
export class OrchestratorModule {}
