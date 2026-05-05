import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';
import { DataSourceRegistryService } from '../market/data-source-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt } from '../users/utils/encryption.util';
import type { DataSourceStatus } from '@crypto-trader/shared';

@ApiTags('admin/data-sources')
@ApiBearerAuth('access-token')
@Controller('admin/data-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DataSourcesController {
  constructor(
    private readonly registry: DataSourceRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] List all data sources with status' })
  @ApiResponse({ status: 200, description: 'List of all data sources' })
  async listAll(
    @CurrentUser() user: RequestUser,
  ): Promise<{ sources: DataSourceStatus[] }> {
    const configs = await this.registry.getAllConfigs();

    // Check which sources have credentials configured for this user
    const credentials = await this.prisma.dataSourceCredential.findMany({
      where: { userId: user.userId, isActive: true },
      select: { dataSourceId: true },
    });
    const credentialSet = new Set(credentials.map((c) => c.dataSourceId));

    const sources: DataSourceStatus[] = configs.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      displayName: cfg.displayName,
      category: cfg.category,
      isActive: cfg.isActive,
      priority: cfg.priority,
      targetAgents: cfg.targetAgents,
      requiresApiKey: cfg.requiresApiKey,
      baseUrl: cfg.baseUrl,
      rateLimitPerMin: cfg.rateLimitPerMin,
      pollingIntervalMs: cfg.pollingIntervalMs,
      monthlyCostUsd: cfg.monthlyCostUsd,
      lastSuccessAt: cfg.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: cfg.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: cfg.lastErrorMessage,
      consecutiveErrors: cfg.consecutiveErrors,
      health: this.registry.computeHealthStatus(cfg),
      hasUserCredential: credentialSet.has(cfg.id),
    }));
    return { sources };
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: '[ADMIN] Toggle a data source on/off' })
  @ApiResponse({ status: 200, description: 'Source toggled' })
  async toggle(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser() user: RequestUser,
  ) {
    const updated = await this.registry.toggleSource(id, body.isActive);

    // Audit log
    await this.prisma.adminAction.create({
      data: {
        adminId: user.userId,
        action: body.isActive ? 'DATA_SOURCE_ENABLED' : 'DATA_SOURCE_DISABLED',
        details: {
          dataSourceId: id,
          name: updated.name,
          isActive: body.isActive,
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
      toggledAt: new Date().toISOString(),
      toggledBy: user.userId,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Update data source config' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  async updateConfig(
    @Param('id') id: string,
    @Body()
    body: {
      priority?: number;
      rateLimitPerMin?: number;
      pollingIntervalMs?: number;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const updated = await this.registry.updateConfig(id, body);

    await this.prisma.adminAction.create({
      data: {
        adminId: user.userId,
        action: 'DATA_SOURCE_CONFIG_UPDATED',
        details: {
          dataSourceId: id,
          changes: body,
        },
      },
    });

    return updated;
  }

  @Get(':id/health')
  @ApiOperation({ summary: '[ADMIN] Health check for a specific data source' })
  @ApiResponse({ status: 200, description: 'Health check result' })
  async healthCheck(@Param('id') id: string) {
    const config = await this.prisma.dataSourceConfig.findUniqueOrThrow({
      where: { id },
    });
    return this.registry.checkHealth(config.name);
  }

  @Post('health-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Health check all active data sources' })
  @ApiResponse({ status: 200, description: 'Health check results for all' })
  async healthCheckAll() {
    return this.registry.checkHealthAll();
  }

  @Get('stats')
  @ApiOperation({
    summary: '[ADMIN] Stats: calls 24h, latencies, errors, uptime per source',
  })
  @ApiResponse({ status: 200, description: 'Data source stats' })
  async getStats() {
    const configs = await this.registry.getAllConfigs();
    const providerMetrics = this.registry.getProviderMetrics();
    return {
      sources: configs.map((cfg) => ({
        name: cfg.name,
        displayName: cfg.displayName,
        category: cfg.category,
        isActive: cfg.isActive,
        consecutiveErrors: cfg.consecutiveErrors,
        lastSuccessAt: cfg.lastSuccessAt?.toISOString() ?? null,
        lastErrorAt: cfg.lastErrorAt?.toISOString() ?? null,
        health: this.registry.computeHealthStatus(cfg),
        metrics: providerMetrics[cfg.name] ?? null,
      })),
      totalActive: configs.filter((c) => c.isActive).length,
      totalSources: configs.length,
      circuitBreakers: this.registry.getCircuitStates(),
      cache: this.registry.getCacheStats(),
      rateLimiter: this.registry.getRateLimiterStats(),
    };
  }

  @Put(':id/credential')
  @ApiOperation({ summary: '[ADMIN] Set API key for a data source' })
  @ApiResponse({ status: 200, description: 'API key saved (encrypted)' })
  async setCredential(
    @Param('id') id: string,
    @Body() body: { apiKey: string },
    @CurrentUser() user: RequestUser,
  ) {
    // Validate source exists
    await this.prisma.dataSourceConfig.findUniqueOrThrow({ where: { id } });

    // Encrypt the API key
    const { encrypted, iv } = encrypt(body.apiKey);

    // Upsert credential
    await this.prisma.dataSourceCredential.upsert({
      where: {
        userId_dataSourceId: {
          userId: user.userId,
          dataSourceId: id,
        },
      },
      create: {
        userId: user.userId,
        dataSourceId: id,
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
      },
      update: {
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
      },
    });

    // Audit log
    await this.prisma.adminAction.create({
      data: {
        adminId: user.userId,
        action: 'DATA_SOURCE_CREDENTIAL_SET',
        details: { dataSourceId: id },
      },
    });

    return { success: true, maskedKey: `***${body.apiKey.slice(-4)}` };
  }
}
