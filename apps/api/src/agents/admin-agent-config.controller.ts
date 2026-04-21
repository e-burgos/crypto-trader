import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { AgentConfigService } from './agent-config.service';
import { AgentId, LLMProvider } from '../../generated/prisma/enums';
import { AgentPresetName } from './agent-presets';

class UpsertAdminAgentConfigDto {
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @IsString()
  @IsNotEmpty()
  model!: string;
}

@ApiTags('admin-agent-config')
@ApiBearerAuth('access-token')
@Controller('admin/agent-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAgentConfigController {
  constructor(private readonly agentConfigService: AgentConfigService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Get all admin default agent configs' })
  getAdminConfigs() {
    return this.agentConfigService.getAdminAgentConfigs();
  }

  @Post('preset/:preset')
  @ApiOperation({
    summary: '[ADMIN] Apply a model preset to all admin agent configs',
  })
  applyAdminPreset(
    @CurrentUser() user: RequestUser,
    @Param('preset') preset: string,
  ) {
    return this.agentConfigService.applyAdminPreset(
      preset as AgentPresetName,
      user.userId,
    );
  }

  @Put(':agentId')
  @ApiOperation({
    summary: '[ADMIN] Set default model for an agent',
  })
  upsertAdminConfig(
    @CurrentUser() user: RequestUser,
    @Param('agentId') agentId: string,
    @Body() dto: UpsertAdminAgentConfigDto,
  ) {
    return this.agentConfigService.upsertAdminAgentConfig(
      agentId as AgentId,
      dto.provider,
      dto.model,
      user.userId,
    );
  }
}
