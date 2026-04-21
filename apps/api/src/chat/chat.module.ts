import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';

@Module({
  imports: [
    PrismaModule,
    OrchestratorModule,
    LlmModule,
    AgentConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
