import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlatformLLMProviderService } from './platform-llm-provider.service';
import { LLMProvider } from '../../generated/prisma/enums';

@ApiTags('admin')
@Controller('admin/llm-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlatformLLMProviderController {
  constructor(
    private readonly platformLLMProviderService: PlatformLLMProviderService,
  ) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] List all LLM providers with their status' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  getAll() {
    return this.platformLLMProviderService.getAll();
  }

  @Put(':provider/toggle')
  @ApiOperation({ summary: '[ADMIN] Toggle LLM provider active status' })
  @ApiParam({ name: 'provider', description: 'LLM provider enum value' })
  @ApiResponse({ status: 200, description: 'Toggle result with impact' })
  @ApiResponse({ status: 400, description: 'Invalid provider' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  toggle(
    @Param('provider') provider: string,
    @Body() dto: { isActive: boolean },
    @Req() req: any,
  ) {
    // Validate provider is a valid enum value
    if (!Object.values(LLMProvider).includes(provider as LLMProvider)) {
      throw new BadRequestException(`Invalid LLM provider: ${provider}`);
    }

    return this.platformLLMProviderService.toggle(
      provider as LLMProvider,
      dto.isActive,
      req.user.userId,
    );
  }
}

@ApiTags('llm')
@Controller('llm-providers')
@UseGuards(JwtAuthGuard)
export class LLMProviderStatusController {
  constructor(
    private readonly platformLLMProviderService: PlatformLLMProviderService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get platform LLM provider status' })
  @ApiResponse({ status: 200, description: 'List of providers with status' })
  getStatus() {
    return this.platformLLMProviderService.getAll();
  }
}
