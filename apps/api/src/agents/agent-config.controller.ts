import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { AgentConfigService } from './agent-config.service';
import { AgentConfigResolverService } from './agent-config-resolver.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';

class UpsertAgentConfigDto {
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @IsString()
  @IsNotEmpty()
  model!: string;
}

@ApiTags('agent-config')
@ApiBearerAuth('access-token')
@Controller('users/me/agents')
@UseGuards(JwtAuthGuard)
export class AgentConfigController {
  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly agentConfigResolver: AgentConfigResolverService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get resolved configs for all agents' })
  getResolvedConfigs(@CurrentUser() user: RequestUser) {
    return this.agentConfigResolver.resolveAllConfigs(user.userId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check agent health (key availability)' })
  checkHealth(
    @CurrentUser() user: RequestUser,
    @Query('simulate') simulate?: string,
    @Query('provider') provider?: string,
  ) {
    const simulateProvider =
      simulate === 'remove' && provider ? (provider as LLMProvider) : undefined;
    return this.agentConfigResolver.checkHealth(user.userId, simulateProvider);
  }

  @Put(':agentId/config')
  @ApiOperation({ summary: 'Set user override for an agent model' })
  upsertConfig(
    @CurrentUser() user: RequestUser,
    @Param('agentId') agentId: string,
    @Body() dto: UpsertAgentConfigDto,
  ) {
    return this.agentConfigService.upsertUserAgentConfig(
      user.userId,
      agentId as AgentId,
      dto.provider,
      dto.model,
    );
  }

  @Delete(':agentId/config')
  @ApiOperation({ summary: 'Reset agent to default (remove user override)' })
  resetConfig(
    @CurrentUser() user: RequestUser,
    @Param('agentId') agentId: string,
  ) {
    return this.agentConfigService.deleteUserAgentConfig(
      user.userId,
      agentId as AgentId,
    );
  }

  // ── Presets ──────────────────────────────────────────────────────────────

  @Post('config/preset/:preset')
  @ApiOperation({
    summary:
      'Apply a model preset to all agents at once (free | optimized | balanced)',
  })
  applyPreset(
    @CurrentUser() user: RequestUser,
    @Param('preset') preset: string,
  ) {
    const valid = ['free', 'optimized', 'balanced'];
    if (!valid.includes(preset)) {
      throw new BadRequestException(
        `Invalid preset. Valid values: ${valid.join(', ')}`,
      );
    }
    return this.agentConfigService.applyPreset(
      user.userId,
      preset as 'free' | 'optimized' | 'balanced',
    );
  }
}
