import { Module } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { AgentConfigResolverService } from './agent-config-resolver.service';
import { AgentConfigController } from './agent-config.controller';
import { AdminAgentConfigController } from './admin-agent-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';

@Module({
  imports: [PrismaModule, OpenRouterModule],
  controllers: [AgentConfigController, AdminAgentConfigController],
  providers: [AgentConfigService, AgentConfigResolverService],
  exports: [AgentConfigService, AgentConfigResolverService],
})
export class AgentConfigModule {}
