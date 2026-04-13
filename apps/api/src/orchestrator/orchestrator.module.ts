import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { SubAgentService } from './sub-agent.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OrchestratorService, SubAgentService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
