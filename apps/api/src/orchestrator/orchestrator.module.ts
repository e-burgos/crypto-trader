import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { EmbeddingService } from './embedding.service';
import { RagService } from './rag.service';
import { DecisionGateService } from './decision-gate.service';
import {
  DocumentProcessorService,
  DocumentProcessor,
  DOCUMENT_PROCESSING_QUEUE,
} from './document-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';
import { SharedCacheModule } from '../cache/shared-cache.module';

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    AgentConfigModule,
    SharedCacheModule,
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
  ],
  providers: [
    OrchestratorService,
    SubAgentService,
    EmbeddingService,
    RagService,
    DocumentProcessorService,
    DocumentProcessor,
    DecisionGateService,
  ],
  exports: [
    OrchestratorService,
    SubAgentService,
    RagService,
    DocumentProcessorService,
    DecisionGateService,
  ],
})
export class OrchestratorModule {}
