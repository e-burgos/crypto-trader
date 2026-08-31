import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { LlmModule } from '../llm/llm.module';
import { AgentConfigModule } from '../agents/agent-config.module';
import { TradingModule } from '../trading/trading.module';
import { getJwtSecret } from '../common/config/env.config';

@Module({
  imports: [
    PrismaModule,
    OrchestratorModule,
    LlmModule,
    AgentConfigModule,
    TradingModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: getJwtSecret() }),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
